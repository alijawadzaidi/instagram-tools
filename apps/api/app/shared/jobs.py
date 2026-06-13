"""Background-job store backed by PostgreSQL.

Jobs survive server restarts and work across multiple instances.
The public API (create_job / get_job / run_job) is the same as before —
only the routers need to pass a db session now.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.job import Job

from .errors import ToolError

log = logging.getLogger("app.jobs")


def create_job(db: Session, tool: str, input_url: str | None = None) -> Job:
    job = Job(tool=tool, input_url=input_url, status="pending")
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str) -> Job | None:
    return db.get(Job, job_id)


def _mark_error(db: Session, job: Job | None, code: str, message: str) -> None:
    if job is None:
        return
    db.rollback()  # clear any failed transaction state before writing the outcome
    job.status = "error"
    job.error_code = code
    job.error = message
    db.commit()


def run_job(job_id: str, work: Callable[[], dict[str, Any]]) -> None:
    """Run blocking `work()` in a thread and persist the outcome to the database."""

    async def _runner() -> None:
        db = SessionLocal()
        job: Job | None = None
        try:
            job = db.get(Job, job_id)
            job.status = "running"
            db.commit()
            log.info("job %s tool=%s running", job_id, job.tool)

            result = await asyncio.to_thread(work)

            job.status = "done"
            job.result = result
            db.commit()
            log.info("job %s tool=%s done", job_id, job.tool)
        except ToolError as e:
            log.warning("job %s failed code=%s: %s", job_id, e.code, e.message)
            _mark_error(db, job, e.code, e.message)
        except Exception as e:  # noqa: BLE001 - last-resort guard for the worker
            log.exception("job %s crashed", job_id)
            _mark_error(db, job, "internal_error", f"Unexpected error: {e}")
        finally:
            db.close()

    asyncio.create_task(_runner())
