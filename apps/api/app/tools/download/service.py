"""Download tool service — product logic over the Instagram integration.

The mandatory per-tool seam: the router handles transport (temp files, streaming
responses, the CDN-image proxy) and calls these for the actual work.
"""

from __future__ import annotations

from app.integrations.instagram.download import download_one, list_qualities
from app.integrations.instagram.extractor import extract_shortcode, get_cover

__all__ = ["list_formats", "download_one", "cover_url", "extract_shortcode"]


def list_formats(url: str) -> dict:
    return list_qualities(url)


def cover_url(url: str) -> str:
    return get_cover(url)
