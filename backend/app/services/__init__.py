"""
Services package.

This package contains business logic services organized by domain:
- JWT token management
- Telegram OAuth validation
- User authentication and management
"""

from backend.app.services.auth_service import get_or_create_user
from backend.app.services.jwt import create_access_token, decode_access_token
from backend.app.services.telegram_auth import validate_telegram_auth

__all__ = [
    "create_access_token",
    "decode_access_token",
    "validate_telegram_auth",
    "get_or_create_user",
]
