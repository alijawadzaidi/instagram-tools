"""Orchestrates the 3-stage pipeline: download -> extract audio -> transcribe."""

from __future__ import annotations

import tempfile

from app.core.config import settings
from app.integrations.instagram import extractor
from app.integrations.instagram.hashtags import extract_hashtags
from app.media.audio import extract_audio
from app.media.downloader import download_video
from app.providers.transcription import get_engine


def transcribe_reel(url: str, engine_name: str | None = None) -> dict:
    """Run the full pipeline for one reel and return a transcript dict.

    Temp files live in a TemporaryDirectory that's removed on exit, so nothing
    is left on disk. Raises typed ToolErrors on known failures.
    """
    engine = get_engine(engine_name or settings.transcribe_engine)

    with tempfile.TemporaryDirectory(prefix="transcribe_") as tmp:
        video_path = download_video(url, tmp)
        audio_path = extract_audio(video_path, tmp)
        transcript = engine.transcribe(audio_path)

    result = transcript.to_dict()
    # Caption + hashtags come free from the reel's metadata (no audio needed).
    caption = extractor.get_caption(url)
    result["caption"] = caption
    result["hashtags"] = extract_hashtags(caption)
    return result
