"""
Comprehensive tests for periods API endpoints.
Tests all CRUD operations with focus on duplicate handling (409 errors) and user isolation.
Updated to test unified API response format: {"success": true/false, "data": ..., "error": ...}
"""
import pytest
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient


def validate_success_response(response_data: dict, expected_data_checks: dict = None):
    """Helper function to validate unified success response format."""
    assert "success" in response_data
    assert response_data["success"] is True
    assert "data" in response_data

    if expected_data_checks:
        data = response_data["data"]
        for key, expected_value in expected_data_checks.items():
            assert key in data
            if expected_value is not None:
                assert data[key] == expected_value

    return response_data["data"]


def validate_error_response(response_data: dict, expected_error_substring: str = None):
    """Helper function to validate unified error response format."""
    assert "success" in response_data
    assert response_data["success"] is False
    assert "error" in response_data
    assert isinstance(response_data["error"], str)

    if expected_error_substring:
        assert expected_error_substring in response_data["error"]

    return response_data["error"]


def validate_list_response(response_data: dict, expected_total: int = None):
    """Helper function to validate unified list response format."""
    assert "success" in response_data
    assert response_data["success"] is True
    assert "data" in response_data
    assert isinstance(response_data["data"], list)

    if expected_total is not None:
        assert "total" in response_data
        assert response_data["total"] == expected_total

    return response_data["data"]


class TestPeriodsCRUDOperations:
    """Test basic CRUD operations for periods."""

    def test_create_period_success(self, authenticated_client: TestClient):
        """Test successful period creation with unified response format."""
        period_data = {
            "period_year": 2025,
            "period_month": 1,
            "period_name": "Январь 2025",
            "is_active": True
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data, {
            "period_year": 2025,
            "period_month": 1,
            "ru_name": "Январь 2025",
            "is_active": True
        })
        assert "id" in data

    def test_create_period_legacy_format(self, authenticated_client: TestClient):
        """Test period creation using legacy format conversion with unified response."""
        period_data = {
            "period_year": 2025,
            "period_month": 2,
            "is_active": True
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data, {
            "period_year": 2025,
            "period_month": 2,
            "ru_name": "2025.02"
        })

    def test_create_period_modern_format(self, authenticated_client: TestClient):
        """Test period creation using modern datetime format with unified response."""
        period_data = {
            "date": "2025-03-01T00:00:00",
            "ru_name": "Март 2025",
            "start_date": "2025-03-01T00:00:00",
            "end_date": "2025-03-31T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data, {
            "ru_name": "Март 2025",
            "period_year": 2025,
            "period_month": 3
        })

    def test_create_period_missing_data(self, authenticated_client: TestClient):
        """Test period creation with missing required fields returns unified error format."""
        period_data = {}

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        response_data = response.json()
        validate_error_response(response_data, "Validation error")


class TestPeriodsDuplicateHandling:
    """Test duplicate period handling and 409 conflict responses."""

    def test_create_duplicate_period_409_error(self, authenticated_client: TestClient):
        """Test creating duplicate period returns 409 Conflict."""
        period_data = {
            "period_year": 2025,
            "period_month": 4,
            "period_name": "Апрель 2025",
            "is_active": True
        }

        # Create first period
        response1 = authenticated_client.post("/api/periods/", json=period_data)
        assert response1.status_code == status.HTTP_200_OK
        validate_success_response(response1.json())

        # Try to create duplicate
        response2 = authenticated_client.post("/api/periods/", json=period_data)
        assert response2.status_code == status.HTTP_409_CONFLICT

        # Check unified error format and message contains date information
        response_data = response2.json()
        error_message = validate_error_response(response_data, "уже существует")
        assert "2025-04-01" in error_message

    def test_duplicate_period_different_names_same_date(self, authenticated_client: TestClient):
        """Test that periods with same date but different names are still duplicates."""
        # Create first period
        period1_data = {
            "period_year": 2025,
            "period_month": 5,
            "period_name": "Май 2025",
            "is_active": True
        }
        response1 = authenticated_client.post("/api/periods/", json=period1_data)
        assert response1.status_code == status.HTTP_200_OK

        # Try to create period with same date but different name
        period2_data = {
            "period_year": 2025,
            "period_month": 5,
            "period_name": "May 2025 (English)",
            "is_active": False
        }
        response2 = authenticated_client.post("/api/periods/", json=period2_data)
        assert response2.status_code == status.HTTP_409_CONFLICT

    def test_duplicate_periods_modern_format(self, authenticated_client: TestClient):
        """Test duplicate detection with modern datetime format."""
        # Create first period
        period1_data = {
            "date": "2025-06-01T00:00:00",
            "ru_name": "Июнь 2025"
        }
        response1 = authenticated_client.post("/api/periods/", json=period1_data)
        assert response1.status_code == status.HTTP_200_OK

        # Try to create duplicate with same date
        period2_data = {
            "date": "2025-06-01T12:00:00",  # Different time, same date
            "ru_name": "Июнь 2025 (дубликат)"
        }
        response2 = authenticated_client.post("/api/periods/", json=period2_data)
        assert response2.status_code == status.HTTP_409_CONFLICT


