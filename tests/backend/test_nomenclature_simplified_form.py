"""
Test suite for simplified nomenclature form changes.
Verifies that nomenclatures can be created without account_name, bill_name, and operation fields.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.main import app
from app.models.nomenclature import Nomenclature
from app.schemas.nomenclature import NomenclatureCreate


class TestNomenclatureSimplifiedForm:
    """Test simplified nomenclature form without removed fields."""

    def test_create_nomenclature_without_optional_fields(self, authenticated_client: TestClient):
        """Test that nomenclatures can be created without account_name, bill_name, and operation fields."""
        payload = {
            "code": "SIMPLE001",
            "name": "Simple Nomenclature",
            "description": "Test nomenclature with minimal fields",
            "nomenclature_type": "EXPENSE",
            "is_active": True
        }

        response = authenticated_authenticated_client.post(
            "/api/nomenclatures/",
            json=payload
        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "SIMPLE001"
        assert data["data"]["name"] == "Simple Nomenclature"
        assert data["data"]["description"] == "Test nomenclature with minimal fields"
        assert data["data"]["nomenclature_type"] == "EXPENSE"
        assert data["data"]["is_active"] is True

        # Optional fields should be None or default values
        assert data["data"]["account_name"] is None
        assert data["data"]["bill_name"] is None
        assert data["data"]["operation"] is None

    def test_create_nomenclature_with_only_required_fields(self, authenticated_client: TestClient):
        """Test creating nomenclature with only code and name (absolute minimum)."""
        payload = {
            "code": "MIN001",
            "name": "Minimal Nomenclature"
        }

        response = authenticated_client.post(
            "/api/nomenclatures/",
            json=payload        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "MIN001"
        assert data["data"]["name"] == "Minimal Nomenclature"

        # Check default values
        assert data["data"]["nomenclature_type"] == "EXPENSE"
        assert data["data"]["is_budget"] is True
        assert data["data"]["is_fact"] is True
        assert data["data"]["is_active"] is True

        # Optional fields should be None
        assert data["data"]["account_name"] is None
        assert data["data"]["bill_name"] is None
        assert data["data"]["operation"] is None
        assert data["data"]["description"] is None

    def test_create_nomenclature_with_partial_optional_fields(self, authenticated_client: TestClient):
        """Test creating nomenclature with some optional fields provided."""
        payload = {
            "code": "PARTIAL001",
            "name": "Partial Nomenclature",
            "description": "Has description but no account/bill/operation",
            "account_name": "Test Account",  # Include one of the optional fields
            "nomenclature_type": "INCOME",
            "is_active": True
        }

        response = authenticated_client.post(
            "/api/nomenclatures/",
            json=payload        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "PARTIAL001"
        assert data["data"]["name"] == "Partial Nomenclature"
        assert data["data"]["account_name"] == "Test Account"
        assert data["data"]["nomenclature_type"] == "INCOME"

        # Other optional fields should be None
        assert data["data"]["bill_name"] is None
        assert data["data"]["operation"] is None

    def test_existing_nomenclatures_with_optional_fields_still_work(self, authenticated_client: TestClient):
        """Test that existing nomenclatures with account_name, bill_name, operation still work."""
        # First create a nomenclature with all fields (simulating legacy data)
        payload = {
            "code": "LEGACY001",
            "name": "Legacy Nomenclature",
            "description": "Has all the old fields",
            "account_name": "Legacy Account",
            "bill_name": "Legacy Bill",
            "operation": "Legacy Operation",
            "nomenclature_type": "EXPENSE",
            "is_active": True
        }

        response = authenticated_client.post(
            "/api/nomenclatures/",
            json=payload        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["data"]["code"] == "LEGACY001"
        assert data["data"]["name"] == "Legacy Nomenclature"
        assert data["data"]["account_name"] == "Legacy Account"
        assert data["data"]["bill_name"] == "Legacy Bill"
        assert data["data"]["operation"] == "Legacy Operation"

        # Now fetch the nomenclature to ensure it's properly stored and retrieved
        nomenclature_id = data["data"]["id"]
        get_response = authenticated_client.get(
            f"/api/nomenclatures/{nomenclature_id}"        )

        assert get_response.status_code == 200
        get_data = get_response.json()
        assert get_data["success"] is True
        assert get_data["data"]["account_name"] == "Legacy Account"
        assert get_data["data"]["bill_name"] == "Legacy Bill"
        assert get_data["data"]["operation"] == "Legacy Operation"

    def test_update_nomenclature_can_remove_optional_fields(self, authenticated_client: TestClient):
        """Test that updating nomenclature can remove optional fields by setting them to null."""
        # Create nomenclature with optional fields
        create_payload = {
            "code": "UPDATE001",
            "name": "Update Test",
            "account_name": "Original Account",
            "bill_name": "Original Bill",
            "operation": "Original Operation"
        }

        create_response = authenticated_client.post(
            "/api/nomenclatures/",
            json=create_payload        )
        assert create_response.status_code == 200
        nomenclature_id = create_response.json()["data"]["id"]

        # Update to remove optional fields
        update_payload = {
            "name": "Updated Name",
            "account_name": None,
            "bill_name": None,
            "operation": None
        }

        update_response = authenticated_client.put(
            f"/api/nomenclatures/{nomenclature_id}",
            json=update_payload        )

        assert update_response.status_code == 200
        updated_data = update_response.json()
        assert updated_data["success"] is True
        assert updated_data["data"]["name"] == "Updated Name"
        assert updated_data["data"]["account_name"] is None
        assert updated_data["data"]["bill_name"] is None
        assert updated_data["data"]["operation"] is None

    def test_schema_validation_without_optional_fields(self):
        """Test that NomenclatureCreate schema validates correctly without optional fields."""
        # Test with minimal required fields
        minimal_nomenclature = NomenclatureCreate(
            code="SCHEMA001",
            name="Schema Test"
        )
        assert minimal_nomenclature.code == "SCHEMA001"
        assert minimal_nomenclature.name == "Schema Test"
        assert minimal_nomenclature.account_name is None
        assert minimal_nomenclature.bill_name is None
        assert minimal_nomenclature.operation is None

    def test_database_constraints_with_optional_fields(self, authenticated_client: TestClient):
        """Test that database properly handles NULL values for optional fields."""
        payload = {
            "code": "DB001",
            "name": "Database Test",
            "account_name": None,
            "bill_name": None,
            "operation": None,
            "description": None
        }

        response = authenticated_client.post(
            "/api/nomenclatures/",
            json=payload        )

        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

        # Verify NULL values are properly stored
        assert data["data"]["account_name"] is None
        assert data["data"]["bill_name"] is None
        assert data["data"]["operation"] is None
        assert data["data"]["description"] is None

    def test_api_response_consistency(self, authenticated_client: TestClient):
        """Test that API responses are consistent regardless of optional field presence."""
        # Create nomenclature without optional fields
        simple_payload = {
            "code": "CONSIST001",
            "name": "Consistency Test Simple"
        }

        simple_response = authenticated_client.post(
            "/api/nomenclatures/",
            json=simple_payload        )

        # Create nomenclature with optional fields
        complex_payload = {
            "code": "CONSIST002",
            "name": "Consistency Test Complex",
            "account_name": "Account",
            "bill_name": "Bill",
            "operation": "Operation"
        }

        complex_response = authenticated_client.post(
            "/api/nomenclatures/",
            json=complex_payload        )

        assert simple_response.status_code == 200
        assert complex_response.status_code == 200

        simple_data = simple_response.json()
        complex_data = complex_response.json()

        # Both should have the same response structure
        assert "success" in simple_data
        assert "data" in simple_data
        assert "success" in complex_data
        assert "data" in complex_data

        # Both should have the same required fields
        required_fields = ["id", "code", "name", "nomenclature_type", "is_budget", "is_fact", "is_active"]
        for field in required_fields:
            assert field in simple_data["data"]
            assert field in complex_data["data"]

        # Both should have the optional fields (with different values)
        optional_fields = ["account_name", "bill_name", "operation", "description"]
        for field in optional_fields:
            assert field in simple_data["data"]
            assert field in complex_data["data"]

    def test_bulk_operations_with_mixed_field_presence(self, authenticated_client: TestClient):
        """Test that multiple nomenclatures with different field combinations work correctly."""
        nomenclatures_to_create = [
            {
                "code": "BULK001",
                "name": "Bulk Test 1"
            },
            {
                "code": "BULK002",
                "name": "Bulk Test 2",
                "description": "Has description"
            },
            {
                "code": "BULK003",
                "name": "Bulk Test 3",
                "account_name": "Account 3"
            },
            {
                "code": "BULK004",
                "name": "Bulk Test 4",
                "account_name": "Account 4",
                "bill_name": "Bill 4",
                "operation": "Operation 4"
            }
        ]

        created_nomenclatures = []
        for payload in nomenclatures_to_create:
            response = authenticated_client.post(
                "/api/nomenclatures/",
                json=payload,
                headers=auth_headers
            )
            assert response.status_code == 200
            data = response.json()
            assert data["success"] is True
            created_nomenclatures.append(data["data"])

        # Verify all nomenclatures were created correctly
        assert len(created_nomenclatures) == 4

        # Verify first nomenclature (minimal)
        assert created_nomenclatures[0]["code"] == "BULK001"
        assert created_nomenclatures[0]["account_name"] is None

        # Verify second nomenclature (with description)
        assert created_nomenclatures[1]["code"] == "BULK002"
        assert created_nomenclatures[1]["description"] == "Has description"
        assert created_nomenclatures[1]["account_name"] is None

        # Verify third nomenclature (with account_name)
        assert created_nomenclatures[2]["code"] == "BULK003"
        assert created_nomenclatures[2]["account_name"] == "Account 3"
        assert created_nomenclatures[2]["bill_name"] is None

        # Verify fourth nomenclature (with all optional fields)
        assert created_nomenclatures[3]["code"] == "BULK004"
        assert created_nomenclatures[3]["account_name"] == "Account 4"
        assert created_nomenclatures[3]["bill_name"] == "Bill 4"
        assert created_nomenclatures[3]["operation"] == "Operation 4"

    def test_list_nomenclatures_with_mixed_field_presence(self, authenticated_client: TestClient):
        """Test that listing nomenclatures works correctly with mixed field presence."""
        # Create a few nomenclatures with different field combinations
        test_data = [
            {"code": "LIST001", "name": "List Test 1"},
            {"code": "LIST002", "name": "List Test 2", "account_name": "Account 2"}
        ]

        for payload in test_data:
            response = authenticated_client.post("/api/nomenclatures/", json=payload, headers=auth_headers)
            assert response.status_code == 200

        # List all nomenclatures
        list_response = authenticated_client.get("/api/nomenclatures/", headers=auth_headers)
        assert list_response.status_code == 200

        list_data = list_response.json()
        assert list_data["success"] is True
        assert "data" in list_data
        assert len(list_data["data"]) >= 2  # At least our test data

        # Find our test nomenclatures
        found_nomenclatures = [
            item for item in list_data["data"]
            if item["code"] in ["LIST001", "LIST002"]
        ]
        assert len(found_nomenclatures) == 2

        # Verify they maintain their field structure
        list001 = next(item for item in found_nomenclatures if item["code"] == "LIST001")
        list002 = next(item for item in found_nomenclatures if item["code"] == "LIST002")

        assert list001["account_name"] is None
        assert list002["account_name"] == "Account 2"