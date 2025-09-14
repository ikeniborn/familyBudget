"""
Comprehensive unit tests for timezone utility functions.

This test suite covers timezone-aware datetime conversion, timezone-naive datetime
pass-through, None value handling, string datetime parsing, error cases, and edge cases.
"""
import pytest
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
from unittest.mock import patch

from app.core.timezone import (
    prepare_datetime_for_db,
    prepare_datetime_fields_for_db,
    get_utc_now,
    ensure_utc_for_comparison
)


class TestPrepareDatetimeForDb:
    """Test cases for prepare_datetime_for_db function."""

    def test_timezone_aware_datetime_conversion(self):
        """Test conversion of timezone-aware datetime to naive UTC."""
        # Create timezone-aware datetime in UTC
        aware_utc = datetime(2025, 9, 14, 10, 30, 45, 123456, tzinfo=timezone.utc)
        result = prepare_datetime_for_db(aware_utc)

        assert result is not None
        assert result.tzinfo is None  # Should be timezone-naive
        assert result == datetime(2025, 9, 14, 10, 30, 45, 123456)
        assert result.microsecond == 123456  # Microseconds preserved

    def test_timezone_aware_with_offset_conversion(self):
        """Test conversion of timezone-aware datetime with offset to naive UTC."""
        # Create timezone-aware datetime with +3 hours offset
        tz_plus3 = timezone(timedelta(hours=3))
        aware_plus3 = datetime(2025, 9, 14, 15, 30, 45, tzinfo=tz_plus3)
        result = prepare_datetime_for_db(aware_plus3)

        assert result is not None
        assert result.tzinfo is None
        # Should convert 15:30 +03:00 to 12:30 UTC
        assert result == datetime(2025, 9, 14, 12, 30, 45)

    def test_timezone_aware_with_negative_offset_conversion(self):
        """Test conversion of timezone-aware datetime with negative offset to naive UTC."""
        # Create timezone-aware datetime with -5 hours offset (EST)
        tz_minus5 = timezone(timedelta(hours=-5))
        aware_minus5 = datetime(2025, 9, 14, 10, 30, 45, tzinfo=tz_minus5)
        result = prepare_datetime_for_db(aware_minus5)

        assert result is not None
        assert result.tzinfo is None
        # Should convert 10:30 -05:00 to 15:30 UTC
        assert result == datetime(2025, 9, 14, 15, 30, 45)

    def test_timezone_naive_datetime_passthrough(self):
        """Test that timezone-naive datetime passes through unchanged."""
        naive_dt = datetime(2025, 9, 14, 10, 30, 45, 123456)
        result = prepare_datetime_for_db(naive_dt)

        assert result is not None
        assert result.tzinfo is None
        assert result == naive_dt
        assert result is naive_dt  # Should be the same object
        assert result.microsecond == 123456

    def test_none_value_handling(self):
        """Test that None values are handled correctly."""
        result = prepare_datetime_for_db(None)
        assert result is None

    def test_iso_string_parsing_with_z_suffix(self):
        """Test parsing of ISO string with 'Z' suffix."""
        iso_string = "2025-09-14T10:30:45.123456Z"
        result = prepare_datetime_for_db(iso_string)

        assert result is not None
        assert result.tzinfo is None
        assert result == datetime(2025, 9, 14, 10, 30, 45, 123456)

    def test_iso_string_parsing_with_timezone_offset(self):
        """Test parsing of ISO string with timezone offset."""
        iso_string = "2025-09-14T15:30:45.123456+03:00"
        result = prepare_datetime_for_db(iso_string)

        assert result is not None
        assert result.tzinfo is None
        # Should convert 15:30 +03:00 to 12:30 UTC
        assert result == datetime(2025, 9, 14, 12, 30, 45, 123456)

    def test_iso_string_parsing_without_microseconds(self):
        """Test parsing of ISO string without microseconds."""
        iso_string = "2025-09-14T10:30:45Z"
        result = prepare_datetime_for_db(iso_string)

        assert result is not None
        assert result.tzinfo is None
        assert result == datetime(2025, 9, 14, 10, 30, 45)

    def test_iso_string_parsing_naive(self):
        """Test parsing of naive ISO string."""
        iso_string = "2025-09-14T10:30:45.123456"
        result = prepare_datetime_for_db(iso_string)

        assert result is not None
        assert result.tzinfo is None
        assert result == datetime(2025, 9, 14, 10, 30, 45, 123456)

    def test_invalid_string_format_raises_value_error(self):
        """Test that invalid string format raises ValueError."""
        invalid_string = "not-a-datetime"
        with pytest.raises(ValueError) as exc_info:
            prepare_datetime_for_db(invalid_string)

        assert "Invalid datetime string format" in str(exc_info.value)
        assert "not-a-datetime" in str(exc_info.value)

    def test_malformed_iso_string_raises_value_error(self):
        """Test that malformed ISO string raises ValueError."""
        malformed_string = "2025-13-50T25:70:90Z"  # Invalid month, day, hour, minute, second
        with pytest.raises(ValueError) as exc_info:
            prepare_datetime_for_db(malformed_string)

        assert "Invalid datetime string format" in str(exc_info.value)

    def test_invalid_type_raises_type_error(self):
        """Test that invalid input types raise TypeError."""
        with pytest.raises(TypeError) as exc_info:
            prepare_datetime_for_db(123)

        assert "Expected datetime object or string" in str(exc_info.value)
        assert "got <class 'int'>" in str(exc_info.value)

    def test_list_input_raises_type_error(self):
        """Test that list input raises TypeError."""
        with pytest.raises(TypeError) as exc_info:
            prepare_datetime_for_db([2025, 9, 14])

        assert "Expected datetime object or string" in str(exc_info.value)
        assert "got <class 'list'>" in str(exc_info.value)

    def test_edge_case_microseconds_preservation(self):
        """Test that microseconds are preserved in conversion."""
        aware_dt = datetime(2025, 9, 14, 10, 30, 45, 999999, tzinfo=timezone.utc)
        result = prepare_datetime_for_db(aware_dt)

        assert result is not None
        assert result.microsecond == 999999

    def test_edge_case_year_boundaries(self):
        """Test datetime conversion at year boundaries."""
        # New Year's Eve in +10 timezone becomes New Year's Day in UTC
        tz_plus10 = timezone(timedelta(hours=10))
        aware_dt = datetime(2024, 12, 31, 22, 30, 0, tzinfo=tz_plus10)
        result = prepare_datetime_for_db(aware_dt)

        assert result is not None
        assert result == datetime(2024, 12, 31, 12, 30, 0)

        # New Year's Day in -10 timezone becomes previous year in UTC
        tz_minus10 = timezone(timedelta(hours=-10))
        aware_dt = datetime(2025, 1, 1, 5, 30, 0, tzinfo=tz_minus10)
        result = prepare_datetime_for_db(aware_dt)

        assert result is not None
        assert result == datetime(2025, 1, 1, 15, 30, 0)


