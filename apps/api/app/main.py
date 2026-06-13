"""FastAPI entrypoint. Mounts every tool's router.

To add a tool: create app/tools/<tool>/router.py with an APIRouter named
`router`, then include it here. The shared/ helpers (downloader, audio, jobs,
errors) are available to all tools. Raise ToolError subclasses for expected
failures — the global handler below turns them into HTTP responses; routers
never need their own try/except.
"""

from __future__ import annotations

import logging
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from .config import settings
from .shared.errors import ToolError
from .shared.logging_setup import setup_logging
from .tools.download.router import router as download_router
from .tools.profile.router import router as profile_router
from .tools.transcribe.router import router as transcribe_router

log = logging.getLogger("app.request")


def custom_generate_unique_id(route: APIRoute) -> str:
    """Stable, clean operationIds (e.g. "transcribe_start") so the generated
    TS client gets readable function names instead of FastAPI's defaults."""
    tag = route.tags[0] if route.tags else "default"
    return f"{tag}_{route.name}"


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging()
    settings.validate_required()
    logging.getLogger("app").info(
        "started engine=%s cors=%s", settings.transcribe_engine, settings.cors_origins
    )
    yield


app = FastAPI(
    title="Instagram Tools API",
    version="0.1.0",
    lifespan=lifespan,
    generate_unique_id_function=custom_generate_unique_id,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(ToolError)
async def tool_error_handler(_: Request, exc: ToolError) -> JSONResponse:
    """The single place expected tool failures become HTTP responses.

    `detail` mirrors `message` so the current frontend keeps working; it goes
    away when the client is generated from this schema (Architecture/04 Phase 3).
    """
    return JSONResponse(
        status_code=exc.http_status,
        content={"code": exc.code, "message": exc.message, "detail": exc.message},
    )


@app.middleware("http")
async def request_log(request: Request, call_next):
    rid = request.headers.get("x-request-id") or uuid.uuid4().hex[:12]
    start = time.perf_counter()
    try:
        response = await call_next(request)
    except Exception:
        log.exception(
            "%s %s -> 500 rid=%s dur=%.0fms",
            request.method,
            request.url.path,
            rid,
            (time.perf_counter() - start) * 1000,
        )
        raise
    response.headers["x-request-id"] = rid
    log.info(
        "%s %s -> %s rid=%s dur=%.0fms",
        request.method,
        request.url.path,
        response.status_code,
        rid,
        (time.perf_counter() - start) * 1000,
    )
    return response


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "engine": settings.transcribe_engine}


app.include_router(transcribe_router)
app.include_router(profile_router)
app.include_router(download_router)
