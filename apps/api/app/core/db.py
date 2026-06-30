"""Database engine + session, created lazily (not at import time).

The engine is built on first use behind a cache, so importing the app (e.g. to
export the OpenAPI schema, or in tests that don't touch the DB) never requires a
real DATABASE_URL. Consolidates the old db/base.py + db/session.py.
"""

from __future__ import annotations

import logging
from collections.abc import Iterator
from functools import lru_cache
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.orm import sessionmaker as _sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


# No-infra dev mode persists jobs here (apps/api/dev.db) when no DATABASE_URL is
# set. Anchored to the api dir so it's stable regardless of the process cwd.
_DEV_DB_PATH = Path(__file__).resolve().parents[2] / "dev.db"


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    if not settings.database_url:
        # No-infra dev mode (auth bypassed, no DATABASE_URL): fall back to a local
        # SQLite file so job-based tools work without provisioning Postgres.
        if settings.auth_bypassed:
            return _dev_sqlite_engine()
        raise RuntimeError(
            "DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env and set it."
        )
    return create_engine(settings.database_url, pool_pre_ping=True)


def _dev_sqlite_engine() -> Engine:
    """A local SQLite engine for no-infra dev mode. Tables are created on the fly
    here (this dev DB skips Alembic migrations). `check_same_thread=False` because
    the in-process job runner touches the DB from a worker thread."""
    import app.models.job  # noqa: F401 — register the Job table on Base.metadata

    logging.getLogger("app").warning(
        "No DATABASE_URL set; using local SQLite dev DB at %s (auth bypassed). "
        "Job durability is local-only — never use this in production.",
        _DEV_DB_PATH,
    )
    engine = create_engine(
        f"sqlite:///{_DEV_DB_PATH}",
        connect_args={"check_same_thread": False},
    )
    Base.metadata.create_all(engine)
    return engine


@lru_cache(maxsize=1)
def _session_factory() -> _sessionmaker:
    return _sessionmaker(bind=get_engine(), autocommit=False, autoflush=False)


def SessionLocal() -> Session:
    """A new SQLAlchemy session (engine/factory are created lazily on first call)."""
    return _session_factory()()


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
