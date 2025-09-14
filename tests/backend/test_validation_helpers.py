"""
Common validation helpers for unified API response format testing.
These functions can be imported by all API test files.
"""


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


def validate_created_response(response_data: dict, expected_data_checks: dict = None):
    """Helper function to validate 201 Created response format."""
    data = validate_success_response(response_data, expected_data_checks)
    assert "id" in data
    return data


def validate_updated_response(response_data: dict, expected_data_checks: dict = None):
    """Helper function to validate updated entity response format."""
    return validate_success_response(response_data, expected_data_checks)


def validate_deleted_response(response_data: dict):
    """Helper function to validate deletion response format."""
    data = validate_success_response(response_data)
    assert "message" in data
    assert "deleted successfully" in data["message"]
    return data


def validate_not_found_error(response_data: dict):
    """Helper function to validate 404 Not Found error response."""
    error_message = validate_error_response(response_data)
    assert "not found" in error_message.lower()
    return error_message


def validate_conflict_error(response_data: dict, entity_type: str = None):
    """Helper function to validate 409 Conflict error response."""
    error_message = validate_error_response(response_data)
    assert "уже существует" in error_message or "already exists" in error_message.lower()
    if entity_type:
        assert entity_type.lower() in error_message.lower()
    return error_message


def validate_validation_error(response_data: dict):
    """Helper function to validate 422 Validation error response."""
    error_message = validate_error_response(response_data)
    assert "validation" in error_message.lower() or "required" in error_message.lower()
    return error_message