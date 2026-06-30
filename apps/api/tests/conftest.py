"""Placeholder env so importing app modules never needs real infra."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://localhost/placeholder")
os.environ.setdefault("INTERNAL_API_KEY", "placeholder")
# Tests assume auth is ENFORCED by default (a local .env may set AUTH_DISABLED=true);
# the bypass is covered by dedicated tests that opt in explicitly. env > .env, so
# this wins over the dotenv value.
os.environ.setdefault("AUTH_DISABLED", "false")
