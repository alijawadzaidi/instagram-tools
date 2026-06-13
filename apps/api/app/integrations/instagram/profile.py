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

from app.core.errors import NotFoundError, PrivateContentError, RateLimitedError

from . import http, session
from .hashtags import extract_hashtags

_CLIPS_URL = "https://www.instagram.com/api/v1/clips/user/"


@dataclass
class ReelSummary:
    shortcode: str
    url: str
    thumbnail_url: str | None
    caption: str
    hashtags: list[str]
    view_count: int | None
    taken_at: int | None  # unix timestamp the reel was posted

    def to_dict(self) -> dict:
        return {
            "shortcode": self.shortcode,
            "url": self.url,
            "thumbnail_url": self.thumbnail_url,
            "caption": self.caption,
            "hashtags": self.hashtags,
            "view_count": self.view_count,
            "taken_at": self.taken_at,
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


def _fetch_web_profile(username: str, cookies: dict) -> dict:
    """Return the raw `user` object from web_profile_info (public fields)."""
    url = (
        "https://www.instagram.com/api/v1/users/web_profile_info/?username="
        + urllib.parse.quote(username)
    )
    try:
        data = json.loads(http.request(url, http.auth_headers(cookies)))
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
    return user


def _resolve_user_id(username: str, cookies: dict) -> str:
    user = _fetch_web_profile(username, cookies)
    if user.get("is_private"):
        raise PrivateContentError(f"@{username} is a private account.")
    return user["id"]


@dataclass
class ProfileInfo:
    username: str
    full_name: str
    biography: str
    follower_count: int | None
    following_count: int | None
    post_count: int | None
    is_verified: bool
    is_private: bool
    profile_pic_url: str | None
    external_url: str | None
    category: str | None

    def to_dict(self) -> dict:
        return self.__dict__


def get_profile(username: str) -> ProfileInfo:
    """Public profile overview for @username (works even for private accounts)."""
    username = username.lstrip("@").strip()
    cookies = session.session_cookies(f"https://www.instagram.com/{username}/")
    u = _fetch_web_profile(username, cookies)
    return ProfileInfo(
        username=u.get("username") or username,
        full_name=u.get("full_name") or "",
        biography=u.get("biography") or "",
        follower_count=(u.get("edge_followed_by") or {}).get("count"),
        following_count=(u.get("edge_follow") or {}).get("count"),
        post_count=(u.get("edge_owner_to_timeline_media") or {}).get("count"),
        is_verified=bool(u.get("is_verified")),
        is_private=bool(u.get("is_private")),
        profile_pic_url=u.get("profile_pic_url_hd") or u.get("profile_pic_url"),
        external_url=u.get("external_url"),
        category=u.get("category_name") or u.get("business_category_name"),
    )


def _full_caption(media: dict) -> str:
    cap = media.get("caption")
    return (cap.get("text") or "") if isinstance(cap, dict) else ""


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
    cookies = session.session_cookies(f"https://www.instagram.com/{username}/")

    if cursor:
        user_id, max_id = _decode_cursor(cursor)
    else:
        user_id, max_id = _resolve_user_id(username, cookies), None

    form = {"target_user_id": user_id, "page_size": str(page_size)}
    if max_id:
        form["max_id"] = max_id
    headers = http.auth_headers(
        cookies, {"Content-Type": "application/x-www-form-urlencoded"}
    )
    try:
        data = json.loads(
            http.request(_CLIPS_URL, headers, data=urllib.parse.urlencode(form).encode())
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
        full_caption = _full_caption(media)
        reels.append(
            ReelSummary(
                shortcode=code,
                url=f"https://www.instagram.com/reel/{code}/",
                thumbnail_url=_thumb_of(media),
                caption=full_caption[:280],  # truncated for display
                hashtags=extract_hashtags(full_caption),  # from FULL caption
                view_count=media.get("play_count") or media.get("view_count"),
                taken_at=media.get("taken_at"),
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
