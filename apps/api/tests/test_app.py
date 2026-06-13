"""Smoke tests for app wiring: auto-discovered routers, the global ToolError
handler, and the internal-key dependency."""

from fastapi.testclient import TestClient

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
