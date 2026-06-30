"""Unit tests for the deterministic parsing logic — the fragile, high-value bits
that don't need a live Instagram (URL/caption parsing, cursor codec, yt-dlp
error classification, quality selectors, settings validation)."""

import pytest

from app.core.config import Settings
from app.core.errors import (
    DownloadError,
    NotFoundError,
    PrivateContentError,
    RateLimitedError,
)
from app.integrations.instagram.download import _classify, _selector
from app.integrations.instagram.extractor import extract_shortcode
from app.integrations.instagram.hashtags import extract_hashtags
from app.integrations.instagram.profile import _decode_cursor, _encode_cursor


class TestExtractShortcode:
    @pytest.mark.parametrize(
        "url,expected",
        [
            ("https://www.instagram.com/reel/ABC123/", "ABC123"),
            ("https://instagram.com/reels/xy_z-9/", "xy_z-9"),
            ("https://www.instagram.com/p/CoDe45/?igshid=1", "CoDe45"),
            ("https://www.instagram.com/tv/Vid99/", "Vid99"),
            ("https://www.instagram.com/reel/ABC123/#fragment", "ABC123"),
        ],
    )
    def test_extracts(self, url, expected):
        assert extract_shortcode(url) == expected

    @pytest.mark.parametrize(
        "url", ["https://example.com/reel/x/", "https://instagram.com/natgeo/", "garbage"]
    )
    def test_none_for_non_reel(self, url):
        assert extract_shortcode(url) is None


class TestExtractHashtags:
    def test_basic(self):
        assert extract_hashtags("love #Sunset and #BEACH vibes") == ["#sunset", "#beach"]

    def test_dedupes_keeping_order(self):
        assert extract_hashtags("#a #b #A #b #c") == ["#a", "#b", "#c"]

    def test_skips_all_numeric(self):
        assert extract_hashtags("#2024 #year2024 #100") == ["#year2024"]

    def test_empty_and_none(self):
        assert extract_hashtags("") == []
        assert extract_hashtags(None) == []


class TestCursorCodec:
    def test_roundtrip(self):
        assert _decode_cursor(_encode_cursor("123", "456_abc")) == ("123", "456_abc")

    def test_invalid_raises_notfound(self):
        with pytest.raises(NotFoundError):
            _decode_cursor("!!!not-base64!!!")


class TestClassifyDownloadError:
    @pytest.mark.parametrize(
        "message,exc",
        [
            ("Login required to view this", PrivateContentError),
            ("This account is private", PrivateContentError),
            ("HTTP Error 429: rate limit exceeded", RateLimitedError),
            ("temporarily blocked", RateLimitedError),
            ("Video not found (404)", NotFoundError),
            ("some other failure", DownloadError),
        ],
    )
    def test_classify(self, message, exc):
        assert isinstance(_classify(message), exc)


class TestSelector:
    def test_best(self):
        assert "best" in _selector("best")

    def test_width(self):
        assert "width<=720" in _selector("720")

    def test_unknown_falls_back_to_best(self):
        assert _selector("weird") == "bestvideo*+bestaudio/best"


class TestSettingsValidation:
    def test_missing_required_raises(self):
        # auth_disabled=False explicitly: the bypass relaxes these requirements,
        # and a local .env may set AUTH_DISABLED=true.
        s = Settings(database_url="", internal_api_key="", auth_disabled=False)
        with pytest.raises(RuntimeError) as e:
            s.validate_required()
        assert "DATABASE_URL" in str(e.value)
        assert "INTERNAL_API_KEY" in str(e.value)

    def test_openai_engine_needs_key(self):
        s = Settings(
            database_url="x", internal_api_key="x", transcribe_engine="openai", openai_api_key=None
        )
        with pytest.raises(RuntimeError) as e:
            s.validate_required()
        assert "OPENAI_API_KEY" in str(e.value)

    def test_valid_passes(self):
        Settings(database_url="x", internal_api_key="x").validate_required()
