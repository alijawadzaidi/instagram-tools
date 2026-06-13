"""Dump the FastAPI OpenAPI schema to apps/api/openapi.json.

This is the contract artifact the TS client is generated from (Architecture/04
Phase 3). It needs the app to *import* but not to connect to anything, so we set
placeholder env vars if real ones are absent — schema generation never touches
the DB or Instagram.

Run: python -m scripts.export_openapi   (from apps/api, with the venv active)
"""

from __future__ import annotations

import json
import os
import pathlib

# Satisfy import-time requirements (engine creation, settings) without real infra.
os.environ.setdefault("DATABASE_URL", "postgresql://localhost/placeholder")
os.environ.setdefault("INTERNAL_API_KEY", "placeholder")

from app.main import app  # noqa: E402  (must follow the env defaults above)

OUT = pathlib.Path(__file__).resolve().parents[1] / "openapi.json"


def main() -> None:
    schema = app.openapi()
    OUT.write_text(json.dumps(schema, indent=2) + "\n")
    print(f"wrote {OUT} ({len(schema['paths'])} paths)")


if __name__ == "__main__":
    main()
