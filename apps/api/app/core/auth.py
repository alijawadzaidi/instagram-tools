"""FastAPI dependency that enforces the internal service key.

Every request must carry the X-Internal-Key header set by the Next.js BFF
proxy. Direct calls from the browser (or anyone who doesn't know the key)
are rejected with 401.
"""

from __future__ import annotations

from fastapi import Header, HTTPException

from app.core.config import settings


# include_in_schema=False: the BFF proxy injects this header, so it must not
# appear in the OpenAPI contract (otherwise the generated client would require
# every caller to pass it).
async def require_internal_key(
    x_internal_key: str = Header(..., include_in_schema=False),
) -> None:
    if not settings.internal_api_key or x_internal_key != settings.internal_api_key:
        raise HTTPException(status_code=401, detail="Unauthorized")


async def current_user_id(
    x_user_id: str | None = Header(default=None, include_in_schema=False),
) -> str | None:
    """The signed-in user id forwarded by the BFF proxy. Used to attribute job
    cost/quota to a user (paid product). Also hidden from the OpenAPI schema."""
    return x_user_id
