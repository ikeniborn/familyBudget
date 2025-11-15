"""
Pydantic schemas for User management endpoints.

This module defines schemas for user CRUD operations.
UserResponse from auth.py is reused for basic user data.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    """
    Schema for creating a new user (admin only).

    Admin users can manually create new users without Telegram OAuth.
    Useful for pre-registering users or testing purposes.

    Validation Rules:
        - telegram_id: Required, positive integer
        - username, first_name: Optional strings
        - is_admin: Optional, defaults to False

    Notes:
        - Creates initial SCD Type 2 version
        - valid_from=now(), valid_to=9999-12-31, is_current=True
    """

    telegram_id: int = Field(
        ...,
        gt=0,
        description="User's Telegram ID (must be unique)",
        examples=[123456789]
    )

    username: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Telegram username (optional)",
        examples=["johndoe", None]
    )

    first_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="User's first name (optional)",
        examples=["John", None]
    )

    last_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="User's last name (optional)",
        examples=["Doe", None]
    )

    is_admin: bool = Field(
        default=False,
        description="Admin status flag (default: False)",
        examples=[False, True]
    )

    is_active: bool = Field(
        default=False,
        description="User activation status (default: False, admin must activate)",
        examples=[False, True]
    )


class UserUpdate(BaseModel):
    """
    Schema for updating user data (admin only).

    Only admin users can update other users.
    Regular users cannot update their own data (comes from Telegram).

    Validation Rules:
        - is_admin and is_active fields can be updated
        - Used for promoting/demoting admins and activating/deactivating users

    Notes:
        - User data (name, username) comes from Telegram OAuth
        - Cannot be manually updated
        - is_active changes: Simple UPDATE (NOT SCD Type 2)
        - is_admin changes: SCD Type 2 update creates new version
    """

    is_admin: bool = Field(
        ...,
        description="Admin status flag",
        examples=[True, False]
    )
    is_active: bool = Field(
        default=True,
        description="User activation status (controlled by admin)",
        examples=[True, False]
    )


class UserDetailResponse(BaseModel):
    """
    Detailed user information including SCD Type 2 fields.

    Extended version of UserResponse with audit and versioning fields.
    Used for admin endpoints.
    """

    id: int = Field(
        description="User's database ID (surrogate key)",
        examples=[1]
    )

    telegram_id: int = Field(
        description="User's Telegram ID (business key)",
        examples=[123456789]
    )

    username: Optional[str] = Field(
        default=None,
        description="Telegram username",
        examples=["johndoe", None]
    )

    first_name: Optional[str] = Field(
        default=None,
        description="User's first name from Telegram",
        examples=["John"]
    )

    last_name: Optional[str] = Field(
        default=None,
        description="User's last name from Telegram",
        examples=["Doe", None]
    )

    photo_url: Optional[str] = Field(
        default=None,
        description="Local path to cached profile photo",
        examples=["/static/avatars/1.jpg", None]
    )

    is_admin: bool = Field(
        description="Admin status flag",
        examples=[False, True]
    )

    is_active: bool = Field(
        description="User activation status (controlled by admin)",
        examples=[True, False]
    )

    last_login_at: Optional[datetime] = Field(
        default=None,
        description="Timestamp of last successful login",
        examples=["2025-11-14T10:30:00Z", None]
    )

    # SCD Type 2 fields
    valid_from: datetime = Field(
        description="Start of validity period",
        examples=["2025-10-13T12:00:00Z"]
    )

    valid_to: datetime = Field(
        description="End of validity period (9999-12-31 for current)",
        examples=["9999-12-31T23:59:59Z"]
    )

    is_current: bool = Field(
        description="True if this is the current version",
        examples=[True]
    )

    # Audit fields
    created_at: datetime = Field(
        description="Record creation timestamp",
        examples=["2025-10-13T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Record last update timestamp",
        examples=["2025-10-13T12:00:00Z"]
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "telegram_id": 123456789,
                "username": "johndoe",
                "first_name": "John",
                "last_name": "Doe",
                "photo_url": "/static/avatars/1.jpg",
                "is_admin": False,
                "is_active": True,
                "last_login_at": "2025-11-14T10:30:00Z",
                "valid_from": "2025-10-13T12:00:00Z",
                "valid_to": "9999-12-31T23:59:59Z",
                "is_current": True,
                "created_at": "2025-10-13T12:00:00Z",
                "updated_at": "2025-10-13T12:00:00Z"
            }
        }
    }


class UserListResponse(BaseModel):
    """
    Schema for paginated user list responses (admin only).
    """

    users: list[UserDetailResponse] = Field(
        description="List of users",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of users (before pagination)",
        examples=[10]
    )

    limit: int = Field(
        description="Maximum number of users returned",
        examples=[100]
    )

    offset: int = Field(
        description="Number of users skipped",
        examples=[0]
    )


class TelegramUserInfo(BaseModel):
    """
    Schema for Telegram user information fetched from Bot API.

    Used by admin when checking if a Telegram ID is valid
    and for auto-filling form fields with user data from Telegram.

    Attributes:
        telegram_id: User's Telegram ID (verified)
        username: Telegram username (optional, may be None)
        first_name: User's first name from Telegram profile
        exists_in_db: Whether user already exists in our database
    """

    telegram_id: int = Field(
        description="Telegram user ID",
        examples=[123456789]
    )

    username: Optional[str] = Field(
        default=None,
        description="Telegram username (without @)",
        examples=["johndoe", None]
    )

    first_name: Optional[str] = Field(
        default=None,
        description="User's first name from Telegram",
        examples=["John"]
    )

    exists_in_db: bool = Field(
        default=False,
        description="True if user already exists in database",
        examples=[False, True]
    )
