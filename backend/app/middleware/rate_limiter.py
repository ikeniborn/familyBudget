"""
Rate limiting middleware using slowapi.

⚠️ SECURITY MODULE ⚠️
Provides rate limiting to protect against brute-force attacks on:
- Authentication endpoints (login, 2FA verification)
- Registration endpoints (spam prevention)
- OAuth callbacks (replay attack mitigation)

Usage:
    from backend.app.middleware.rate_limiter import limiter

    @router.post("/login")
    @limiter.limit("5/minute")
    async def login(request: Request, ...):
        ...

Rate Limits:
    - /auth/login: 5/minute (password brute-force protection)
    - /auth/verify-2fa: 5/minute (TOTP brute-force protection)
    - /auth/register: 3/hour (spam prevention)
    - /auth/telegram-callback: 10/minute (OAuth abuse prevention)

Response Headers (on every request):
    - X-RateLimit-Limit: Maximum requests allowed
    - X-RateLimit-Remaining: Requests remaining in window
    - X-RateLimit-Reset: Unix timestamp when limit resets

Error Response (429 Too Many Requests):
    {
        "detail": "Rate limit exceeded: 5 per 1 minute"
    }
"""

import logging

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

logger = logging.getLogger(__name__)


def get_client_ip(request: Request) -> str:
    """
    Get client IP address for rate limiting.

    Handles reverse proxy scenarios by checking X-Forwarded-For header first,
    then X-Real-IP, before falling back to direct client address.

    Args:
        request: FastAPI Request object

    Returns:
        str: Client IP address

    Security Note:
        X-Forwarded-For can be spoofed if not behind trusted proxy.
        Ensure nginx/load balancer is configured to set this correctly.
    """
    # Check X-Forwarded-For header (set by nginx/proxy)
    forwarded_for = request.headers.get("X-Forwarded-For")
    if forwarded_for:
        # X-Forwarded-For format: "client, proxy1, proxy2"
        # Take the first (original client) IP
        client_ip = forwarded_for.split(",")[0].strip()
        return client_ip

    # Check X-Real-IP header (alternative proxy header)
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip.strip()

    # Fall back to default method (direct connection)
    return get_remote_address(request)


def rate_limit_key_func(request: Request) -> str:
    """
    Generate rate limit key for request.

    Uses client IP address as the primary key for rate limiting.
    All requests from the same IP share the same rate limit bucket.

    Args:
        request: FastAPI Request object

    Returns:
        str: Rate limit key (client IP)
    """
    return get_client_ip(request)


# Create limiter instance with custom key function
# Uses in-memory storage by default (suitable for single-instance deployment)
# For multi-instance deployment, configure Redis storage:
#   limiter = Limiter(key_func=rate_limit_key_func, storage_uri="redis://localhost:6379")
limiter = Limiter(
    key_func=rate_limit_key_func,
    default_limits=["200/minute"],  # Default limit for non-decorated endpoints
)


def get_limiter() -> Limiter:
    """
    Get the global limiter instance.

    Returns:
        Limiter: Configured slowapi Limiter instance
    """
    return limiter
