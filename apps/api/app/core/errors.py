"""Typed errors so failures surface clearly instead of being swallowed.

Each error carries a stable machine-readable `code` (the frontend can branch on
it) and a human-readable message. The router maps these to HTTP responses.
"""

from __future__ import annotations


class ToolError(Exception):
    """Base for all expected, user-facing tool failures."""

    code: str = "error"
    http_status: int = 400

    def __init__(self, message: str):
        super().__init__(message)
        self.message = message


class PrivateContentError(ToolError):
    code = "private"
    http_status = 422

    def __init__(self, message: str = "This reel is private or requires login."):
        super().__init__(message)


class RateLimitedError(ToolError):
    code = "rate_limited"
    http_status = 429

    def __init__(
        self,
        message: str = "Instagram is rate-limiting requests. Try again later "
        "or configure cookies.",
    ):
        super().__init__(message)


class NotFoundError(ToolError):
    code = "not_found"
    http_status = 404

    def __init__(self, message: str = "Couldn't find a reel at that URL."):
        super().__init__(message)


class DownloadError(ToolError):
    code = "download_failed"
    http_status = 502

    def __init__(self, message: str = "Failed to download the reel."):
        super().__init__(message)


class NoAudioError(ToolError):
    code = "no_audio"
    http_status = 422

    def __init__(self, message: str = "No speech was found in this reel."):
        super().__init__(message)


class EngineError(ToolError):
    code = "engine_error"
    http_status = 500

    def __init__(self, message: str = "Transcription failed."):
        super().__init__(message)
