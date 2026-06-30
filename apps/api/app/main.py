"""FastAPI entrypoint.

To add a tool: create app/tools/<slug>/ with router.py (an APIRouter named
`router`), schemas.py, and service.py. Routers are auto-discovered below — no
edit to this file needed. Raise ToolError subclasses for expected failures; the
global handler turns them into HTTP responses, so routers need no try/except.

Layers: core/ (config, db, errors, auth, logging) · integrations/ (instagram) ·
media/ · providers/ (transcription, …) · jobs/ · tools/<slug>/.
"""

from __future__ import annotations

import importlib
import logging
import pkgutil
import time
import uuid
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.routing import APIRoute

from app import tools
from app.core.config import settings
from app.core.errors import ToolError
from app.core.logging import setup_logging

log = logging.getLogger("app.request")


def _discover_tool_routers() -> list[APIRouter]:
    """Every app/tools/<slug>/router.py that exports `router`, in import order."""
    routers: list[APIRouter] = []
    for mod in pkgutil.iter_modules(tools.__path__):
        if not mod.ispkg:
            continue
        try:
            module = importlib.import_module(f"app.tools.{mod.name}.router")
        except ModuleNotFoundError:
            continue
        router = getattr(module, "router", None)
        if isinstance(router, APIRouter):
            routers.append(router)
    return routers


def custom_generate_unique_id(route: APIRoute) -> str:
    """Stable, clean operationIds (e.g. "transcribe_start") so the generated
    TS client gets readable function names instead of FastAPI's defaults."""
    tag = route.tags[0] if route.tags else "default"
    return f"{tag}_{route.name}"


@asynccontextmanager
async def lifespan(_: FastAPI):
    setup_logging()
    settings.validate_required()
    if settings.auth_bypassed:
        logging.getLogger("app").warning(
            "AUTH BYPASSED (AUTH_DISABLED=true, env=%s) — internal-key check off, "
            "requests attributed to %r. Never use this in production.",
            settings.environment,
            settings.dev_user_id,
        )
    # Mark jobs that were "running" when a previous process died as interrupted,
    # so they don't hang forever (Architecture/04 Phase 5). A DB hiccup at boot
    # shouldn't stop the API from starting — log and continue.
    try:
        from app.jobs.reaper import reap_stale

        reap_stale()
    except Exception:
        logging.getLogger("app").exception("startup job reaper failed")
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


for _router in _discover_tool_routers():
    app.include_router(_router)
