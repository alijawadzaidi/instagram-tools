"""Placeholder env so importing app modules never needs real infra."""

import os

os.environ.setdefault("DATABASE_URL", "postgresql://localhost/placeholder")
os.environ.setdefault("INTERNAL_API_KEY", "placeholder")
