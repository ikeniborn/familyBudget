"""
Comprehensive tests for cost centers (МВЗ) API endpoints.
Tests CRUD operations, duplicate handling, and user isolation.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient


class TestCostCentersCRUDOperations:
    """Test basic CRUD operations for cost centers."""

    def test_create_cost_center_success(self, authenticated_client: TestClient):
        """Test successful cost center creation."""
        center_data = {
            "name": "Домашние расходы",
            "is_active": True
        }

        response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == center_data["name"]
        assert data["is_active"] is True
        assert "id" in data
        assert "user_id" in data

    def test_create_cost_center_minimal_data(self, authenticated_client: TestClient):
        """Test creating cost center with minimal required data."""
        center_data = {
            "name": "Минимальный МВЗ"
        }

        response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == center_data["name"]
        assert "is_active" in data  # Should have default value
        assert "id" in data

    def test_create_cost_center_missing_name(self, authenticated_client: TestClient):
        """Test creating cost center without required name field."""
        center_data = {
            "is_active": True
        }

        response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestCostCentersDuplicateHandling:
    """Test duplicate cost center handling and error responses."""

    def test_create_duplicate_cost_center_400_error(self, authenticated_client: TestClient):
        """Test creating duplicate cost center returns 400 Bad Request."""
        center_data = {
            "name": "Дублирующийся МВЗ",
            "is_active": True
        }

        # Create first center
        response1 = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response1.status_code == status.HTTP_200_OK

        # Try to create duplicate
        response2 = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response2.status_code == status.HTTP_400_BAD_REQUEST

        # Check error message
        error_data = response2.json()
        assert "уже существует" in error_data["detail"]
        assert center_data["name"] in error_data["detail"]

    def test_duplicate_cost_center_case_sensitive(self, authenticated_client: TestClient):
        """Test that cost center names are case sensitive."""
        # Create center with lowercase
        center1_data = {
            "name": "транспортные расходы",
            "is_active": True
        }
        response1 = authenticated_client.post("/api/cost_centers/", json=center1_data)
        assert response1.status_code == status.HTTP_200_OK

        # Create center with different case - should succeed
        center2_data = {
            "name": "ТРАНСПОРТНЫЕ РАСХОДЫ",
            "is_active": True
        }
        response2 = authenticated_client.post("/api/cost_centers/", json=center2_data)
        assert response2.status_code == status.HTTP_200_OK

        # Different cases should be treated as different names
        assert response1.json()["id"] != response2.json()["id"]

    def test_duplicate_cost_center_integrity_error(self, authenticated_client: TestClient):
        """Test handling of database integrity errors on duplicates."""
        center_data = {
            "name": "Интегральная проверка МВЗ",
            "is_active": True
        }

        # Create first center
        response1 = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response1.status_code == status.HTTP_200_OK

        # Concurrent creation attempt should trigger integrity error handling
        response2 = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response2.status_code == status.HTTP_400_BAD_REQUEST

        error_data = response2.json()
        assert "уже существует" in error_data["detail"]


class TestCostCentersReadOperations:
    """Test reading and retrieving cost centers."""

    def test_get_all_cost_centers(self, authenticated_client: TestClient):
        """Test retrieving all cost centers for user."""
        # Create multiple centers
        centers_data = [
            {"name": "Коммунальные услуги", "is_active": True},
            {"name": "Продукты питания", "is_active": True},
            {"name": "Развлечения", "is_active": False}
        ]

        created_ids = []
        for center_data in centers_data:
            response = authenticated_client.post("/api/cost_centers/", json=center_data)
            assert response.status_code == status.HTTP_200_OK
            created_ids.append(response.json()["id"])

        # Get all centers
        response = authenticated_client.get("/api/cost_centers/")
        assert response.status_code == status.HTTP_200_OK

        centers = response.json()
        assert len(centers) == 3

        # Check they are ordered by name
        names = [c["name"] for c in centers]
        assert names == sorted(names)

    def test_get_cost_center_by_id(self, authenticated_client: TestClient):
        """Test retrieving specific cost center by ID."""
        center_data = {
            "name": "Тестовый МВЗ",
            "is_active": True
        }

        # Create center
        create_response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert create_response.status_code == status.HTTP_200_OK
        center_id = create_response.json()["id"]

        # Get by ID
        get_response = authenticated_client.get(f"/api/cost_centers/{center_id}")
        assert get_response.status_code == status.HTTP_200_OK

        data = get_response.json()
        assert data["id"] == center_id
        assert data["name"] == center_data["name"]
        assert data["is_active"] == center_data["is_active"]

    def test_get_nonexistent_cost_center(self, authenticated_client: TestClient):
        """Test retrieving non-existent cost center returns 404."""
        response = authenticated_client.get("/api/cost_centers/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        error_data = response.json()
        assert "not found" in error_data["detail"].lower()


class TestCostCentersUpdateOperations:
    """Test cost center update operations."""

    def test_update_cost_center_success(self, authenticated_client: TestClient):
        """Test successful cost center update."""
        # Create center
        center_data = {
            "name": "Обновляемый МВЗ",
            "is_active": True
        }
        create_response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert create_response.status_code == status.HTTP_200_OK
        center_id = create_response.json()["id"]

        # Update center
        update_data = {
            "name": "Обновленный МВЗ",
            "is_active": False
        }
        response = authenticated_client.put(f"/api/cost_centers/{center_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == update_data["name"]
        assert data["is_active"] == update_data["is_active"]

    def test_update_cost_center_duplicate_name(self, authenticated_client: TestClient):
        """Test updating cost center to existing name fails."""
        # Create two centers
        center1_data = {"name": "Первый МВЗ", "is_active": True}
        center2_data = {"name": "Второй МВЗ", "is_active": True}

        response1 = authenticated_client.post("/api/cost_centers/", json=center1_data)
        response2 = authenticated_client.post("/api/cost_centers/", json=center2_data)

        assert response1.status_code == status.HTTP_200_OK
        assert response2.status_code == status.HTTP_200_OK

        center2_id = response2.json()["id"]

        # Try to update second center to have same name as first
        update_data = {"name": "Первый МВЗ"}
        response = authenticated_client.put(f"/api/cost_centers/{center2_id}", json=update_data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        error_data = response.json()
        assert "уже существует" in error_data["detail"]

    def test_update_nonexistent_cost_center(self, authenticated_client: TestClient):
        """Test updating non-existent cost center returns 404."""
        update_data = {"name": "Обновленное название"}

        response = authenticated_client.put("/api/cost_centers/99999", json=update_data)
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_update_cost_center_partial(self, authenticated_client: TestClient):
        """Test partial update of cost center fields."""
        # Create center
        center_data = {
            "name": "Частичное обновление МВЗ",
            "is_active": True
        }
        create_response = authenticated_client.post("/api/cost_centers/", json=center_data)
        center_id = create_response.json()["id"]

        # Update only is_active field
        update_data = {"is_active": False}
        response = authenticated_client.put(f"/api/cost_centers/{center_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        # Updated field
        assert data["is_active"] is False
        # Unchanged field
        assert data["name"] == center_data["name"]


class TestCostCentersDeleteOperations:
    """Test cost center deletion operations."""

    def test_delete_cost_center_success(self, authenticated_client: TestClient):
        """Test successful cost center deletion."""
        # Create center
        center_data = {
            "name": "Удаляемый МВЗ",
            "is_active": True
        }
        create_response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert create_response.status_code == status.HTTP_200_OK
        center_id = create_response.json()["id"]

        # Delete center
        delete_response = authenticated_client.delete(f"/api/cost_centers/{center_id}")
        assert delete_response.status_code == status.HTTP_200_OK

        delete_data = delete_response.json()
        assert "deleted successfully" in delete_data["message"]

        # Verify deletion
        get_response = authenticated_client.get(f"/api/cost_centers/{center_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_delete_nonexistent_cost_center(self, authenticated_client: TestClient):
        """Test deleting non-existent cost center returns 404."""
        response = authenticated_client.delete("/api/cost_centers/99999")
        assert response.status_code == status.HTTP_404_NOT_FOUND

    def test_bulk_delete_cost_centers_success(self, authenticated_client: TestClient):
        """Test successful bulk deletion of cost centers."""
        # Create multiple centers
        centers_data = [
            {"name": "Удаляемый МВЗ 1", "is_active": True},
            {"name": "Удаляемый МВЗ 2", "is_active": True},
            {"name": "Удаляемый МВЗ 3", "is_active": False}
        ]

        created_ids = []
        for center_data in centers_data:
            response = authenticated_client.post("/api/cost_centers/", json=center_data)
            assert response.status_code == status.HTTP_200_OK
            created_ids.append(response.json()["id"])

        # Bulk delete
        response = authenticated_client.post("/api/cost_centers/bulk-delete", json=created_ids)
        assert response.status_code == status.HTTP_200_OK

        delete_data = response.json()
        assert "Deleted 3 cost centers" in delete_data["message"]

        # Verify all are deleted
        for center_id in created_ids:
            get_response = authenticated_client.get(f"/api/cost_centers/{center_id}")
            assert get_response.status_code == status.HTTP_404_NOT_FOUND

    def test_bulk_delete_nonexistent_cost_centers(self, authenticated_client: TestClient):
        """Test bulk deletion of non-existent cost centers."""
        fake_ids = [99997, 99998, 99999]

        response = authenticated_client.post("/api/cost_centers/bulk-delete", json=fake_ids)
        assert response.status_code == status.HTTP_404_NOT_FOUND

        error_data = response.json()
        assert "not found" in error_data["detail"].lower()


class TestCostCentersUserIsolation:
    """Test data isolation between users."""

    def test_cost_centers_isolated_between_users(self, client: TestClient):
        """Test that users cannot see each other's cost centers."""
        # Create two users
        user1_data = {
            "username": "user1_cost_centers",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1_cost_centers@example.com"
        }
        user2_data = {
            "username": "user2_cost_centers",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2_cost_centers@example.com"
        }

        # Register and login user1
        client.post("/api/auth/register", json=user1_data)
        response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_cookies = response.cookies

        # Create center as user1
        client.cookies = user1_cookies
        center_data = {
            "name": "User1 МВЗ",
            "is_active": True
        }
        create_response = client.post("/api/cost_centers/", json=center_data)
        assert create_response.status_code == status.HTTP_200_OK
        center_id = create_response.json()["id"]

        # Register and login user2
        client.post("/api/auth/register", json=user2_data)
        response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_cookies = response.cookies

        # Try to access user1's center as user2
        client.cookies = user2_cookies
        get_response = client.get(f"/api/cost_centers/{center_id}")
        assert get_response.status_code == status.HTTP_404_NOT_FOUND

        # Get all centers as user2 - should be empty
        list_response = client.get("/api/cost_centers/")
        assert list_response.status_code == status.HTTP_200_OK
        centers = list_response.json()
        assert len(centers) == 0

    def test_same_center_name_different_users(self, client: TestClient):
        """Test that different users can have centers with same name."""
        # Create two users
        user1_data = {
            "username": "user1_same_cost_center",
            "password": "Password123!",
            "user_name": "User One",
            "email": "user1_same_cost_center@example.com"
        }
        user2_data = {
            "username": "user2_same_cost_center",
            "password": "Password123!",
            "user_name": "User Two",
            "email": "user2_same_cost_center@example.com"
        }

        # Same center data for both users
        center_data = {
            "name": "Общий МВЗ",
            "is_active": True
        }

        # Register and login user1, create center
        client.post("/api/auth/register", json=user1_data)
        response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        client.cookies = response.cookies

        response1 = client.post("/api/cost_centers/", json=center_data)
        assert response1.status_code == status.HTTP_200_OK

        # Register and login user2, create same center
        client.post("/api/auth/register", json=user2_data)
        response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        client.cookies = response.cookies

        response2 = client.post("/api/cost_centers/", json=center_data)
        assert response2.status_code == status.HTTP_200_OK

        # Both should succeed because they belong to different users
        assert response1.json()["id"] != response2.json()["id"]

    def test_unique_code_per_user_from_existing_test(self, authenticated_client: TestClient):
        """Test that cost center codes must be unique per user (from existing test)."""
        test_cost_center_data = {
            "name": "Test Code Uniqueness",
            "is_active": True
        }

        # Create first center
        response1 = authenticated_client.post("/api/cost_centers/", json=test_cost_center_data)
        assert response1.status_code == status.HTTP_200_OK

        # Try to create with same name (which acts as unique identifier)
        response2 = authenticated_client.post("/api/cost_centers/", json=test_cost_center_data)
        assert response2.status_code == status.HTTP_400_BAD_REQUEST

        error_data = response2.json()
        assert "уже существует" in error_data["detail"]


