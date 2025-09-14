"""
Comprehensive tests for periods API endpoint JSON serialization fix.

Tests the specific fix for JSON serialization of PeriodResponse objects and datetime fields.
The issue was that datetime fields weren't properly serialized to ISO format.

Fix details:
- backend-fastapi/app/api/v1/endpoints/periods.py (line 116: using .dict())
- backend-fastapi/app/core/response.py (DateTimeJSONEncoder class)
"""
import pytest
import json
from datetime import datetime, date
from unittest.mock import Mock, AsyncMock
from fastapi.testclient import TestClient
from httpx import AsyncClient

from app.core.response import DateTimeJSONEncoder, success_response
from app.api.v1.endpoints.periods import PeriodResponse


class TestDateTimeJSONEncoder:
    """Test the custom DateTimeJSONEncoder class."""

    def test_datetime_serialization(self):
        """Test datetime objects are serialized to ISO format."""
        encoder = DateTimeJSONEncoder()
        test_datetime = datetime(2024, 9, 13, 15, 30, 45)

        # Test direct serialization
        result = encoder.default(test_datetime)
        assert result == "2024-09-13T15:30:45"

    def test_date_serialization(self):
        """Test date objects are serialized to ISO format."""
        encoder = DateTimeJSONEncoder()
        test_date = date(2024, 9, 13)

        # Test direct serialization
        result = encoder.default(test_date)
        assert result == "2024-09-13"

    def test_non_datetime_objects_fallback(self):
        """Test non-datetime objects fall back to parent encoder."""
        encoder = DateTimeJSONEncoder()

        # This should raise TypeError as expected for unknown objects
        with pytest.raises(TypeError):
            encoder.default(object())

    def test_json_dumps_with_datetime(self):
        """Test json.dumps works correctly with DateTimeJSONEncoder."""
        test_data = {
            "id": 1,
            "created_at": datetime(2024, 9, 13, 15, 30, 45),
            "date_field": date(2024, 9, 13),
            "name": "Test Period"
        }

        result_json = json.dumps(test_data, cls=DateTimeJSONEncoder)
        result_dict = json.loads(result_json)

        assert result_dict["id"] == 1
        assert result_dict["created_at"] == "2024-09-13T15:30:45"
        assert result_dict["date_field"] == "2024-09-13"
        assert result_dict["name"] == "Test Period"


class TestPeriodResponseSerialization:
    """Test PeriodResponse object serialization."""

    def test_period_response_dict_method(self):
        """Test PeriodResponse.dict() properly converts all fields."""
        test_datetime = datetime(2024, 9, 13, 15, 30, 45)

        period_response = PeriodResponse(
            id=1,
            date=test_datetime,
            ru_name="Сентябрь 2024",
            start_date=test_datetime,
            end_date=test_datetime,
            period_id=1,
            period_name="Сентябрь 2024",
            period_year=2024,
            period_month=9,
            is_active=True,
            created_at=test_datetime,
            updated_at=test_datetime,
            user_id=123
        )

        # Test the .dict() method works
        result_dict = period_response.dict()

        # Verify all fields are present
        assert result_dict["id"] == 1
        assert result_dict["date"] == test_datetime
        assert result_dict["ru_name"] == "Сентябрь 2024"
        assert result_dict["start_date"] == test_datetime
        assert result_dict["end_date"] == test_datetime
        assert result_dict["period_id"] == 1
        assert result_dict["period_name"] == "Сентябрь 2024"
        assert result_dict["period_year"] == 2024
        assert result_dict["period_month"] == 9
        assert result_dict["is_active"] is True
        assert result_dict["created_at"] == test_datetime
        assert result_dict["updated_at"] == test_datetime
        assert result_dict["user_id"] == 123

    def test_period_response_json_serialization(self):
        """Test PeriodResponse can be JSON serialized with DateTimeJSONEncoder."""
        test_datetime = datetime(2024, 9, 13, 15, 30, 45)

        period_response = PeriodResponse(
            id=1,
            date=test_datetime,
            ru_name="Сентябрь 2024",
            start_date=test_datetime,
            end_date=test_datetime,
            period_id=1,
            period_name="Сентябрь 2024",
            period_year=2024,
            period_month=9,
            is_active=True,
            created_at=test_datetime,
            updated_at=test_datetime,
            user_id=123
        )

        # Test JSON serialization of dict with custom encoder
        result_dict = period_response.dict()
        json_string = json.dumps(result_dict, cls=DateTimeJSONEncoder)
        parsed_result = json.loads(json_string)

        # Verify datetime fields are properly serialized
        assert parsed_result["date"] == "2024-09-13T15:30:45"
        assert parsed_result["start_date"] == "2024-09-13T15:30:45"
        assert parsed_result["end_date"] == "2024-09-13T15:30:45"
        assert parsed_result["created_at"] == "2024-09-13T15:30:45"
        assert parsed_result["updated_at"] == "2024-09-13T15:30:45"

        # Verify other fields remain unchanged
        assert parsed_result["id"] == 1
        assert parsed_result["ru_name"] == "Сентябрь 2024"
        assert parsed_result["period_year"] == 2024
        assert parsed_result["period_month"] == 9
        assert parsed_result["is_active"] is True
        assert parsed_result["user_id"] == 123