class TestPrepareDatetimeFieldsForDb:
    """Test cases for prepare_datetime_fields_for_db function."""

    def test_single_field_processing(self):
        """Test processing of a single datetime field."""
        aware_dt = datetime(2025, 9, 14, 15, 30, 0, tzinfo=timezone(timedelta(hours=3)))
        data = {
            'start_date': aware_dt,
            'name': 'Test Period',
            'is_active': True
        }

        result = prepare_datetime_fields_for_db(data, 'start_date')

        assert result is not data  # Should be a copy
        assert result['start_date'].tzinfo is None
        assert result['start_date'] == datetime(2025, 9, 14, 12, 30, 0)  # Converted to UTC
        assert result['name'] == 'Test Period'  # Other fields unchanged
        assert result['is_active'] is True

    def test_multiple_fields_processing(self):
        """Test processing of multiple datetime fields."""
        start_dt = datetime(2025, 9, 14, 15, 30, 0, tzinfo=timezone(timedelta(hours=3)))
        end_dt = datetime(2025, 9, 14, 18, 30, 0, tzinfo=timezone(timedelta(hours=3)))

        data = {
            'start_date': start_dt,
            'end_date': end_dt,
            'created_at': datetime(2025, 9, 14, 10, 0, 0, tzinfo=timezone.utc),
            'name': 'Test Period',
            'count': 42
        }

        result = prepare_datetime_fields_for_db(data, 'start_date', 'end_date', 'created_at')

        assert result is not data
        assert result['start_date'] == datetime(2025, 9, 14, 12, 30, 0)
        assert result['end_date'] == datetime(2025, 9, 14, 15, 30, 0)
        assert result['created_at'] == datetime(2025, 9, 14, 10, 0, 0)
        assert result['name'] == 'Test Period'
        assert result['count'] == 42

    def test_missing_field_is_ignored(self):
        """Test that missing fields are silently ignored."""
        data = {
            'name': 'Test Period',
            'is_active': True
        }

        result = prepare_datetime_fields_for_db(data, 'start_date', 'end_date')

        assert result is not data
        assert result == data  # Should be unchanged

    def test_none_values_in_fields(self):
        """Test handling of None values in specified fields."""
        data = {
            'start_date': None,
            'end_date': datetime(2025, 9, 14, 10, 30, 0, tzinfo=timezone.utc),
            'name': 'Test Period'
        }

        result = prepare_datetime_fields_for_db(data, 'start_date', 'end_date')

        assert result['start_date'] is None
        assert result['end_date'] == datetime(2025, 9, 14, 10, 30, 0)
        assert result['end_date'].tzinfo is None

    def test_string_datetime_fields(self):
        """Test processing of string datetime fields."""
        data = {
            'start_date': '2025-09-14T15:30:00+03:00',
            'end_date': '2025-09-14T18:30:00Z',
            'name': 'Test Period'
        }

        result = prepare_datetime_fields_for_db(data, 'start_date', 'end_date')

        assert result['start_date'] == datetime(2025, 9, 14, 12, 30, 0)
        assert result['end_date'] == datetime(2025, 9, 14, 18, 30, 0)

    def test_invalid_input_type_raises_type_error(self):
        """Test that non-dictionary input raises TypeError."""
        with pytest.raises(TypeError) as exc_info:
            prepare_datetime_fields_for_db("not-a-dict", 'field1')

        assert "Expected dictionary" in str(exc_info.value)
        assert "got <class 'str'>" in str(exc_info.value)

    def test_invalid_datetime_field_raises_value_error(self):
        """Test that invalid datetime in field raises ValueError with context."""
        data = {
            'start_date': 'invalid-datetime',
            'name': 'Test Period'
        }

        with pytest.raises(ValueError) as exc_info:
            prepare_datetime_fields_for_db(data, 'start_date')

        assert "Invalid datetime in field 'start_date'" in str(exc_info.value)
        assert "invalid-datetime" in str(exc_info.value)

    def test_invalid_type_in_field_raises_value_error(self):
        """Test that invalid type in datetime field raises ValueError."""
        data = {
            'start_date': 12345,
            'name': 'Test Period'
        }

        with pytest.raises(ValueError) as exc_info:
            prepare_datetime_fields_for_db(data, 'start_date')

        assert "Invalid datetime in field 'start_date'" in str(exc_info.value)

    def test_empty_field_names(self):
        """Test processing with no field names specified."""
        data = {
            'start_date': datetime(2025, 9, 14, 10, 30, 0, tzinfo=timezone.utc),
            'name': 'Test Period'
        }

        result = prepare_datetime_fields_for_db(data)

        assert result is not data
        assert result == data  # Should be unchanged copy
        assert result['start_date'].tzinfo is not None  # Timezone preserved

    def test_original_data_not_modified(self):
        """Test that original data dictionary is not modified."""
        aware_dt = datetime(2025, 9, 14, 15, 30, 0, tzinfo=timezone(timedelta(hours=3)))
        data = {
            'start_date': aware_dt,
            'name': 'Test Period'
        }
        original_start_date = data['start_date']

        result = prepare_datetime_fields_for_db(data, 'start_date')

        # Original data should be unchanged
        assert data['start_date'] is original_start_date
        assert data['start_date'].tzinfo is not None

        # Result should be different
        assert result['start_date'] is not original_start_date
        assert result['start_date'].tzinfo is None


