"""HTTP endpoint for the profile-reels tool.

POST /tools/profile/reels  { "username": "...", "cursor": null, "page_size": 12 }
  -> { "username": "...", "reels": [...], "next_cursor": "..." | null }

Cursor-based: omit `cursor` for the first page; pass the returned `next_cursor`
to load the next page. One Instagram call per page. Listing is fast, so it's
synchronous. Transcribing selected reels reuses the /tools/transcribe flow.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from ...shared.auth import require_internal_key
from ...shared.errors import ToolError
from ...shared.ig_profile import get_profile, get_reels_page
from .schemas import (
    ProfileInfoRequest,
    ProfileInfoResponse,
    ProfileReelsRequest,
    ProfileReelsResponse,
)

router = APIRouter(
    prefix="/tools/profile",
    tags=["profile"],
    dependencies=[Depends(require_internal_key)],
)


@router.post("/reels", response_model=ProfileReelsResponse)
async def list_reels(req: ProfileReelsRequest) -> ProfileReelsResponse:
    try:
        page = get_reels_page(req.username, cursor=req.cursor, page_size=req.page_size)
    except ToolError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e

    return ProfileReelsResponse(
        username=req.username.lstrip("@").strip(),
        reels=[r.to_dict() for r in page.reels],
        next_cursor=page.next_cursor,
    )


@router.post("/info", response_model=ProfileInfoResponse)
async def info(req: ProfileInfoRequest) -> ProfileInfoResponse:
    try:
        return ProfileInfoResponse(**get_profile(req.username).to_dict())
    except ToolError as e:
        raise HTTPException(status_code=e.http_status, detail=e.message) from e
