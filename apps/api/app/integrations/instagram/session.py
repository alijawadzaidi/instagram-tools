"""Cookie warmup for the no-login Instagram calls.

Hitting a public page yields csrftoken/mid cookies that the API calls then echo
back. Those are session cookies, not page-specific, so we cache one warmed set
process-wide with a short TTL instead of warming up on every request (the audit
found ~2 extra IG hits per user action — see Research/06-restructure/02).
"""

from __future__ import annotations

import time
import urllib.error
import urllib.request

from . import http

# A warmed cookie set is good for a while; keep it short so a poisoned/expired
# set self-heals quickly.
_TTL_SECONDS = 600.0
_cache: dict | None = None
_cache_expires = 0.0


def _warmup(page_url: str) -> dict:
    cookies: dict[str, str] = {}
    req = urllib.request.Request(page_url, headers=http.BASE_HEADERS)
    try:
        resp = http.opener.open(req, timeout=30)
        raw = resp.headers.get_all("Set-Cookie", []) or []
    except urllib.error.HTTPError as e:
        raw = e.headers.get_all("Set-Cookie", []) or []
    for c in raw:
        k, _, v = c.split(";")[0].partition("=")
        cookies[k] = v
    return cookies


def session_cookies(page_url: str) -> dict:
    """Warmed csrftoken/mid cookies, cached process-wide for _TTL_SECONDS.

    `page_url` only seeds the warmup request; any public page yields usable
    session cookies, so all callers share one cached set.
    """
    global _cache, _cache_expires
    now = time.monotonic()
    if _cache is not None and now < _cache_expires and "csrftoken" in _cache:
        return _cache
    _cache = _warmup(page_url)
    _cache_expires = now + _TTL_SECONDS
    return _cache
