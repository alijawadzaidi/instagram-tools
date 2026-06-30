"""Smoke tests for app wiring: auto-discovered routers, the global ToolError
handler, and the internal-key dependency."""

import asyncio

import pytest
from fastapi.testclient import TestClient

from app.core.auth import current_user_id, require_internal_key
from app.core.config import Settings, settings
from app.core.errors import RateLimitedError
from app.main import app


def test_health():
    with TestClient(app) as c:
        r = c.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"


def test_tool_routers_auto_discovered():
    paths = {route.path for route in app.routes}
    # one endpoint from each tool module proves auto-discovery ran
    assert "/tools/transcribe" in paths
    assert "/tools/profile/reels" in paths
    assert "/tools/download/formats" in paths


def test_tool_error_handler_returns_code_and_message():
    app.add_api_route("/_test/boom", _boom, methods=["GET"])
    with TestClient(app) as c:
        r = c.get("/_test/boom")
        assert r.status_code == 429
        body = r.json()
        assert body["code"] == "rate_limited"
        assert "message" in body


def _boom():
    raise RateLimitedError()


def test_internal_key_required():
    with TestClient(app) as c:
        # missing the internal-key header -> rejected (422 validation, never 200)
        r = c.post("/tools/profile/info", json={"username": "x"})
        assert r.status_code != 200


def test_auth_bypassed_property():
    assert Settings(auth_disabled=True, environment="development").auth_bypassed
    # never bypass in production, even if explicitly disabled
    assert not Settings(auth_disabled=True, environment="production").auth_bypassed
    assert not Settings(auth_disabled=False).auth_bypassed


def test_current_user_id_dev_fallback(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", True)
    monkeypatch.setattr(settings, "environment", "development")
    # no forwarded id -> synthetic dev user
    assert asyncio.run(current_user_id(None)) == settings.dev_user_id
    # a real forwarded id still wins
    assert asyncio.run(current_user_id("u_123")) == "u_123"


def test_require_internal_key_noop_when_bypassed(monkeypatch):
    monkeypatch.setattr(settings, "auth_disabled", True)
    monkeypatch.setattr(settings, "environment", "development")
    # would normally raise (no header / no configured key); bypass lets it pass
    assert asyncio.run(require_internal_key(None)) is None


def test_validate_required_relaxed_when_bypassed():
    # bypassed: no DB, no internal key -> startup still allowed (no-infra dev mode)
    Settings(
        auth_disabled=True,
        environment="development",
        database_url="",
        internal_api_key="",
    ).validate_required()
    # not bypassed: DB + internal key are still required
    with pytest.raises(RuntimeError):
        Settings(
            auth_disabled=False, database_url="", internal_api_key=""
        ).validate_required()


def test_dev_sqlite_fallback_when_bypassed(monkeypatch, tmp_path):
    """No DATABASE_URL + auth bypassed -> a local SQLite engine with the jobs
    table ready, so job-based tools run without Postgres. Not bypassed -> raise."""
    from sqlalchemy import inspect

    from app.core import db

    monkeypatch.setattr(db, "_DEV_DB_PATH", tmp_path / "dev.db")
    monkeypatch.setattr(db.settings, "database_url", "")
    monkeypatch.setattr(db.settings, "auth_disabled", True)
    monkeypatch.setattr(db.settings, "environment", "development")
    db.get_engine.cache_clear()
    try:
        engine = db.get_engine()
        assert engine.dialect.name == "sqlite"
        assert "jobs" in inspect(engine).get_table_names()
    finally:
        db.get_engine.cache_clear()

    # without the bypass, a missing DATABASE_URL is still a hard error
    monkeypatch.setattr(db.settings, "auth_disabled", False)
    db.get_engine.cache_clear()
    try:
        with pytest.raises(RuntimeError):
            db.get_engine()
    finally:
        db.get_engine.cache_clear()
