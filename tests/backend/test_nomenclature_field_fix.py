"""
Test suite for nomenclature field mapping fix.
Verifies that the code field is properly handled in nomenclature creation.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.main import app
from app.models.nomenclature import Nomenclature
from app.schemas.nomenclature import NomenclatureCreate


class TestNomenclatureFieldMapping:
    """Test nomenclature field mapping and validation."""

    def test_nomenclature_create_requires_code_field(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test that nomenclature creation fails without code field."""
        # Missing code field
        payload = {
            "name": "Test Nomenclature",
            "account_name": "Test Account",
            "bill_name": "Test Bill",
            "operation": "Test Operation",
            "nomenclature_type": "EXPENSE",
            "is_active": True
        }

        response = client.post(
            "/api/nomenclatures/",
            json=payload,
            headers=auth_headers
        )

        assert response.status_code == 422
        error_detail = response.json()
        assert "code" in str(error_detail).lower()
        assert "field required" in str(error_detail).lower()

    def test_nomenclature_create_with_all_required_fields(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test successful nomenclature creation with all required fields."""
        payload = {
            "code": "TEST001",
            "name": "Test Nomenclature",
            "account_name": "Test Account",
            "bill_name": "Test Bill",
            "operation": "Test Operation",
            "nomenclature_type": "EXPENSE",
            "description": "Test description",
            "is_budget": True,
            "is_fact": True,
            "is_active": True
        }

        response = client.post(
            "/api/nomenclatures/",
            json=payload,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "TEST001"
        assert data["data"]["name"] == "Test Nomenclature"
        assert data["data"]["account_name"] == "Test Account"
        assert data["data"]["bill_name"] == "Test Bill"
        assert data["data"]["operation"] == "Test Operation"

    def test_nomenclature_schema_validation(self):
        """Test that NomenclatureCreate schema properly validates required fields."""
        # Test with missing code
        with pytest.raises(ValueError) as exc_info:
            NomenclatureCreate(
                name="Test",
                account_name="Account",
                bill_name="Bill",
                operation="Operation"
            )
        assert "code" in str(exc_info.value).lower()

        # Test with all required fields
        valid_nomenclature = NomenclatureCreate(
            code="TEST001",
            name="Test",
            account_name="Account",
            bill_name="Bill",
            operation="Operation"
        )
        assert valid_nomenclature.code == "TEST001"
        assert valid_nomenclature.name == "Test"

    def test_nomenclature_field_types(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test that field types are correctly validated."""
        # Test with incorrect field types
        payload = {
            "code": 123,  # Should be string
            "name": "Test",
            "account_name": "Account",
            "bill_name": "Bill",
            "operation": "Operation",
            "is_active": "yes"  # Should be boolean
        }

        response = client.post(
            "/api/nomenclatures/",
            json=payload,
            headers=auth_headers
        )

        # The API should handle type conversion or return validation error
        if response.status_code == 200:
            data = response.json()
            # If successful, verify types were converted
            assert isinstance(data["data"]["code"], str)
            assert isinstance(data["data"]["is_active"], bool)
        else:
            # If validation error, verify it's about type mismatch
            assert response.status_code == 422

    def test_nomenclature_optional_fields(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test that optional fields have proper defaults."""
        # Only required fields
        payload = {
            "code": "TEST002",
            "name": "Minimal Nomenclature",
            "account_name": "Account",
            "bill_name": "Bill",
            "operation": "Operation"
        }

        response = client.post(
            "/api/nomenclatures/",
            json=payload,
            headers=auth_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Check defaults for optional fields
        nomenclature = data["data"]
        assert nomenclature["nomenclature_type"] == "EXPENSE"  # Default value
        assert nomenclature["is_active"] is True  # Default value
        assert nomenclature["is_budget"] is True  # Default value
        assert nomenclature["is_fact"] is True  # Default value

    def test_nomenclature_duplicate_code_prevention(self, client: TestClient, auth_headers: Dict[str, str], db: Session):
        """Test that duplicate nomenclature codes are prevented."""
        # Create first nomenclature
        payload1 = {
            "code": "UNIQUE001",
            "name": "First Nomenclature",
            "account_name": "Account1",
            "bill_name": "Bill1",
            "operation": "Operation1"
        }

        response1 = client.post(
            "/api/nomenclatures/",
            json=payload1,
            headers=auth_headers
        )
        assert response1.status_code == 200

        # Try to create second nomenclature with same code
        payload2 = {
            "code": "UNIQUE001",  # Same code
            "name": "Second Nomenclature",
            "account_name": "Account2",
            "bill_name": "Bill2",
            "operation": "Operation2"
        }

        response2 = client.post(
            "/api/nomenclatures/",
            json=payload2,
            headers=auth_headers
        )

        # Should either fail with 409 conflict or 400 bad request
        assert response2.status_code in [400, 409]
        error_data = response2.json()
        assert error_data["success"] is False

    def test_nomenclature_update_preserves_code(self, client: TestClient, auth_headers: Dict[str, str]):
        """Test that updating nomenclature preserves the code field."""
        # Create nomenclature
        create_payload = {
            "code": "UPDATE001",
            "name": "Original Name",
            "account_name": "Account",
            "bill_name": "Bill",
            "operation": "Operation"
        }

        create_response = client.post(
            "/api/nomenclatures/",
            json=create_payload,
            headers=auth_headers
        )
        assert create_response.status_code == 200
        nomenclature_id = create_response.json()["data"]["id"]

        # Update nomenclature
        update_payload = {
            "name": "Updated Name",
            "description": "Added description"
        }

        update_response = client.put(
            f"/api/nomenclatures/{nomenclature_id}",
            json=update_payload,
            headers=auth_headers
        )

        assert update_response.status_code == 200
        updated_data = update_response.json()
        assert updated_data["data"]["code"] == "UPDATE001"  # Code preserved
        assert updated_data["data"]["name"] == "Updated Name"  # Name updated
        assert updated_data["data"]["description"] == "Added description"  # Description added