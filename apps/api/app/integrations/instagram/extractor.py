"""Direct Instagram media extractor for a single reel — no login, no yt-dlp.

Replicates the technique the public downloader sites use: resolve the reel's CDN
MP4 URL straight from Instagram's no-login `web_info` GraphQL query (the same
payload the private `media/<id>/info` endpoint returns). Verified live June 2026.
Instagram rotates the query's `doc_id` every few weeks — see `_web_info` for how
to refresh it. Shared HTTP bits live in `http`.
"""

from __future__ import annotations

import json
import re
import urllib.error
import urllib.parse

from app.core.config import settings
from app.core.errors import NotFoundError, PrivateContentError, RateLimitedError

from . import http, session


def extract_shortcode(url: str) -> str | None:
    url = url.split("?")[0].split("#")[0]
    m = re.search(r"instagram\.com/(?:p|tv|reel|reels)/([A-Za-z0-9_-]+)", url)
    return m.group(1) if m else None


def _web_info(shortcode: str, cookies: dict) -> dict:
    """The reel/post media object via the no-login `web_info` GraphQL query.

    POST graphql/query with a rotating `doc_id` (settings.ig_web_info_doc_id)
    returns the same shape as the private `media/<id>/info` endpoint: `items[0]`
    with `video_versions`, `image_versions2`, `caption`, and (for albums)
    `carousel_media`. To refresh the doc_id when Instagram rotates it, open a
    public reel in a logged-in browser, find the `graphql/query` XHR whose
    response holds `xdt_api__v1__media__shortcode__web_info`, and copy its doc_id.
    Returns `items[0]`, or `{}` on a miss.
    """
    body = urllib.parse.urlencode(
        {
            "av": "0",
            "__d": "www",
            "__user": "0",
            "__a": "1",
            "variables": json.dumps({"shortcode": shortcode}),
            "doc_id": settings.ig_web_info_doc_id,
        }
    ).encode()
    headers = http.auth_headers(cookies, {"Content-Type": "application/x-www-form-urlencoded"})
    data = json.loads(http.request("https://www.instagram.com/graphql/query", headers, body))
    info = (data.get("data") or {}).get("xdt_api__v1__media__shortcode__web_info") or {}
    items = info.get("items") or []
    return items[0] if items else {}


def _video_url_from_item(item: dict) -> str | None:
    """The best video URL from a media item, descending into a carousel's first
    video child when the top-level item is an album."""
    for media in (item, *(item.get("carousel_media") or [])):
        versions = media.get("video_versions") or []
        if versions:
            return versions[0].get("url")
    return None


def _cover_from_item(item: dict) -> str:
    """The highest-res cover image from a media item (first carousel child for
    albums). `image_versions2.candidates` is ordered largest-first."""
    for media in (item, *(item.get("carousel_media") or [])):
        candidates = (media.get("image_versions2") or {}).get("candidates") or []
        if candidates:
            return candidates[0].get("url") or ""
    return ""


def _via_graphql(shortcode: str, cookies: dict) -> str | None:
    return _video_url_from_item(_web_info(shortcode, cookies))


def get_cover(url: str) -> str:
    """Return the reel's high-res cover image URL. Empty on failure."""
    shortcode = extract_shortcode(url)
    if not shortcode:
        return ""
    try:
        cookies = session.session_cookies(f"https://www.instagram.com/p/{shortcode}/")
        return _cover_from_item(_web_info(shortcode, cookies))
    except Exception:
        return ""


def get_caption(url: str) -> str:
    """Best-effort fetch of a reel's caption text (empty string on failure)."""
    shortcode = extract_shortcode(url)
    if not shortcode:
        return ""
    try:
        cookies = session.session_cookies(f"https://www.instagram.com/p/{shortcode}/")
        item = _web_info(shortcode, cookies)
    except Exception:
        return ""
    return (item.get("caption") or {}).get("text") or ""


def _via_embed(shortcode: str) -> str | None:
    webpage = http.request(
        f"https://www.instagram.com/p/{shortcode}/embed/", http.BASE_HEADERS
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

    cookies = session.session_cookies(f"https://www.instagram.com/p/{shortcode}/")

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
