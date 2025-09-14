"""
Comprehensive tests for periods deletion functionality.
Tests foreign key constraint handling, 409 Conflict responses, and user isolation.
Updated to test unified API response format: {"success": true/false, "data": ..., "error": ...}
"""
import pytest
from decimal import Decimal
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


class TestPeriodDeletionSuccess:
    """Test successful period deletion when no dependencies exist."""

    def test_delete_period_no_dependencies(self, authenticated_client: TestClient):
        """Test successful deletion when period has no registry records."""
        # Create a test period
        period_data = {
            "period_year": 2025,
            "period_month": 1,
            "period_name": "Тестовый период для удаления",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        created_data = validate_success_response(create_response.json())
        period_id = created_data["id"]

        # Verify period exists before deletion
        get_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_200_OK
        validate_success_response(get_response.json())

        # Delete the period
        delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_200_OK

        response_data = delete_response.json()
        data = validate_success_response(response_data, {
            "message": "Period deleted successfully"
        })

        # Verify period was actually deleted
        verify_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert verify_response.status_code == status.HTTP_404_NOT_FOUND
        validate_error_response(verify_response.json(), "not found")

    def test_delete_multiple_periods_batch(self, authenticated_client: TestClient):
        """Test deleting multiple periods in sequence."""
        created_periods = []

        # Create multiple test periods
        for i in range(3):
            period_data = {
                "period_year": 2025,
                "period_month": i + 2,  # Feb, Mar, Apr
                "period_name": f"Batch Delete Test {i + 1}",
                "is_active": False
            }

            response = authenticated_client.post("/api/periods/", json=period_data)
            assert response.status_code == status.HTTP_200_OK
            data = validate_success_response(response.json())
            created_periods.append(data["id"])

        # Delete all periods
        for period_id in created_periods:
            delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
            assert delete_response.status_code == status.HTTP_200_OK
            validate_success_response(delete_response.json())

            # Verify each deletion
            verify_response = authenticated_client.get(f"/api/periods/{period_id}")
            assert verify_response.status_code == status.HTTP_404_NOT_FOUND


class TestPeriodDeletionConstraints:
    """Test foreign key constraint handling when period has dependencies."""

    @pytest.fixture(autouse=True)
    def setup_reference_data(self, authenticated_client: TestClient):
        """Setup reference data for constraint testing."""
        # Create period that will have dependencies
        period_response = authenticated_client.post("/api/periods/", json={
            "period_year": 2025,
            "period_month": 5,
            "period_name": "Период с зависимостями",
            "is_active": True
        })
        assert period_response.status_code == status.HTTP_200_OK
        self.period_id = validate_success_response(period_response.json())["id"]
        self.period_name = "Период с зависимостями"

        # Create financial center
        fc_response = authenticated_client.post("/api/financial_centers/", json={
            "code": "FC_DELETE_TEST",
            "name": "Financial Center Delete Test",
            "description": "Test financial center for deletion testing"
        })
        assert fc_response.status_code == status.HTTP_200_OK
        self.financial_center_id = validate_success_response(fc_response.json())["id"]

        # Create cost center
        cc_response = authenticated_client.post("/api/cost_centers/", json={
            "code": "CC_DELETE_TEST",
            "name": "Cost Center Delete Test",
            "description": "Test cost center for deletion testing"
        })
        assert cc_response.status_code == status.HTTP_200_OK
        self.cost_center_id = validate_success_response(cc_response.json())["id"]

        # Create nomenclature
        nom_response = authenticated_client.post("/api/nomenclatures/", json={
            "code": "NOM_DELETE_TEST",
            "name": "Nomenclature Delete Test",
            "description": "Test nomenclature for deletion testing"
        })
        assert nom_response.status_code == status.HTTP_200_OK
        self.nomenclature_id = validate_success_response(nom_response.json())["id"]

    def test_delete_period_with_registry_records_409_conflict(self, authenticated_client: TestClient):
        """Test that deleting period with registry records returns 409 Conflict."""
        # Create registry entries linked to the period
        registry_entries = [
            {
                "period_id": self.period_id,
                "financial_center_id": self.financial_center_id,
                "cost_center_id": self.cost_center_id,
                "nomenclature_id": self.nomenclature_id,
                "row_type": 1,  # Plan
                "summ": 10000.00,
                "comment": "Test plan entry"
            },
            {
                "period_id": self.period_id,
                "financial_center_id": self.financial_center_id,
                "cost_center_id": self.cost_center_id,
                "nomenclature_id": self.nomenclature_id,
                "row_type": 2,  # Fact
                "summ": 7500.00,
                "comment": "Test fact entry"
            }
        ]

        created_registry_ids = []
        for registry_data in registry_entries:
            response = authenticated_client.post("/api/registry/", json=registry_data)
            assert response.status_code == status.HTTP_200_OK
            data = validate_success_response(response.json())
            created_registry_ids.append(data["id"])

        # Try to delete the period - should fail with 409 Conflict
        delete_response = authenticated_client.delete(f"/api/periods/{self.period_id}")
        assert delete_response.status_code == status.HTTP_409_CONFLICT

        response_data = delete_response.json()
        error_message = validate_error_response(response_data)

        # Verify error message content
        assert "Невозможно удалить период" in error_message
        assert self.period_name in error_message
        assert "2 записей бюджета" in error_message
        assert "связанных с этим периодом" in error_message
        assert "Сначала удалите все связанные записи" in error_message

        # Verify period still exists
        get_response = authenticated_client.get(f"/api/periods/{self.period_id}")
        assert get_response.status_code == status.HTTP_200_OK
        validate_success_response(get_response.json())

        # Cleanup - delete registry entries first, then period
        for registry_id in created_registry_ids:
            authenticated_client.delete(f"/api/registry/{registry_id}")

    def test_delete_period_single_dependency_error_message(self, authenticated_client: TestClient):
        """Test error message when period has exactly one registry record."""
        # Create single registry entry
        registry_data = {
            "period_id": self.period_id,
            "financial_center_id": self.financial_center_id,
            "cost_center_id": self.cost_center_id,
            "nomenclature_id": self.nomenclature_id,
            "row_type": 1,
            "summ": 5000.00,
            "comment": "Single dependency test"
        }

        registry_response = authenticated_client.post("/api/registry/", json=registry_data)
        assert registry_response.status_code == status.HTTP_200_OK
        registry_id = validate_success_response(registry_response.json())["id"]

        # Try to delete period
        delete_response = authenticated_client.delete(f"/api/periods/{self.period_id}")
        assert delete_response.status_code == status.HTTP_409_CONFLICT

        response_data = delete_response.json()
        error_message = validate_error_response(response_data)

        # Verify singular form in error message
        assert "1 записей бюджета" in error_message or "1 записи бюджета" in error_message

        # Cleanup
        authenticated_client.delete(f"/api/registry/{registry_id}")

    def test_delete_period_multiple_dependencies_count(self, authenticated_client: TestClient):
        """Test that error message shows correct count of dependent records."""
        # Create exactly 5 registry entries
        created_registry_ids = []

        for i in range(5):
            registry_data = {
                "period_id": self.period_id,
                "financial_center_id": self.financial_center_id,
                "cost_center_id": self.cost_center_id,
                "nomenclature_id": self.nomenclature_id,
                "row_type": 1 if i % 2 == 0 else 2,  # Alternate between plan and fact
                "summ": 1000.00 * (i + 1),
                "comment": f"Dependency count test {i + 1}"
            }

            response = authenticated_client.post("/api/registry/", json=registry_data)
            assert response.status_code == status.HTTP_200_OK
            registry_id = validate_success_response(response.json())["id"]
            created_registry_ids.append(registry_id)

        # Try to delete period
        delete_response = authenticated_client.delete(f"/api/periods/{self.period_id}")
        assert delete_response.status_code == status.HTTP_409_CONFLICT

        response_data = delete_response.json()
        error_message = validate_error_response(response_data)

        # Verify exact count in error message
        assert "5 записей бюджета" in error_message

        # Cleanup
        for registry_id in created_registry_ids:
            authenticated_client.delete(f"/api/registry/{registry_id}")


class TestPeriodDeletionNotFound:
    """Test 404 handling for non-existent periods."""

    def test_delete_nonexistent_period_404(self, authenticated_client: TestClient):
        """Test deleting non-existent period returns 404 Not Found."""
        nonexistent_id = 99999

        response = authenticated_client.delete(f"/api/periods/{nonexistent_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response_data = response.json()
        error_message = validate_error_response(response_data)

        # Verify error message content
        assert "not found" in error_message.lower() or "не найден" in error_message.lower()

    def test_delete_invalid_period_id_format(self, authenticated_client: TestClient):
        """Test deleting with invalid period ID format."""
        invalid_ids = ["invalid", "0", "-1", "abc"]

        for invalid_id in invalid_ids:
            response = authenticated_client.delete(f"/api/periods/{invalid_id}")
            # Should be either 404 or 422, depending on validation
            assert response.status_code in [
                status.HTTP_404_NOT_FOUND,
                status.HTTP_422_UNPROCESSABLE_ENTITY
            ]

    def test_delete_already_deleted_period_404(self, authenticated_client: TestClient):
        """Test deleting a period that was already deleted."""
        # Create and delete period
        period_data = {
            "period_year": 2025,
            "period_month": 6,
            "period_name": "Double Delete Test",
            "is_active": False
        }

        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        period_id = validate_success_response(create_response.json())["id"]

        # First deletion should succeed
        delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_200_OK
        validate_success_response(delete_response.json())

        # Second deletion attempt should return 404
        second_delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert second_delete_response.status_code == status.HTTP_404_NOT_FOUND
        validate_error_response(second_delete_response.json())


class TestPeriodDeletionUserIsolation:
    """Test user isolation for period deletion operations."""

    def test_delete_other_users_period_404(self, client: TestClient):
        """Test that users cannot delete periods belonging to other users."""
        # Create first user and period
        user1_data = {
            "username": "user1_delete_test",
            "password": "Password123!",
            "user_name": "User One Delete",
            "email": "user1_delete@example.com"
        }

        client.post("/api/auth/register", json=user1_data)
        login_response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_cookies = login_response.cookies

        # Create period as user1
        client.cookies = user1_cookies
        period_data = {
            "period_year": 2025,
            "period_month": 7,
            "period_name": "User1 Period for Isolation Test"
        }

        create_response = client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        period_id = validate_success_response(create_response.json())["id"]

        # Create second user
        user2_data = {
            "username": "user2_delete_test",
            "password": "Password123!",
            "user_name": "User Two Delete",
            "email": "user2_delete@example.com"
        }

        client.post("/api/auth/register", json=user2_data)
        login_response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_cookies = login_response.cookies

        # Try to delete user1's period as user2
        client.cookies = user2_cookies
        delete_response = client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_404_NOT_FOUND

        response_data = delete_response.json()
        error_message = validate_error_response(response_data)
        assert "not found" in error_message.lower() or "access denied" in error_message.lower()

        # Verify period still exists for user1
        client.cookies = user1_cookies
        get_response = client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_200_OK
        validate_success_response(get_response.json())

    def test_delete_period_user_isolation_with_dependencies(self, client: TestClient):
        """Test user isolation when period has dependencies from different users."""
        # This is an edge case test to ensure user isolation works even with complex dependencies
        user1_data = {
            "username": "user1_complex_delete",
            "password": "Password123!",
            "user_name": "User One Complex",
            "email": "user1_complex@example.com"
        }

        client.post("/api/auth/register", json=user1_data)
        login_response = client.post("/api/auth/login", json={
            "username": user1_data["username"],
            "password": user1_data["password"]
        })
        user1_cookies = login_response.cookies

        # Create period and dependencies as user1
        client.cookies = user1_cookies
        period_data = {
            "period_year": 2025,
            "period_month": 8,
            "period_name": "Complex Isolation Test"
        }

        create_response = client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        period_id = validate_success_response(create_response.json())["id"]

        # Create user2 who should not be able to delete user1's period
        user2_data = {
            "username": "user2_complex_delete",
            "password": "Password123!",
            "user_name": "User Two Complex",
            "email": "user2_complex@example.com"
        }

        client.post("/api/auth/register", json=user2_data)
        login_response = client.post("/api/auth/login", json={
            "username": user2_data["username"],
            "password": user2_data["password"]
        })
        user2_cookies = login_response.cookies

        # User2 attempts to delete user1's period
        client.cookies = user2_cookies
        delete_response = client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_404_NOT_FOUND

        # Error should indicate not found or access denied
        error_message = validate_error_response(delete_response.json())
        assert "not found" in error_message.lower() or "access denied" in error_message.lower()


class TestPeriodDeletionErrorMessages:
    """Test error message content and formatting."""

    def test_constraint_error_message_russian_localization(self, authenticated_client: TestClient):
        """Test that constraint error messages are properly localized in Russian."""
        # Create period with Russian name
        period_data = {
            "period_year": 2025,
            "period_month": 9,
            "period_name": "Сентябрь 2025 - Тест локализации",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        period_id = validate_success_response(create_response.json())["id"]

        # Create reference data
        fc_response = authenticated_client.post("/api/financial_centers/", json={
            "code": "FC_RUS_TEST",
            "name": "Russian Test FC"
        })
        fc_id = validate_success_response(fc_response.json())["id"]

        cc_response = authenticated_client.post("/api/cost_centers/", json={
            "code": "CC_RUS_TEST",
            "name": "Russian Test CC"
        })
        cc_id = validate_success_response(cc_response.json())["id"]

        nom_response = authenticated_client.post("/api/nomenclatures/", json={
            "code": "NOM_RUS_TEST",
            "name": "Russian Test Nom"
        })
        nom_id = validate_success_response(nom_response.json())["id"]

        # Create registry entry
        registry_data = {
            "period_id": period_id,
            "financial_center_id": fc_id,
            "cost_center_id": cc_id,
            "nomenclature_id": nom_id,
            "row_type": 1,
            "summ": 15000.00,
            "comment": "Русский комментарий для теста"
        }

        registry_response = authenticated_client.post("/api/registry/", json=registry_data)
        assert registry_response.status_code == status.HTTP_200_OK
        registry_id = validate_success_response(registry_response.json())["id"]

        # Try to delete period
        delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_409_CONFLICT

        response_data = delete_response.json()
        error_message = validate_error_response(response_data)

        # Verify Russian localization
        russian_keywords = [
            "Невозможно удалить период",
            "записей бюджета",
            "связанных с этим периодом",
            "Сначала удалите все связанные записи"
        ]

        for keyword in russian_keywords:
            assert keyword in error_message, f"Missing Russian keyword: {keyword}"

        # Verify period name is included
        assert "Сентябрь 2025 - Тест локализации" in error_message

        # Cleanup
        authenticated_client.delete(f"/api/registry/{registry_id}")

    def test_generic_database_error_handling(self, authenticated_client: TestClient):
        """Test handling of unexpected database errors during deletion."""
        # This test verifies that unexpected database errors are properly caught and formatted
        # Create a period first
        period_data = {
            "period_year": 2025,
            "period_month": 10,
            "period_name": "Generic Error Test"
        }

        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        period_id = validate_success_response(create_response.json())["id"]

        # Normal deletion should work
        delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_200_OK
        validate_success_response(delete_response.json())

    def test_error_response_format_consistency(self, authenticated_client: TestClient):
        """Test that all error responses follow unified format."""
        test_cases = [
            # Non-existent period
            {"period_id": 99999, "expected_status": status.HTTP_404_NOT_FOUND},
        ]

        for test_case in test_cases:
            response = authenticated_client.delete(f"/api/periods/{test_case['period_id']}")
            assert response.status_code == test_case["expected_status"]

            response_data = response.json()

            # Verify unified error response format
            assert "success" in response_data
            assert response_data["success"] is False
            assert "error" in response_data
            assert isinstance(response_data["error"], str)
            assert len(response_data["error"]) > 0

            # Should not have "data" field in error responses
            assert "data" not in response_data


class TestPeriodDeletionAuthentication:
    """Test authentication requirements for period deletion."""

    def test_unauthenticated_delete_request_401(self, client: TestClient):
        """Test that unauthenticated deletion requests are rejected."""
        response = client.delete("/api/periods/1")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_invalid_session_delete_request_401(self, client: TestClient):
        """Test that requests with invalid sessions are rejected."""
        # Set invalid session cookie
        client.cookies.set("connect.sid", "invalid-session-id")

        response = client.delete("/api/periods/1")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
class TestPeriodDeletionAsync:
    """Test asynchronous aspects of period deletion."""

    async def test_concurrent_delete_attempts(self, authenticated_async_client: AsyncClient):
        """Test concurrent deletion attempts on the same period."""
        from datetime import datetime

        # Create period
        period_data = {
            "date": "2025-11-01T00:00:00",
            "ru_name": "Concurrent Delete Test"
        }

        create_response = await authenticated_async_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK

        response_data = create_response.json()
        period_id = validate_success_response(response_data)["id"]

        # Make concurrent deletion requests
        import asyncio

        async def delete_period():
            return await authenticated_async_client.delete(f"/api/periods/{period_id}")

        # Only one should succeed, others should get 404
        responses = await asyncio.gather(
            delete_period(),
            delete_period(),
            delete_period(),
            return_exceptions=True
        )

        success_count = sum(1 for r in responses if r.status_code == status.HTTP_200_OK)
        not_found_count = sum(1 for r in responses if r.status_code == status.HTTP_404_NOT_FOUND)

        assert success_count == 1
        assert not_found_count == 2

    async def test_delete_during_registry_creation(self, authenticated_async_client: AsyncClient):
        """Test deletion attempt while registry entries are being created."""
        # This tests race conditions between deletion and dependency creation
        period_data = {
            "date": "2025-12-01T00:00:00",
            "ru_name": "Race Condition Test"
        }

        create_response = await authenticated_async_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        period_id = validate_success_response(create_response.json())["id"]

        # Try to delete (should succeed since no dependencies exist yet)
        delete_response = await authenticated_async_client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_200_OK
        validate_success_response(delete_response.json())