class TestPeriodsReadOperations:
    """Test reading and retrieving periods."""

    def test_get_all_periods(self, authenticated_client: TestClient):
        """Test retrieving all periods for user."""
        # Create multiple periods
        periods_data = [
            {"period_year": 2025, "period_month": 1, "period_name": "Январь"},
            {"period_year": 2025, "period_month": 2, "period_name": "Февраль"},
            {"period_year": 2025, "period_month": 3, "period_name": "Март"}
        ]

        created_ids = []
        for period_data in periods_data:
            response = authenticated_client.post("/api/periods/", json=period_data)
            assert response.status_code == status.HTTP_200_OK
            data = validate_success_response(response.json())
            created_ids.append(data["id"])

        # Get all periods
        response = authenticated_client.get("/api/periods/")
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        periods = validate_list_response(response_data, expected_total=3)
        assert len(periods) == 3
        # Check periods are ordered by date
        assert periods[0]["period_month"] <= periods[1]["period_month"]

    def test_get_period_by_id(self, authenticated_client: TestClient):
        """Test retrieving specific period by ID."""
        period_data = {
            "period_year": 2025,
            "period_month": 7,
            "period_name": "Июль 2025"
        }

        # Create period
        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        created_data = validate_success_response(create_response.json())
        period_id = created_data["id"]

        # Get by ID
        get_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_200_OK

        response_data = get_response.json()
        data = validate_success_response(response_data, {
            "id": period_id,
            "period_name": "Июль 2025",
            "period_year": 2025,
            "period_month": 7
        })

    def test_get_nonexistent_period(self, authenticated_client: TestClient):
        """Test retrieving non-existent period returns 404 with unified error format."""
        response = authenticated_client.get("/api/periods/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response_data = response.json()
        error_message = validate_error_response(response_data)
        assert "not found" in error_message.lower()

    def test_get_current_period(self, authenticated_client: TestClient):
        """Test getting current period based on today's date."""
        # Create a period close to current date
        current_date = datetime.now()
        period_data = {
            "period_year": current_date.year,
            "period_month": current_date.month,
            "period_name": f"{current_date.strftime('%B')} {current_date.year}"
        }

        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK

        # Get current period
        response = authenticated_client.get("/api/periods/current")
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["period_year"] == current_date.year
        assert data["period_month"] == current_date.month


class TestPeriodsUpdateOperations:
    """Test period update operations."""

    def test_update_period_success(self, authenticated_client: TestClient):
        """Test successful period update."""
        # Create period
        period_data = {
            "period_year": 2025,
            "period_month": 8,
            "period_name": "Август 2025",
            "is_active": True
        }
        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        created_data = validate_success_response(create_response.json())
        period_id = created_data["id"]

        # Update period
        update_data = {
            "ru_name": "Август 2025 (Обновлено)",
            "is_active": False
        }
        response = authenticated_client.put(f"/api/periods/{period_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        data = validate_success_response(response_data, {
            "ru_name": "Август 2025 (Обновлено)",
            "period_name": "Август 2025 (Обновлено)"  # Legacy field
        })

    def test_update_nonexistent_period(self, authenticated_client: TestClient):
        """Test updating non-existent period returns 404 with unified error format."""
        update_data = {"ru_name": "Updated Name"}

        response = authenticated_client.put("/api/periods/99999", json=update_data)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response_data = response.json()
        validate_error_response(response_data)