class TestGetUtcNow:
    """Test cases for get_utc_now function."""

    def test_returns_timezone_naive_datetime(self):
        """Test that get_utc_now returns timezone-naive datetime."""
        result = get_utc_now()

        assert isinstance(result, datetime)
        assert result.tzinfo is None

    @patch('app.core.timezone.datetime')
    def test_calls_datetime_now_with_utc(self, mock_datetime):
        """Test that function calls datetime.now with UTC timezone."""
        mock_utc_now = datetime(2025, 9, 14, 12, 30, 45, tzinfo=timezone.utc)
        mock_datetime.now.return_value = mock_utc_now
        mock_datetime.timezone = timezone

        result = get_utc_now()

        mock_datetime.now.assert_called_once_with(timezone.utc)

    def test_time_is_current(self):
        """Test that returned time is current (within reasonable bounds)."""
        import time
        before = time.time()
        result = get_utc_now()
        after = time.time()

        result_timestamp = result.timestamp()

        # Should be within a few seconds of current time
        assert before <= result_timestamp <= after


class TestEnsureUtcForComparison:
    """Test cases for ensure_utc_for_comparison function."""

    def test_none_input_returns_none(self):
        """Test that None input returns None."""
        result = ensure_utc_for_comparison(None)
        assert result is None

    def test_naive_datetime_assumed_utc(self):
        """Test that naive datetime is assumed to be UTC and returned as-is."""
        naive_dt = datetime(2025, 9, 14, 12, 30, 45)
        result = ensure_utc_for_comparison(naive_dt)

        assert result is naive_dt  # Should be same object
        assert result.tzinfo is None

    def test_utc_datetime_stripped_timezone(self):
        """Test that UTC datetime has timezone stripped."""
        utc_dt = datetime(2025, 9, 14, 12, 30, 45, tzinfo=timezone.utc)
        result = ensure_utc_for_comparison(utc_dt)

        assert result.tzinfo is None
        assert result == datetime(2025, 9, 14, 12, 30, 45)

    def test_timezone_aware_converted_to_utc(self):
        """Test that timezone-aware datetime is converted to UTC."""
        tz_plus3 = timezone(timedelta(hours=3))
        aware_dt = datetime(2025, 9, 14, 15, 30, 45, tzinfo=tz_plus3)
        result = ensure_utc_for_comparison(aware_dt)

        assert result.tzinfo is None
        assert result == datetime(2025, 9, 14, 12, 30, 45)  # Converted to UTC

    def test_negative_timezone_offset(self):
        """Test conversion with negative timezone offset."""
        tz_minus8 = timezone(timedelta(hours=-8))
        aware_dt = datetime(2025, 9, 14, 8, 30, 45, tzinfo=tz_minus8)
        result = ensure_utc_for_comparison(aware_dt)

        assert result.tzinfo is None
        assert result == datetime(2025, 9, 14, 16, 30, 45)  # Converted to UTC

    def test_microseconds_preserved(self):
        """Test that microseconds are preserved during conversion."""
        tz_plus5 = timezone(timedelta(hours=5))
        aware_dt = datetime(2025, 9, 14, 15, 30, 45, 123456, tzinfo=tz_plus5)
        result = ensure_utc_for_comparison(aware_dt)

        assert result.tzinfo is None
        assert result.microsecond == 123456
        assert result == datetime(2025, 9, 14, 10, 30, 45, 123456)


