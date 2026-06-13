"""Low-level HTTP primitives for Instagram's web endpoints.

The no-login technique (verified May 2026, see Research/05) relies on:
  - the public web-client app id header (`X-IG-App-ID`),
  - a cookie warmup (visit a page to collect csrftoken/mid — see session.py),
  - NOT following redirects (a 302 to /login means "blocked", and following it
    strips our custom headers).

`extractor` (single reel) and `profile` (a user's reels) build on this.
"""

from __future__ import annotations

import gzip
import urllib.request

IG_APP_ID = "936619743392459"  # Instagram's public web-client app id

BASE_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin": "https://www.instagram.com",
    "Referer": "https://www.instagram.com/",
}


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


opener = urllib.request.build_opener(_NoRedirect)


def request(url: str, headers: dict, data: bytes | None = None) -> str:
    req = urllib.request.Request(url, data=data, headers=headers)
    resp = opener.open(req, timeout=30)
    raw = resp.read()
    if resp.headers.get("Content-Encoding") == "gzip":
        raw = gzip.decompress(raw)
    return raw.decode("utf-8", errors="replace")


def auth_headers(cookies: dict, extra: dict | None = None) -> dict:
    """Headers for the no-login API calls: app id + csrf + cookies."""
    headers = {
        **BASE_HEADERS,
        "X-IG-App-ID": IG_APP_ID,
        "X-Requested-With": "XMLHttpRequest",
    }
    if "csrftoken" in cookies:
        headers["X-CSRFToken"] = cookies["csrftoken"]
        headers["Cookie"] = "; ".join(f"{k}={v}" for k, v in cookies.items())
    if extra:
        headers.update(extra)
    return headers