class TestCostCentersErrorHandling:
    """Test error handling and edge cases."""

    def test_unauthenticated_access(self, client: TestClient):
        """Test that unauthenticated requests are rejected."""
        center_data = {
            "name": "Тест без авторизации",
            "is_active": True
        }

        # Try to create center without authentication
        response = client.post("/api/cost_centers/", json=center_data)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

        # Try to get centers without authentication
        response = client.get("/api/cost_centers/")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_data_types(self, authenticated_client: TestClient):
        """Test handling of invalid data types."""
        invalid_data = {
            "name": ["invalid_name"],  # Should be string
            "is_active": "invalid_boolean"  # Should be boolean
        }

        response = authenticated_client.post("/api/cost_centers/", json=invalid_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_pagination_parameters(self, authenticated_client: TestClient):
        """Test pagination with skip and limit parameters."""
        # Create multiple centers
        for i in range(5):
            center_data = {
                "name": f"МВЗ {i:02d}",
                "is_active": True
            }
            response = authenticated_client.post("/api/cost_centers/", json=center_data)
            assert response.status_code == status.HTTP_200_OK

        # Test pagination
        response = authenticated_client.get("/api/cost_centers/?skip=2&limit=2")
        assert response.status_code == status.HTTP_200_OK

        centers = response.json()
        assert len(centers) == 2

    def test_empty_name_handling(self, authenticated_client: TestClient):
        """Test handling of empty or whitespace-only names."""
        # Empty name
        response = authenticated_client.post("/api/cost_centers/", json={"name": ""})
        assert response.status_code in [
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_400_BAD_REQUEST
        ]

        # Whitespace-only name
        response = authenticated_client.post("/api/cost_centers/", json={"name": "   "})
        assert response.status_code in [
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            status.HTTP_400_BAD_REQUEST
        ]

    def test_user_id_isolation_enforcement(self, authenticated_client: TestClient):
        """Test that user_id cannot be manually set during create/update."""
        # Test create with manual user_id (should be ignored)
        center_data = {
            "name": "Тест изоляции МВЗ",
            "user_id": 99999,  # Should be ignored
            "is_active": True
        }

        response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["user_id"] != 99999  # Should use actual user_id from session

        # Test update with manual user_id (should be ignored)
        center_id = data["id"]
        update_data = {
            "name": "Обновленное название МВЗ",
            "user_id": 88888  # Should be ignored
        }

        response = authenticated_client.put(f"/api/cost_centers/{center_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        updated_data = response.json()
        assert updated_data["user_id"] != 88888  # Should remain unchanged
        assert updated_data["user_id"] == data["user_id"]  # Should be same as before


class TestCostCentersBusinessLogic:
    """Test business logic specific to cost centers."""

    def test_cost_center_naming_conventions(self, authenticated_client: TestClient):
        """Test various naming conventions for cost centers."""
        naming_tests = [
            {"name": "Коммунальные услуги", "expected_success": True},
            {"name": "МВЗ-001", "expected_success": True},
            {"name": "Центр затрат № 1", "expected_success": True},
            {"name": "Administrative Expenses", "expected_success": True},  # English
            {"name": "МВЗ_Продукты_2025", "expected_success": True},  # With underscore and year
            {"name": "1234567890" * 10, "expected_success": True},  # Long name (100 chars)
        ]

        for test_case in naming_tests:
            center_data = {
                "name": test_case["name"],
                "is_active": True
            }

            response = authenticated_client.post("/api/cost_centers/", json=center_data)

            if test_case["expected_success"]:
                assert response.status_code == status.HTTP_200_OK
                assert response.json()["name"] == test_case["name"]
            else:
                assert response.status_code in [
                    status.HTTP_422_UNPROCESSABLE_ENTITY,
                    status.HTTP_400_BAD_REQUEST
                ]

    def test_cost_center_activation_deactivation(self, authenticated_client: TestClient):
        """Test activating and deactivating cost centers."""
        # Create active center
        center_data = {
            "name": "Тест активации",
            "is_active": True
        }
        create_response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert create_response.status_code == status.HTTP_200_OK
        center_id = create_response.json()["id"]
        assert create_response.json()["is_active"] is True

        # Deactivate
        update_data = {"is_active": False}
        response = authenticated_client.put(f"/api/cost_centers/{center_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["is_active"] is False

        # Reactivate
        update_data = {"is_active": True}
        response = authenticated_client.put(f"/api/cost_centers/{center_id}", json=update_data)
        assert response.status_code == status.HTTP_200_OK
        assert response.json()["is_active"] is True

    def test_cost_center_default_values(self, authenticated_client: TestClient):
        """Test default values for cost center fields."""
        center_data = {
            "name": "Тест дефолтных значений"
            # is_active not specified
        }

        response = authenticated_client.post("/api/cost_centers/", json=center_data)
        assert response.status_code == status.HTTP_200_OK

        data = response.json()
        assert data["name"] == center_data["name"]
        # Should have some default value for is_active
        assert "is_active" in data
        assert isinstance(data["is_active"], bool)


@pytest.mark.asyncio
class TestCostCentersAsyncOperations:
    """Test asynchronous operations on cost centers."""

    async def test_concurrent_center_creation(self, authenticated_async_client: AsyncClient):
        """Test handling of concurrent cost center creation attempts."""
        center_data = {
            "name": "Конкурентный тест МВЗ",
            "is_active": True
        }

        # Make concurrent requests
        import asyncio

        async def create_center():
            return await authenticated_async_client.post("/api/cost_centers/", json=center_data)

        # Only one should succeed, others should get 400
        responses = await asyncio.gather(
            create_center(),
            create_center(),
            create_center(),
            return_exceptions=True
        )

        success_count = sum(1 for r in responses if r.status_code == status.HTTP_200_OK)
        conflict_count = sum(1 for r in responses if r.status_code == status.HTTP_400_BAD_REQUEST)

        assert success_count == 1
        assert conflict_count == 2

    async def test_concurrent_bulk_operations(self, authenticated_async_client: AsyncClient):
        """Test concurrent bulk operations on cost centers."""
        import asyncio

        # Create multiple centers first
        center_ids = []
        for i in range(5):
            center_data = {
                "name": f"Bulk МВЗ {i}",
                "is_active": True
            }
            response = await authenticated_async_client.post("/api/cost_centers/", json=center_data)
            assert response.status_code == status.HTTP_200_OK
            center_ids.append(response.json()["id"])

        # Concurrent bulk delete attempts
        async def bulk_delete():
            return await authenticated_async_client.post("/api/cost_centers/bulk-delete", json=center_ids)

        responses = await asyncio.gather(
            bulk_delete(),
            bulk_delete(),
            return_exceptions=True
        )

        # First should succeed, second should fail (items already deleted)
        success_responses = [r for r in responses if r.status_code == status.HTTP_200_OK]
        error_responses = [r for r in responses if r.status_code == status.HTTP_404_NOT_FOUND]

        assert len(success_responses) == 1
        assert len(error_responses) == 1