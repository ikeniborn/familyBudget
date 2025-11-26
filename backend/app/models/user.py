"""
User dimension table model with SCD Type 1 pattern.

This module defines the User model that tracks user information from Telegram
with in-place updates (NO versioning). Full change history is stored in
separate UserHistory table (SCD Type 2).

IMPORTANT: This is a breaking change from previous SCD Type 2 implementation.
Migration required to convert existing data.
"""

from datetime import datetime
from typing import Optional

from sqlalchemy import BigInteger, Column
from sqlmodel import Field, SQLModel


class User(SQLModel, table=True):
    """
    User dimension table with SCD Type 1 (current data only).

    Changes to this table are in-place updates (no versioning).
    Full change history is stored in UserHistory table (SCD Type 2).

    Stable PK (id) ensures FK integrity in fact tables (t_f_budget_fact, etc).
    Unlike previous SCD Type 2 implementation, the id field NEVER changes when
    user profile is updated.

    Table: t_d_user
    Pattern: SCD Type 1 (Slowly Changing Dimension Type 1)

    Business Key: telegram_id (unique identifier from Telegram)

    Architecture Notes:
        - Main table contains ONLY current user data (no historical versions)
        - History is stored in separate t_d_user_history table (SCD Type 2)
        - FK in fact tables (t_f_budget_fact.user_id) remain stable (NO updates needed)
        - Profile updates (username, photo_url, etc.) are in-place (UPDATE, not INSERT)

    Attributes:
        id: Surrogate primary key (stable - NEVER changes)
        telegram_id: Unique identifier from Telegram (business key)
        username: Telegram username (optional, SCD1 - in-place update)
        first_name: User's first name (optional, SCD1 - in-place update)
        last_name: User's last name (optional, SCD1 - in-place update)
        photo_url: Local path to cached profile photo (optional, SCD1 - in-place update)
        is_admin: Admin flag for access control (SCD1 - in-place update)
        is_active: User activation status (SCD1 - in-place update)
        last_login_at: Timestamp of last successful login (SCD1 - in-place update)
        created_at: Timestamp when user was first created (immutable)
        updated_at: Timestamp when user was last updated (auto-updated on changes)

    Migration from SCD Type 2:
        Old SCD2 fields REMOVED:
        - valid_from: Replaced by UserHistory.valid_from
        - valid_to: Replaced by UserHistory.valid_to
        - is_current: Replaced by UserHistory.is_current

        Migration Strategy (Phase 2):
        1. Keep only is_current=True version in main table
        2. Move ALL versions to UserHistory table
        3. Remap FK in fact tables (old versioned id → new stable id)

    Examples:
        # Create new user (first login)
        >>> user = User(
        ...     telegram_id=123456789,
        ...     username="john_doe",
        ...     first_name="John",
        ...     last_name="Doe",
        ...     is_admin=False,
        ...     is_active=False  # Requires admin activation
        ... )

        # Update profile (in-place, NO new version created)
        >>> user.username = "john_updated"
        >>> user.updated_at = datetime.utcnow()
        >>> await session.commit()
        # UserService will also create history record in UserHistory table
    """

    __tablename__ = "t_d_user"

    # Primary key (stable - NEVER changes)
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key (stable - never changes on profile updates)"
    )

    # Business key (unique identifier from Telegram)
    telegram_id: int = Field(
        nullable=False,
        index=True,
        unique=True,  # Enforces uniqueness - one Telegram user = one record
        sa_column=Column(BigInteger, nullable=False, index=True, unique=True),
        description="Telegram user ID (business key, unique across all users, BIGINT for large IDs)"
    )

    # Profile data (SCD Type 1 - in-place updates)
    username: Optional[str] = Field(
        default=None,
        max_length=255,
        description="Telegram username (SCD1 - in-place update, history in UserHistory)"
    )
    first_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="User's first name (SCD1 - in-place update)"
    )
    last_name: Optional[str] = Field(
        default=None,
        max_length=255,
        description="User's last name from Telegram (SCD1 - in-place update)"
    )
    photo_url: Optional[str] = Field(
        default=None,
        max_length=512,
        description="Local path to cached profile photo (SCD1 - in-place update)"
    )

    # Status flags (SCD Type 1 - in-place updates)
    is_admin: bool = Field(
        default=False,
        nullable=False,
        description="Admin access flag (SCD1 - in-place update)"
    )
    is_active: bool = Field(
        default=False,
        nullable=False,
        index=True,
        description="User activation status controlled by admin (SCD1 - in-place update)"
    )

    # Audit fields (SCD Type 1 - in-place updates)
    last_login_at: Optional[datetime] = Field(
        default=None,
        nullable=True,
        index=True,
        description="Timestamp of last successful login (SCD1 - in-place update)"
    )
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record creation timestamp (immutable)"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record last update timestamp (auto-updated on changes)"
    )

    # NOTE: SCD Type 2 fields REMOVED (breaking change from previous version)
    # - valid_from: Moved to UserHistory table
    # - valid_to: Moved to UserHistory table
    # - is_current: Moved to UserHistory table
    #
    # Full change history is now stored in separate UserHistory table (SCD Type 2)

    def __repr__(self) -> str:
        """String representation of User model."""
        return (
            f"User(id={self.id}, telegram_id={self.telegram_id}, "
            f"username={self.username}, first_name={self.first_name}, "
            f"last_name={self.last_name}, is_admin={self.is_admin}, "
            f"is_active={self.is_active})"
        )
