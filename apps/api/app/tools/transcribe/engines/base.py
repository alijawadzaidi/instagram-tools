"""The transcription engine contract. Implementations are swappable via config."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol


@dataclass
class Segment:
    start: float
    end: float
    text: str


@dataclass
class Transcript:
    text: str
    segments: list[Segment] = field(default_factory=list)
    language: str | None = None

    def to_dict(self) -> dict:
        return {
            "text": self.text,
            "segments": [s.__dict__ for s in self.segments],
            "language": self.language,
        }


class Engine(Protocol):
    """Anything that turns an audio file into a Transcript."""

    def transcribe(self, audio_path: str) -> Transcript: ...
