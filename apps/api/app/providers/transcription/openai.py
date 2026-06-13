"""Cloud transcription via OpenAI's Whisper API. The production default.

Fast, no local compute. Costs ~$0.006/min and needs OPENAI_API_KEY.
"""

from __future__ import annotations

from app.core.config import settings
from app.core.errors import EngineError

from .base import Engine, Segment, Transcript


class OpenAIEngine(Engine):
    def __init__(self) -> None:
        if not settings.openai_api_key:
            raise EngineError("OPENAI_API_KEY is not set.")
        try:
            from openai import OpenAI
        except ImportError as e:
            raise EngineError(
                "openai is not installed. Run `pip install openai`."
            ) from e
        self._client = OpenAI(api_key=settings.openai_api_key)

    def transcribe(self, audio_path: str) -> Transcript:
        with open(audio_path, "rb") as f:
            resp = self._client.audio.transcriptions.create(
                model="whisper-1",
                file=f,
                response_format="verbose_json",
            )
        segments = [
            Segment(start=s["start"], end=s["end"], text=s["text"].strip())
            for s in (getattr(resp, "segments", None) or [])
        ]
        return Transcript(
            text=resp.text.strip(),
            segments=segments,
            language=getattr(resp, "language", None),
        )
