"""
JWT Authentication Middleware.

This middleware extracts and validates JWT tokens from requests,
injects user_id into request state, and protects endpoints that require authentication.

Security Features:
    - Extracts JWT from Cookie (access_token) or Authorization header (Bearer token)
    - Validates token signature and expiration
    - Injects user_id into request.state for downstream use
    - Whitelists public endpoints (/health, /api/v1/auth/*)
    - Smart 401 handling based on request type:
      - Browser (Accept: text/html) → HTTP 303 redirect to login
      - HTMX (HX-Request: true) → 401 + HX-Redirect header
      - API (Accept: application/json) → JSON 401 response
"""
from typing import Optional

from collections.abc import Callable

from fastapi import Request, Response, status
from fastapi.responses import RedirectResponse
from starlette.middleware.base import BaseHTTPMiddleware

from backend.app.core.json_utils import ORJSONResponse
from backend.app.services.jwt import decode_access_token_full

# Login page URL for redirects
LOGIN_URL = "/api/v1/auth/telegram-login"


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
        "/ready",  # Readiness probe for load balancers
        "/ping",  # Simple ping for liveness checks
        "/health/detailed",  # Detailed health check for monitoring
        "/docs",
        "/openapi.json",
        "/redoc",
        "/",  # Home page (uses CurrentUserOptional)
        "/analytics",  # Analytics page (uses CurrentUserOptional)
        "/favicon.ico",  # Browser favicon
        "/manifest.json",  # PWA manifest (required for install prompt)
        "/sw.min.js",  # Service Worker minified (required for PWA caching)
        # Email/2FA authentication pages (public)
        "/register",  # Email registration page
        "/login-email",  # Email login page
        "/2fa-verify",  # 2FA code verification page
        "/2fa-setup-login",  # First-time 2FA setup during email login
        "/pending-activation",  # Pending admin activation page
        # Push notifications (public)
        "/api/v1/push/vapid-key",  # VAPID public key (needed before login for Safari iOS)
        # WebAuthn authentication endpoints (public - for login)
        "/api/v1/webauthn/authenticate/options",  # Generate auth challenge (identifier-first login)
        "/api/v1/webauthn/authenticate/verify",  # Verify auth response and issue JWT tokens
    }

    # Public path prefixes (startswith check)
    PUBLIC_PREFIXES = [
        "/api/v1/auth/",
        "/api/v1/webapp/validate",  # Web Apps initData validation (no token required)
        "/static/",  # Static files (CSS, JS, images)
        "/shared/",  # Shared static files (JS modules, CSS)
        "/webapp/",  # Web Apps static files (HTML, JS, CSS)
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process each request through JWT authentication.

        IMPORTANT: This middleware ALWAYS attempts to extract and validate JWT tokens,
        even for public endpoints. This allows public endpoints using CurrentUserOptional
        to access authenticated user data from cookies when available.

        Logic:
        1. Always try to extract token from Cookie or Authorization header
        2. If token found and valid -> set request.state.user_id
        3. For public endpoints -> continue even if no valid token
        4. For protected endpoints -> return 401 if no valid token

        Args:
            request: Incoming HTTP request
            call_next: Next middleware/endpoint in chain

        Returns:
            Response: HTTP response from endpoint or 401 error
        """
        # Always try to extract JWT token (even for public endpoints)
        token = self._extract_token(request)

        if token is not None:
            # Validate token and extract both user_id and telegram_id
            # user_id: database PK (always present for valid tokens)
            # telegram_id: Telegram business key (None for email-only users)
            user_id, telegram_id = decode_access_token_full(token)

            if user_id is not None:
                # Token is valid - inject both values into request state
                # user_id: Always set (for email-only users and Telegram users)
                # telegram_id: Set only for Telegram users (None for email-only users)
                request.state.user_id = user_id
                request.state.telegram_id = telegram_id

        # Check if endpoint is public
        is_public = self._is_public_endpoint(request.url.path)

        # For protected endpoints, require valid authentication
        # Now check for user_id (present for all valid tokens, both Telegram and email users)
        if not is_public and not hasattr(request.state, 'user_id'):
            # No valid token for protected endpoint
            # Return appropriate response based on request type
            return self._create_auth_error_response(request)

        # Continue to next middleware/endpoint
        # For public endpoints: may or may not have telegram_id set
        # For protected endpoints: guaranteed to have telegram_id set
        return await call_next(request)

    def _is_browser_request(self, request: Request) -> bool:
        """
        Check if request is from a browser expecting HTML.

        Args:
            request: HTTP request

        Returns:
            bool: True if browser request (Accept: text/html)
        """
        accept = request.headers.get("Accept", "")
        return "text/html" in accept

    def _is_htmx_request(self, request: Request) -> bool:
        """
        Check if request is from HTMX.

        Args:
            request: HTTP request

        Returns:
            bool: True if HTMX request (HX-Request: true)
        """
        return request.headers.get("HX-Request") == "true"

    def _is_api_request(self, request: Request) -> bool:
        """
        Check if request is an API request expecting JSON.

        Args:
            request: HTTP request

        Returns:
            bool: True if API request (Accept: application/json or Authorization header)
        """
        accept = request.headers.get("Accept", "")
        has_auth_header = request.headers.get("Authorization") is not None
        return "application/json" in accept or has_auth_header

    def _create_auth_error_response(self, request: Request) -> Response:
        """
        Create appropriate 401 response based on request type.

        Response Types:
            - Browser (Accept: text/html) → HTTP 303 redirect to login
            - HTMX (HX-Request: true) → 401 + HX-Redirect header (HTMX will redirect)
            - API (Accept: application/json) → JSON 401 response

        Args:
            request: HTTP request

        Returns:
            Response: Appropriate auth error response
        """
        # Priority: HTMX > API > Browser
        # HTMX requests may also have text/html in Accept header

        if self._is_htmx_request(request):
            # HTMX request - return 401 with HX-Redirect header
            # HTMX will automatically redirect to the specified URL
            return Response(
                content="Authentication required",
                status_code=status.HTTP_401_UNAUTHORIZED,
                headers={
                    "HX-Redirect": LOGIN_URL,
                    "HX-Reswap": "none",  # Don't swap content
                },
                media_type="text/plain"
            )

        if self._is_api_request(request):
            # API request - return JSON 401
            return ORJSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={
                    "detail": "Authentication required - No token provided or token invalid"
                }
            )

        if self._is_browser_request(request):
            # Browser request - HTTP 303 redirect to login page
            # 303 See Other is preferred for POST→GET redirect pattern
            return RedirectResponse(
                url=LOGIN_URL,
                status_code=status.HTTP_303_SEE_OTHER
            )

        # Default fallback - JSON 401 (unknown client type)
        return ORJSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "detail": "Authentication required - No token provided or token invalid"
            }
        )

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

    def _extract_token(self, request: Request) -> Optional[str]:
        """
        Extract JWT token from Cookie or Authorization header.

        Priority:
            1. Cookie: access_token
            2. Authorization header: Bearer <token>

        Args:
            request: HTTP request

        Returns:
            Optional[str]: JWT token if found, None otherwise
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
