"""
Comprehensive tests for periods deletion functionality.
Tests foreign key constraint handling, 409 Conflict responses, and user isolation.
"""
import pytest
from datetime import datetime
from fastapi import status
from fastapi.testclient import TestClient


class TestPeriodDeletionSuccess:
    """Test successful period deletion when no dependencies exist."""

    def test_delete_period_no_dependencies(self, authenticated_client: TestClient):
        """Test successful deletion when period has no registry records."""
        # Create a test period
        period_data = {
            "period_year": 2025,
            "period_month": 1,
            "period_name": "Test Delete Period",
            "is_active": True
        }

        create_response = authenticated_client.post("/api/periods/", json=period_data)
        assert create_response.status_code == status.HTTP_200_OK
        created_data = create_response.json()
        period_id = created_data["id"]

        # Verify period exists before deletion
        get_response = authenticated_client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_200_OK

        # Delete the period
        delete_response = authenticated_client.delete(f"/api/periods/{period_id}")
        assert delete_response.status_code == status.HTTP_200_OK

        # Verify success response
        response_data = delete_response.json()
        if "success" in response_data:
            # Unified format
            assert response_data["success"] is True
            assert "data" in response_data
            assert "message" in response_data["data"]
        else:
            # Legacy format
            assert "message" in response_data

        # Verify period was actually deleted
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
            "period_name": "Constraint Test Period",
            "is_active": True
        })
        assert period_response.status_code == status.HTTP_200_OK
        self.period_id = period_response.json()["id"]

        # Create financial center
        fc_response = authenticated_client.post("/api/financial_centers/", json={
            "code": "FC_DELETE_TEST",
            "name": "Financial Center Delete Test"
        })
        assert fc_response.status_code == status.HTTP_200_OK
        if "success" in fc_response.json():
            self.financial_center_id = fc_response.json()["data"]["id"]
        else:
            self.financial_center_id = fc_response.json()["id"]

        # Create cost center
        cc_response = authenticated_client.post("/api/cost_centers/", json={
            "code": "CC_DELETE_TEST",
            "name": "Cost Center Delete Test"
        })
        assert cc_response.status_code == status.HTTP_200_OK
        if "success" in cc_response.json():
            self.cost_center_id = cc_response.json()["data"]["id"]
        else:
            self.cost_center_id = cc_response.json()["id"]

        # Create nomenclature
        nom_response = authenticated_client.post("/api/nomenclatures/", json={
            "code": "NOM_DELETE_TEST",
            "name": "Nomenclature Delete Test"
        })
        assert nom_response.status_code == status.HTTP_200_OK
        if "success" in nom_response.json():
            self.nomenclature_id = nom_response.json()["data"]["id"]
        else:
            self.nomenclature_id = nom_response.json()["id"]

    def test_delete_period_with_registry_records_409_conflict(self, authenticated_client: TestClient):
        """Test that deleting period with registry records returns 409 Conflict."""
        # Create registry entry linked to the period
        registry_data = {
            "period_id": self.period_id,
            "financial_center_id": self.financial_center_id,
            "cost_center_id": self.cost_center_id,
            "nomenclature_id": self.nomenclature_id,
            "row_type": 1,  # Plan
            "summ": 10000.00,
            "comment": "Test plan entry"
        }

        registry_response = authenticated_client.post("/api/registry/", json=registry_data)
        assert registry_response.status_code == status.HTTP_200_OK

        # Try to delete the period - should fail with 409 Conflict
        delete_response = authenticated_client.delete(f"/api/periods/{self.period_id}")
        assert delete_response.status_code == status.HTTP_409_CONFLICT

        response_data = delete_response.json()

        # Check error message content
        if "success" in response_data:
            # Unified format
            assert response_data["success"] is False
            error_message = response_data["error"]
        else:
            # Legacy format
            error_message = response_data.get("detail", str(response_data))

        # Verify error message contains expected content
        assert "удалить период" in error_message or "delete period" in error_message.lower()

        # Verify period still exists
        get_response = authenticated_client.get(f"/api/periods/{self.period_id}")
        assert get_response.status_code == status.HTTP_200_OK


class TestPeriodDeletionNotFound:
    """Test 404 handling for non-existent periods."""

    def test_delete_nonexistent_period_404(self, authenticated_client: TestClient):
        """Test deleting non-existent period returns 404 Not Found."""
        nonexistent_id = 99999

        response = authenticated_client.delete(f"/api/periods/{nonexistent_id}")
        assert response.status_code == status.HTTP_404_NOT_FOUND

        response_data = response.json()

        # Check error format
        if "success" in response_data:
            # Unified format
            assert response_data["success"] is False
            assert "error" in response_data
        else:
            # Legacy format - should have detail field
            assert "detail" in response_data or "error" in response_data


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
        period_id = create_response.json()["id"]

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

        # Verify period still exists for user1
        client.cookies = user1_cookies
        get_response = client.get(f"/api/periods/{period_id}")
        assert get_response.status_code == status.HTTP_200_OK


class TestPeriodDeletionAuthentication:
    """Test authentication requirements for period deletion."""

    def test_unauthenticated_delete_request_401(self, client: TestClient):
        """Test that unauthenticated deletion requests are rejected."""
        response = client.delete("/api/periods/1")
        assert response.status_code == status.HTTP_401_UNAUTHORIZED