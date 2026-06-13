"""App logging: timestamped, levelled lines under the "app" logger namespace.

Request lines carry a request id (rid=...) so one user action can be traced
across the access log and job logs. Moves to core/logging.py in Phase 4 of the
restructure (Architecture/04).
"""

from __future__ import annotations

import logging

_FORMAT = "%(asctime)s %(levelname)s %(name)s %(message)s"


def setup_logging(level: int = logging.INFO) -> None:
    # basicConfig is a no-op if a handler is already configured (e.g. by tests),
    # so this is safe to call from the app lifespan.
    logging.basicConfig(level=level, format=_FORMAT)
    logging.getLogger("app").setLevel(level)
