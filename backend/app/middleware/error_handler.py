"""
Global Error Handler Middleware.

This module provides centralized error handling for all exceptions in the application.
It converts exceptions into structured JSON responses with appropriate HTTP status codes.

Features:
    - Handles custom APIException classes
    - Handles FastAPI HTTPException
    - Handles database exceptions (SQLAlchemy)
    - Handles generic Python exceptions
    - Structured error response format
    - Structured logging with correlation IDs
"""

from typing import Any

from fastapi import Request, status
from fastapi.exceptions import HTTPException
from sqlalchemy.exc import SQLAlchemyError

from backend.app.core.exceptions import APIException
from backend.app.core.json_utils import ORJSONResponse
from backend.app.core.logging import StructuredLogger
from backend.app.middleware.logging_middleware import get_correlation_id

logger = StructuredLogger(__name__)


async def api_exception_handler(
    request: Request,
    exc: APIException,
) -> ORJSONResponse:
    """
    Handle custom APIException instances.

    Converts APIException to structured JSON response.

    Args:
        request: FastAPI Request object
        exc: Custom APIException instance

    Returns:
        ORJSONResponse with error details

    Example:
        raise NotFoundException("Article not found")
        # Response: 404
        # {
        #   "detail": {
        #     "message": "Article not found",
        #     "status_code": 404,
        #     "error_code": "NOT_FOUND"
        #   }
        # }
    """
    # Log error with structured logging
    logger.warning(
        "API exception raised",
        correlation_id=get_correlation_id(request),
        request_method=request.method,
        request_path=request.url.path,
        exception_type=type(exc).__name__,
        status_code=exc.status_code,
        error_code=exc.error_code,
        error_message=exc.message,
        details=exc.details,
    )

    return ORJSONResponse(
        status_code=exc.status_code,
        content={
            "detail": exc.to_dict()
        },
    )


async def http_exception_handler(
    request: Request,
    exc: HTTPException,
) -> ORJSONResponse:
    """
    Handle FastAPI HTTPException instances.

    Converts HTTPException to structured JSON response.

    Args:
        request: FastAPI Request object
        exc: FastAPI HTTPException instance

    Returns:
        ORJSONResponse with error details

    Example:
        raise HTTPException(404, "Not found")
        # Response: 404
        # {
        #   "detail": {
        #     "message": "Not found",
        #     "status_code": 404
        #   }
        # }
    """
    # Log error with structured logging
    logger.warning(
        "HTTP exception raised",
        correlation_id=get_correlation_id(request),
        request_method=request.method,
        request_path=request.url.path,
        status_code=exc.status_code,
        error_message=exc.detail,
    )

    return ORJSONResponse(
        status_code=exc.status_code,
        content={
            "detail": {
                "message": exc.detail,
                "status_code": exc.status_code,
            }
        },
    )


async def database_exception_handler(
    request: Request,
    exc: SQLAlchemyError,
) -> ORJSONResponse:
    """
    Handle SQLAlchemy database exceptions.

    Converts database errors into user-friendly responses.

    Args:
        request: FastAPI Request object
        exc: SQLAlchemy exception

    Returns:
        ORJSONResponse with error details

    Security:
        Does not expose internal database errors to client.
        Logs full error details for debugging.

    Example:
        # IntegrityError: Duplicate key
        # Response: 409
        # {
        #   "detail": {
        #     "message": "Database constraint violation",
        #     "status_code": 409,
        #     "error_code": "DB_CONSTRAINT_VIOLATION"
        #   }
        # }
    """
    # Log the full error with structured logging
    logger.error(
        "Database exception raised",
        correlation_id=get_correlation_id(request),
        request_method=request.method,
        request_path=request.url.path,
        error_type=type(exc).__name__,
        error_message=str(exc),
    )

    # Determine error type and response
    error_type = type(exc).__name__

    if "IntegrityError" in error_type:
        # Unique constraint, foreign key constraint, etc.
        return ORJSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={
                "detail": {
                    "message": "Database constraint violation",
                    "status_code": 409,
                    "error_code": "DB_CONSTRAINT_VIOLATION",
                }
            },
        )

    elif "OperationalError" in error_type:
        # Connection issues, timeout, etc.
        return ORJSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": {
                    "message": "Database connection error",
                    "status_code": 503,
                    "error_code": "DB_CONNECTION_ERROR",
                }
            },
        )

    else:
        # Generic database error
        return ORJSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "detail": {
                    "message": "Database error occurred",
                    "status_code": 500,
                    "error_code": "DATABASE_ERROR",
                }
            },
        )


async def generic_exception_handler(
    request: Request,
    exc: Exception,
) -> ORJSONResponse:
    """
    Handle generic Python exceptions.

    Catches any unhandled exceptions and converts them to structured responses.

    Args:
        request: FastAPI Request object
        exc: Any Python exception

    Returns:
        ORJSONResponse with error details

    Security:
        Does not expose internal error details to client.
        Logs full traceback for debugging.

    Example:
        # Any unhandled exception
        # Response: 500
        # {
        #   "detail": {
        #     "message": "An unexpected error occurred",
        #     "status_code": 500,
        #     "error_code": "INTERNAL_ERROR"
        #   }
        # }
    """
    # Log the full error with traceback using structured logging
    logger.exception(
        "Unhandled exception",
        correlation_id=get_correlation_id(request),
        request_method=request.method,
        request_path=request.url.path,
        error_type=type(exc).__name__,
        error_message=str(exc),
    )

    # Return generic error response (don't expose internal details)
    return ORJSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": {
                "message": "An unexpected error occurred",
                "status_code": 500,
                "error_code": "INTERNAL_ERROR",
            }
        },
    )


def format_error_response(
    message: str,
    status_code: int,
    error_code: str | None = None,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Format error response in standardized structure.

    Helper function to ensure consistent error response format.

    Args:
        message: Human-readable error message
        status_code: HTTP status code
        error_code: Machine-readable error code (optional)
        details: Additional error details (optional)

    Returns:
        Formatted error response dictionary

    Example:
        >>> format_error_response(
        ...     message="Article not found",
        ...     status_code=404,
        ...     error_code="NOT_FOUND",
        ...     details={"article_id": 123}
        ... )
        {
            "detail": {
                "message": "Article not found",
                "status_code": 404,
                "error_code": "NOT_FOUND",
                "details": {"article_id": 123}
            }
        }
    """
    response: dict[str, Any] = {
        "detail": {
            "message": message,
            "status_code": status_code,
        }
    }

    if error_code:
        response["detail"]["error_code"] = error_code

    if details:
        response["detail"]["details"] = details

    return response