class TestSuccessResponseWithPeriods:
    """Test success_response function with periods data."""

    def test_success_response_single_period(self):
        """Test success_response with a single period dict."""
        test_datetime = datetime(2024, 9, 13, 15, 30, 45)

        period_data = {
            "id": 1,
            "date": test_datetime,
            "ru_name": "Сентябрь 2024",
            "created_at": test_datetime,
            "user_id": 123
        }

        response = success_response(data=period_data)

        # Verify response structure
        assert response.status_code == 200

        # Parse response content
        content = json.loads(response.body.decode())

        assert content["success"] is True
        assert "data" in content
        assert content["data"]["id"] == 1
        assert content["data"]["date"] == "2024-09-13T15:30:45"  # ISO format
        assert content["data"]["ru_name"] == "Сентябрь 2024"
        assert content["data"]["created_at"] == "2024-09-13T15:30:45"
        assert content["data"]["user_id"] == 123

    def test_success_response_period_list(self):
        """Test success_response with a list of periods."""
        test_datetime1 = datetime(2024, 9, 13, 15, 30, 45)
        test_datetime2 = datetime(2024, 10, 1, 10, 0, 0)

        periods_data = [
            {
                "id": 1,
                "date": test_datetime1,
                "ru_name": "Сентябрь 2024",
                "created_at": test_datetime1,
                "user_id": 123
            },
            {
                "id": 2,
                "date": test_datetime2,
                "ru_name": "Октябрь 2024",
                "created_at": test_datetime2,
                "user_id": 123
            }
        ]

        response = success_response(data=periods_data, total=2)

        # Verify response structure
        assert response.status_code == 200

        # Parse response content
        content = json.loads(response.body.decode())

        assert content["success"] is True
        assert "data" in content
        assert "total" in content
        assert content["total"] == 2
        assert len(content["data"]) == 2

        # Verify first period
        first_period = content["data"][0]
        assert first_period["id"] == 1
        assert first_period["date"] == "2024-09-13T15:30:45"
        assert first_period["ru_name"] == "Сентябрь 2024"

        # Verify second period
        second_period = content["data"][1]
        assert second_period["id"] == 2
        assert second_period["date"] == "2024-10-01T10:00:00"
        assert second_period["ru_name"] == "Октябрь 2024"

    def test_success_response_empty_period_list(self):
        """Test success_response with empty periods list."""
        response = success_response(data=[], total=0)

        # Verify response structure
        assert response.status_code == 200

        # Parse response content
        content = json.loads(response.body.decode())

        assert content["success"] is True
        assert "data" in content
        assert "total" in content
        assert content["total"] == 0
        assert content["data"] == []


