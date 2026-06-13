"""Token -> cost estimation for spend tracking.

Prices are cents per 1,000,000 tokens (input, output). These DO drift — treat
cost_cents as an estimate and update this table when vendor pricing changes.
Unknown models return None (cost simply not recorded).
"""

from __future__ import annotations

# model -> (input_cents_per_mtok, output_cents_per_mtok)
_PRICES: dict[str, tuple[float, float]] = {
    # Anthropic (approximate; verify against current pricing)
    "claude-sonnet-4-6": (300.0, 1500.0),
    "claude-haiku-4-5-20251001": (80.0, 400.0),
    "claude-opus-4-8": (1500.0, 7500.0),
    # OpenAI (approximate)
    "gpt-4o": (250.0, 1000.0),
    "gpt-4o-mini": (15.0, 60.0),
}


def estimate_cost_cents(model: str, tokens_in: int, tokens_out: int) -> int | None:
    price = _PRICES.get(model)
    if price is None:
        return None
    cin, cout = price
    cents = (tokens_in / 1_000_000) * cin + (tokens_out / 1_000_000) * cout
    return round(cents)
