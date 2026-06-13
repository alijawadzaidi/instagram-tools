"""The LLM provider contract — same swap-by-config shape as the transcription
engines. AI tools depend on this Protocol, never on a specific vendor SDK."""

from __future__ import annotations

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Protocol


@dataclass
class Message:
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMResult:
    text: str
    model: str
    tokens_in: int = 0
    tokens_out: int = 0


class LLMProvider(Protocol):
    """Anything that turns a chat into text. Implementations log model/tokens/
    latency per call and surface token usage for cost accounting."""

    name: str

    def complete(
        self,
        messages: list[Message],
        *,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> LLMResult: ...

    def stream(
        self,
        messages: list[Message],
        *,
        model: str | None = None,
        max_tokens: int = 1024,
        temperature: float = 0.7,
    ) -> Iterator[str]: ...
