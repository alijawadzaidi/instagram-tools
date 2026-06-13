"""A tiny TTL cache for expensive results (transcripts, LLM outputs).

In-memory + process-local today; the interface (get / set / get_or_set) is
deliberately Redis-shaped so it can be swapped for a shared cache when the
deployment grows past one instance (Architecture/04). Keys should encode the
inputs that determine the result, e.g. (tool, shortcode, params_hash).
"""

from __future__ import annotations

import hashlib
import json
import time
from typing import Any, Callable


class TTLCache:
    def __init__(self, default_ttl: float = 24 * 3600.0):
        self._default_ttl = default_ttl
        self._store: dict[str, tuple[float, Any]] = {}

    def get(self, key: str) -> Any | None:
        entry = self._store.get(key)
        if entry is None:
            return None
        expires, value = entry
        if time.monotonic() >= expires:
            self._store.pop(key, None)
            return None
        return value

    def set(self, key: str, value: Any, ttl: float | None = None) -> None:
        self._store[key] = (time.monotonic() + (ttl or self._default_ttl), value)

    def get_or_set(self, key: str, factory: Callable[[], Any], ttl: float | None = None) -> Any:
        hit = self.get(key)
        if hit is not None:
            return hit
        value = factory()
        self.set(key, value, ttl)
        return value

    def clear(self) -> None:
        self._store.clear()


def make_key(*parts: Any) -> str:
    """Stable cache key from arbitrary JSON-able parts (dicts are order-normalized)."""
    raw = json.dumps(parts, sort_keys=True, default=str)
    return hashlib.sha256(raw.encode()).hexdigest()


# Process-wide result cache. Swap the construction here for a Redis-backed
# implementation with the same surface when needed.
results = TTLCache()
