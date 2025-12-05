"""
Pydantic schemas for User management endpoints.

This module defines schemas for user CRUD operations after migration
from SCD Type 2 to SCD Type 1 + History architecture.

BREAKING CHANGES:
- UserResponse: SCD2 fields removed (valid_from, valid_to, is_current)
- UserDetailResponse: SCD2 fields removed (matches main User table)
- UserHistoryResponse: NEW schema for history endpoint (has SCD2 fields)
"""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    """
    Schema for creating a new user (admin only).

    Admin users can manually create new users without Telegram OAuth.
    Useful for pre-registering users or testing purposes.

    Validation Rules:
        - telegram_id: Required, positive integer
        - username, first_name, last_name: Optional strings
        - is_admin, is_active: Optional booleans

    Notes:
        - Creates user in main t_d_user table (SCD1)
        - Also creates initial history record in t_d_user_history
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
    Schema for updating user data.

    Used for updating profile fields that can be modified in-place (SCD1).

    Validation Rules:
        - All fields are optional (partial update)
        - telegram_id: Telegram ID (can be set/cleared by admin)
        - email: Email for email-based auth
        - username, first_name, last_name, photo_url: Profile data
        - is_admin, is_active: Status flags

    Notes:
        - Updates User table in-place (SCD1)
        - Also creates history record in UserHistory table
        - All changes are logged with metadata (change_type, changed_fields)
    """

    telegram_id: Optional[int] = Field(
        default=None,
        description="Telegram user ID (business key, nullable for email-only users)",
        examples=[740775802]
    )

    email: Optional[str] = Field(
        default=None,
        max_length=320,
        description="User email for email-based auth",
        examples=["john@example.com"]
    )

    username: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Telegram username",
        examples=["johndoe_updated"]
    )

    first_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="User's first name",
        examples=["John"]
    )

    last_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="User's last name",
        examples=["Doe"]
    )

    photo_url: Optional[str] = Field(
        default=None,
        max_length=512,
        description="Local path to cached profile photo",
        examples=["/static/avatars/123.jpg"]
    )

    is_admin: Optional[bool] = Field(
        default=None,
        description="Admin status flag",
        examples=[True, False]
    )

    is_active: Optional[bool] = Field(
        default=None,
        description="User activation status",
        examples=[True, False]
    )

    timezone: Optional[str] = Field(
        default=None,
        max_length=50,
        description="User timezone in IANA format (e.g., 'Europe/Moscow'). "
        "NULL means use SYSTEM_TIMEZONE from config.",
        examples=["Europe/Moscow", "UTC", None]
    )


class UserResponse(BaseModel):
    """
    User response schema (SCD1 - no SCD2 fields).

    Basic user information without temporal validity or versioning fields.
    Used for most API endpoints.

    BREAKING CHANGE from previous version:
        - SCD2 fields REMOVED: valid_from, valid_to, is_current
        - Full history available via GET /users/{id}/history endpoint
    """

    id: int = Field(
        description="User's database ID (stable - never changes)",
        examples=[1]
    )

    telegram_id: Optional[int] = Field(
        default=None,
        description="User's Telegram ID (business key, nullable for email-only users)",
        examples=[123456789, None]
    )

    email: Optional[str] = Field(
        default=None,
        description="User email for email-based auth (nullable for Telegram-only users)",
        examples=["john@example.com", None]
    )

    username: Optional[str] = Field(
        default=None,
        description="Telegram username",
        examples=["johndoe", None]
    )

    two_factor_enabled: bool = Field(
        default=False,
        description="Whether 2FA is enabled (required for email login)",
        examples=[False, True]
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

    timezone: Optional[str] = Field(
        default=None,
        description="User timezone in IANA format (e.g., 'Europe/Moscow'). "
        "NULL means use SYSTEM_TIMEZONE from config.",
        examples=["Europe/Moscow", "UTC", None]
    )

    last_login_at: Optional[datetime] = Field(
        default=None,
        description="Timestamp of last successful login",
        examples=["2025-11-14T10:30:00Z", None]
    )

    created_at: datetime = Field(
        description="Record creation timestamp",
        examples=["2025-10-13T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Record last update timestamp",
        examples=["2025-10-13T12:00:00Z"]
    )

    # NOTE: SCD2 fields REMOVED (breaking change)
    # - valid_from: Moved to UserHistoryResponse
    # - valid_to: Moved to UserHistoryResponse
    # - is_current: Moved to UserHistoryResponse

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "telegram_id": 123456789,
                "email": "john@example.com",
                "username": "johndoe",
                "two_factor_enabled": True,
                "first_name": "John",
                "last_name": "Doe",
                "photo_url": "/static/avatars/1.jpg",
                "is_admin": False,
                "is_active": True,
                "timezone": "Europe/Moscow",
                "last_login_at": "2025-11-14T10:30:00Z",
                "created_at": "2025-10-13T12:00:00Z",
                "updated_at": "2025-10-13T12:00:00Z"
            }
        }
    }


