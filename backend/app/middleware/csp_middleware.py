"""
Content Security Policy (CSP) middleware.

Adds security headers to protect against XSS, clickjacking, and other attacks.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class CSPMiddleware(BaseHTTPMiddleware):
    """
    Content Security Policy middleware.

    Adds CSP and other security headers to all responses.
    Special configuration for /webapp/* endpoints (Telegram Web Apps).
    """

    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)

        # Check if request is for webapp
        is_webapp = request.url.path.startswith("/webapp")

        if is_webapp:
            # CSP for Telegram Web Apps
            # Allow Telegram scripts and styles
            csp = (
                "default-src 'self'; "
                "script-src 'self' https://telegram.org 'unsafe-inline'; "  # unsafe-inline for inline scripts
                "style-src 'self' 'unsafe-inline'; "  # unsafe-inline for inline styles
                "img-src 'self' data: https:; "
                "connect-src 'self' https://api.telegram.org; "
                "font-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )
        else:
            # Strict CSP for other endpoints
            csp = (
                "default-src 'self'; "
                "script-src 'self'; "
                "style-src 'self' 'unsafe-inline'; "
                "img-src 'self' data: https:; "
                "connect-src 'self'; "
                "font-src 'self'; "
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )

        # Add CSP header
        response.headers["Content-Security-Policy"] = csp

        # Additional security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HSTS (only in production with HTTPS)
        # Uncomment when deploying to production with HTTPS
        # response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"

        return response
