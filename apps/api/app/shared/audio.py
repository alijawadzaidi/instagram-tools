"""Audio extraction via ffmpeg. Reused by any tool that needs audio from video."""

from __future__ import annotations

import os
import shutil
import subprocess

from .errors import EngineError


def extract_audio(video_path: str, out_dir: str) -> str:
    """Extract a 16kHz mono WAV from `video_path`.

    16kHz mono is what speech models want, and it keeps the file small for
    cloud engines that upload the audio. Returns the WAV path.
    """
    if shutil.which("ffmpeg") is None:
        raise EngineError("ffmpeg is not installed on the server.")

    audio_path = os.path.join(out_dir, "audio.wav")
    cmd = [
        "ffmpeg",
        "-i", video_path,
        "-vn",                # drop video
        "-ac", "1",           # mono
        "-ar", "16000",       # 16 kHz
        "-f", "wav",
        "-y",                 # overwrite
        audio_path,
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise EngineError(f"ffmpeg failed to extract audio: {proc.stderr[-500:]}")
    return audio_path