class UserHistoryResponse(BaseModel):
    """
    User history response schema (SCD2 - with temporal validity).

    Full historical snapshot with SCD Type 2 fields.
    Used for GET /users/{id}/history endpoint.

    Attributes:
        history_id: Surrogate key for history record
        user_id: FK to t_d_user.id (stable)
        telegram_id: Business key
        username, first_name, last_name, photo_url: Profile snapshot
        is_admin, is_active: Status snapshot
        last_login_at: Audit snapshot
        valid_from: Start of validity period
        valid_to: End of validity period (9999-12-31 for current)
        is_current: True for current version
        change_type: Type of change (CREATE/UPDATE/ROLE_CHANGE/LOGIN)
        changed_fields: Array of changed field names
        changed_by_user_id: Who made the change (NULL for auto)
        created_at: When history record was created
    """

    history_id: int = Field(
        description="History record ID (surrogate key)",
        examples=[1]
    )

    user_id: int = Field(
        description="User's database ID (FK to t_d_user.id, stable)",
        examples=[1]
    )

    telegram_id: int = Field(
        description="Telegram user ID (business key)",
        examples=[123456789]
    )

    username: Optional[str] = Field(
        default=None,
        description="Username at time of change (snapshot)",
        examples=["johndoe"]
    )

    first_name: Optional[str] = Field(
        default=None,
        description="First name at time of change (snapshot)",
        examples=["John"]
    )

    last_name: Optional[str] = Field(
        default=None,
        description="Last name at time of change (snapshot)",
        examples=["Doe"]
    )

    photo_url: Optional[str] = Field(
        default=None,
        description="Photo URL at time of change (snapshot)",
        examples=["/static/avatars/1.jpg"]
    )

    is_admin: bool = Field(
        description="Admin flag at time of change (snapshot)",
        examples=[False]
    )

    is_active: bool = Field(
        description="Active status at time of change (snapshot)",
        examples=[True]
    )

    timezone: Optional[str] = Field(
        default=None,
        description="User timezone at time of change (snapshot)",
        examples=["Europe/Moscow", "UTC", None]
    )

    last_login_at: Optional[datetime] = Field(
        default=None,
        description="Last login at time of change (snapshot)",
        examples=["2025-11-14T10:30:00Z"]
    )

    # SCD Type 2 fields (temporal validity)
    valid_from: datetime = Field(
        description="Start of validity period (when change occurred)",
        examples=["2025-10-13T12:00:00Z"]
    )

    valid_to: datetime = Field(
        description="End of validity period (9999-12-31 23:59:59 for current)",
        examples=["9999-12-31T23:59:59Z"]
    )

    is_current: bool = Field(
        description="True for current version (matches User table)",
        examples=[True]
    )

    # Audit metadata
    change_type: Optional[str] = Field(
        default=None,
        description="Type of change: CREATE/UPDATE/ROLE_CHANGE/LOGIN",
        examples=["CREATE", "UPDATE", "ROLE_CHANGE"]
    )

    changed_fields: Optional[List[str]] = Field(
        default=None,
        description="Array of changed field names (e.g., ['username', 'photo_url'])",
        examples=[["username"], ["is_admin", "is_active"], None]
    )

    changed_by_user_id: Optional[int] = Field(
        default=None,
        description="User ID who made the change (NULL for automatic changes)",
        examples=[2, None]
    )

    created_at: datetime = Field(
        description="Timestamp when history record was created",
        examples=["2025-10-13T12:00:00Z"]
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "history_id": 1,
                "user_id": 1,
                "telegram_id": 123456789,
                "username": "johndoe",
                "first_name": "John",
                "last_name": "Doe",
                "photo_url": "/static/avatars/1.jpg",
                "is_admin": False,
                "is_active": True,
                "timezone": "Europe/Moscow",
                "last_login_at": "2025-11-14T10:30:00Z",
                "valid_from": "2025-10-13T12:00:00Z",
                "valid_to": "9999-12-31T23:59:59Z",
                "is_current": True,
                "change_type": "CREATE",
                "changed_fields": None,
                "changed_by_user_id": None,
                "created_at": "2025-10-13T12:00:00Z"
            }
        }
    }


# Alias for backward compatibility
UserDetailResponse = UserResponse  # Same as UserResponse after SCD2 → SCD1 migration


class UserListResponse(BaseModel):
    """
    Schema for paginated user list responses (admin only).
    """

    users: list[UserResponse] = Field(
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


class UserHistoryListResponse(BaseModel):
    """
    Schema for user history list responses.

    Used by GET /users/{id}/history endpoint.
    """

    history: list[UserHistoryResponse] = Field(
        description="List of historical versions",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of history records",
        examples=[5]
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
