import uuid
from typing import Optional

from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.core.db import Base

# JSONB on Postgres (queryable, indexable), plain JSON elsewhere (e.g. SQLite in
# tests). One column type that works on both.
JsonType = JSON().with_variant(JSONB, "postgresql")


class Job(Base):
    __tablename__ = "jobs"

    # Optional[...] (not `X | None`): SQLAlchemy evaluates Mapped[] annotations
    # at runtime, and PEP 604 unions need Python 3.10+. Dev runs 3.9.

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: uuid.uuid4().hex)
    tool: Mapped[str] = mapped_column(String, nullable=False, index=True)
    status: Mapped[str] = mapped_column(String, nullable=False, default="pending", index=True)

    # Who enqueued it (from the BFF's x-user-id). Load-bearing for the paid
    # product: quota enforcement + cost attribution.
    user_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    # The inputs needed to (re)run the job — makes work reconstructable from the
    # row (not a Python closure), the prerequisite for a durable queue / worker.
    params: Mapped[Optional[dict]] = mapped_column(JsonType, nullable=True)

    # Deprecated: superseded by params["url"]; kept nullable for old rows.
    input_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    result: Mapped[Optional[dict]] = mapped_column(JsonType, nullable=True)
    error_code: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Spend accounting for AI tools (LLM token usage -> cents).
    tokens_in: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tokens_out: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    cost_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    created_at: Mapped[str] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    updated_at: Mapped[Optional[str]] = mapped_column(
        DateTime(timezone=True), onupdate=func.now(), nullable=True
    )
