"""
Content Security Policy (CSP) middleware.

Adds security headers to protect against XSS, clickjacking, and other attacks.
"""

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

from backend.app.core.config import get_settings


class CSPMiddleware(BaseHTTPMiddleware):
    """
    Content Security Policy middleware.

    Adds CSP and other security headers to all responses.
    Special configuration for /webapp/* endpoints (Telegram Web Apps).
    """

    async def dispatch(self, request: Request, call_next):
        settings = get_settings()
        response: Response = await call_next(request)

        # Check if request is for webapp
        is_webapp = request.url.path.startswith("/webapp")

        if is_webapp:
            # CSP for Telegram Web Apps
            # Allow Telegram to embed WebApp in iframe
            csp = (
                "default-src 'self'; "
                "script-src 'self' https://telegram.org https://*.telegram.org 'unsafe-inline'; "  # unsafe-inline for inline scripts
                "style-src 'self' 'unsafe-inline'; "  # unsafe-inline for inline styles
                "img-src 'self' data: https:; "
                "connect-src 'self' https://api.telegram.org; "
                "font-src 'self'; "
                "frame-ancestors https://web.telegram.org https://*.telegram.org; "  # Allow Telegram to embed in iframe
                "base-uri 'self'; "
                "form-action 'self'"
            )
        else:
            # CSP for Web UI with CDN support (Tailwind, DaisyUI, HTMX, ECharts, Telegram Login Widget)
            csp = (
                "default-src 'self'; "
                "script-src 'self' https://cdn.tailwindcss.com https://unpkg.com https://cdn.jsdelivr.net https://telegram.org https://*.telegram.org 'unsafe-inline'; "  # Allow CDN, Telegram widget, inline scripts
                "style-src 'self' https://cdn.jsdelivr.net 'unsafe-inline'; "  # Allow DaisyUI and inline styles
                "img-src 'self' data: https:; "
                "connect-src 'self'; "
                "font-src 'self' https://cdn.jsdelivr.net; "  # Allow DaisyUI fonts
                "frame-src https://oauth.telegram.org https://*.telegram.org; "  # Allow Telegram OAuth iframe
                "frame-ancestors 'none'; "
                "base-uri 'self'; "
                "form-action 'self'"
            )

        # Add CSP header
        response.headers["Content-Security-Policy"] = csp

        # Additional security headers
        response.headers["X-Content-Type-Options"] = "nosniff"

        # X-Frame-Options: Allow Telegram to embed /webapp/* in iframe
        if is_webapp:
            # Don't set X-Frame-Options for webapp (CSP frame-ancestors is sufficient)
            # Setting both can cause conflicts and browsers prefer CSP
            pass
        else:
            response.headers["X-Frame-Options"] = "DENY"

        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # HSTS (only in production with HTTPS)
        # Enable Strict-Transport-Security header in production with SSL
        # This prevents SSL stripping attacks and enforces HTTPS
        if settings.APP_ENV == "production" and settings.SSL_TYPE == "letsencrypt":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        return response
