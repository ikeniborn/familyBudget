"""
Logging Middleware for Request/Response Logging.

This module provides middleware for structured logging of HTTP requests and responses,
with automatic correlation ID injection for request tracing.

Features:
    - Correlation ID generation and injection
    - Request logging (method, path, IP, user agent)
    - Response logging (status code, duration)
    - Error logging with stack traces
    - Structured JSON format
"""

import time
import uuid
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from backend.app.core.logging import StructuredLogger

logger = StructuredLogger(__name__)


class LoggingMiddleware(BaseHTTPMiddleware):
    """
    Middleware for structured request/response logging.

    Logs all HTTP requests and responses with:
    - Correlation ID for request tracing
    - Request details (method, path, IP, headers)
    - Response details (status code, duration)
    - Error details if exception occurs

    Correlation ID is:
    - Generated if not provided in X-Correlation-ID header
    - Injected into response headers
    - Available in all logs for the request

    Example Log Output:
        {
            "timestamp": "2025-10-13T12:00:00",
            "level": "INFO",
            "message": "HTTP request",
            "correlation_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
            "request_method": "GET",
            "request_path": "/api/v1/articles",
            "request_ip": "127.0.0.1",
            "user_agent": "Mozilla/5.0..."
        }
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable,
    ) -> Response:
        """
        Process request and log details.

        Args:
            request: FastAPI Request object
            call_next: Next middleware/endpoint to call

        Returns:
            Response object with correlation ID header
        """
        # Generate or extract correlation ID
        correlation_id = request.headers.get("X-Correlation-ID") or str(uuid.uuid4())

        # Store correlation ID in request state
        request.state.correlation_id = correlation_id

        # Extract request details
        request_method = request.method
        request_path = request.url.path
        request_ip = request.client.host if request.client else "unknown"
        user_agent = request.headers.get("user-agent", "unknown")

        # Log request
        logger.info(
            "HTTP request",
            correlation_id=correlation_id,
            request_method=request_method,
            request_path=request_path,
            request_ip=request_ip,
            user_agent=user_agent,
        )

        # Process request and measure duration
        start_time = time.time()

        try:
            response = await call_next(request)
            duration = time.time() - start_time

            # Log response
            logger.info(
                "HTTP response",
                correlation_id=correlation_id,
                request_method=request_method,
                request_path=request_path,
                status_code=response.status_code,
                duration_ms=round(duration * 1000, 2),
            )

            # Inject correlation ID into response headers
            response.headers["X-Correlation-ID"] = correlation_id

            return response

        except Exception as exc:
            duration = time.time() - start_time

            # Log error
            logger.error(
                "HTTP request failed",
                correlation_id=correlation_id,
                request_method=request_method,
                request_path=request_path,
                error_type=type(exc).__name__,
                error_message=str(exc),
                duration_ms=round(duration * 1000, 2),
            )

            # Re-raise exception to be handled by error handlers
            raise


def get_correlation_id(request: Request) -> str:
    """
    Get correlation ID from request state.

    Useful for manually logging correlation ID in endpoints.

    Args:
        request: FastAPI Request object

    Returns:
        Correlation ID string

    Example:
        >>> from fastapi import Request
        >>> @router.get("/articles")
        >>> async def list_articles(request: Request):
        ...     correlation_id = get_correlation_id(request)
        ...     logger.info("Listing articles", correlation_id=correlation_id)
    """
    return getattr(request.state, "correlation_id", "unknown")


def inject_correlation_id_to_logger(request: Request, logger_record: any) -> None:
    """
    Inject correlation ID into logger record.

    Helper function to add correlation ID to log records.

    Args:
        request: FastAPI Request object
        logger_record: Logger record to inject correlation_id into
    """
    correlation_id = get_correlation_id(request)
    logger_record.correlation_id = correlation_id
