"""
Authentication Pydantic schemas for Telegram OAuth and JWT.

This module defines request and response schemas for the authentication flow:
- Telegram OAuth data validation
- User response data
- Authentication response with user data
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TelegramAuthData(BaseModel):
    """
    Telegram OAuth authentication data.

    This schema validates data received from Telegram Login Widget.
    All fields except 'hash' come from Telegram's authentication response.

    According to Telegram OAuth documentation:
    https://core.telegram.org/widgets/login

    Attributes:
        id: Telegram user ID
        first_name: User's first name
        last_name: User's last name (optional)
        username: Telegram username (optional)
        photo_url: Profile photo URL (optional)
        auth_date: Authentication timestamp (unix timestamp)
        hash: HMAC-SHA256 hash for validation (computed by Telegram)

    Example:
        >>> data = TelegramAuthData(
        ...     id=123456789,
        ...     first_name="John",
        ...     last_name="Doe",
        ...     username="johndoe",
        ...     auth_date=1699999999,
        ...     hash="abc123def456..."
        ... )
    """

    id: int = Field(
        description="Telegram user ID",
        examples=[123456789]
    )
    first_name: str = Field(
        description="User's first name from Telegram",
        examples=["John"]
    )
    last_name: Optional[str] = Field(
        default=None,
        description="User's last name from Telegram (optional)",
        examples=["Doe", None]
    )
    username: Optional[str] = Field(
        default=None,
        description="Telegram username (optional)",
        examples=["johndoe", None]
    )
    photo_url: Optional[str] = Field(
        default=None,
        description="Profile photo URL (optional)",
        examples=["https://t.me/i/userpic/320/johndoe.jpg", None]
    )
    auth_date: int = Field(
        description="Authentication timestamp (unix timestamp)",
        examples=[1699999999]
    )
    hash: str = Field(
        description="HMAC-SHA256 hash from Telegram for validation",
        examples=["abc123def456789abcdef123456789abcdef"]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "id": 123456789,
                "first_name": "John",
                "last_name": "Doe",
                "username": "johndoe",
                "photo_url": "https://t.me/i/userpic/320/johndoe.jpg",
                "auth_date": 1699999999,
                "hash": "abc123def456789abcdef123456789abcdef"
            }
        }
    }


class UserResponse(BaseModel):
    """
    User data returned in authentication response.

    Contains essential user information without sensitive SCD2 fields.

    Attributes:
        id: User's database ID (surrogate key)
        telegram_id: User's Telegram ID (business key)
        username: Telegram username (optional)
        first_name: User's first name
        last_name: User's last name (optional)
        is_admin: Admin status flag

    Example:
        >>> user = UserResponse(
        ...     id=1,
        ...     telegram_id=123456789,
        ...     username="johndoe",
        ...     first_name="John",
        ...     last_name="Doe",
        ...     is_admin=False
        ... )
    """

    id: int = Field(
        description="User's database ID",
        examples=[1]
    )
    telegram_id: int = Field(
        description="User's Telegram ID",
        examples=[123456789]
    )
    username: Optional[str] = Field(
        default=None,
        description="Telegram username",
        examples=["johndoe", None]
    )
    first_name: Optional[str] = Field(
        default=None,
        description="User's first name",
        examples=["John"]
    )
    last_name: Optional[str] = Field(
        default=None,
        description="User's last name",
        examples=["Doe", None]
    )
    is_admin: bool = Field(
        default=False,
        description="Admin status flag",
        examples=[False]
    )

    model_config = {
        "from_attributes": True,  # Enable ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "telegram_id": 123456789,
                "username": "johndoe",
                "first_name": "John",
                "last_name": "Doe",
                "is_admin": False
            }
        }
    }


class AuthResponse(BaseModel):
    """
    Complete authentication response.

    Returned after successful Telegram OAuth authentication.
    JWT token is set in httpOnly cookie separately.

    Attributes:
        user: User data
        message: Success message

    Example:
        >>> response = AuthResponse(
        ...     user=UserResponse(...),
        ...     message="Authentication successful"
        ... )
    """

    user: UserResponse = Field(
        description="Authenticated user data"
    )
    message: str = Field(
        default="Authentication successful",
        description="Success message",
        examples=["Authentication successful"]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "user": {
                    "id": 1,
                    "telegram_id": 123456789,
                    "username": "johndoe",
                    "first_name": "John",
                    "last_name": "Doe",
                    "is_admin": False
                },
                "message": "Authentication successful"
            }
        }
    }
