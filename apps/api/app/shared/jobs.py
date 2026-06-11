"""Background-job store backed by PostgreSQL.

Jobs survive server restarts and work across multiple instances.
The public API (create_job / get_job / run_job) is the same as before —
only the routers need to pass a db session now.
"""

from __future__ import annotations

import asyncio
from typing import Any, Callable

from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.job import Job
from .errors import ToolError


def create_job(db: Session, tool: str, input_url: str | None = None) -> Job:
    job = Job(tool=tool, input_url=input_url, status="pending")
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str) -> Job | None:
    return db.get(Job, job_id)


def run_job(job_id: str, work: Callable[[], dict[str, Any]]) -> None:
    """Run blocking `work()` in a thread and persist the outcome to the database."""

    async def _runner() -> None:
        db = SessionLocal()
        try:
            job = db.get(Job, job_id)
            job.status = "running"
            db.commit()

            result = await asyncio.to_thread(work)

            job.status = "done"
            job.result = result
            db.commit()
        except ToolError as e:
            job.status = "error"
            job.error_code = e.code
            job.error = e.message
            db.commit()
        except Exception as e:  # noqa: BLE001 - last-resort guard for the worker
            job.status = "error"
            job.error_code = "internal_error"
            job.error = f"Unexpected error: {e}"
            db.commit()
        finally:
            db.close()

    asyncio.create_task(_runner())
