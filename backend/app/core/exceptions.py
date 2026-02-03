"""
Custom Exception Classes.

This module defines custom exception classes for the Family Budget API,
providing structured error handling with appropriate HTTP status codes.

Exception Hierarchy:
    APIException (Base)
    ├── BadRequestException (400)
    ├── UnauthorizedException (401)
    ├── ForbiddenException (403)
    ├── NotFoundException (404)
    ├── ConflictException (409)
    └── InternalServerException (500)

Usage:
    raise NotFoundException(
        message="Article not found",
        details={"article_id": 123}
    )
"""

from typing import Any, Optional


class APIException(Exception):
    """
    Base exception class for all API exceptions.

    All custom exceptions inherit from this class.

    Attributes:
        status_code: HTTP status code
        message: Human-readable error message
        details: Additional error details (optional)
        error_code: Machine-readable error code (optional)
    """

    status_code: int = 500
    message: str = "Internal server error"
    error_code: Optional[str] = None

    def __init__(
        self,
        message: Optional[str] = None,
        details: Optional[dict[str, Any]] = None,
        error_code: Optional[str] = None,
    ):
        """
        Initialize API exception.

        Args:
            message: Override default error message
            details: Additional error details
            error_code: Machine-readable error code
        """
        self.message = message or self.message
        self.details = details or {}
        self.error_code = error_code or self.error_code
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """
        Convert exception to dictionary for JSON response.

        Returns:
            Dictionary with error details
        """
        result: dict[str, Any] = {
            "message": self.message,
            "status_code": self.status_code,
        }

        if self.error_code:
            result["error_code"] = self.error_code

        if self.details:
            result["details"] = self.details

        return result


class BadRequestException(APIException):
    """
    400 Bad Request.

    Raised when the request is malformed or contains invalid parameters.

    Example:
        raise BadRequestException(
            message="Invalid query parameter",
            details={"param": "limit", "value": -1}
        )
    """

    status_code = 400
    message = "Bad request"
    error_code = "BAD_REQUEST"


class UnauthorizedException(APIException):
    """
    401 Unauthorized.

    Raised when authentication is required but not provided or invalid.

    Example:
        raise UnauthorizedException(
            message="Authentication required",
            error_code="AUTH_REQUIRED"
        )
    """

    status_code = 401
    message = "Unauthorized"
    error_code = "UNAUTHORIZED"


class ForbiddenException(APIException):
    """
    403 Forbidden.

    Raised when user is authenticated but doesn't have permission.

    Example:
        raise ForbiddenException(
            message="Admin access required",
            error_code="ADMIN_REQUIRED"
        )
    """

    status_code = 403
    message = "Forbidden"
    error_code = "FORBIDDEN"


class NotFoundException(APIException):
    """
    404 Not Found.

    Raised when requested resource doesn't exist.

    Example:
        raise NotFoundException(
            message="Article not found",
            details={"article_id": 123}
        )
    """

    status_code = 404
    message = "Resource not found"
    error_code = "NOT_FOUND"


class ConflictException(APIException):
    """
    409 Conflict.

    Raised when request conflicts with current state of the server.

    Example:
        raise ConflictException(
            message="Article with this code already exists",
            details={"code": "FOOD"}
        )
    """

    status_code = 409
    message = "Conflict"
    error_code = "CONFLICT"


class UnprocessableEntityException(APIException):
    """
    422 Unprocessable Entity.

    Raised when request is well-formed but contains semantic errors.

    Example:
        raise UnprocessableEntityException(
            message="Cannot create cycle in hierarchy",
            details={"parent_id": 5, "article_id": 1}
        )
    """

    status_code = 422
    message = "Unprocessable entity"
    error_code = "UNPROCESSABLE_ENTITY"


class InternalServerException(APIException):
    """
    500 Internal Server Error.

    Raised when an unexpected error occurs.

    Example:
        raise InternalServerException(
            message="Failed to process request",
            details={"error": str(e)}
        )
    """

    status_code = 500
    message = "Internal server error"
    error_code = "INTERNAL_SERVER_ERROR"


class DatabaseException(InternalServerException):
    """
    Database-related error.

    Raised when database operation fails.

    Example:
        raise DatabaseException(
            message="Failed to connect to database",
            error_code="DB_CONNECTION_ERROR"
        )
    """

    error_code = "DATABASE_ERROR"
    message = "Database error"


class ServiceUnavailableException(APIException):
    """
    503 Service Unavailable.

    Raised when service is temporarily unavailable.

    Example:
        raise ServiceUnavailableException(
            message="Database connection pool exhausted",
            error_code="SERVICE_UNAVAILABLE"
        )
    """

    status_code = 503
    message = "Service unavailable"
    error_code = "SERVICE_UNAVAILABLE"
