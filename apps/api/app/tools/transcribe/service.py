"""Orchestrates the 3-stage pipeline: download -> extract audio -> transcribe."""

from __future__ import annotations

import tempfile

from ...config import settings
from ...shared import ig_extractor
from ...shared.audio import extract_audio
from ...shared.downloader import download_video
from ...shared.hashtags import extract_hashtags
from .engines import get_engine


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
    caption = ig_extractor.get_caption(url)
    result["caption"] = caption
    result["hashtags"] = extract_hashtags(caption)
    return result