class TestIntegrationScenarios:
    """Integration tests combining multiple timezone utility functions."""

    def test_full_workflow_with_mixed_inputs(self):
        """Test complete workflow with mixed datetime inputs."""
        # Simulate data from API request with mixed datetime formats
        api_data = {
            'start_date': '2025-09-14T15:30:00+03:00',  # String with offset
            'end_date': datetime(2025, 9, 14, 18, 30, 0, tzinfo=timezone.utc),  # UTC aware
            'created_at': datetime(2025, 9, 14, 10, 0, 0),  # Naive
            'updated_at': None,  # None value
            'name': 'Integration Test Period',
            'count': 100
        }

        # Process datetime fields
        processed_data = prepare_datetime_fields_for_db(
            api_data,
            'start_date', 'end_date', 'created_at', 'updated_at'
        )

        # Verify all datetime fields are properly processed
        assert processed_data['start_date'] == datetime(2025, 9, 14, 12, 30, 0)  # +3:00 -> UTC
        assert processed_data['end_date'] == datetime(2025, 9, 14, 18, 30, 0)    # UTC stripped
        assert processed_data['created_at'] == datetime(2025, 9, 14, 10, 0, 0)   # Naive unchanged
        assert processed_data['updated_at'] is None                               # None preserved

        # Non-datetime fields unchanged
        assert processed_data['name'] == 'Integration Test Period'
        assert processed_data['count'] == 100

        # All processed datetimes are timezone-naive
        assert all(
            dt.tzinfo is None for dt in [
                processed_data['start_date'],
                processed_data['end_date'],
                processed_data['created_at']
            ] if dt is not None
        )

    def test_comparison_workflow(self):
        """Test datetime comparison workflow using ensure_utc_for_comparison."""
        # Different timezone representations of the same moment
        utc_dt = datetime(2025, 9, 14, 12, 30, 0, tzinfo=timezone.utc)
        plus3_dt = datetime(2025, 9, 14, 15, 30, 0, tzinfo=timezone(timedelta(hours=3)))
        minus5_dt = datetime(2025, 9, 14, 7, 30, 0, tzinfo=timezone(timedelta(hours=-5)))
        naive_dt = datetime(2025, 9, 14, 12, 30, 0)  # Assumed UTC

        # Normalize all for comparison
        normalized = [
            ensure_utc_for_comparison(dt) for dt in [utc_dt, plus3_dt, minus5_dt, naive_dt]
        ]

        # All should be equal when normalized
        expected = datetime(2025, 9, 14, 12, 30, 0)
        assert all(dt == expected for dt in normalized)
        assert all(dt.tzinfo is None for dt in normalized)

    def test_database_storage_simulation(self):
        """Test simulation of complete database storage workflow."""
        # Simulate incoming data from different sources
        form_data = {
            'period': '2025.09',
            'start_date': '2025-09-01T00:00:00+03:00',
            'end_date': '2025-09-30T23:59:59+03:00',
            'is_active': True
        }

        # Process for database storage
        db_data = prepare_datetime_fields_for_db(form_data, 'start_date', 'end_date')

        # Verify database-ready format
        assert db_data['start_date'] == datetime(2025, 8, 31, 21, 0, 0)      # Sep 1 00:00 +3 -> Aug 31 21:00 UTC
        assert db_data['end_date'] == datetime(2025, 9, 30, 20, 59, 59)      # Sep 30 23:59 +3 -> Sep 30 20:59 UTC
        assert all(dt.tzinfo is None for dt in [db_data['start_date'], db_data['end_date']])

        # Simulate retrieval from database and comparison
        current_time = get_utc_now()
        period_start = ensure_utc_for_comparison(db_data['start_date'])

        # Both should be timezone-naive and comparable
        assert period_start.tzinfo is None
        assert current_time.tzinfo is None
        # Comparison should work without timezone issues
        is_period_started = current_time >= period_start  # Should not raise exception
        assert isinstance(is_period_started, bool)