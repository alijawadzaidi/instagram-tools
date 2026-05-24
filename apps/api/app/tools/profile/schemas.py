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
    taken_at: int | None = None


class ProfileReelsResponse(BaseModel):
    username: str
    reels: list[ReelSummaryModel]
    next_cursor: str | None = None  # null when there are no more reels


class ProfileInfoRequest(BaseModel):
    username: str = Field(..., description="Instagram username (with or without @).")


class ProfileInfoResponse(BaseModel):
    username: str
    full_name: str = ""
    biography: str = ""
    follower_count: int | None = None
    following_count: int | None = None
    post_count: int | None = None
    is_verified: bool = False
    is_private: bool = False
    profile_pic_url: str | None = None
    external_url: str | None = None
    category: str | None = None
