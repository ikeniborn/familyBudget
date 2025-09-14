"""
Test suite for cost center creation fix - missing 'code' field issue.
This file tests the fix applied to ensure the 'code' field is properly handled
in cost center creation and update operations.
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app
import json


class TestCostCenterCodeFieldFix:
    """Test suite for verifying the 'code' field requirement fix"""

    def test_create_cost_center_with_all_required_fields(
        self, authenticated_client: TestClient
    ):
        """Test successful cost center creation with code and name fields"""
        # Arrange
        cost_center_data = {
            "code": "TEST001",
            "name": "Test Cost Center",
            "description": "Test description",
            "is_active": True
        }

        # Act
        response = authenticated_client.post(
            "/api/cost_centers/",
            json=cost_center_data
        )

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "TEST001"
        assert data["data"]["name"] == "Test Cost Center"
        assert data["data"]["description"] == "Test description"
        assert data["data"]["is_active"] is True

    def test_create_cost_center_missing_code_field(
        self, authenticated_client: TestClient
    ):
        """Test that missing 'code' field returns 422 validation error"""
        # Arrange - intentionally missing 'code' field
        cost_center_data = {
            "name": "Test Cost Center Without Code",
            "description": "Test description",
            "is_active": True
        }

        # Act
        response = authenticated_client.post(
            "/api/cost_centers/",
            json=cost_center_data
        )

        # Assert
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert "validation" in data["error"].lower() or "field required" in str(data)

    def test_create_cost_center_missing_name_field(
        self, authenticated_client: TestClient
    ):
        """Test that missing 'name' field returns 422 validation error"""
        # Arrange - intentionally missing 'name' field
        cost_center_data = {
            "code": "TEST002",
            "description": "Test description",
            "is_active": True
        }

        # Act
        response = authenticated_client.post(
            "/api/cost_centers/",
            json=cost_center_data
        )

        # Assert
        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False
        assert "validation" in data["error"].lower() or "field required" in str(data)

    def test_create_cost_center_duplicate_code(
        self, authenticated_client: TestClient
    ):
        """Test that duplicate code returns 409 conflict error"""
        # Arrange - create first cost center
        cost_center_data = {
            "code": "UNIQUE001",
            "name": "First Cost Center",
            "is_active": True
        }

        # Create first cost center
        response1 = authenticated_client.post(
            "/api/cost_centers/",
            json=cost_center_data
        )
        assert response1.status_code == 201

        # Attempt to create second with same code
        duplicate_data = {
            "code": "UNIQUE001",  # Same code
            "name": "Second Cost Center",  # Different name
            "is_active": True
        }

        # Act
        response2 = authenticated_client.post(
            "/api/cost_centers/",
            json=duplicate_data
        )

        # Assert
        assert response2.status_code == 409
        data = response2.json()
        assert data["success"] is False
        assert "already exists" in data["error"].lower() or "duplicate" in data["error"].lower()

    def test_create_cost_center_with_optional_fields_only(
        self, authenticated_client: TestClient
    ):
        """Test creating cost center with only required fields (code, name)"""
        # Arrange - only required fields
        cost_center_data = {
            "code": "MINIMAL001",
            "name": "Minimal Cost Center"
            # No description, is_active should default to True
        }

        # Act
        response = authenticated_client.post(
            "/api/cost_centers/",
            json=cost_center_data
        )

        # Assert
        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "MINIMAL001"
        assert data["data"]["name"] == "Minimal Cost Center"
        assert data["data"]["description"] is None or data["data"]["description"] == ""
        assert data["data"]["is_active"] is True  # Default value

    def test_update_cost_center_with_code_field(
        self, authenticated_client: TestClient
    ):
        """Test updating cost center including the code field"""
        # Arrange - create initial cost center
        initial_data = {
            "code": "UPDATE001",
            "name": "Initial Name",
            "is_active": True
        }

        create_response = authenticated_client.post(
            "/api/cost_centers/",
            json=initial_data
        )
        assert create_response.status_code == 201
        created_id = create_response.json()["data"]["id"]

        # Update data
        update_data = {
            "code": "UPDATE002",  # Change code
            "name": "Updated Name",
            "description": "Updated description",
            "is_active": False
        }

        # Act
        response = authenticated_client.put(
            f"/api/cost_centers/{created_id}",
            json=update_data
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "UPDATE002"
        assert data["data"]["name"] == "Updated Name"
        assert data["data"]["description"] == "Updated description"
        assert data["data"]["is_active"] is False

    def test_code_field_length_validation(
        self, authenticated_client: TestClient
    ):
        """Test code field length constraints"""
        # Test too long code (assuming max length is reasonable, e.g., 50 chars)
        long_code_data = {
            "code": "A" * 100,  # Very long code
            "name": "Test Cost Center"
        }

        response = authenticated_client.post(
            "/api/cost_centers/",
            json=long_code_data
        )

        # Should either accept (if no limit) or reject with 422
        if response.status_code == 422:
            data = response.json()
            assert data["success"] is False
            assert "validation" in data["error"].lower() or "too long" in str(data).lower()

        # Test empty code
        empty_code_data = {
            "code": "",  # Empty string
            "name": "Test Cost Center"
        }

        response = authenticated_client.post(
            "/api/cost_centers/",
            json=empty_code_data
        )

        assert response.status_code == 422
        data = response.json()
        assert data["success"] is False

    def test_get_cost_center_includes_code_field(
        self, authenticated_client: TestClient
    ):
        """Test that GET request returns the code field"""
        # Arrange - create cost center
        cost_center_data = {
            "code": "GET001",
            "name": "Get Test Cost Center"
        }

        create_response = authenticated_client.post(
            "/api/cost_centers/",
            json=cost_center_data
        )
        assert create_response.status_code == 201
        created_id = create_response.json()["data"]["id"]

        # Act - get the created cost center
        response = authenticated_client.get(
            f"/api/cost_centers/{created_id}"
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "GET001"
        assert data["data"]["name"] == "Get Test Cost Center"

    def test_list_cost_centers_includes_code_field(
        self, authenticated_client: TestClient
    ):
        """Test that list endpoint returns code field for all items"""
        # Arrange - create multiple cost centers
        for i in range(3):
            data = {
                "code": f"LIST{i:03d}",
                "name": f"List Test {i}"
            }
            response = authenticated_client.post(
                "/api/cost_centers/",
                json=data
            )
            assert response.status_code == 201

        # Act - list all cost centers
        response = authenticated_client.get(
            "/api/cost_centers/"
        )

        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert len(data["data"]) >= 3

        # Check that all items have code field
        for item in data["data"]:
            assert "code" in item
            assert "name" in item
            assert item["code"] is not None
            assert item["name"] is not None