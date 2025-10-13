"""
Services package.

This package contains business logic services organized by domain:
- JWT token management
- Telegram OAuth validation
- User authentication and management
- SCD Type 2 (Slowly Changing Dimension) operations
"""

from backend.app.services.auth_service import get_or_create_user
from backend.app.services.jwt import create_access_token, decode_access_token
from backend.app.services.scd2_service import (
    create_new_version,
    get_current_version,
    get_history,
    get_version_at_date,
    has_changes,
    validate_scd2_instance,
    verify_no_concurrent_update,
)
from backend.app.services.telegram_auth import validate_telegram_auth

__all__ = [
    "create_access_token",
    "decode_access_token",
    "validate_telegram_auth",
    "get_or_create_user",
    # SCD Type 2 service
    "create_new_version",
    "get_current_version",
    "get_version_at_date",
    "get_history",
    "has_changes",
    "validate_scd2_instance",
    "verify_no_concurrent_update",
]
