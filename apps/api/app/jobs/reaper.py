"""Startup reaper: a job left "running" means the process that owned it died
(deploy, crash). Mark those interrupted so they don't hang forever and the UI
shows a real error. Runs on app startup (see main.lifespan).

Only "running" is reaped — "pending" jobs are safe to leave for a worker to
claim; reaping them would kill queued work once a separate worker exists.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.core.db import SessionLocal
from app.models.job import Job

log = logging.getLogger("app.jobs")


def reap_stale(db: Session | None = None) -> int:
    own = db is None
    db = db or SessionLocal()
    try:
        stale = db.query(Job).filter(Job.status == "running").all()
        for job in stale:
            job.status = "error"
            job.error_code = "interrupted"
            job.error = "The server restarted while this job was running. Please retry."
        if stale:
            db.commit()
            log.info("reaped %d interrupted job(s)", len(stale))
        return len(stale)
    finally:
        if own:
            db.close()