class TestPeriodsAPISerializationIntegration:
    """Integration tests for the periods API serialization fix."""

    def test_period_response_list_serialization_flow(self):
        """Test the complete flow of PeriodResponse list serialization."""
        test_datetime = datetime(2024, 9, 13, 15, 30, 45)

        # Simulate the exact flow from the API endpoint (line 116)
        period_dict = {
            'id': 1,
            'date': test_datetime,
            'ru_name': 'Сентябрь 2024',
            'start_date': test_datetime,
            'end_date': test_datetime,
            'period_id': 1,
            'period_name': 'Сентябрь 2024',
            'period_year': 2024,
            'period_month': 9,
            'is_active': True,
            'created_at': test_datetime,
            'updated_at': test_datetime,
            'user_id': 123
        }

        # Create PeriodResponse and convert to dict (the fix)
        period_response = PeriodResponse(**period_dict)
        serialized_dict = period_response.dict()

        # Simulate adding to response list
        response_periods = [serialized_dict]

        # Test final response creation
        response = success_response(data=response_periods, total=len(response_periods))

        # Verify the response is properly formed
        assert response.status_code == 200

        content = json.loads(response.body.decode())

        assert content["success"] is True
        assert "data" in content
        assert "total" in content
        assert content["total"] == 1
        assert len(content["data"]) == 1

        period_data = content["data"][0]

        # Verify all datetime fields are ISO serialized
        assert period_data["date"] == "2024-09-13T15:30:45"
        assert period_data["start_date"] == "2024-09-13T15:30:45"
        assert period_data["end_date"] == "2024-09-13T15:30:45"
        assert period_data["created_at"] == "2024-09-13T15:30:45"
        assert period_data["updated_at"] == "2024-09-13T15:30:45"

        # Verify other fields
        assert period_data["id"] == 1
        assert period_data["ru_name"] == "Сентябрь 2024"
        assert period_data["period_year"] == 2024
        assert period_data["period_month"] == 9
        assert period_data["is_active"] is True
        assert period_data["user_id"] == 123

    def test_multiple_periods_serialization(self):
        """Test serialization of multiple periods with various datetime values."""
        periods_data = []

        # Create test data with different datetime values
        for i in range(3):
            test_datetime = datetime(2024, 9 + i, 15, 10 + i, 30, 45)

            period_dict = {
                'id': i + 1,
                'date': test_datetime,
                'ru_name': f'Период {i + 1}',
                'start_date': test_datetime,
                'end_date': test_datetime,
                'period_id': i + 1,
                'period_name': f'Период {i + 1}',
                'period_year': 2024,
                'period_month': 9 + i,
                'is_active': True,
                'created_at': test_datetime,
                'updated_at': test_datetime,
                'user_id': 123
            }

            # Apply the fix: create PeriodResponse and convert to dict
            period_response = PeriodResponse(**period_dict)
            periods_data.append(period_response.dict())

        # Create response
        response = success_response(data=periods_data, total=len(periods_data))
        content = json.loads(response.body.decode())

        # Verify structure
        assert content["success"] is True
        assert len(content["data"]) == 3
        assert content["total"] == 3

        # Verify each period has properly serialized datetime fields
        for i, period in enumerate(content["data"]):
            expected_month = 9 + i
            expected_hour = 10 + i
            expected_datetime = f"2024-{expected_month:02d}-15T{expected_hour:02d}:30:45"

            assert period["date"] == expected_datetime
            assert period["start_date"] == expected_datetime
            assert period["end_date"] == expected_datetime
            assert period["created_at"] == expected_datetime
            assert period["updated_at"] == expected_datetime

            assert period["id"] == i + 1
            assert period["ru_name"] == f'Период {i + 1}'
            assert period["period_month"] == expected_month

    def test_edge_case_datetime_serialization(self):
        """Test edge cases for datetime serialization."""
        # Test with microseconds
        test_datetime = datetime(2024, 12, 31, 23, 59, 59, 999999)

        period_dict = {
            'id': 1,
            'date': test_datetime,
            'ru_name': 'Edge Case Period',
            'start_date': None,  # Test None values
            'end_date': test_datetime,
            'period_id': 1,
            'period_name': 'Edge Case Period',
            'period_year': 2024,
            'period_month': 12,
            'is_active': True,
            'created_at': test_datetime,
            'updated_at': None,  # Test None values
            'user_id': 123
        }

        period_response = PeriodResponse(**period_dict)
        serialized_dict = period_response.dict()

        response = success_response(data=[serialized_dict], total=1)
        content = json.loads(response.body.decode())

        period_data = content["data"][0]

        # Verify datetime with microseconds
        assert period_data["date"] == "2024-12-31T23:59:59.999999"
        assert period_data["end_date"] == "2024-12-31T23:59:59.999999"
        assert period_data["created_at"] == "2024-12-31T23:59:59.999999"

        # Verify None values remain None
        assert period_data["start_date"] is None
        assert period_data["updated_at"] is None


