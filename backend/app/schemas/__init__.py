"""
Pydantic schemas package.

This package contains all Pydantic schemas for request/response validation.
Schemas are organized by domain (auth, users, articles, facts).

Schemas:
    TelegramAuthData: Telegram OAuth input data
    UserResponse: User data for responses
    AuthResponse: Authentication response with user data
"""

from backend.app.schemas.auth import AuthResponse, TelegramAuthData, UserResponse

__all__ = [
    "TelegramAuthData",
    "UserResponse",
    "AuthResponse",
]
