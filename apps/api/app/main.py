"""FastAPI entrypoint. Mounts every tool's router.

To add a tool: create app/tools/<tool>/router.py with an APIRouter named
`router`, then include it here. The shared/ helpers (downloader, audio, jobs,
errors) are available to all tools.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .tools.profile.router import router as profile_router
from .tools.transcribe.router import router as transcribe_router

app = FastAPI(title="Instagram Tools API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engine": settings.transcribe_engine}


app.include_router(transcribe_router)
app.include_router(profile_router)
