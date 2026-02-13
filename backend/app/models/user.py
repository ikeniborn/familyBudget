"""
User dimension table model with SCD Type 1 pattern.

This module defines the User model that tracks user information from Telegram
or email with in-place updates (NO versioning). Full change history is stored in
separate UserHistory table (SCD Type 2).

Authentication Methods:
    - Telegram OAuth (telegram_id required)
    - Email + Password + 2FA (email required, 2FA mandatory)
    - Both methods linked (telegram_id AND email)

Constraint: At least one auth method must be set (telegram_id OR email IS NOT NULL)

IMPORTANT: This is a breaking change from previous SCD Type 2 implementation.
Migration required to convert existing data.
"""
from datetime import datetime

from sqlalchemy import BigInteger, CheckConstraint, Column, Index
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

    Authentication Methods:
        1. Telegram OAuth only (telegram_id NOT NULL, email NULL)
        2. Email + Password + 2FA only (telegram_id NULL, email NOT NULL)
        3. Both linked (telegram_id NOT NULL, email NOT NULL)

    Business Keys:
        - telegram_id: Unique identifier from Telegram (nullable for email-only users)
        - email: User email for email-based login (nullable for Telegram-only users)

    Architecture Notes:
        - Main table contains ONLY current user data (no historical versions)
        - History is stored in separate t_d_user_history table (SCD Type 2)
        - FK in fact tables (t_f_budget_fact.user_id) remain stable (NO updates needed)
        - Profile updates (username, photo_url, etc.) are in-place (UPDATE, not INSERT)
        - Constraint: At least one auth method (telegram_id OR email) must be set

    Attributes:
        id: Surrogate primary key (stable - NEVER changes)
        telegram_id: Unique identifier from Telegram (nullable for email-only users)
        email: User email for email-based auth (nullable for Telegram-only users)
        password_hash: Argon2 hashed password (nullable, required for email auth)
        username: Telegram username (optional, SCD1 - in-place update)
        first_name: User's first name (optional, SCD1 - in-place update)
        last_name: User's last name (optional, SCD1 - in-place update)
        photo_url: Local path to cached profile photo (optional, SCD1 - in-place update)
        is_admin: Admin flag for access control (SCD1 - in-place update)
        is_active: User activation status (SCD1 - in-place update)
        two_factor_secret: TOTP secret for 2FA (encrypted, nullable)
        two_factor_enabled: Whether 2FA is enabled (required for email login)
        backup_codes: JSON array of hashed backup codes (nullable)
        enable_push_notifications: Enable Web Push notifications (SCD1 - in-place update)
        enable_telegram_notifications: Enable Telegram notifications (SCD1 - in-place update)
        last_login_at: Timestamp of last successful login (SCD1 - in-place update)
        created_at: Timestamp when user was first created (immutable)
        updated_at: Timestamp when user was last updated (auto-updated on changes)

    Examples:
        # Create Telegram-only user (first login)
        >>> user = User(
        ...     telegram_id=123456789,
        ...     username="john_doe",
        ...     first_name="John",
        ...     is_admin=False,
        ...     is_active=False  # Requires admin activation
        ... )

        # Create email-only user (registration)
        >>> user = User(
        ...     email="john@example.com",
        ...     password_hash="$argon2id$...",
        ...     first_name="John",
        ...     is_admin=False,
        ...     is_active=False  # Requires admin activation
        ... )

        # Link Telegram to email account
        >>> user.telegram_id = 123456789
        >>> await session.commit()
    """

    __tablename__ = "t_d_user"

    # Database constraints
    __table_args__ = (
        # At least one auth method must be set
        CheckConstraint(
            "telegram_id IS NOT NULL OR email IS NOT NULL",
            name="chk_user_has_auth_method"
        ),
        # Partial unique index for email (only non-null values)
        Index(
            "ix_t_d_user_email_unique",
            "email",
            unique=True,
            postgresql_where="email IS NOT NULL"
        ),
    )

    # Primary key (stable - NEVER changes)
    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key (stable - never changes on profile updates)"
    )

    # =========================================================================
    # Authentication Fields (Business Keys)
    # =========================================================================

    # Telegram OAuth (nullable for email-only users)
    telegram_id: int | None = Field(
        default=None,
        sa_column=Column(BigInteger, nullable=True, index=True, unique=True),
        description="Telegram user ID (business key, nullable for email-only users, BIGINT for large IDs)"
    )

    # Email authentication (nullable for Telegram-only users)
    email: str | None = Field(
        default=None,
        max_length=320,  # RFC 5321 max email length
        description="User email for email-based auth (unique via partial index, nullable for Telegram-only)"
    )

    # Password (Argon2 hash, required for email auth)
    password_hash: str | None = Field(
        default=None,
        max_length=255,
        description="Argon2 hashed password (required for email authentication)"
    )

    # =========================================================================
    # Two-Factor Authentication (2FA) Fields
    # =========================================================================

    # TOTP secret (encrypted, required for email-based login)
    two_factor_secret: str | None = Field(
        default=None,
        max_length=64,  # base32 encoded secret (32 bytes = ~52 chars)
        description="TOTP secret for 2FA (base32 encoded, required for email login)"
    )

    # 2FA enabled flag
    two_factor_enabled: bool = Field(
        default=False,
        nullable=False,
        description="Whether 2FA is enabled (required for email login)"
    )

    # Backup codes (JSON array of Argon2 hashed codes)
    backup_codes: str | None = Field(
        default=None,
        max_length=2000,  # JSON array of ~8 hashed codes
        description="JSON array of Argon2 hashed backup codes (one-time use)"
    )

    # =========================================================================
    # Profile data (SCD Type 1 - in-place updates)
    # =========================================================================

    username: str | None = Field(
        default=None,
        max_length=255,
        description="Telegram username (SCD1 - in-place update, history in UserHistory)"
    )
    first_name: str | None = Field(
        default=None,
        max_length=255,
        description="User's first name (SCD1 - in-place update)"
    )
    last_name: str | None = Field(
        default=None,
        max_length=255,
        description="User's last name (SCD1 - in-place update)"
    )
    photo_url: str | None = Field(
        default=None,
        max_length=512,
        description="Local path to cached profile photo (SCD1 - in-place update)"
    )

    # =========================================================================
    # Status flags (SCD Type 1 - in-place updates)
    # =========================================================================

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

    # =========================================================================
    # Notification Preferences (v6.4.0+) (SCD Type 1 - in-place updates)
    # =========================================================================

    enable_push_notifications: bool = Field(
        default=True,
        nullable=False,
        description="Enable Web Push notifications for this user (SCD1 - in-place update, history in UserHistory)"
    )

    enable_telegram_notifications: bool = Field(
        default=True,
        nullable=False,
        description="Enable Telegram bot notifications for this user (SCD1 - in-place update, history in UserHistory)"
    )

    # =========================================================================
    # Account Merge Support
    # =========================================================================

    merged_into_user_id: int | None = Field(
        default=None,
        nullable=True,
        index=True,
        description="Reference to target user when this account was merged into another. NULL means not merged."
    )

    # =========================================================================
    # Google Sheets Integration (v7.x+)
    # =========================================================================

    google_sheets_url: str | None = Field(
        default=None,
        max_length=2048,
        description="Saved Google Sheets URL for shopping list import (SCD1 - in-place update)"
    )

    # =========================================================================
    # Audit fields (SCD Type 1 - in-place updates)
    # =========================================================================

    last_login_at: datetime | None = Field(
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
    #
    # NOTE: Security-sensitive fields NOT stored in UserHistory:
    # - password_hash: Never store in history (security)
    # - two_factor_secret: Never store in history (security)
    # - backup_codes: Never store in history (security)

    @property
    def has_password(self) -> bool:
        """Check if user has a password set.

        Used by frontend to show/hide 'Reset Password' button.
        Returns True if password_hash is set, False otherwise.
        """
        return self.password_hash is not None

    def __repr__(self) -> str:
        """String representation of User model."""
        return (
            f"User(id={self.id}, telegram_id={self.telegram_id}, "
            f"username={self.username}, first_name={self.first_name}, "
            f"last_name={self.last_name}, is_admin={self.is_admin}, "
            f"is_active={self.is_active})"
        )
