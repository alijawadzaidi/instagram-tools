"""Fetch a user's reels by username — no login, cursor-paginated.

Technique (verified May 2026, see Research/05):
  1. `web_profile_info?username=...` → resolve the numeric user id (first page only).
  2. POST `api/v1/clips/user/` with that id → one page of reels + a `max_id` cursor.

Pagination is **cursor-based, one Instagram call per page** — gentle on rate
limits and scalable to any account size. We hand the client an opaque `next_cursor`
that encodes the user id + Instagram's `max_id`, so "load more" pages don't re-run
the username lookup.
"""

from __future__ import annotations

import base64
import json
import urllib.error
import urllib.parse
from dataclasses import dataclass

from . import ig_http
from .errors import NotFoundError, PrivateContentError, RateLimitedError

_CLIPS_URL = "https://www.instagram.com/api/v1/clips/user/"


@dataclass
class ReelSummary:
    shortcode: str
    url: str
    thumbnail_url: str | None
    caption: str
    view_count: int | None

    def to_dict(self) -> dict:
        return {
            "shortcode": self.shortcode,
            "url": self.url,
            "thumbnail_url": self.thumbnail_url,
            "caption": self.caption,
            "view_count": self.view_count,
        }


@dataclass
class ReelsPage:
    reels: list[ReelSummary]
    next_cursor: str | None  # opaque; pass back to fetch the next page


def _encode_cursor(user_id: str, max_id: str) -> str:
    raw = json.dumps({"u": user_id, "m": max_id}).encode()
    return base64.urlsafe_b64encode(raw).decode()


def _decode_cursor(cursor: str) -> tuple[str, str]:
    try:
        data = json.loads(base64.urlsafe_b64decode(cursor.encode()))
        return data["u"], data["m"]
    except Exception as e:
        raise NotFoundError("Invalid pagination cursor.") from e


def _resolve_user_id(username: str, cookies: dict) -> str:
    url = (
        "https://www.instagram.com/api/v1/users/web_profile_info/?username="
        + urllib.parse.quote(username)
    )
    try:
        data = json.loads(ig_http.request(url, ig_http.auth_headers(cookies)))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            raise NotFoundError(f"No Instagram user named @{username}.") from e
        if e.code == 429:
            raise RateLimitedError() from e
        raise PrivateContentError(
            "Couldn't load that profile. Instagram may be blocking anonymous "
            "access from this network."
        ) from e
    user = (data.get("data") or {}).get("user")
    if not user or not user.get("id"):
        raise NotFoundError(f"No Instagram user named @{username}.")
    if user.get("is_private"):
        raise PrivateContentError(f"@{username} is a private account.")
    return user["id"]


def _caption_of(media: dict) -> str:
    cap = media.get("caption")
    return (cap.get("text") or "")[:200] if isinstance(cap, dict) else ""


def _thumb_of(media: dict) -> str | None:
    candidates = (media.get("image_versions2") or {}).get("candidates") or []
    return candidates[0]["url"] if candidates else None


def get_reels_page(
    username: str, cursor: str | None = None, page_size: int = 12
) -> ReelsPage:
    """Return ONE page of @username's reels plus a cursor for the next page.

    Pass `cursor=None` for the first page; pass the returned `next_cursor` to get
    the following page. `next_cursor` is None when there are no more reels.
    """
    username = username.lstrip("@").strip()
    cookies = ig_http.session_cookies(f"https://www.instagram.com/{username}/")

    if cursor:
        user_id, max_id = _decode_cursor(cursor)
    else:
        user_id, max_id = _resolve_user_id(username, cookies), None

    form = {"target_user_id": user_id, "page_size": str(page_size)}
    if max_id:
        form["max_id"] = max_id
    headers = ig_http.auth_headers(
        cookies, {"Content-Type": "application/x-www-form-urlencoded"}
    )
    try:
        data = json.loads(
            ig_http.request(_CLIPS_URL, headers, data=urllib.parse.urlencode(form).encode())
        )
    except urllib.error.HTTPError as e:
        if e.code == 429:
            raise RateLimitedError() from e
        raise PrivateContentError(
            "Couldn't load this page of reels (Instagram blocked the request)."
        ) from e

    reels: list[ReelSummary] = []
    for it in data.get("items") or []:
        media = it.get("media") or {}
        code = media.get("code")
        if not code:
            continue
        reels.append(
            ReelSummary(
                shortcode=code,
                url=f"https://www.instagram.com/reel/{code}/",
                thumbnail_url=_thumb_of(media),
                caption=_caption_of(media),
                view_count=media.get("play_count") or media.get("view_count"),
            )
        )

    paging = data.get("paging_info") or {}
    next_max = paging.get("max_id")
    next_cursor = (
        _encode_cursor(user_id, next_max)
        if paging.get("more_available") and next_max
        else None
    )
    return ReelsPage(reels=reels, next_cursor=next_cursor)
