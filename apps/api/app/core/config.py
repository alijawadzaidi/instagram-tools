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

    # --- LLM (AI tools) ---
    # Which provider AI tools use by default: "anthropic" | "openai". Per-tool /
    # per-call overrides are possible; both providers ship from day one.
    llm_provider: str = "anthropic"
    llm_model: str | None = None  # None -> the provider's default model
    anthropic_api_key: str | None = None

    # --- downloader / Instagram ---
    # Path to a Netscape-format cookies.txt exported from a logged-in browser.
    # Required when hosting (Instagram blocks data-center IPs); optional locally.
    ig_cookies_file: str | None = None
    download_retries: int = 3
    download_timeout: int = 60

    # --- database ---
    database_url: str = ""

    # --- internal auth ---
    # Shared secret with the Next.js BFF proxy. Every proxied request must carry
    # this in the X-Internal-Key header.
    internal_api_key: str = ""

    # --- dev auth bypass ---
    # Deployment environment. The bypass is HARD-disabled unless this is non-prod.
    environment: str = "development"
    # When true (and not production), the whole auth layer is skipped: the
    # internal-key check is a no-op and requests are attributed to dev_user_id.
    # One shared env var drives both apps: `AUTH_DISABLED=true pnpm dev`.
    auth_disabled: bool = False
    # Synthetic user id used to attribute jobs/quota while auth is bypassed.
    dev_user_id: str = "dev-user"

    # --- web/server ---
    # Comma-separated list of allowed CORS origins for the Next.js frontend.
    cors_origins: str = "http://localhost:3000"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def auth_bypassed(self) -> bool:
        """True only when explicitly disabled AND not in production — so a stray
        AUTH_DISABLED in a prod environment can never open the door."""
        return self.auth_disabled and self.environment != "production"

    def validate_required(self) -> None:
        """Fail fast at startup with one clear message instead of crashing
        mid-request with a stack trace nobody can act on."""
        missing = []
        if not self.database_url:
            missing.append("DATABASE_URL")
        # When auth is bypassed the internal key is unused, so don't require it.
        if not self.internal_api_key and not self.auth_bypassed:
            missing.append("INTERNAL_API_KEY")
        if self.transcribe_engine == "openai" and not self.openai_api_key:
            missing.append("OPENAI_API_KEY (required by TRANSCRIBE_ENGINE=openai)")
        if self.transcribe_engine == "assemblyai" and not self.assemblyai_api_key:
            missing.append("ASSEMBLYAI_API_KEY (required by TRANSCRIBE_ENGINE=assemblyai)")
        if missing:
            raise RuntimeError(
                "Missing required settings: "
                + ", ".join(missing)
                + ". Copy apps/api/.env.example to apps/api/.env and fill them in."
            )


settings = Settings()
