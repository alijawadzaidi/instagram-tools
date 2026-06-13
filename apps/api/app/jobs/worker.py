"""Optional standalone worker process: claims pending jobs and runs them.

NOT used by default — the API dispatches jobs in-process (see runner.dispatch).
Enable this when a separate worker is provisioned (e.g. a Fly.io `[processes]`
worker group — Architecture/04 open question #1). Same code, different trigger:

    python -m app.jobs.worker
"""

from __future__ import annotations

import logging
import time

import app.main  # noqa: F401 - import the app so every tool's handler registers
from app.core.db import SessionLocal
from app.core.logging import setup_logging

from . import queue
from .runner import execute

log = logging.getLogger("app.jobs")


def run_worker(poll_interval: float = 1.0) -> None:
    setup_logging()
    log.info("worker started")
    while True:
        db = SessionLocal()
        try:
            job = queue.claim_one(db)
            job_id = job.id if job else None
        finally:
            db.close()
        if job_id is None:
            time.sleep(poll_interval)
            continue
        execute(job_id)


if __name__ == "__main__":
    run_worker()
