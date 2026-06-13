"""Profile tool service — the product logic, separate from HTTP transport.

Thin today (it delegates to the Instagram integration), but it's the mandatory
per-tool seam: routers call services, services compose integrations/providers.
"""

from __future__ import annotations

from app.integrations.instagram.profile import (
    ProfileInfo,
    ReelsPage,
    get_profile,
    get_reels_page,
)

__all__ = ["list_reels", "get_profile_info", "ReelsPage", "ProfileInfo"]


def list_reels(username: str, cursor: str | None, page_size: int) -> ReelsPage:
    return get_reels_page(username, cursor=cursor, page_size=page_size)


def get_profile_info(username: str) -> ProfileInfo:
    return get_profile(username)