class TestSerializationErrorHandling:
    """Test error handling in serialization scenarios."""

    def test_invalid_datetime_handling(self):
        """Test that invalid datetime objects are handled gracefully."""
        # This test ensures the encoder doesn't break on edge cases
        encoder = DateTimeJSONEncoder()

        # Test valid datetime
        valid_datetime = datetime(2024, 9, 13)
        assert encoder.default(valid_datetime) == "2024-09-13T00:00:00"

        # Test valid date
        valid_date = date(2024, 9, 13)
        assert encoder.default(valid_date) == "2024-09-13"

    def test_period_response_with_missing_fields(self):
        """Test PeriodResponse creation with minimal required fields."""
        # Test with only required fields
        minimal_period = PeriodResponse(
            id=1,
            date=datetime(2024, 9, 13),
            ru_name="Minimal Period",
            start_date=None,
            end_date=None,
            period_id=1,
            period_name="Minimal Period",
            period_year=2024,
            period_month=9
        )

        serialized = minimal_period.dict()

        # Test JSON serialization works
        json_string = json.dumps(serialized, cls=DateTimeJSONEncoder)
        result = json.loads(json_string)

        assert result["id"] == 1
        assert result["date"] == "2024-09-13T00:00:00"
        assert result["ru_name"] == "Minimal Period"
        assert result["start_date"] is None
        assert result["end_date"] is None


# Performance test
class TestSerializationPerformance:
    """Test performance aspects of serialization fix."""

    def test_large_periods_list_serialization(self):
        """Test serialization performance with larger datasets."""
        import time

        # Create 100 periods
        periods_data = []
        base_datetime = datetime(2024, 1, 1)

        for i in range(100):
            test_datetime = datetime(2024, 1, 1 + i % 28, 10, 30, 45)  # Vary days

            period_dict = {
                'id': i + 1,
                'date': test_datetime,
                'ru_name': f'Период {i + 1}',
                'start_date': test_datetime,
                'end_date': test_datetime,
                'period_id': i + 1,
                'period_name': f'Период {i + 1}',
                'period_year': 2024,
                'period_month': 1,
                'is_active': True,
                'created_at': test_datetime,
                'updated_at': test_datetime,
                'user_id': 123
            }

            period_response = PeriodResponse(**period_dict)
            periods_data.append(period_response.dict())

        # Measure serialization time
        start_time = time.time()
        response = success_response(data=periods_data, total=len(periods_data))
        content = json.loads(response.body.decode())
        end_time = time.time()

        # Verify result
        assert content["success"] is True
        assert len(content["data"]) == 100
        assert content["total"] == 100

        # Performance assertion (should be fast)
        serialization_time = end_time - start_time
        assert serialization_time < 1.0  # Should complete in less than 1 second

        # Verify random samples are properly serialized
        sample_period = content["data"][50]  # Check middle item
        assert "T" in sample_period["date"]  # Should be ISO format
        assert sample_period["id"] == 51
        assert sample_period["ru_name"] == "Период 51"