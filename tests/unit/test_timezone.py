"""
Unit tests for timezone utility functions.

Tests cover:
- to_utc: Convert from user timezone to UTC
- from_utc: Convert from UTC to user timezone
- is_valid_timezone: Validate IANA timezone names
- now_utc, now_local: Current time functions
- get_common_timezones: UI timezone selector data
- format_datetime_local: Formatted local time display
"""

import pytest
from datetime import datetime, timezone
from zoneinfo import ZoneInfo


class TestToUtc:
    """Tests for to_utc function."""

    def test_moscow_noon_to_utc(self):
        """Moscow (UTC+3) noon should be 09:00 UTC."""
        from backend.app.utils.timezone import to_utc

        # Moscow noon (naive datetime, assumed to be in Moscow timezone)
        moscow_noon = datetime(2025, 12, 6, 12, 0, 0)
        utc = to_utc(moscow_noon, "Europe/Moscow")

        assert utc.hour == 9
        assert utc.tzinfo == timezone.utc
        assert utc.date() == moscow_noon.date()

    def test_new_york_midnight_to_utc(self):
        """New York (UTC-5 in winter) midnight should be 05:00 UTC."""
        from backend.app.utils.timezone import to_utc

        ny_midnight = datetime(2025, 1, 15, 0, 0, 0)
        utc = to_utc(ny_midnight, "America/New_York")

        assert utc.hour == 5
        assert utc.tzinfo == timezone.utc

    def test_utc_to_utc_no_change(self):
        """UTC to UTC should not change the time."""
        from backend.app.utils.timezone import to_utc

        utc_time = datetime(2025, 12, 6, 12, 0, 0)
        result = to_utc(utc_time, "UTC")

        assert result.hour == 12
        assert result.tzinfo == timezone.utc

    def test_timezone_aware_input(self):
        """Already timezone-aware datetime should be converted correctly."""
        from backend.app.utils.timezone import to_utc

        moscow_tz = ZoneInfo("Europe/Moscow")
        moscow_aware = datetime(2025, 12, 6, 12, 0, 0, tzinfo=moscow_tz)
        utc = to_utc(moscow_aware, "Europe/Moscow")

        assert utc.hour == 9
        assert utc.tzinfo == timezone.utc

    def test_null_timezone_uses_system(self, monkeypatch):
        """NULL timezone should fallback to SYSTEM_TIMEZONE."""
        from backend.app.utils.timezone import to_utc

        # Assuming SYSTEM_TIMEZONE is UTC by default
        utc_time = datetime(2025, 12, 6, 12, 0, 0)
        result = to_utc(utc_time, None)

        # With UTC as system timezone, time should be the same
        assert result.hour == 12
        assert result.tzinfo == timezone.utc


class TestFromUtc:
    """Tests for from_utc function."""

    def test_utc_to_moscow(self):
        """09:00 UTC should be noon in Moscow (UTC+3)."""
        from backend.app.utils.timezone import from_utc

        utc_9am = datetime(2025, 12, 6, 9, 0, 0, tzinfo=timezone.utc)
        moscow = from_utc(utc_9am, "Europe/Moscow")

        assert moscow.hour == 12
        assert str(moscow.tzinfo) == "Europe/Moscow"

    def test_utc_to_new_york(self):
        """05:00 UTC should be midnight in New York (UTC-5 in winter)."""
        from backend.app.utils.timezone import from_utc

        utc_5am = datetime(2025, 1, 15, 5, 0, 0, tzinfo=timezone.utc)
        ny = from_utc(utc_5am, "America/New_York")

        assert ny.hour == 0
        assert str(ny.tzinfo) == "America/New_York"

    def test_naive_utc_input(self):
        """Naive datetime should be assumed UTC and converted."""
        from backend.app.utils.timezone import from_utc

        naive_utc = datetime(2025, 12, 6, 9, 0, 0)
        moscow = from_utc(naive_utc, "Europe/Moscow")

        assert moscow.hour == 12

    def test_null_timezone_uses_system(self):
        """NULL timezone should fallback to SYSTEM_TIMEZONE."""
        from backend.app.utils.timezone import from_utc

        utc_time = datetime(2025, 12, 6, 12, 0, 0, tzinfo=timezone.utc)
        result = from_utc(utc_time, None)

        # Result should be in SYSTEM_TIMEZONE (UTC by default)
        assert result is not None


class TestIsValidTimezone:
    """Tests for is_valid_timezone function."""

    def test_valid_timezones(self):
        """Common valid timezone names should return True."""
        from backend.app.utils.timezone import is_valid_timezone

        valid = [
            "UTC",
            "Europe/Moscow",
            "Europe/London",
            "America/New_York",
            "Asia/Tokyo",
            "Australia/Sydney",
        ]

        for tz in valid:
            assert is_valid_timezone(tz) is True, f"{tz} should be valid"

    def test_invalid_timezones(self):
        """Invalid timezone names should return False."""
        from backend.app.utils.timezone import is_valid_timezone

        invalid = [
            "Invalid/Zone",
            "Moscow",
            # Note: EST is technically valid IANA timezone (though deprecated)
            # "EST",  # Removed - exists in zoneinfo.available_timezones()
            "GMT+3",  # Offset format not valid
            "",
            "Europe",
        ]

        for tz in invalid:
            assert is_valid_timezone(tz) is False, f"{tz} should be invalid"


