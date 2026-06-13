"""LLM provider registry — pick the implementation named by config.llm_provider.

Same pattern as providers/transcription: a string-path registry with lazy,
cached singletons, so importing this module never imports a vendor SDK or needs
an API key (that happens on first get_llm(name)).
"""

from __future__ import annotations

from app.core.errors import EngineError

from .base import LLMProvider, LLMResult, Message
from .pricing import estimate_cost_cents

_REGISTRY = {
    "anthropic": "app.providers.llm.anthropic:AnthropicProvider",
    "openai": "app.providers.llm.openai:OpenAIProvider",
}

_instances: dict[str, LLMProvider] = {}


def get_llm(name: str) -> LLMProvider:
    if name not in _REGISTRY:
        raise EngineError(
            f"Unknown LLM provider '{name}'. Choose one of: {', '.join(_REGISTRY)}."
        )
    if name not in _instances:
        import importlib

        module_path, class_name = _REGISTRY[name].split(":")
        cls = getattr(importlib.import_module(module_path), class_name)
        _instances[name] = cls()
    return _instances[name]


__all__ = ["get_llm", "LLMProvider", "LLMResult", "Message", "estimate_cost_cents"]
