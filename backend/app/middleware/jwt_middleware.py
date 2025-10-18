"""
JWT Authentication Middleware.

This middleware extracts and validates JWT tokens from requests,
injects user_id into request state, and protects endpoints that require authentication.

Security Features:
    - Extracts JWT from Cookie (access_token) or Authorization header (Bearer token)
    - Validates token signature and expiration
    - Injects user_id into request.state for downstream use
    - Whitelists public endpoints (/health, /api/v1/auth/*)
    - Returns 401 Unauthorized for invalid/missing tokens on protected endpoints
"""

from typing import Callable

from fastapi import Request, Response, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.app.services.jwt import decode_access_token


class JWTAuthMiddleware(BaseHTTPMiddleware):
    """
    Middleware for JWT-based authentication.

    Extracts JWT token from Cookie or Authorization header,
    validates it, and injects user_id into request state.

    Public endpoints (whitelisted):
        - /health
        - /docs
        - /openapi.json
        - /api/v1/auth/*

    Protected endpoints:
        - All other endpoints require valid JWT token
    """

    # Public endpoints that don't require authentication
    PUBLIC_PATHS = {
        "/health",
        "/docs",
        "/openapi.json",
        "/redoc",
        "/",  # Home page (uses CurrentUserOptional)
        "/analytics",  # Analytics page (uses CurrentUserOptional)
        "/favicon.ico",  # Browser favicon
    }

    # Public path prefixes (startswith check)
    PUBLIC_PREFIXES = [
        "/api/v1/auth/",
        "/static/",  # Static files (CSS, JS, images)
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each request through JWT authentication.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/endpoint in chain

        Returns:
            Response: HTTP response from endpoint or 401 error
        """
        # Check if endpoint is public (no authentication required)
        if self._is_public_endpoint(request.url.path):
            # Skip authentication for public endpoints
            return await call_next(request)

        # Extract JWT token from request
        token = self._extract_token(request)

        if token is None:
            # No token provided for protected endpoint
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Authentication required - No token provided"
                }
            )

        # Validate token and extract user_id
        user_id = decode_access_token(token)

        if user_id is None:
            # Token is invalid, expired, or malformed
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Authentication failed - Invalid or expired token"
                }
            )

        # Inject user_id into request state for downstream use
        request.state.user_id = user_id

        # Continue to next middleware/endpoint
        return await call_next(request)

    def _is_public_endpoint(self, path: str) -> bool:
        """
        Check if endpoint is public (doesn't require authentication).

        Args:
            path: Request URL path

        Returns:
            bool: True if endpoint is public, False if protected
        """
        # Check exact matches
        if path in self.PUBLIC_PATHS:
            return True

        # Check prefix matches
        for prefix in self.PUBLIC_PREFIXES:
            if path.startswith(prefix):
                return True

        return False

    def _extract_token(self, request: Request) -> str | None:
        """
        Extract JWT token from Cookie or Authorization header.

        Priority:
            1. Cookie: access_token
            2. Authorization header: Bearer <token>

        Args:
            request: HTTP request

        Returns:
            str | None: JWT token if found, None otherwise
        """
        # Try to extract from Cookie first (primary method)
        token = request.cookies.get("access_token")
        if token:
            return token

        # Fallback to Authorization header (for API clients)
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            # Extract token after "Bearer " prefix
            return auth_header[7:]  # len("Bearer ") = 7

        # No token found
        return None
