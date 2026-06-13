"""HTTP endpoints for the transcribe tool.

POST /tools/transcribe        -> enqueue a job, returns { job_id, status }
GET  /tools/transcribe/{id}   -> poll the job, returns status (+ result/error)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.auth import current_user_id, require_internal_key
from app.core.db import get_db
from app.jobs.queue import enqueue, get_job
from app.jobs.quota import check_quota
from app.jobs.runner import dispatch

# Importing the service registers the "transcribe" job handler.
from . import service  # noqa: F401
from .schemas import JobResponse, TranscribeRequest

router = APIRouter(
    prefix="/tools/transcribe",
    tags=["transcribe"],
    dependencies=[Depends(require_internal_key)],
)


def _to_response(job) -> JobResponse:
    return JobResponse(
        job_id=job.id,
        status=job.status,
        result=job.result,
        error_code=job.error_code,
        error=job.error,
    )


# Stays `async def`: dispatch() schedules the work onto the running event loop
# (asyncio.create_task) and the blocking transcription runs in a thread. A plain
# `def` handler would run on the thread pool, where there's no loop to schedule on.
@router.post("", response_model=JobResponse)
async def start(
    req: TranscribeRequest,
    db: Session = Depends(get_db),
    user_id: str | None = Depends(current_user_id),
) -> JobResponse:
    check_quota(db, user_id, "transcribe")
    job = enqueue(
        db,
        tool="transcribe",
        params={"url": req.url, "engine": req.engine},
        user_id=user_id,
    )
    dispatch(job.id)
    return _to_response(job)


@router.get("/{job_id}", response_model=JobResponse)
async def status(job_id: str, db: Session = Depends(get_db)) -> JobResponse:
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return _to_response(job)
