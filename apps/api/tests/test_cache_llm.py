"""Tests for the result cache and the LLM provider registry/pricing."""

import pytest

from app.core.cache import TTLCache, make_key
from app.core.errors import EngineError
from app.providers.llm import get_llm
from app.providers.llm.pricing import estimate_cost_cents


class TestTTLCache:
    def test_set_get(self):
        c = TTLCache()
        c.set("k", 123)
        assert c.get("k") == 123

    def test_miss_returns_none(self):
        assert TTLCache().get("absent") is None

    def test_expiry(self):
        c = TTLCache()
        c.set("k", "v", ttl=-1)  # already expired
        assert c.get("k") is None

    def test_get_or_set_calls_factory_once(self):
        c = TTLCache()
        calls = []

        def factory():
            calls.append(1)
            return "made"

        assert c.get_or_set("k", factory) == "made"
        assert c.get_or_set("k", factory) == "made"
        assert len(calls) == 1

    def test_make_key_is_order_stable(self):
        assert make_key("t", {"b": 2, "a": 1}) == make_key("t", {"a": 1, "b": 2})


class TestLLMRegistry:
    def test_unknown_provider_raises(self):
        with pytest.raises(EngineError):
            get_llm("not_a_provider")

    def test_known_providers_listed(self):
        # the registry knows both providers (instantiation needs SDK + key, not tested)
        from app.providers.llm import _REGISTRY

        assert set(_REGISTRY) == {"anthropic", "openai"}


class TestPricing:
    def test_known_model(self):
        # 1M in + 1M out at (300, 1500) cents/Mtok = 1800 cents
        assert estimate_cost_cents("claude-sonnet-4-6", 1_000_000, 1_000_000) == 1800

    def test_unknown_model_returns_none(self):
        assert estimate_cost_cents("mystery-model", 100, 100) is None
