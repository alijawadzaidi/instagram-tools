from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.config import settings

# The engine is created at import time (moves into the app factory in Phase 4
# of Architecture/04). Guard here so a missing DATABASE_URL fails with an
# actionable message instead of a sqlalchemy parse error.
if not settings.database_url:
    raise RuntimeError(
        "DATABASE_URL is not set. Copy apps/api/.env.example to apps/api/.env and set it."
    )

engine = create_engine(settings.database_url, pool_pre_ping=True)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
