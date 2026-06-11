"""HTTP endpoints for the transcribe tool.

POST /tools/transcribe        -> start a job, returns { job_id, status }
GET  /tools/transcribe/{id}   -> poll the job, returns status (+ result/error)
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ...db.session import get_db
from ...shared.jobs import create_job, get_job, run_job
from .schemas import JobResponse, TranscribeRequest
from .service import transcribe_reel

router = APIRouter(prefix="/tools/transcribe", tags=["transcribe"])


def _to_response(job) -> JobResponse:
    return JobResponse(
        job_id=job.id,
        status=job.status,
        result=job.result,
        error_code=job.error_code,
        error=job.error,
    )


@router.post("", response_model=JobResponse)
async def start(req: TranscribeRequest, db: Session = Depends(get_db)) -> JobResponse:
    job = create_job(db, tool="transcribe", input_url=req.url)
    run_job(job.id, lambda: transcribe_reel(req.url, req.engine))
    return _to_response(job)


@router.get("/{job_id}", response_model=JobResponse)
async def status(job_id: str, db: Session = Depends(get_db)) -> JobResponse:
    job = get_job(db, job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return _to_response(job)
    