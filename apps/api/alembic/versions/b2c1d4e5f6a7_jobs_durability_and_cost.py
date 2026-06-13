"""jobs: durability + cost columns

Adds user_id, params (JSONB), token/cost accounting, and indexes — the schema
the durable queue and the paid AI tools need (Architecture/04 Phase 5).

Revision ID: b2c1d4e5f6a7
Revises: 3a7b740b4593
Create Date: 2026-06-13 00:00:00.000000
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "b2c1d4e5f6a7"
down_revision: Union[str, Sequence[str], None] = "3a7b740b4593"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("user_id", sa.String(), nullable=True))
    op.add_column("jobs", sa.Column("params", postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column("jobs", sa.Column("tokens_in", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("tokens_out", sa.Integer(), nullable=True))
    op.add_column("jobs", sa.Column("cost_cents", sa.Integer(), nullable=True))

    op.create_index("ix_jobs_tool", "jobs", ["tool"])
    op.create_index("ix_jobs_status", "jobs", ["status"])
    op.create_index("ix_jobs_user_id", "jobs", ["user_id"])
    op.create_index("ix_jobs_created_at", "jobs", ["created_at"])


def downgrade() -> None:
    op.drop_index("ix_jobs_created_at", table_name="jobs")
    op.drop_index("ix_jobs_user_id", table_name="jobs")
    op.drop_index("ix_jobs_status", table_name="jobs")
    op.drop_index("ix_jobs_tool", table_name="jobs")

    op.drop_column("jobs", "cost_cents")
    op.drop_column("jobs", "tokens_out")
    op.drop_column("jobs", "tokens_in")
    op.drop_column("jobs", "params")
    op.drop_column("jobs", "user_id")
