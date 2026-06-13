"""Per-user quota enforcement seam.

The paid product (Architecture/04, open question #2 = "paid product planned")
will gate AI tools on per-user credits/limits. This is the one place that
decision lands — called at enqueue time — so adding real limits later touches no
tool code. No limits are enforced yet.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.core.errors import ToolError


class QuotaExceededError(ToolError):
    code = "quota_exceeded"
    http_status = 402  # Payment Required

    def __init__(self, message: str = "You've reached your usage limit."):
        super().__init__(message)


def check_quota(db: Session, user_id: str | None, tool: str) -> None:
    """Raise QuotaExceededError if the user is over their limit. No-op today."""
    # TODO(billing): enforce per-user credits / daily caps here using the
    # jobs table's user_id + cost_cents columns.
    return
