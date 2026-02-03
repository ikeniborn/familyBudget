"""
OpenAPI Error Response Schemas.

This module defines reusable error response models for OpenAPI documentation.
These schemas document the error response format returned by exception handlers.

All error responses follow this structure:
{
    "detail": {
        "message": "Human-readable error message",
        "status_code": 400,
        "error_code": "MACHINE_READABLE_CODE",
        "details": {}  // Optional additional context
    }
}
"""

from typing import Any

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    """
    Error detail structure returned in all error responses.

    Used consistently across all exception handlers.
    """

    message: str = Field(..., description="Human-readable error message")
    status_code: int = Field(..., description="HTTP status code")
    error_code: str | None = Field(None, description="Machine-readable error code")
    details: dict[str, Any] | None = Field(None, description="Additional error context")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "message": "Resource not found",
                    "status_code": 404,
                    "error_code": "NOT_FOUND",
                    "details": {"resource_id": 123}
                }
            ]
        }
    }


class ErrorResponse(BaseModel):
    """
    Standard error response wrapper.

    All error responses from the API wrap ErrorDetail in a 'detail' field.
    """

    detail: ErrorDetail = Field(..., description="Error details")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "detail": {
                        "message": "Article not found",
                        "status_code": 404,
                        "error_code": "NOT_FOUND"
                    }
                }
            ]
        }
    }


class ValidationErrorDetail(BaseModel):
    """
    Single field validation error.

    Returned as part of validation error responses.
    """

    field: str = Field(..., description="Field name that failed validation")
    message: str = Field(..., description="Validation error message")
    type: str = Field(..., description="Validation error type")
    location: list[str] = Field(..., description="Location path to the field")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "field": "amount",
                    "message": "Amount must be greater than zero",
                    "type": "value_error",
                    "location": ["body", "amount"]
                }
            ]
        }
    }


class ValidationErrorResponse(BaseModel):
    """
    Validation error response (422 Unprocessable Entity).

    Returned when request data fails Pydantic validation.
    Contains array of field-level errors.
    """

    detail: dict[str, Any] = Field(..., description="Validation error details")

    model_config = {
        "json_schema_extra": {
            "examples": [
                {
                    "detail": {
                        "message": "Validation error",
                        "errors": [
                            {
                                "field": "amount",
                                "message": "Amount must be greater than zero",
                                "type": "value_error",
                                "location": ["body", "amount"]
                            },
                            {
                                "field": "fact_date",
                                "message": "Fact date cannot be in the future",
                                "type": "value_error",
                                "location": ["body", "fact_date"]
                            }
                        ]
                    }
                }
            ]
        }
    }


# Commonly used error response definitions for OpenAPI
# Can be used in @router.get(..., responses={404: {"model": ErrorResponse}})

BadRequestResponse = {
    "model": ErrorResponse,
    "description": "Bad Request - Invalid request parameters or data",
}

UnauthorizedResponse = {
    "model": ErrorResponse,
    "description": "Unauthorized - Authentication required or failed",
}

ForbiddenResponse = {
    "model": ErrorResponse,
    "description": "Forbidden - Insufficient permissions for this operation",
}

NotFoundResponse = {
    "model": ErrorResponse,
    "description": "Not Found - Requested resource does not exist",
}

ConflictResponse = {
    "model": ErrorResponse,
    "description": "Conflict - Resource state conflict (e.g., duplicate entry)",
}

UnprocessableEntityResponse = {
    "model": ValidationErrorResponse,
    "description": "Unprocessable Entity - Request validation failed",
}

InternalServerErrorResponse = {
    "model": ErrorResponse,
    "description": "Internal Server Error - Unexpected server error occurred",
}

ServiceUnavailableResponse = {
    "model": ErrorResponse,
    "description": "Service Unavailable - Database or external service unavailable",
}


def get_common_responses(
    include_400: bool = False,
    include_401: bool = True,
    include_403: bool = False,
    include_404: bool = False,
    include_409: bool = False,
    include_422: bool = True,
    include_500: bool = True,
    include_503: bool = False,
) -> dict[int | str, dict[str, Any]]:
    """
    Get common error responses for endpoint documentation.

    Helper function to easily add standard error responses to endpoints.

    Args:
        include_400: Include 400 Bad Request
        include_401: Include 401 Unauthorized (default: True)
        include_403: Include 403 Forbidden
        include_404: Include 404 Not Found
        include_409: Include 409 Conflict
        include_422: Include 422 Unprocessable Entity (default: True)
        include_500: Include 500 Internal Server Error (default: True)
        include_503: Include 503 Service Unavailable

    Returns:
        Dictionary of status codes to response definitions

    Example:
        @router.get("/articles/{id}", responses=get_common_responses(
            include_403=True,
            include_404=True,
        ))
        async def get_article(id: int): ...
    """
    responses: dict[int | str, dict[str, Any]] = {}

    if include_400:
        responses[400] = BadRequestResponse
    if include_401:
        responses[401] = UnauthorizedResponse
    if include_403:
        responses[403] = ForbiddenResponse
    if include_404:
        responses[404] = NotFoundResponse
    if include_409:
        responses[409] = ConflictResponse
    if include_422:
        responses[422] = UnprocessableEntityResponse
    if include_500:
        responses[500] = InternalServerErrorResponse
    if include_503:
        responses[503] = ServiceUnavailableResponse

    return responses
