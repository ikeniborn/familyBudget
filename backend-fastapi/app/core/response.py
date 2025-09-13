"""
Unified API response utilities for consistent response format.

This module provides utilities for creating standardized API responses:
- Success responses: {"success": true, "data": ...}
- Error responses: {"success": false, "error": "..."}
"""
from typing import Any, Dict, List, Optional, Union
from fastapi import HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel


class ApiResponse(BaseModel):
    """Base API response model."""
    success: bool
    data: Optional[Any] = None
    error: Optional[str] = None


class ListResponse(BaseModel):
    """List API response model with total count."""
    success: bool
    data: List[Any]
    total: Optional[int] = None
    error: Optional[str] = None


def success_response(
    data: Any = None,
    total: Optional[int] = None,
    status_code: int = 200
) -> JSONResponse:
    """
    Create a success response with unified format.

    Args:
        data: Response data (can be dict, list, or any serializable object)
        total: Total count for list responses (optional)
        status_code: HTTP status code (default: 200)

    Returns:
        JSONResponse with format: {"success": true, "data": data, "total": total}
    """
    response_content = {
        "success": True,
        "data": data
    }

    # Add total count for list responses
    if total is not None:
        response_content["total"] = total

    return JSONResponse(
        content=response_content,
        status_code=status_code
    )


def error_response(
    error_message: str,
    status_code: int = 400,
    detail: Optional[str] = None
) -> JSONResponse:
    """
    Create an error response with unified format.

    Args:
        error_message: Main error message
        status_code: HTTP status code (default: 400)
        detail: Additional error detail (optional, for backward compatibility)

    Returns:
        JSONResponse with format: {"success": false, "error": "message"}
    """
    # Use detail if provided (for backward compatibility), otherwise use error_message
    final_message = detail if detail is not None else error_message

    response_content = {
        "success": False,
        "error": final_message
    }

    return JSONResponse(
        content=response_content,
        status_code=status_code
    )


def validation_error_response(
    errors: List[Dict[str, Any]],
    status_code: int = 422
) -> JSONResponse:
    """
    Create a validation error response.

    Args:
        errors: List of validation errors
        status_code: HTTP status code (default: 422)

    Returns:
        JSONResponse with validation errors
    """
    return JSONResponse(
        content={
            "success": False,
            "error": "Validation error",
            "details": errors
        },
        status_code=status_code
    )


class APIException(HTTPException):
    """
    Custom exception that returns unified error format.

    Usage:
        raise APIException(
            status_code=404,
            error_message="Resource not found"
        )
    """

    def __init__(
        self,
        status_code: int,
        error_message: str,
        headers: Optional[Dict[str, Any]] = None
    ):
        self.error_message = error_message
        super().__init__(
            status_code=status_code,
            detail=error_message,
            headers=headers
        )


# Common HTTP status code helpers
def success_ok(data: Any = None, total: Optional[int] = None) -> JSONResponse:
    """200 OK success response."""
    return success_response(data=data, total=total, status_code=200)


def success_created(data: Any = None) -> JSONResponse:
    """201 Created success response."""
    return success_response(data=data, status_code=201)


def success_no_content() -> JSONResponse:
    """204 No Content success response."""
    return success_response(status_code=204)


def error_bad_request(message: str) -> JSONResponse:
    """400 Bad Request error response."""
    return error_response(message, status_code=400)


def error_unauthorized(message: str = "Unauthorized") -> JSONResponse:
    """401 Unauthorized error response."""
    return error_response(message, status_code=401)


def error_forbidden(message: str = "Forbidden") -> JSONResponse:
    """403 Forbidden error response."""
    return error_response(message, status_code=403)


def error_not_found(message: str = "Not found") -> JSONResponse:
    """404 Not Found error response."""
    return error_response(message, status_code=404)


def error_conflict(message: str = "Conflict") -> JSONResponse:
    """409 Conflict error response."""
    return error_response(message, status_code=409)


def error_unprocessable_entity(message: str = "Unprocessable Entity") -> JSONResponse:
    """422 Unprocessable Entity error response."""
    return error_response(message, status_code=422)


def error_internal_server(message: str = "Internal server error") -> JSONResponse:
    """500 Internal Server Error response."""
    return error_response(message, status_code=500)