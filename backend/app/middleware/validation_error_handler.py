"""
Validation Error Handler Middleware.

This module provides a global exception handler for Pydantic validation errors,
converting them into user-friendly JSON responses with detailed field-level error messages.

Features:
    - Converts Pydantic ValidationError to structured JSON
    - Provides field-level error messages
    - Returns 422 Unprocessable Entity status
    - Includes error type and location information
"""


from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from backend.app.core.json_utils import ORJSONResponse


async def validation_exception_handler(
    request: Request,
    exc: RequestValidationError | ValidationError,
) -> ORJSONResponse:
    """
    Handle Pydantic validation errors and return structured JSON response.

    Converts Pydantic validation errors into a user-friendly format:
    - Field-level error messages
    - Error type and location
    - HTTP 422 status code

    Args:
        request: FastAPI Request object
        exc: Pydantic ValidationError or FastAPI RequestValidationError

    Returns:
        ORJSONResponse with validation error details

    Response Format:
        {
            "detail": {
                "message": "Validation error",
                "errors": [
                    {
                        "field": "name",
                        "message": "Article name cannot be empty",
                        "type": "value_error",
                        "location": ["body", "name"]
                    }
                ]
            }
        }

    Example:
        >>> # Request: POST /articles {"name": ""}
        >>> # Response: 422 Unprocessable Entity
        >>> {
        ...     "detail": {
        ...         "message": "Validation error",
        ...         "errors": [{
        ...             "field": "name",
        ...             "message": "Article name cannot be empty",
        ...             "type": "value_error",
        ...             "location": ["body", "name"]
        ...         }]
        ...     }
        ... }
    """
    errors = []

    # Extract errors from Pydantic ValidationError
    for error in exc.errors():
        # Get field location (e.g., ["body", "name"] or ["query", "limit"])
        location = error.get("loc", [])

        # Extract field name (last element of location)
        field = location[-1] if location else "unknown"

        # Get error message
        message = error.get("msg", "Validation error")

        # Get error type (e.g., "value_error", "type_error")
        error_type = error.get("type", "validation_error")

        # Build structured error
        errors.append({
            "field": field,
            "message": message,
            "type": error_type,
            "location": list(location),
        })

    # Return structured JSON response
    return ORJSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "detail": {
                "message": "Validation error",
                "errors": errors,
            }
        },
    )


async def value_error_handler(
    request: Request,
    exc: ValueError,
) -> ORJSONResponse:
    """
    Handle generic ValueError exceptions.

    Converts ValueError to a user-friendly JSON response.

    Args:
        request: FastAPI Request object
        exc: ValueError exception

    Returns:
        ORJSONResponse with error details

    Example:
        >>> # ValueError("Invalid date format")
        >>> {
        ...     "detail": {
        ...         "message": "Invalid date format",
        ...         "type": "value_error"
        ...     }
        ... }
    """
    return ORJSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "detail": {
                "message": str(exc),
                "type": "value_error",
            }
        },
    )
