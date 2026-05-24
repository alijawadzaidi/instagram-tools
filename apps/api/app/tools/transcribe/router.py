"""HTTP endpoints for the transcribe tool.

POST /tools/transcribe        -> start a job, returns { job_id, status }
GET  /tools/transcribe/{id}   -> poll the job, returns status (+ result/error)
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

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
async def start(req: TranscribeRequest) -> JobResponse:
    job = create_job()
    run_job(job, lambda: transcribe_reel(req.url, req.engine))
    return _to_response(job)


@router.get("/{job_id}", response_model=JobResponse)
async def status(job_id: str) -> JobResponse:
    job = get_job(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Job not found.")
    return _to_response(job)
