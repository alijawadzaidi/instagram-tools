"""Request/response models for the transcribe tool."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

Engine = Literal["local_whisper", "openai", "assemblyai"]


class TranscribeRequest(BaseModel):
    url: str = Field(..., description="Instagram reel/post URL.")
    engine: Engine | None = Field(
        default=None, description="Override the default engine."
    )


class Segment(BaseModel):
    start: float
    end: float
    text: str


class TranscriptResult(BaseModel):
    text: str
    segments: list[Segment] = []
    language: str | None = None
    caption: str = ""
    hashtags: list[str] = []


class JobResponse(BaseModel):
    job_id: str
    status: Literal["pending", "running", "done", "error"]
    result: TranscriptResult | None = None
    error_code: str | None = None
    error: str | None = None
