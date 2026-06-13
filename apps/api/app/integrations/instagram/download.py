"""Download an Instagram reel at a chosen quality (or audio-only).

We use **yt-dlp** for this — it's the canonical tool for enumerating Instagram's
quality ladder (it parses the DASH manifest the raw GraphQL endpoint doesn't
reliably expose) and it auto-muxes video+audio / extracts audio via ffmpeg. No
reinventing. Cookie-aware (effectively required when hosted). Reused by both the
single-reel and profile tools.

Note: reels are portrait, so the user-facing "quality" tracks the **width**
(1080 / 720 / 540 / 360), not the height. We surface the resolutions yt-dlp
actually reports rather than guessing fixed buckets.
"""

from __future__ import annotations

import os

from app.core.config import settings
from app.core.errors import DownloadError, NotFoundError, PrivateContentError, RateLimitedError

from .extractor import extract_shortcode


def _base_opts() -> dict:
    return {
        "quiet": True,
        "noprogress": True,
        "retries": settings.download_retries,
        "socket_timeout": settings.download_timeout,
        "cookiefile": settings.ig_cookies_file or None,
    }


def _classify(message: str) -> Exception:
    m = message.lower()
    if "login required" in m or "private" in m or "log in" in m:
        return PrivateContentError()
    if ("rate" in m and "limit" in m) or "429" in m or "temporarily blocked" in m:
        return RateLimitedError()
    if "not found" in m or "404" in m or "unavailable" in m:
        return NotFoundError()
    return DownloadError(f"Download failed: {message}")


def list_qualities(url: str) -> dict:
    """Return the download options actually available for this reel.

    Shape: { shortcode, qualities: [{id,label,width,height,filesize}], audio_available }
    `id` is "best" or a width string (e.g. "720"); pass it back as ?quality=.
    """
    import yt_dlp

    try:
        with yt_dlp.YoutubeDL(_base_opts()) as ydl:
            info = ydl.extract_info(url, download=False)
    except yt_dlp.utils.DownloadError as e:
        raise _classify(str(e)) from e

    formats = info.get("formats") or []
    audio_available = any(f.get("acodec") not in (None, "none") for f in formats)

    # Distinct video resolutions, biggest first, deduped by width.
    by_width: dict[int, dict] = {}
    for f in formats:
        w, h = f.get("width"), f.get("height")
        if not w or not h or f.get("vcodec") in (None, "none"):
            continue
        if w not in by_width or (f.get("filesize") or 0) > (by_width[w].get("filesize") or 0):
            by_width[w] = {
                "width": w,
                "height": h,
                "filesize": f.get("filesize") or f.get("filesize_approx"),
            }

    qualities = [
        {"id": "best", "label": "Best available", "width": None, "height": None, "filesize": None}
    ]
    for w in sorted(by_width, reverse=True):
        r = by_width[w]
        qualities.append(
            {
                "id": str(w),
                "label": f"{w}p ({w}×{r['height']})",
                "width": w,
                "height": r["height"],
                "filesize": r["filesize"],
            }
        )

    return {
        "shortcode": extract_shortcode(url) or "",
        "qualities": qualities,
        "audio_available": audio_available,
    }


def _selector(quality: str) -> str:
    if quality == "best":
        return "bestvideo*+bestaudio/best"
    if quality.isdigit():  # a width, e.g. "720"
        w = int(quality)
        return f"bestvideo[width<={w}]+bestaudio/best[width<={w}]/best"
    return "bestvideo*+bestaudio/best"


def download_one(url: str, quality: str, out_dir: str) -> tuple[str, str]:
    """Download `url` at `quality` into `out_dir`.

    `quality` is "best", a width string like "720", or "audio" (audio-only mp3).
    Returns (file_path, suggested_filename).
    """
    import yt_dlp

    shortcode = extract_shortcode(url) or "reel"
    opts = _base_opts()
    opts["outtmpl"] = os.path.join(out_dir, "%(id)s.%(ext)s")

    if quality == "audio":
        opts["format"] = "bestaudio/best"
        opts["postprocessors"] = [
            {"key": "FFmpegExtractAudio", "preferredcodec": "mp3", "preferredquality": "192"}
        ]
        expected_ext = "mp3"
        suffix = "audio"
    else:
        opts["format"] = _selector(quality)
        opts["merge_output_format"] = "mp4"
        expected_ext = "mp4"
        suffix = quality if quality.isdigit() else "best"

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])
    except yt_dlp.utils.DownloadError as e:
        raise _classify(str(e)) from e

    produced = [f for f in os.listdir(out_dir) if not f.endswith(".part")]
    if not produced:
        raise DownloadError("Download produced no file.")
    produced.sort(key=lambda f: (not f.endswith(expected_ext)))
    path = os.path.join(out_dir, produced[0])

    ext = os.path.splitext(path)[1] or f".{expected_ext}"
    filename = f"reel-{shortcode}-{suffix}{ext}"
    return path, filename
