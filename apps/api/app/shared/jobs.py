"""A tiny in-memory background-job store.

Transcription can take a while, so we don't do it inside the HTTP request (that
risks gateway timeouts — exactly what the ReelScribe reference hit). Instead the
router creates a Job, kicks off the work in a background thread, and the client
polls the Job until it's done.

NOTE: in-memory = single instance only. When we scale to multiple backend
instances, swap this for Redis. The public API (create_job / get_job / run_job)
stays the same.
"""

from __future__ import annotations

import asyncio
import uuid
from dataclasses import dataclass, field
from typing import Any, Callable

from .errors import ToolError


@dataclass
class Job:
    id: str
    status: str = "pending"  # pending | running | done | error
    result: dict[str, Any] | None = None
    error_code: str | None = None
    error: str | None = None


_JOBS: dict[str, Job] = {}


def create_job() -> Job:
    job = Job(id=uuid.uuid4().hex)
    _JOBS[job.id] = job
    return job


def get_job(job_id: str) -> Job | None:
    return _JOBS.get(job_id)


def run_job(job: Job, work: Callable[[], dict[str, Any]]) -> None:
    """Run blocking `work()` in a thread and record the outcome on `job`."""

    async def _runner() -> None:
        job.status = "running"
        try:
            job.result = await asyncio.to_thread(work)
            job.status = "done"
        except ToolError as e:
            job.status = "error"
            job.error_code = e.code
            job.error = e.message
        except Exception as e:  # noqa: BLE001 - last-resort guard for the worker
            job.status = "error"
            job.error_code = "internal_error"
            job.error = f"Unexpected error: {e}"

    asyncio.create_task(_runner())
