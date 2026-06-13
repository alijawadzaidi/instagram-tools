"""Instagram video downloader.

Two strategies, tried in order:

1. **Direct extractor** (`integrations.instagram.extractor`) — resolves the CDN
   MP4 URL straight from
   Instagram's GraphQL/embed endpoints, no login, no yt-dlp. This is the technique
   the public downloader sites use; it's fast and dependency-light.
2. **yt-dlp fallback** — if the direct method fails (Instagram changed something),
   fall back to yt-dlp, which the community patches quickly.

Both support cookies (effectively required when hosted, since Instagram blocks
data-center IPs) and classify failures into typed errors. Reused by every tool
that needs the source video.
"""

from __future__ import annotations

import os
import urllib.error
import urllib.request

from app.core.config import settings
from app.core.errors import (
    DownloadError,
    NotFoundError,
    PrivateContentError,
    RateLimitedError,
    ToolError,
)
from app.integrations.instagram import extractor, http

_CHUNK = 1 << 16


def download_video(url: str, out_dir: str) -> str:
    """Download the reel/post at `url` into `out_dir`. Returns the video path.

    Tries the direct extractor first, then yt-dlp. Raises a typed `ToolError`
    subclass on known failure modes.
    """
    try:
        video_url = extractor.get_video_url(url)
        return _download_url(video_url, out_dir)
    except ToolError:
        # Direct method failed for a known reason — try yt-dlp before giving up.
        return _download_with_ytdlp(url, out_dir)


def _download_url(video_url: str, out_dir: str) -> str:
    """Stream a direct CDN URL to disk."""
    dest = os.path.join(out_dir, "reel.mp4")
    req = urllib.request.Request(
        video_url, headers={"User-Agent": http.BASE_HEADERS["User-Agent"]}
    )
    try:
        with urllib.request.urlopen(req, timeout=settings.download_timeout) as resp, open(
            dest, "wb"
        ) as f:
            while chunk := resp.read(_CHUNK):
                f.write(chunk)
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise RateLimitedError() from e
        raise DownloadError(f"CDN download failed: HTTP {e.code}") from e
    return dest


def _download_with_ytdlp(url: str, out_dir: str) -> str:
    import yt_dlp

    out_template = os.path.join(out_dir, "reel.%(ext)s")
    ydl_opts = {
        "outtmpl": out_template,
        "format": "mp4/bestvideo+bestaudio/best",
        "quiet": True,
        "noprogress": True,
        "retries": settings.download_retries,
        "socket_timeout": settings.download_timeout,
        # Cookies: optional locally, effectively required when hosted.
        "cookiefile": settings.ig_cookies_file or None,
    }

    try:
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            ydl.extract_info(url, download=True)
    except yt_dlp.utils.DownloadError as e:
        raise _classify(str(e)) from e

    for name in os.listdir(out_dir):
        if name.startswith("reel."):
            return os.path.join(out_dir, name)
    raise DownloadError("Download reported success but no file was produced.")


def _classify(message: str) -> Exception:
    """Map a yt-dlp error string onto one of our typed errors."""
    m = message.lower()
    if "login required" in m or "private" in m or "log in" in m:
        return PrivateContentError()
    if "rate" in m and "limit" in m or "429" in m or "temporarily blocked" in m:
        return RateLimitedError()
    if "not found" in m or "404" in m or "does not exist" in m or "unavailable" in m:
        return NotFoundError()
    return DownloadError(f"Download failed: {message}")
