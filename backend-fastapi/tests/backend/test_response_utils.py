"""Tests for unified API response utilities."""

import pytest
from fastapi.responses import JSONResponse
from pydantic import BaseModel

from app.core.response import (
    success_response,
    success_ok,
    success_created,
    success_no_content,
    error_response,
    error_bad_request,
    error_unauthorized,
    error_forbidden,
    error_not_found,
    error_conflict,
    error_unprocessable_entity,
    error_internal_server,
    ApiResponse,
    ListResponse
)


class TestSuccessResponses:
    """Test successful response functions."""

    def test_success_response_with_data(self):
        """Test success response with data."""
        data = {"id": 1, "name": "Test"}
        response = success_response(data)

        assert isinstance(response, JSONResponse)
        assert response.status_code == 200
        # Parse the body to check content
        import json
        body = json.loads(response.body)
        assert body["success"] is True
        assert body["data"] == data
        assert "error" not in body

    def test_success_response_with_message(self):
        """Test success response with message."""
        data = {"id": 1}
        message = "Operation successful"
        response = success_response(data, message=message)

        import json
        body = json.loads(response.body)
        assert body["success"] is True
        assert body["data"] == data
        assert body["message"] == message

    def test_success_response_with_list_and_total(self):
        """Test success response with list data and total."""
        data = [{"id": 1}, {"id": 2}]
        response = success_response(data, total=10)

        import json
        body = json.loads(response.body)
        assert body["success"] is True
        assert body["data"] == data
        assert body["total"] == 10

    def test_success_response_empty_data(self):
        """Test success response with empty data."""
        response = success_response([])

        import json
        body = json.loads(response.body)
        assert body["success"] is True
        assert body["data"] == []

    def test_created_response(self):
        """Test created response (201)."""
        data = {"id": 1, "name": "New Item"}
        response = success_created(data)

        assert response.status_code == 201
        import json
        body = json.loads(response.body)
        assert body["success"] is True
        assert body["data"] == data

    def test_no_content_response(self):
        """Test no content response (204)."""
        response = success_no_content()

        assert response.status_code == 204
        # 204 should have empty body
        assert response.body == b''


class TestErrorResponses:
    """Test error response functions."""

    def test_error_response_basic(self):
        """Test basic error response."""
        error_msg = "Something went wrong"
        response = error_response(error_msg)

        assert isinstance(response, JSONResponse)
        assert response.status_code == 400
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == error_msg
        assert "data" not in body

    def test_error_response_with_status_code(self):
        """Test error response with custom status code."""
        error_msg = "Not found"
        response = error_response(error_msg, status_code=404)

        assert response.status_code == 404
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == error_msg

    def test_bad_request_response(self):
        """Test bad request response (400)."""
        error_msg = "Invalid input"
        response = error_bad_request(error_msg)

        assert response.status_code == 400
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == error_msg

    def test_unauthorized_response(self):
        """Test unauthorized response (401)."""
        response = error_unauthorized()

        assert response.status_code == 401
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == "Unauthorized"

    def test_unauthorized_response_custom_message(self):
        """Test unauthorized response with custom message."""
        error_msg = "Invalid token"
        response = error_unauthorized(error_msg)

        assert response.status_code == 401
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == error_msg

    def test_forbidden_response(self):
        """Test forbidden response (403)."""
        response = error_forbidden()

        assert response.status_code == 403
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == "Forbidden"

    def test_not_found_response(self):
        """Test not found response (404)."""
        error_msg = "Resource not found"
        response = error_not_found(error_msg)

        assert response.status_code == 404
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == error_msg

    def test_conflict_response(self):
        """Test conflict response (409)."""
        error_msg = "Resource already exists"
        response = error_conflict(error_msg)

        assert response.status_code == 409
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == error_msg

    def test_unprocessable_entity_response(self):
        """Test unprocessable entity response (422)."""
        error_msg = "Validation failed"
        response = error_unprocessable_entity(error_msg)

        assert response.status_code == 422
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == error_msg

    def test_internal_server_error_response(self):
        """Test internal server error response (500)."""
        response = error_internal_server()

        assert response.status_code == 500
        import json
        body = json.loads(response.body)
        assert body["success"] is False
        assert body["error"] == "Internal server error"


class TestPydanticModels:
    """Test Pydantic response models."""

    def test_api_response_model(self):
        """Test ApiResponse model."""
        response = ApiResponse(success=True, data={"test": "data"})

        assert response.success is True
        assert response.data == {"test": "data"}
        assert response.error is None
        assert response.message is None

    def test_api_response_with_error(self):
        """Test ApiResponse model with error."""
        response = ApiResponse(success=False, error="Test error")

        assert response.success is False
        assert response.error == "Test error"
        assert response.data is None

    def test_list_response_model(self):
        """Test ListResponse model."""
        items = [{"id": 1}, {"id": 2}]
        response = ListResponse(success=True, data=items, total=10)

        assert response.success is True
        assert response.data == items
        assert response.total == 10

    def test_api_response_model_with_message(self):
        """Test ApiResponse model with message."""
        response = ApiResponse(success=True, data={"test": "data"}, message="Success")

        assert response.success is True
        assert response.data == {"test": "data"}
        assert response.message == "Success"


class TestResponseConsistency:
    """Test response format consistency."""

    def test_all_success_responses_have_success_true(self):
        """Test all success responses have success=true."""
        responses = [
            success_response({"test": "data"}),
            success_created({"id": 1}),
        ]

        for response in responses:
            if response.status_code != 204:  # Skip no_content
                import json
                body = json.loads(response.body)
                assert body["success"] is True

    def test_all_error_responses_have_success_false(self):
        """Test all error responses have success=false."""
        responses = [
            error_response("Error"),
            error_bad_request("Bad request"),
            error_unauthorized(),
            error_forbidden(),
            error_not_found("Not found"),
            error_conflict("Conflict"),
            error_unprocessable_entity("Invalid"),
            error_internal_server(),
        ]

        for response in responses:
            import json
            body = json.loads(response.body)
            assert body["success"] is False
            assert "error" in body

    def test_response_serialization_with_complex_data(self):
        """Test response serialization with complex data types."""
        from datetime import datetime, date
        from decimal import Decimal

        data = {
            "id": 1,
            "name": "Test",
            "created_at": datetime(2024, 1, 1, 12, 0, 0),
            "date": date(2024, 1, 1),
            "amount": Decimal("100.50"),
            "nested": {
                "key": "value"
            },
            "list": [1, 2, 3]
        }

        response = success_response(data)
        import json
        body = json.loads(response.body)

        assert body["success"] is True
        assert body["data"]["id"] == 1
        assert body["data"]["name"] == "Test"
        # Datetime should be serialized to ISO format
        assert "2024-01-01" in body["data"]["created_at"]
        assert body["data"]["nested"]["key"] == "value"
        assert body["data"]["list"] == [1, 2, 3]

    def test_response_with_unicode_characters(self):
        """Test response with Unicode characters."""
        data = {
            "name": "Тест",
            "description": "测试",
            "emoji": "🎉"
        }

        response = success_response(data)
        import json
        body = json.loads(response.body)

        assert body["data"]["name"] == "Тест"
        assert body["data"]["description"] == "测试"
        assert body["data"]["emoji"] == "🎉"