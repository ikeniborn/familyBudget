"""
Static Cache Middleware

Adds Cache-Control headers to static files served by FastAPI StaticFiles.

Why needed:
- FastAPI StaticFiles only adds ETag + Last-Modified headers
- Browsers use heuristic caching without explicit Cache-Control
- Versioned URLs (?v=11.4.45) don't work reliably without Cache-Control

Cache Strategy:
- Versioned static files (?v=*): 1 year cache (immutable after version change)
- Service Worker: no-cache (must revalidate on every request)
- manifest.json: 1 hour cache (PWA metadata)
- Other static files: 1 hour cache with must-revalidate

Author: Family Budget Team
"""

from starlette.datastructures import MutableHeaders
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response


class StaticCacheMiddleware(BaseHTTPMiddleware):
    """Add Cache-Control headers to static files"""

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        response = await call_next(request)

        # Only add Cache-Control for successful responses
        if response.status_code != 200:
            return response

        path = request.url.path

        # Determine Cache-Control based on path
        cache_control = None

        # Service Worker - NEVER cache (critical for PWA updates)
        if path == "/sw.min.js" or path == "/sw.js":
            cache_control = "no-cache, must-revalidate"

        # PWA Manifest - short cache (1 hour)
        elif path == "/manifest.json":
            cache_control = "public, max-age=3600, must-revalidate"

        # Static files with version query parameter - long-term cache (1 year)
        elif path.startswith(("/static/", "/shared/", "/webapp/")) and "v=" in request.url.query:
            cache_control = "public, max-age=31536000, immutable"

        # Static files without version - short cache (1 hour)
        elif path.startswith(("/static/", "/shared/", "/webapp/")):
            cache_control = "public, max-age=3600, must-revalidate"

        # Add Cache-Control header if determined
        if cache_control:
            headers = MutableHeaders(response.headers)
            headers["Cache-Control"] = cache_control
            response.headers = headers

        return response
