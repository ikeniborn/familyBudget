"""
Comprehensive tests for periods API endpoints.
Tests all CRUD operations with focus on duplicate handling (409 errors) and user isolation.
"""
import pytest
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient


class TestPeriodsCRUDOperations:
    """Test basic CRUD operations for periods."""

    def test_create_period_success(self, authenticated_client: TestClient):
        """Test successful period creation."""
        period_data = {
            "period_year": 2025,
            "period_month": 1,
            "period_name": "Январь 2025",
            "is_active": True
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["period_year"] == 2025
        assert data["period_month"] == 1
        assert data["ru_name"] == "Январь 2025"
        assert data["is_active"] is True
        assert "id" in data

    def test_create_period_legacy_format(self, authenticated_client: TestClient):
        """Test period creation using legacy format conversion."""
        period_data = {
            "period_year": 2025,
            "period_month": 2,
            "is_active": True
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["period_year"] == 2025
        assert data["period_month"] == 2
        # Check auto-generated name
        assert data["ru_name"] == "2025.02"

    def test_create_period_modern_format(self, authenticated_client: TestClient):
        """Test period creation using modern datetime format."""
        period_data = {
            "date": "2025-03-01T00:00:00",
            "ru_name": "Март 2025",
            "start_date": "2025-03-01T00:00:00",
            "end_date": "2025-03-31T23:59:59"
        }

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["ru_name"] == "Март 2025"
        assert data["period_year"] == 2025
        assert data["period_month"] == 3

    def test_create_period_missing_data(self, authenticated_client: TestClient):
        """Test period creation with missing required fields."""
        period_data = {}

        response = authenticated_client.post("/api/periods/", json=period_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


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

        # Try to create duplicate
        response2 = authenticated_client.post("/api/periods/", json=period_data)
        assert response2.status_code == status.HTTP_409_CONFLICT

        # Check error message contains date information
        error_data = response2.json()
        assert "уже существует" in error_data["detail"]
        assert "2025-04-01" in error_data["detail"]

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
            created_ids.append(response.json()["id"])

        # Get all periods
        response = authenticated_client.get("/api/periods/")
        assert response.status_code == status.HTTP_200_OK

        periods = response.json()
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
        period_id = create_response.json()["id"]

        # Get by ID
        get_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_200_OK

        data = get_response.json()
        assert data["id"] == period_id
        assert data["period_name"] == "Июль 2025"
        assert data["period_year"] == 2025
        assert data["period_month"] == 7

    def test_get_nonexistent_period(self, authenticated_client: TestClient):
        """Test retrieving non-existent period returns 404."""
        response = authenticated_client.get("/api/periods/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        error_data = response.json()
        assert "not found" in error_data["detail"].lower()

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
        period_id = create_response.json()["id"]

        # Update period
        update_data = {
            "ru_name": "Август 2025 (Обновлено)",
            "is_active": False
        }
        response = authenticated_client.put(f"/api/periods/{period_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["ru_name"] == "Август 2025 (Обновлено)"
        assert data["period_name"] == "Август 2025 (Обновлено)"  # Legacy field

    def test_update_nonexistent_period(self, authenticated_client: TestClient):
        """Test updating non-existent period returns 404."""
        update_data = {"ru_name": "Updated Name"}

        response = authenticated_client.put("/api/periods/99999", json=update_data)
        assert response.status_code == status.HTTP_404_NOT_FOUND


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
        period_id = create_response.json()["id"]

        # Delete period
        delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_200_OK

        delete_data = delete_response.json()
        assert "deleted successfully" in delete_data["message"]

        # Verify deletion
        get_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_nonexistent_period(self, authenticated_client: TestClient):
        """Test deleting non-existent period returns 404."""
        response = authenticated_client.delete("/api/periods/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND


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