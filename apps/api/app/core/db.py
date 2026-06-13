"""Database engine + session, created lazily (not at import time).

The engine is built on first use behind a cache, so importing the app (e.g. to
export the OpenAPI schema, or in tests that don't touch the DB) never requires a
real DATABASE_URL. Consolidates the old db/base.py + db/session.py.
"""

from __future__ import annotations

from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session
from sqlalchemy.orm import sessionmaker as _sessionmaker

from app.core.config import settings


class Base(DeclarativeBase):
    pass


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    if not settings.database_url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env and set it."
        )
    return create_engine(settings.database_url, pool_pre_ping=True)


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
