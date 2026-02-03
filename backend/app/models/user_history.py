"""
User history table model with SCD Type 2 pattern.

This module defines the UserHistory model that stores full change history
for User table with temporal validity (valid_from, valid_to).

All changes to User table are logged here with metadata about what changed,
when, and who made the change.

SECURITY NOTE:
    The following fields are NEVER stored in history (security sensitive):
    - password_hash: Never store password hashes in history
    - two_factor_secret: TOTP secrets must not be logged
    - backup_codes: Backup codes must not be logged

    Only non-sensitive fields are tracked for audit purposes.
"""

from datetime import datetime, timezone

from sqlalchemy import ARRAY, BigInteger, Column, DateTime, String
from sqlmodel import Field, SQLModel

# Far future datetime constant for SCD Type 2 valid_to field
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


class UserHistory(SQLModel, table=True):
    """
    User history table (SCD Type 2 - full change history).

    Stores all changes to User table with temporal validity (valid_from, valid_to).
    Each change creates a new version with is_current=True, previous version is closed.

    FK to t_d_user.id (stable) ensures history is linked to correct user.

    Table: t_d_user_history
    Pattern: SCD Type 2 (Slowly Changing Dimension Type 2)

    Architecture Notes:
        - Stores FULL history of all User table changes
        - FK user_id points to stable t_d_user.id (NOT versioned)
        - Each change: close old version (is_current=False, set valid_to) + create new version
        - Used ONLY for audit and GET /users/{id}/history endpoint
        - NOT used in regular queries (no JOINs in fact table queries)

    Change Tracking:
        - change_type: Type of change (CREATE/UPDATE/ROLE_CHANGE/LOGIN)
        - changed_fields: Array of field names that were changed (['username', 'photo_url'])
        - changed_by_user_id: Who made the change (NULL for automatic changes)

    Indexes:
        - user_id: Fast lookup of history for specific user
        - valid_from: Temporal queries (find version at specific time)
        - is_current: Find current version (should match User table)
        - telegram_id: Search history by business key

    Attributes:
        history_id: Surrogate primary key for history records
        user_id: Foreign key to t_d_user.id (stable PK)
        telegram_id: Business key (nullable for email-only users)
        email: Email for email-based auth (nullable for Telegram-only users)
        username: Profile snapshot at time of change (optional)
        first_name: Profile snapshot at time of change (optional)
        last_name: Profile snapshot at time of change (optional)
        photo_url: Profile snapshot at time of change (optional)
        is_admin: Status snapshot at time of change
        is_active: Status snapshot at time of change
        two_factor_enabled: 2FA status at time of change (for security audit)
        last_login_at: Audit snapshot at time of change (optional)
        valid_from: Start of validity period (when change occurred)
        valid_to: End of validity period (9999-12-31 for current version)
        is_current: True for current version (matches User table)
        change_type: Type of change (CREATE/UPDATE/ROLE_CHANGE/LOGIN/2FA_ENABLE/2FA_DISABLE)
        changed_fields: Array of changed field names (e.g., ['username', 'photo_url'])
        changed_by_user_id: Who made the change (NULL for automatic)
        created_at: When history record was created

    Examples:
        # CREATE change (new user first login)
        >>> history = UserHistory(
        ...     user_id=1,
        ...     telegram_id=123456789,
        ...     username="john_doe",
        ...     first_name="John",
        ...     is_admin=False,
        ...     is_active=False,
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="CREATE",
        ...     changed_fields=None  # Initial creation
        ... )

        # UPDATE change (profile update)
        >>> # 1. Close old version
        >>> old_history.is_current = False
        >>> old_history.valid_to = datetime.utcnow()
        >>> # 2. Create new version
        >>> new_history = UserHistory(
        ...     user_id=1,
        ...     telegram_id=123456789,
        ...     username="john_updated",  # Changed
        ...     first_name="John",
        ...     is_admin=False,
        ...     is_active=False,
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="UPDATE",
        ...     changed_fields=["username"]  # What changed
        ... )

        # ROLE_CHANGE (admin activation)
        >>> history = UserHistory(
        ...     user_id=1,
        ...     telegram_id=123456789,
        ...     username="john_doe",
        ...     is_admin=False,
        ...     is_active=True,  # Changed from False
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="ROLE_CHANGE",
        ...     changed_fields=["is_active"],
        ...     changed_by_user_id=2  # Admin user_id
        ... )

    Workflow:
        When User table is updated via UserService:
        1. Close old UserHistory version (is_current=False, set valid_to)
        2. Update User table in-place (SCD1)
        3. Create new UserHistory version (is_current=True, capture changes)
    """

    __tablename__ = "t_d_user_history"

    # Primary key (surrogate key for history records)
    history_id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key for history table"
    )

    # Foreign key to main User table (stable PK)
    user_id: int = Field(
        foreign_key="t_d_user.id",
        nullable=False,
        index=True,
        description="Foreign key to t_d_user.id (stable - does NOT change on updates)"
    )

    # =========================================================================
    # Authentication Fields (Business Keys - nullable since either can be auth method)
    # =========================================================================

    # Telegram OAuth (nullable for email-only users)
    telegram_id: int | None = Field(
        sa_column=Column(BigInteger, nullable=True, index=True),
        default=None,
        description="Telegram user ID (business key, nullable for email-only users, BIGINT for large IDs)"
    )

    # Email authentication (nullable for Telegram-only users)
    email: str | None = Field(
        default=None,
        max_length=320,  # RFC 5321 max email length
        description="User email for email-based auth (nullable for Telegram-only users)"
    )

    # =========================================================================
    # Profile data snapshot (at the time of change)
    # =========================================================================
    username: str | None = Field(
        default=None,
        max_length=255,
        description="Username at time of change (snapshot)"
    )
    first_name: str | None = Field(
        default=None,
        max_length=255,
        description="First name at time of change (snapshot)"
    )
    last_name: str | None = Field(
        default=None,
        max_length=255,
        description="Last name at time of change (snapshot)"
    )
    photo_url: str | None = Field(
        default=None,
        max_length=512,
        description="Photo URL at time of change (snapshot)"
    )

    # =========================================================================
    # Status flags snapshot
    # =========================================================================

    is_admin: bool = Field(
        nullable=False,
        description="Admin flag at time of change (snapshot)"
    )
    is_active: bool = Field(
        nullable=False,
        description="Active status at time of change (snapshot)"
    )

    # 2FA status (for security audit - tracks when 2FA was enabled/disabled)
    # NOTE: two_factor_secret is NOT stored in history (security sensitive)
    two_factor_enabled: bool = Field(
        default=False,
        nullable=False,
        description="2FA enabled status at time of change (for security audit)"
    )

    last_login_at: datetime | None = Field(
        default=None,
        nullable=True,
        description="Last login timestamp at time of change (snapshot)"
    )

    # =========================================================================
    # Google Sheets Integration (v7.x+)
    # =========================================================================

    google_sheets_url: str | None = Field(
        default=None,
        max_length=2048,
        description="Google Sheets URL at time of change (snapshot)"
    )

    # SCD Type 2 fields (temporal validity)
    valid_from: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
        description="Start of validity period (when change occurred)"
    )
    valid_to: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
        default_factory=lambda: FAR_FUTURE_DATETIME,
        description="End of validity period (9999-12-31 23:59:59 for current version)"
    )
    is_current: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="True for current version (matches User table)"
    )

    # Audit fields (metadata about the change)
    change_type: str | None = Field(
        default=None,
        max_length=50,
        description="Type of change: CREATE/UPDATE/ROLE_CHANGE/LOGIN"
    )
    changed_fields: list[str] | None = Field(
        sa_column=Column(ARRAY(String)),
        default=None,
        description="Array of field names that were changed (e.g., ['username', 'photo_url'])"
    )
    changed_by_user_id: int | None = Field(
        default=None,
        nullable=True,
        description="User ID who made the change (NULL for automatic changes)"
    )
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc),
        description="Timestamp when history record was created (timezone-aware UTC)"
    )

    def __repr__(self) -> str:
        """String representation of UserHistory model."""
        return (
            f"UserHistory(history_id={self.history_id}, user_id={self.user_id}, "
            f"telegram_id={self.telegram_id}, username={self.username}, "
            f"is_current={self.is_current}, change_type={self.change_type}, "
            f"valid_from={self.valid_from})"
        )
