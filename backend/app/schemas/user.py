"""
Pydantic schemas for User management endpoints.

This module defines schemas for user CRUD operations.
UserResponse from auth.py is reused for basic user data.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserUpdate(BaseModel):
    """
    Schema for updating user data (admin only).

    Only admin users can update other users.
    Regular users cannot update their own data (comes from Telegram).

    Validation Rules:
        - Only is_admin field can be updated
        - Used for promoting/demoting admins

    Notes:
        - User data (name, username) comes from Telegram OAuth
        - Cannot be manually updated
        - SCD Type 2 update creates new version
    """

    is_admin: bool = Field(
        ...,
        description="Admin status flag",
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

    is_admin: bool = Field(
        description="Admin status flag",
        examples=[False, True]
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
                "is_admin": False,
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
