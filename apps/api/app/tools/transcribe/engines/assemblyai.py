"""Cloud transcription via AssemblyAI. Adds speaker labels + word timestamps.

Use this engine when we want subtitles/diarization. Needs ASSEMBLYAI_API_KEY.
"""

from __future__ import annotations

from ....config import settings
from ....shared.errors import EngineError
from .base import Engine, Segment, Transcript


class AssemblyAIEngine(Engine):
    def __init__(self) -> None:
        if not settings.assemblyai_api_key:
            raise EngineError("ASSEMBLYAI_API_KEY is not set.")
        try:
            import assemblyai as aai
        except ImportError as e:
            raise EngineError(
                "assemblyai is not installed. Run `pip install assemblyai`."
            ) from e
        aai.settings.api_key = settings.assemblyai_api_key
        self._aai = aai

    def transcribe(self, audio_path: str) -> Transcript:
        aai = self._aai
        config = aai.TranscriptionConfig(speaker_labels=True)
        transcript = aai.Transcriber().transcribe(audio_path, config)

        if transcript.status == aai.TranscriptStatus.error:
            raise EngineError(f"AssemblyAI failed: {transcript.error}")

        segments = [
            Segment(
                start=(u.start or 0) / 1000,
                end=(u.end or 0) / 1000,
                text=u.text.strip(),
            )
            for u in (transcript.utterances or [])
        ]
        return Transcript(text=(transcript.text or "").strip(), segments=segments)
