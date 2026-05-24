"""Request/response models for the download tool."""

from __future__ import annotations

from pydantic import BaseModel, Field


class FormatsRequest(BaseModel):
    url: str = Field(..., description="Instagram reel/post URL.")


class QualityOption(BaseModel):
    id: str  # "best" | width like "720" | "audio" (pass back as ?quality=)
    label: str
    width: int | None = None
    height: int | None = None
    filesize: int | None = None


class FormatsResponse(BaseModel):
    shortcode: str
    qualities: list[QualityOption]
    audio_available: bool


class ZipRequest(BaseModel):
    urls: list[str] = Field(..., min_length=1, max_length=50)
    quality: str = Field(default="best", description='Quality id, or "audio".')


class CoverRequest(BaseModel):
    url: str = Field(..., description="Instagram reel/post URL.")


class CoverResponse(BaseModel):
    shortcode: str
    cover_url: str | None = None
