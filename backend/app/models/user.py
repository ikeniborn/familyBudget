"""
User dimension table model with SCD Type 2 pattern.

This module defines the User model that tracks user information from Telegram
with historical changes using Slowly Changing Dimension Type 2 pattern.
"""

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    """
    User dimension table with SCD Type 2.

    Tracks user information from Telegram with historical changes.
    Each user can have multiple records (versions) but only one is current.

    Table: t_d_user
    Pattern: SCD Type 2 (Slowly Changing Dimension Type 2)

    Business Key: telegram_id

    Attributes:
        id: Surrogate primary key (auto-generated)
        telegram_id: Unique identifier from Telegram (business key)
        username: Telegram username (optional)
        first_name: User's first name (optional)
        last_name: User's last name (optional)
        photo_url: Local path to cached profile photo (optional)
        is_admin: Admin flag for access control
        valid_from: Start of validity period for this record
        valid_to: End of validity period (9999-12-31 for current records)
        is_current: Flag indicating if this is the current version
        created_at: Timestamp when record was created
        updated_at: Timestamp when record was last updated
    """

    __tablename__ = "t_d_user"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Business key
    telegram_id: int = Field(
        nullable=False,
        index=True,
        description="Telegram user ID (business key)"
    )

    # User attributes
    username: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Telegram username"
    )
    first_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="User's first name"
    )
    last_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="User's last name from Telegram"
    )
    photo_url: Optional[str] = Field(
        default=None,
        max_length=512,
        description="Local path to cached profile photo (e.g., /static/avatars/123.jpg)"
    )
    is_admin: bool = Field(
        default=False,
        nullable=False,
        description="Admin access flag"
    )

    # SCD Type 2 fields
    valid_from: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Start of validity period"
    )
    valid_to: Optional[datetime] = Field(
        default=datetime(9999, 12, 31, 23, 59, 59),
        nullable=True,
        description="End of validity period (9999-12-31 for current)"
    )
    is_current: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="Current version flag"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record last update timestamp"
    )

    def __repr__(self) -> str:
        """String representation of User model."""
        return (
            f"User(id={self.id}, telegram_id={self.telegram_id}, "
            f"username={self.username}, first_name={self.first_name}, "
            f"last_name={self.last_name}, is_current={self.is_current})"
        )
