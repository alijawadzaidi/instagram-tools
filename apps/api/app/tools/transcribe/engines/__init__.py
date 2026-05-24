"""Engine factory: pick the implementation named by config.transcribe_engine."""

from __future__ import annotations

from ....shared.errors import EngineError
from .base import Engine, Segment, Transcript

_REGISTRY = {
    "local_whisper": "app.tools.transcribe.engines.local_whisper:LocalWhisperEngine",
    "openai": "app.tools.transcribe.engines.openai:OpenAIEngine",
    "assemblyai": "app.tools.transcribe.engines.assemblyai:AssemblyAIEngine",
}

# Engines are created lazily and cached (model loading / clients are expensive).
_instances: dict[str, Engine] = {}


def get_engine(name: str) -> Engine:
    if name not in _REGISTRY:
        raise EngineError(
            f"Unknown transcribe engine '{name}'. "
            f"Choose one of: {', '.join(_REGISTRY)}."
        )
    if name not in _instances:
        module_path, class_name = _REGISTRY[name].split(":")
        import importlib

        cls = getattr(importlib.import_module(module_path), class_name)
        _instances[name] = cls()
    return _instances[name]


__all__ = ["get_engine", "Engine", "Segment", "Transcript"]
