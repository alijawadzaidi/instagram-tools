"""Extract hashtags from caption text. Shared by the profile + transcribe tools.

Captions are data we already fetch, so hashtag features are pure parsing — no
extra Instagram requests. Aggregation (frequency, co-occurrence) is done on the
frontend so it can recompute as more reels are loaded.
"""

from __future__ import annotations

import re

# A hashtag: '#', then letters/digits/underscore (Unicode-aware). Stops at
# spaces/punctuation. Instagram tags are case-insensitive, so we lowercase.
_HASHTAG_RE = re.compile(r"#(\w+)", re.UNICODE)


def extract_hashtags(text: str | None) -> list[str]:
    """Return the unique hashtags in `text` (lowercased, '#' included, order kept)."""
    if not text:
        return []
    seen: set[str] = set()
    out: list[str] = []
    for raw in _HASHTAG_RE.findall(text):
        tag = "#" + raw.lower()
        if tag not in seen and not raw.isdigit():  # skip all-numeric (not real tags)
            seen.add(tag)
            out.append(tag)
    return out