class TestPeriodsDeleteOperations:
    """Test period deletion operations."""

    def test_delete_period_success(self, authenticated_client: TestClient):
        """Test successful period deletion."""
        # Create period
        period_data = {
            "period_year": 2025,
            "period_month": 9,
            "period_name": "Сентябрь 2025"
        }
        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        created_data = validate_success_response(create_response.json())
        period_id = created_data["id"]

        # Delete period
        delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_200_OK

        response_data = delete_response.json()
        data = validate_success_response(response_data)
        assert "deleted successfully" in data["message"]

        # Verify deletion
        get_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND
        validate_error_response(get_response.json())

    def test_delete_nonexistent_period(self, authenticated_client: TestClient):
        """Test deleting non-existent period returns 404 with unified error format."""
        response = authenticated_client.delete("/api/periods/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response_data = response.json()
        validate_error_response(response_data)


class TestPeriodsUserIsolation:
    """Test data isolation between users."""

    def test_periods_isolated_between_users(self, client: TestClient):
        """Test that users cannot see each other's periods."""
        # Create two users
        user1_data = {
            "username": "user1_periods",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1_periods@example.com"
        }
        user2_data = {
            "username": "user2_periods",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2_periods@example.com"
        }

        # Register and login user1
        client.post("/api/auth/register", json=user1_data)
        response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_cookies = response.cookies

        # Create period as user1
        client.cookies = user1_cookies
        period_data = {
            "period_year": 2025,
            "period_month": 10,
            "period_name": "User1 Period"
        }
        create_response = client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        period_id = create_response.json()["id"]

        # Register and login user2
        client.post("/api/auth/register", json=user2_data)
        response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_cookies = response.cookies

        # Try to access user1's period as user2
        client.cookies = user2_cookies
        get_response = client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

        # Get all periods as user2 - should be empty
        list_response = client.get("/api/periods/")
        assert list_response.status_code == status.HTTP_200_OK
        periods = list_response.json()
        assert len(periods) == 0

    def test_same_period_different_users(self, client: TestClient):
        """Test that different users can have periods with same date."""
        # Create two users
        user1_data = {
            "username": "user1_same_period",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1_same@example.com"
        }
        user2_data = {
            "username": "user2_same_period",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2_same@example.com"
        }

        # Same period data for both users
        period_data = {
            "period_year": 2025,
            "period_month": 11,
            "period_name": "Ноябрь 2025"
        }

        # Register and login user1, create period
        client.post("/api/auth/register", json=user1_data)
        response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        client.cookies = response.cookies

        response1 = client.post("/api/periods/", json=period_data)
        assert response1.status_code == status.HTTP_200_OK

        # Register and login user2, create same period
        client.post("/api/auth/register", json=user2_data)
        response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        client.cookies = response.cookies

        response2 = client.post("/api/periods/", json=period_data)
        assert response2.status_code == status.HTTP_200_OK

        # Both should succeed because they belong to different users
        assert response1.json()["id"] != response2.json()["id"]


class TestPeriodsErrorHandling:
    """Test error handling and edge cases."""

    def test_unauthenticated_access(self, client: TestClient):
        """Test that unauthenticated requests are rejected."""
        period_data = {
            "period_year": 2025,
            "period_month": 12,
            "period_name": "Декабрь 2025"
        }

        # Try to create period without authentication
        response = client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Try to get periods without authentication
        response = client.get("/api/periods/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_period_data_types(self, authenticated_client: TestClient):
        """Test handling of invalid data types."""
        invalid_data = {
            "period_year": "invalid_year",  # Should be integer
            "period_month": 13,  # Invalid month
            "period_name": None  # Should be string
        }

        response = authenticated_client.post("/api/periods/", json=invalid_data)
        assert response.status_code in [
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_400_BAD_REQUEST
        ]

    def test_pagination_parameters(self, authenticated_client: TestClient):
        """Test pagination with skip and limit parameters."""
        # Create multiple periods
        for i in range(5):
            period_data = {
                "period_year": 2024,
                "period_month": i + 1,
                "period_name": f"Period {i + 1}"
            }
            response = authenticated_client.post("/api/periods/", json=period_data)
            assert response.status_code == status.HTTP_200_OK

        # Test pagination
        response = authenticated_client.get("/api/periods/?skip=2&limit=2")
        assert response.status_code == status.HTTP_200_OK

        periods = response.json()
        assert len(periods) == 2


@pytest.mark.asyncio
class TestPeriodsAsyncOperations:
    """Test asynchronous operations on periods."""

    async def test_concurrent_period_creation(self, authenticated_async_client: AsyncClient):
        """Test handling of concurrent period creation attempts."""
        period_data = {
            "period_year": 2026,
            "period_month": 1,
            "period_name": "Concurrent Test"
        }

        # Make concurrent requests
        import asyncio

        async def create_period():
            return await authenticated_async_client.post("/api/periods/", json=period_data)

        # Should only one succeed, others should get 409
        responses = await asyncio.gather(
            create_period(),
            create_period(),
            create_period(),
            return_exceptions=True
        )

        success_count = sum(1 for r in responses if r.status_code == status.HTTP_200_OK)
        conflict_count = sum(1 for r in responses if r.status_code == status.HTTP_409_CONFLICT)

        assert success_count == 1
        assert conflict_count == 2


# SERIALIZATION FIX TESTS
class TestPeriodsAPISerialization:
    """Test JSON serialization fix for periods API endpoints."""

    @pytest.mark.asyncio
    async def test_get_periods_datetime_serialization(self, authenticated_async_client: AsyncClient):
        """Test that datetime fields in periods are properly serialized to ISO format."""
        # Create a test period
        period_data = {
            "date": "2024-09-13T15:30:45",
            "ru_name": "Test Serialization Period"
        }

        # Create period
        create_response = await authenticated_async_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == 201

        created_data = validate_success_response(create_response.json())
        period_id = created_data["id"]

        try:
            # Get all periods
            response = await authenticated_async_client.get("/api/periods/")
            assert response.status_code == 200

            response_data = response.json()
            periods_data = validate_list_response(response_data)

            # Find our test period
            test_period = None
            for period in periods_data:
                if period["id"] == period_id:
                    test_period = period
                    break

            assert test_period is not None, "Created period not found in list"

            # Verify datetime fields are ISO formatted strings
            assert isinstance(test_period["date"], str)
            assert "T" in test_period["date"]  # ISO format indicator
            assert test_period["date"] == "2024-09-13T15:30:45"

            # Verify created_at and updated_at are also properly formatted
            if test_period.get("created_at"):
                assert isinstance(test_period["created_at"], str)
                assert "T" in test_period["created_at"]

            if test_period.get("updated_at"):
                assert isinstance(test_period["updated_at"], str)
                assert "T" in test_period["updated_at"]

            # Verify all expected PeriodResponse fields are present
            expected_fields = [
                "id", "date", "ru_name", "period_id", "period_name",
                "period_year", "period_month", "is_active"
            ]

            for field in expected_fields:
                assert field in test_period, f"Field {field} missing from response"
                assert test_period[field] is not None, f"Field {field} is None"

            # Verify legacy field mappings
            assert test_period["period_id"] == test_period["id"]
            assert test_period["period_name"] == test_period["ru_name"]
            assert test_period["period_year"] == 2024
            assert test_period["period_month"] == 9

        finally:
            # Cleanup
            await authenticated_async_client.delete(f"/api/periods/{period_id}")

    @pytest.mark.asyncio
    async def test_get_current_period_datetime_serialization(self, authenticated_async_client: AsyncClient, ):
        """Test current period endpoint datetime serialization."""
        from datetime import datetime

        # Create a period for current date
        current_date = datetime.now()
        period_data = {
            "date": current_date.isoformat(),
            "ru_name": f"Current Period {current_date.strftime('%Y-%m')}"
        }

        # Create period
        create_response = await authenticated_async_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == 201

        created_data = validate_success_response(create_response.json())
        period_id = created_data["id"]

        try:
            # Get current period
            response = await authenticated_async_client.get("/api/periods/current")

            if response.status_code == 200:
                response_data = response.json()
                current_period = validate_success_response(response_data)

                # Verify datetime serialization
                assert isinstance(current_period["date"], str)
                assert "T" in current_period["date"]

                # Verify all PeriodResponse fields are properly serialized
                assert "id" in current_period
                assert "ru_name" in current_period
                assert "period_year" in current_period
                assert "period_month" in current_period

            elif response.status_code == 404:
                # No current period found - this is acceptable
                error_data = validate_error_response(response.json())
                assert "not found" in error_data.lower()

        finally:
            # Cleanup
            await authenticated_async_client.delete(f"/api/periods/{period_id}")

    @pytest.mark.asyncio
    async def test_create_period_response_serialization(self, authenticated_async_client: AsyncClient, ):
        """Test that period creation response is properly serialized."""
        from datetime import datetime

        test_datetime = datetime(2024, 9, 13, 15, 30, 45)
        period_data = {
            "date": test_datetime.isoformat(),
            "ru_name": "Serialization Test Period"
        }

        # Create period
        response = await authenticated_async_client.post("/api/periods/", json=period_data)
        assert response.status_code == 201

        response_data = response.json()
        created_period = validate_success_response(response_data)

        try:
            # Verify response structure and serialization
            assert isinstance(created_period["date"], str)
            assert created_period["date"] == "2024-09-13T15:30:45"

            # Verify all fields are properly serialized
            assert created_period["id"] is not None
            assert created_period["ru_name"] == "Serialization Test Period"
            assert created_period["period_year"] == 2024
            assert created_period["period_month"] == 9
            assert created_period["is_active"] is True

            # Verify datetime fields that might be present
            datetime_fields = ["created_at", "updated_at", "start_date", "end_date"]
            for field in datetime_fields:
                if field in created_period and created_period[field] is not None:
                    assert isinstance(created_period[field], str)
                    if "T" not in created_period[field]:  # Only for full datetime, not date
                        # This might be a date field, check if it's valid
                        from datetime import datetime
                        try:
                            datetime.fromisoformat(created_period[field])
                        except ValueError:
                            pytest.fail(f"Field {field} is not properly serialized: {created_period[field]}")

        finally:
            # Cleanup
            await authenticated_async_client.delete(f"/api/periods/{created_period['id']}")

    @pytest.mark.asyncio
    async def test_update_period_response_serialization(self, authenticated_async_client: AsyncClient, ):
        """Test that period update response is properly serialized."""
        from datetime import datetime

        # Create initial period
        initial_datetime = datetime(2024, 9, 1, 10, 0, 0)
        period_data = {
            "date": initial_datetime.isoformat(),
            "ru_name": "Initial Period"
        }

        create_response = await authenticated_async_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == 201

        created_data = validate_success_response(create_response.json())
        period_id = created_data["id"]

        try:
            # Update period
            updated_datetime = datetime(2024, 9, 15, 14, 30, 0)
            update_data = {
                "date": updated_datetime.isoformat(),
                "ru_name": "Updated Period"
            }

            update_response = await authenticated_async_client.put(f"/api/periods/{period_id}", json=update_data)
            assert update_response.status_code == 200

            response_data = update_response.json()
            updated_period = validate_success_response(response_data)

            # Verify datetime serialization in update response
            assert isinstance(updated_period["date"], str)
            assert updated_period["date"] == "2024-09-15T14:30:00"
            assert updated_period["ru_name"] == "Updated Period"

            # Verify all response fields are properly serialized
            assert updated_period["id"] == period_id
            assert updated_period["period_year"] == 2024
            assert updated_period["period_month"] == 9

        finally:
            # Cleanup
            await authenticated_async_client.delete(f"/api/periods/{period_id}")

    @pytest.mark.asyncio
    async def test_periods_response_format_consistency(self, authenticated_async_client: AsyncClient, ):
        """Test that all period endpoints return consistent response format."""
        from datetime import datetime

        # Create test periods
        periods_to_create = []
        for i in range(3):
            test_datetime = datetime(2024, 9, 10 + i, 12, 0, 0)
            periods_to_create.append({
                "date": test_datetime.isoformat(),
                "ru_name": f"Consistency Test Period {i + 1}"
            })

        created_ids = []

        try:
            # Create periods and test response format consistency
            for period_data in periods_to_create:
                create_response = await authenticated_async_client.post("/api/periods/", json=period_data)
                assert create_response.status_code == 201

                response_data = create_response.json()

                # Verify unified response format
                assert "success" in response_data
                assert response_data["success"] is True
                assert "data" in response_data

                created_period = response_data["data"]
                created_ids.append(created_period["id"])

                # Verify datetime serialization consistency
                assert isinstance(created_period["date"], str)
                assert "T" in created_period["date"]

            # Test GET /periods/ format consistency
            list_response = await authenticated_async_client.get("/api/periods/")
            assert list_response.status_code == 200

            list_data = list_response.json()

            # Verify unified list response format
            assert "success" in list_data
            assert list_data["success"] is True
            assert "data" in list_data
            assert "total" in list_data
            assert isinstance(list_data["data"], list)
            assert isinstance(list_data["total"], int)

            # Verify each period in list has consistent datetime serialization
            for period in list_data["data"]:
                if period["id"] in created_ids:
                    assert isinstance(period["date"], str)
                    assert "T" in period["date"]

                    # Verify all expected fields are present and properly typed
                    assert isinstance(period["id"], int)
                    assert isinstance(period["ru_name"], str)
                    assert isinstance(period["period_year"], int)
                    assert isinstance(period["period_month"], int)
                    assert isinstance(period["is_active"], bool)

        finally:
            # Cleanup all created periods
            for period_id in created_ids:
                await authenticated_async_client.delete(f"/api/periods/{period_id}")