class TestNowUtc:
    """Tests for now_utc function."""

    def test_returns_utc_timezone(self):
        """now_utc should return timezone-aware datetime in UTC."""
        from backend.app.utils.timezone import now_utc

        now = now_utc()

        assert now.tzinfo == timezone.utc

    def test_returns_current_time(self):
        """now_utc should return current time (within 1 second tolerance)."""
        from backend.app.utils.timezone import now_utc

        before = datetime.now(timezone.utc)
        now = now_utc()
        after = datetime.now(timezone.utc)

        assert before <= now <= after


class TestNowLocal:
    """Tests for now_local function."""

    def test_returns_timezone_aware(self):
        """now_local should return timezone-aware datetime."""
        from backend.app.utils.timezone import now_local

        now = now_local("Europe/Moscow")

        assert now.tzinfo is not None
        assert str(now.tzinfo) == "Europe/Moscow"

    def test_null_timezone_uses_system(self):
        """now_local(None) should use SYSTEM_TIMEZONE."""
        from backend.app.utils.timezone import now_local

        now = now_local(None)

        assert now.tzinfo is not None


class TestGetCommonTimezones:
    """Tests for get_common_timezones function."""

    def test_returns_list(self):
        """get_common_timezones should return a list."""
        from backend.app.utils.timezone import get_common_timezones

        result = get_common_timezones()

        assert isinstance(result, list)
        assert len(result) > 0

    def test_contains_required_fields(self):
        """Each timezone entry should have name, offset, and display fields."""
        from backend.app.utils.timezone import get_common_timezones

        result = get_common_timezones()

        for tz in result:
            assert "name" in tz
            assert "offset" in tz
            assert "display" in tz

    def test_contains_common_timezones(self):
        """Result should include UTC and Europe/Moscow."""
        from backend.app.utils.timezone import get_common_timezones

        result = get_common_timezones()
        names = [tz["name"] for tz in result]

        assert "UTC" in names
        assert "Europe/Moscow" in names


class TestFormatDatetimeLocal:
    """Tests for format_datetime_local function."""

    def test_format_moscow_time(self):
        """UTC time should be formatted in Moscow timezone."""
        from backend.app.utils.timezone import format_datetime_local

        utc_time = datetime(2025, 12, 6, 9, 30, 0, tzinfo=timezone.utc)
        formatted = format_datetime_local(utc_time, "Europe/Moscow")

        # 09:30 UTC = 12:30 Moscow
        assert "06.12.2025" in formatted
        assert "12:30" in formatted

    def test_format_null_timezone(self):
        """NULL timezone should use SYSTEM_TIMEZONE."""
        from backend.app.utils.timezone import format_datetime_local

        utc_time = datetime(2025, 12, 6, 12, 0, 0, tzinfo=timezone.utc)
        formatted = format_datetime_local(utc_time, None)

        assert formatted is not None
        assert "06.12.2025" in formatted


class TestRoundTrip:
    """Tests for round-trip conversion (to_utc -> from_utc)."""

    def test_roundtrip_moscow(self):
        """Converting Moscow -> UTC -> Moscow should preserve original time."""
        from backend.app.utils.timezone import to_utc, from_utc

        original = datetime(2025, 12, 6, 15, 30, 0)
        utc = to_utc(original, "Europe/Moscow")
        back = from_utc(utc, "Europe/Moscow")

        assert back.hour == original.hour
        assert back.minute == original.minute
        assert back.day == original.day

    def test_roundtrip_preserves_date_across_day_boundary(self):
        """Conversion should handle day boundaries correctly."""
        from backend.app.utils.timezone import to_utc, from_utc

        # 01:00 Moscow = 22:00 UTC (previous day)
        moscow_early = datetime(2025, 12, 6, 1, 0, 0)
        utc = to_utc(moscow_early, "Europe/Moscow")
        back = from_utc(utc, "Europe/Moscow")

        assert back.hour == 1
        assert back.day == 6
        assert back.month == 12


class TestDSTHandling:
    """Tests for Daylight Saving Time handling."""

    def test_dst_transition_spring(self):
        """DST spring transition should be handled correctly."""
        from backend.app.utils.timezone import to_utc, from_utc

        # London spring forward: 2025-03-30 01:00 -> 02:00 becomes 03:00
        # 02:30 doesn't exist (skipped), but 01:30 and 03:30 do
        before_dst = datetime(2025, 3, 30, 0, 30, 0)
        utc = to_utc(before_dst, "Europe/London")
        back = from_utc(utc, "Europe/London")

        # Should preserve original time
        assert back.hour == 0
        assert back.minute == 30

    def test_dst_transition_fall(self):
        """DST fall transition should be handled correctly."""
        from backend.app.utils.timezone import to_utc, from_utc

        # London fall back: 2025-10-26 02:00 -> 01:00 (ambiguous hour)
        after_dst = datetime(2025, 10, 26, 3, 0, 0)
        utc = to_utc(after_dst, "Europe/London")

        # 3:00 GMT = 3:00 UTC (GMT = UTC in winter)
        assert utc.hour == 3
