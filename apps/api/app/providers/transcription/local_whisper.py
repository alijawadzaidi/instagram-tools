"""Local transcription with faster-whisper. Free, offline, no API key.

The dev default. On a server without a GPU this is slow — production should use
a cloud engine instead (see config.transcribe_engine).
"""

from __future__ import annotations

from app.core.config import settings
from app.core.errors import EngineError

from .base import Engine, Segment, Transcript


class LocalWhisperEngine(Engine):
    def __init__(self) -> None:
        try:
            from faster_whisper import WhisperModel
        except ImportError as e:
            raise EngineError(
                "faster-whisper is not installed. Run `pip install faster-whisper`, "
                "or set TRANSCRIBE_ENGINE to a cloud engine."
            ) from e

        # CPU + int8 is the safe default; loads the model once per process.
        self._model = WhisperModel(settings.whisper_model, device="cpu", compute_type="int8")

    def transcribe(self, audio_path: str) -> Transcript:
        segments_iter, info = self._model.transcribe(audio_path)
        segments = [
            Segment(start=s.start, end=s.end, text=s.text.strip())
            for s in segments_iter
        ]
        text = " ".join(s.text for s in segments).strip()
        return Transcript(text=text, segments=segments, language=info.language)
