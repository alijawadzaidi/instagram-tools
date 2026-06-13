"""Job execution: load a job, run its registered handler, persist the outcome.

`execute()` is the shared core used by both triggers:
  - in-process: `dispatch()` runs it in a worker thread off the request's event
    loop (the default today),
  - separate process: `worker.run_worker()` claims jobs and calls `execute()`.

Work is reconstructed from the stored tool+params via the handler registry, so a
job is fully described by its DB row.
"""

from __future__ import annotations

import asyncio
import logging

from app.core.db import SessionLocal
from app.core.errors import ToolError

from . import queue
from .handlers import coerce, get_handler

log = logging.getLogger("app.jobs")


def execute(job_id: str) -> None:
    """Run a job to completion. Synchronous; safe to call inside a thread."""
    db = SessionLocal()
    try:
        job = queue.get_job(db, job_id)
        if job is None:
            log.warning("job %s vanished before execution", job_id)
            return
        if job.status != "running":
            job.status = "running"
            db.commit()
        log.info("job %s tool=%s running", job_id, job.tool)
        try:
            outcome = coerce(get_handler(job.tool)(job.params or {}))
            queue.complete(db, job, outcome)
            log.info(
                "job %s tool=%s done cost_cents=%s", job_id, job.tool, outcome.cost_cents
            )
        except ToolError as e:
            log.warning("job %s failed code=%s: %s", job_id, e.code, e.message)
            queue.fail(db, job, e.code, e.message)
        except Exception as e:  # noqa: BLE001 - last-resort guard for the worker
            log.exception("job %s crashed", job_id)
            queue.fail(db, job, "internal_error", f"Unexpected error: {e}")
    finally:
        db.close()


def dispatch(job_id: str) -> None:
    """In-process trigger: run the job in a thread off the event loop."""

    async def _run() -> None:
        await asyncio.to_thread(execute, job_id)

    asyncio.create_task(_run())
