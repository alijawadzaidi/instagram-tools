"""Job handler registry.

A durable job stores its `tool` + `params` (not a Python closure), so the work
must be reconstructable from data. Each tool registers a handler that takes the
stored params and returns a result (optionally with LLM token/cost usage). The
in-process runner and a future separate worker both dispatch through here.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Callable, Union

from app.core.errors import ToolError


@dataclass
class HandlerResult:
    """What a job handler produces: the result payload plus optional spend."""

    result: dict
    tokens_in: int | None = None
    tokens_out: int | None = None
    cost_cents: int | None = None


# A handler may return a plain dict (result only) or a HandlerResult (with usage).
JobHandler = Callable[[dict], Union[HandlerResult, dict]]

_HANDLERS: dict[str, JobHandler] = {}


def job_handler(tool: str) -> Callable[[JobHandler], JobHandler]:
    """Register the handler for `tool`. Import-time side effect — the tool's
    service module must be imported for the registration to take effect."""

    def decorator(fn: JobHandler) -> JobHandler:
        _HANDLERS[tool] = fn
        return fn

    return decorator


def get_handler(tool: str) -> JobHandler:
    handler = _HANDLERS.get(tool)
    if handler is None:
        raise ToolError(f"No job handler registered for tool '{tool}'.")
    return handler


def coerce(out: HandlerResult | dict) -> HandlerResult:
    return out if isinstance(out, HandlerResult) else HandlerResult(result=out)
