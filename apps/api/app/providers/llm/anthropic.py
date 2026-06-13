"""Anthropic (Claude) LLM provider. The `anthropic` SDK and ANTHROPIC_API_KEY
are only required when this provider is actually used."""

from __future__ import annotations

import logging
import time
from collections.abc import Iterator

from app.core.config import settings
from app.core.errors import EngineError

from .base import LLMResult, Message

log = logging.getLogger("app.llm")

_DEFAULT_MODEL = "claude-sonnet-4-6"


class AnthropicProvider:
    name = "anthropic"

    def __init__(self) -> None:
        try:
            import anthropic
        except ImportError as e:  # pragma: no cover - exercised only without the dep
            raise EngineError("The 'anthropic' package isn't installed.") from e
        if not settings.anthropic_api_key:
            raise EngineError("ANTHROPIC_API_KEY is not set.")
        self._client = anthropic.Anthropic(api_key=settings.anthropic_api_key)

    @staticmethod
    def _split(messages: list[Message]) -> tuple[str, list[dict]]:
        system = "\n\n".join(m.content for m in messages if m.role == "system")
        chat = [{"role": m.role, "content": m.content} for m in messages if m.role != "system"]
        return system, chat

    def complete(
        self,
        messages: list[Message],
        *,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> LLMResult:
        model = model or settings.llm_model or _DEFAULT_MODEL
        system, chat = self._split(messages)
        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": chat,
        }
        if system:
            kwargs["system"] = system

        t0 = time.perf_counter()
        resp = self._client.messages.create(**kwargs)
        text = "".join(b.text for b in resp.content if getattr(b, "type", None) == "text")
        result = LLMResult(
            text=text,
            model=model,
            tokens_in=resp.usage.input_tokens,
            tokens_out=resp.usage.output_tokens,
        )
        log.info(
            "llm anthropic model=%s tin=%d tout=%d dur=%.0fms",
            model,
            result.tokens_in,
            result.tokens_out,
            (time.perf_counter() - t0) * 1000,
        )
        return result

    def stream(
        self,
        messages: list[Message],
        *,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> Iterator[str]:
        model = model or settings.llm_model or _DEFAULT_MODEL
        system, chat = self._split(messages)
        kwargs: dict = {
            "model": model,
            "max_tokens": max_tokens,
            "temperature": temperature,
            "messages": chat,
        }
        if system:
            kwargs["system"] = system
        with self._client.messages.stream(**kwargs) as stream:
            yield from stream.text_stream
