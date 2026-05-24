"""Direct Instagram media extractor for a single reel — no login, no yt-dlp.

Replicates the technique the public downloader sites use (studied from `parth-dl`):
resolve the reel's CDN MP4 URL straight from Instagram's GraphQL/embed endpoints.
Verified live May 2026 — see Research/05-download-technique.md. Shared HTTP bits
live in `ig_http`.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse

from . import ig_http
from .errors import NotFoundError, PrivateContentError, RateLimitedError

_GRAPHQL_DOC_ID = "8845758582119845"


def extract_shortcode(url: str) -> str | None:
    url = url.split("?")[0].split("#")[0]
    m = re.search(r"instagram\.com/(?:p|tv|reel|reels)/([A-Za-z0-9_-]+)", url)
    return m.group(1) if m else None


def _graphql_media(shortcode: str, cookies: dict) -> dict:
    variables = {
        "shortcode": shortcode,
        "child_comment_count": 0,
        "fetch_comment_count": 0,
        "parent_comment_count": 0,
        "has_threaded_comments": False,
    }
    url = (
        "https://www.instagram.com/graphql/query/?doc_id="
        + _GRAPHQL_DOC_ID
        + "&variables="
        + urllib.parse.quote(json.dumps(variables))
    )
    data = json.loads(ig_http.request(url, ig_http.auth_headers(cookies)))
    return (data.get("data") or {}).get("xdt_shortcode_media") or {}


def _via_graphql(shortcode: str, cookies: dict) -> str | None:
    return _graphql_media(shortcode, cookies).get("video_url")


def get_cover(url: str) -> str:
    """Return the reel's high-res cover image URL (display_url). Empty on failure."""
    shortcode = extract_shortcode(url)
    if not shortcode:
        return ""
    try:
        cookies = ig_http.session_cookies(f"https://www.instagram.com/p/{shortcode}/")
        media = _graphql_media(shortcode, cookies)
    except Exception:
        return ""
    return media.get("display_url") or ""


def get_caption(url: str) -> str:
    """Best-effort fetch of a reel's caption text (empty string on failure)."""
    shortcode = extract_shortcode(url)
    if not shortcode:
        return ""
    try:
        cookies = ig_http.session_cookies(f"https://www.instagram.com/p/{shortcode}/")
        media = _graphql_media(shortcode, cookies)
    except Exception:
        return ""
    edges = (media.get("edge_media_to_caption") or {}).get("edges") or []
    return edges[0]["node"]["text"] if edges else ""


def _via_embed(shortcode: str) -> str | None:
    webpage = ig_http.request(
        f"https://www.instagram.com/p/{shortcode}/embed/", ig_http.BASE_HEADERS
    )
    m = re.search(r'"video_url":"([^"]+)"', webpage)
    if m:
        return m.group(1).encode().decode("unicode_escape")
    return None


def get_video_url(url: str) -> str:
    """Resolve the direct CDN MP4 URL for an Instagram reel/post (no login)."""
    shortcode = extract_shortcode(url)
    if not shortcode:
        raise NotFoundError("That doesn't look like a valid Instagram reel/post URL.")

    cookies = ig_http.session_cookies(f"https://www.instagram.com/p/{shortcode}/")

    last_http_error: urllib.error.HTTPError | None = None
    for fn in (lambda: _via_graphql(shortcode, cookies), lambda: _via_embed(shortcode)):
        try:
            video_url = fn()
            if video_url:
                return video_url
        except urllib.error.HTTPError as e:
            last_http_error = e
        except Exception:
            pass

    if last_http_error is not None:
        if last_http_error.code == 429:
            raise RateLimitedError()
        if last_http_error.code in (401, 403, 302):
            raise PrivateContentError()
    raise PrivateContentError(
        "Couldn't fetch this reel. It may be private, removed, or Instagram is "
        "blocking anonymous access from this network."
    )
