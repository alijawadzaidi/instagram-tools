"""Request/response models for the profile-reels tool."""

from __future__ import annotations

from pydantic import BaseModel, Field


class ProfileReelsRequest(BaseModel):
    username: str = Field(..., description="Instagram username (with or without @).")
    cursor: str | None = Field(
        default=None, description="Opaque cursor from a previous page; omit for page 1."
    )
    page_size: int = Field(default=12, ge=1, le=50, description="Reels per page.")


class ReelSummaryModel(BaseModel):
    shortcode: str
    url: str
    thumbnail_url: str | None = None
    caption: str = ""
    hashtags: list[str] = []
    view_count: int | None = None


class ProfileReelsResponse(BaseModel):
    username: str
    reels: list[ReelSummaryModel]
    next_cursor: str | None = None  # null when there are no more reels
