"""The job store + claim. Postgres `SELECT … FOR UPDATE SKIP LOCKED` lets many
workers claim distinct jobs without colliding; on other dialects (SQLite tests)
it degrades to a plain ordered claim. Enqueue today is consumed by the
in-process runner; the same `claim_one` powers a separate worker process when
the deployment topology calls for it (Architecture/04 Phase 5)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.job import Job

from .handlers import HandlerResult


def enqueue(
    db: Session,
    tool: str,
    params: dict | None = None,
    user_id: str | None = None,
) -> Job:
    job = Job(tool=tool, status="pending", params=params or {}, user_id=user_id)
    db.add(job)
    db.commit()
    db.refresh(job)
    return job


def get_job(db: Session, job_id: str) -> Job | None:
    return db.get(Job, job_id)


def claim_one(db: Session, tools: list[str] | None = None) -> Job | None:
    """Atomically claim the oldest pending job (-> running) and return it."""
    q = db.query(Job).filter(Job.status == "pending")
    if tools:
        q = q.filter(Job.tool.in_(tools))
    q = q.order_by(Job.created_at)
    if db.bind is not None and db.bind.dialect.name == "postgresql":
        q = q.with_for_update(skip_locked=True)
    job = q.first()
    if job is None:
        return None
    job.status = "running"
    db.commit()
    db.refresh(job)
    return job


def complete(db: Session, job: Job, outcome: HandlerResult) -> None:
    job.status = "done"
    job.result = outcome.result
    job.tokens_in = outcome.tokens_in
    job.tokens_out = outcome.tokens_out
    job.cost_cents = outcome.cost_cents
    db.commit()


def fail(db: Session, job: Job, code: str, message: str) -> None:
    db.rollback()  # clear any failed transaction before writing the outcome
    job.status = "error"
    job.error_code = code
    job.error = message
    db.commit()
