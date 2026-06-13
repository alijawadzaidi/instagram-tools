"""OpenAI LLM provider. The `openai` SDK and OPENAI_API_KEY are only required
when this provider is actually used."""

from __future__ import annotations

import logging
import time
from collections.abc import Iterator

from app.core.config import settings
from app.core.errors import EngineError

from .base import LLMResult, Message

log = logging.getLogger("app.llm")

_DEFAULT_MODEL = "gpt-4o-mini"


class OpenAIProvider:
    name = "openai"

    def __init__(self) -> None:
        try:
            import openai
        except ImportError as e:  # pragma: no cover - exercised only without the dep
            raise EngineError("The 'openai' package isn't installed.") from e
        if not settings.openai_api_key:
            raise EngineError("OPENAI_API_KEY is not set.")
        self._client = openai.OpenAI(api_key=settings.openai_api_key)

    def complete(
        self,
        messages: list[Message],
        *,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> LLMResult:
        model = model or settings.llm_model or _DEFAULT_MODEL
        chat = [{"role": m.role, "content": m.content} for m in messages]

        t0 = time.perf_counter()
        resp = self._client.chat.completions.create(
            model=model,
            messages=chat,
            max_tokens=max_tokens,
            temperature=temperature,
        )
        usage = resp.usage
        result = LLMResult(
            text=resp.choices[0].message.content or "",
            model=model,
            tokens_in=usage.prompt_tokens if usage else 0,
            tokens_out=usage.completion_tokens if usage else 0,
        )
        log.info(
            "llm openai model=%s tin=%d tout=%d dur=%.0fms",
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
        chat = [{"role": m.role, "content": m.content} for m in messages]
        stream = self._client.chat.completions.create(
            model=model,
            messages=chat,
            max_tokens=max_tokens,
            temperature=temperature,
            stream=True,
        )
        for chunk in stream:
            delta = chunk.choices[0].delta.content
            if delta:
                yield delta
