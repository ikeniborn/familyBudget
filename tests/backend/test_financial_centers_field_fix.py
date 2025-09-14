"""
Comprehensive tests for the financial center field fix.
Tests field name validation, rejection of old field names, and proper error handling.
Verifies that the fix correctly accepts 'name' and rejects 'financial_center_name'.
"""
import pytest
from fastapi import status
from fastapi.testclient import TestClient


class TestFinancialCenterFieldNameValidation:
    """Test proper field name handling after the field fix."""

    def test_create_with_correct_name_field_success(self, authenticated_client: TestClient):
        """Test that creating with 'name' field works correctly."""
        center_data = {
            "name": "Правильное поле name",
            "is_active": True
        }

        response = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        assert "success" in response_data
        assert response_data["success"] is True
        assert "data" in response_data

        data = response_data["data"]
        assert data["name"] == center_data["name"]
        assert data["is_active"] == center_data["is_active"]
        assert "id" in data
        assert "user_id" in data

    def test_create_with_old_financial_center_name_field_rejected(self, authenticated_client: TestClient):
        """Test that the old 'financial_center_name' field is rejected with 422 validation error."""
        center_data = {
            "financial_center_name": "Старое поле financial_center_name",  # Old field name
            "is_active": True
        }

        response = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        error_data = response.json()
        assert "detail" in error_data
        # Should contain validation error about missing required field
        detail = error_data["detail"]
        assert isinstance(detail, list)

        # Check that validation error mentions the 'name' field is required
        field_errors = [d for d in detail if d.get("loc") and "name" in d["loc"]]
        assert len(field_errors) > 0
        assert any("required" in str(error.get("msg", "")).lower() for error in field_errors)

    def test_update_with_correct_name_field_success(self, authenticated_client: TestClient):
        """Test that updating with 'name' field works correctly."""
        # First create a financial center
        create_data = {
            "name": "Исходный ЦФО",
            "is_active": True
        }
        create_response = authenticated_client.post("/api/financial_centers/", json=create_data)
        assert create_response.status_code == status.HTTP_200_OK

        center_id = create_response.json()["data"]["id"]

        # Update with correct field name
        update_data = {
            "name": "Обновленное название",
            "is_active": False
        }

        response = authenticated_client.put(f"/api/financial_centers/{center_id}/", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        assert "success" in response_data
        assert response_data["success"] is True
        assert "data" in response_data

        data = response_data["data"]
        assert data["name"] == update_data["name"]
        assert data["is_active"] == update_data["is_active"]

    def test_update_with_old_financial_center_name_field_ignored(self, authenticated_client: TestClient):
        """Test that updating with old 'financial_center_name' field is ignored (no validation error but field ignored)."""
        # First create a financial center
        create_data = {
            "name": "Исходный ЦФО для обновления",
            "is_active": True
        }
        create_response = authenticated_client.post("/api/financial_centers/", json=create_data)
        assert create_response.status_code == status.HTTP_200_OK

        center_id = create_response.json()["data"]["id"]
        original_name = create_data["name"]

        # Try to update with old field name - should be ignored during update
        update_data = {
            "financial_center_name": "Новое название через старое поле",  # Old field name
            "is_active": False
        }

        response = authenticated_client.put(f"/api/financial_centers/{center_id}/", json=update_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        assert "success" in response_data
        assert response_data["success"] is True

        data = response_data["data"]
        # Name should remain unchanged since old field was ignored
        assert data["name"] == original_name
        # But is_active should be updated
        assert data["is_active"] == update_data["is_active"]

    def test_mixed_fields_name_takes_precedence(self, authenticated_client: TestClient):
        """Test that when both 'name' and 'financial_center_name' are provided, 'name' takes precedence."""
        center_data = {
            "name": "Правильное поле name",
            "financial_center_name": "Неправильное поле",  # Should be ignored
            "is_active": True
        }

        response = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert response.status_code == status.HTTP_200_OK

        response_data = response.json()
        assert "success" in response_data
        assert response_data["success"] is True

        data = response_data["data"]
        # Should use the 'name' field value
        assert data["name"] == center_data["name"]
        assert data["name"] != center_data["financial_center_name"]


class TestFinancialCenterValidationErrorMessages:
    """Test proper error message formatting and validation responses."""

    def test_missing_required_name_field_error_message(self, authenticated_client: TestClient):
        """Test that missing 'name' field returns properly formatted 422 error."""
        center_data = {
            "is_active": True
            # Missing required 'name' field
        }

        response = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        error_data = response.json()
        assert "detail" in error_data
        assert isinstance(error_data["detail"], list)

        # Check that error details contain information about missing name field
        name_error = None
        for detail in error_data["detail"]:
            if detail.get("loc") and "name" in detail["loc"]:
                name_error = detail
                break

        assert name_error is not None
        assert "required" in name_error["msg"].lower()
        assert name_error["type"] == "missing"

    def test_empty_name_field_error_message(self, authenticated_client: TestClient):
        """Test that empty 'name' field returns proper validation error."""
        center_data = {
            "name": "",  # Empty name
            "is_active": True
        }

        response = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        error_data = response.json()
        assert "detail" in error_data
        assert isinstance(error_data["detail"], list)

        # Check that error details contain information about empty name field
        name_error = None
        for detail in error_data["detail"]:
            if detail.get("loc") and "name" in detail["loc"]:
                name_error = detail
                break

        assert name_error is not None
        # Should contain validation error about minimum length
        assert "at least" in name_error["msg"].lower() or "ensure" in name_error["msg"].lower()

    def test_name_field_too_long_error_message(self, authenticated_client: TestClient):
        """Test that overly long 'name' field returns proper validation error."""
        center_data = {
            "name": "x" * 256,  # Exceeds max length of 255
            "is_active": True
        }

        response = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        error_data = response.json()
        assert "detail" in error_data
        assert isinstance(error_data["detail"], list)

        # Check that error details contain information about field length
        name_error = None
        for detail in error_data["detail"]:
            if detail.get("loc") and "name" in detail["loc"]:
                name_error = detail
                break

        assert name_error is not None
        # Should contain validation error about maximum length
        assert "at most" in name_error["msg"].lower() or "ensure" in name_error["msg"].lower()

    def test_invalid_is_active_field_type_error_message(self, authenticated_client: TestClient):
        """Test that invalid is_active field type returns proper validation error."""
        center_data = {
            "name": "Тест ЦФО",
            "is_active": "invalid_boolean"  # Should be boolean
        }

        response = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        error_data = response.json()
        assert "detail" in error_data
        assert isinstance(error_data["detail"], list)

        # Check that error details contain information about invalid boolean
        is_active_error = None
        for detail in error_data["detail"]:
            if detail.get("loc") and "is_active" in detail["loc"]:
                is_active_error = detail
                break

        assert is_active_error is not None
        assert "bool" in is_active_error["msg"].lower() or "boolean" in is_active_error["msg"].lower()


class TestFinancialCenterDuplicateNameHandling:
    """Test duplicate name handling with correct field names."""

    def test_duplicate_name_field_conflict_error(self, authenticated_client: TestClient):
        """Test that duplicate names using correct 'name' field return 400 Bad Request."""
        center_data = {
            "name": "Дублирующийся ЦФО название",
            "is_active": True
        }

        # Create first center
        response1 = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert response1.status_code == status.HTTP_200_OK

        # Try to create duplicate
        response2 = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert response2.status_code == status.HTTP_400_BAD_REQUEST

        # Check error response format
        error_data = response2.json()
        assert "success" in error_data
        assert error_data["success"] is False
        assert "error" in error_data
        assert "уже существует" in error_data["error"]
        assert center_data["name"] in error_data["error"]

    def test_update_to_duplicate_name_field_conflict_error(self, authenticated_client: TestClient):
        """Test that updating to existing name returns proper 400 error."""
        # Create two centers
        center1_data = {"name": "Первый ЦФО", "is_active": True}
        center2_data = {"name": "Второй ЦФО", "is_active": True}

        response1 = authenticated_client.post("/api/financial_centers/", json=center1_data)
        response2 = authenticated_client.post("/api/financial_centers/", json=center2_data)

        assert response1.status_code == status.HTTP_200_OK
        assert response2.status_code == status.HTTP_200_OK

        center2_id = response2.json()["data"]["id"]

        # Try to update second center to have same name as first
        update_data = {"name": "Первый ЦФО"}
        response = authenticated_client.put(f"/api/financial_centers/{center2_id}/", json=update_data)
        assert response.status_code == status.HTTP_400_BAD_REQUEST

        # Check error response format
        error_data = response.json()
        assert "success" in error_data
        assert error_data["success"] is False
        assert "error" in error_data
        assert "уже существует" in error_data["error"]


class TestFinancialCenterResponseFormat:
    """Test unified response format consistency."""

    def test_success_response_format_consistency(self, authenticated_client: TestClient):
        """Test that all successful operations return consistent response format."""
        center_data = {
            "name": "Тест формата ответа",
            "is_active": True
        }

        # Test CREATE response format
        create_response = authenticated_client.post("/api/financial_centers/", json=center_data)
        assert create_response.status_code == status.HTTP_200_OK

        create_data = create_response.json()
        assert "success" in create_data
        assert create_data["success"] is True
        assert "data" in create_data
        assert isinstance(create_data["data"], dict)

        center_id = create_data["data"]["id"]

        # Test GET response format
        get_response = authenticated_client.get(f"/api/financial_centers/{center_id}/")
        assert get_response.status_code == status.HTTP_200_OK

        get_data = get_response.json()
        assert "success" in get_data
        assert get_data["success"] is True
        assert "data" in get_data
        assert isinstance(get_data["data"], dict)

        # Test UPDATE response format
        update_data = {"name": "Обновленный формат"}
        update_response = authenticated_client.put(f"/api/financial_centers/{center_id}/", json=update_data)
        assert update_response.status_code == status.HTTP_200_OK

        update_response_data = update_response.json()
        assert "success" in update_response_data
        assert update_response_data["success"] is True
        assert "data" in update_response_data
        assert isinstance(update_response_data["data"], dict)

        # Test DELETE response format
        delete_response = authenticated_client.delete(f"/api/financial_centers/{center_id}/")
        assert delete_response.status_code == status.HTTP_200_OK

        delete_data = delete_response.json()
        assert "success" in delete_data
        assert delete_data["success"] is True
        assert "data" in delete_data
        assert "message" in delete_data["data"]

    def test_error_response_format_consistency(self, authenticated_client: TestClient):
        """Test that all error responses return consistent format."""
        # Test 422 validation error format
        invalid_data = {"is_active": True}  # Missing required name
        validation_response = authenticated_client.post("/api/financial_centers/", json=invalid_data)
        assert validation_response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

        validation_data = validation_response.json()
        # 422 errors use FastAPI's default format with 'detail'
        assert "detail" in validation_data
        assert isinstance(validation_data["detail"], list)

        # Test 404 error format
        not_found_response = authenticated_client.get("/api/financial_centers/99999/")
        assert not_found_response.status_code == status.HTTP_404_NOT_FOUND

        not_found_data = not_found_response.json()
        assert "success" in not_found_data
        assert not_found_data["success"] is False
        assert "error" in not_found_data

        # Test 400 error format (duplicate name)
        center_data = {"name": "Дублирующийся тест", "is_active": True}
        authenticated_client.post("/api/financial_centers/", json=center_data)  # Create first

        duplicate_response = authenticated_client.post("/api/financial_centers/", json=center_data)  # Try duplicate
        assert duplicate_response.status_code == status.HTTP_400_BAD_REQUEST

        duplicate_data = duplicate_response.json()
        assert "success" in duplicate_data
        assert duplicate_data["success"] is False
        assert "error" in duplicate_data

    def test_list_response_format_consistency(self, authenticated_client: TestClient):
        """Test that list endpoint returns consistent response format."""
        # Create a few centers
        centers_data = [
            {"name": "Список ЦФО 1", "is_active": True},
            {"name": "Список ЦФО 2", "is_active": False}
        ]

        for center_data in centers_data:
            response = authenticated_client.post("/api/financial_centers/", json=center_data)
            assert response.status_code == status.HTTP_200_OK

        # Test list response format
        list_response = authenticated_client.get("/api/financial_centers/")
        assert list_response.status_code == status.HTTP_200_OK

        list_data = list_response.json()
        assert "success" in list_data
        assert list_data["success"] is True
        assert "data" in list_data
        assert isinstance(list_data["data"], list)
        assert "total" in list_data
        assert isinstance(list_data["total"], int)
        assert len(list_data["data"]) >= 2  # At least our created centers