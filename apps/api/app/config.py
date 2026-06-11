"""Central settings, read from environment / .env. Reused by every tool."""

from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- transcription engine ---
    # Which engine handles transcription: "local_whisper" | "openai" | "assemblyai".
    # Local is the dev default (free, no key). Production should set "openai".
    transcribe_engine: str = "local_whisper"
    whisper_model: str = "base"  # tiny|base|small|medium|large (local engine only)

    openai_api_key: str | None = None
    assemblyai_api_key: str | None = None

    # --- downloader / Instagram ---
    # Path to a Netscape-format cookies.txt exported from a logged-in browser.
    # Required when hosting (Instagram blocks data-center IPs); optional locally.
    ig_cookies_file: str | None = None
    download_retries: int = 3
    download_timeout: int = 60

    # --- database ---
    database_url: str = ""

    # --- web/server ---
    # Comma-separated list of allowed CORS origins for the Next.js frontend.
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
