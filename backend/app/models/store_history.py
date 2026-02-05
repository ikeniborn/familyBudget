"""
Store history table model with SCD Type 2 pattern.

This module defines the StoreHistory model that stores full change history
for Store table with temporal validity (valid_from, valid_to).

All changes to Store table are logged here with metadata about what changed,
when, and who made the change.
"""
from datetime import datetime, timezone

from sqlalchemy import ARRAY, DateTime, String
from sqlmodel import Column, Field, SQLModel

# Far future datetime constant for SCD Type 2 valid_to field
# Uses timezone-aware UTC to prevent asyncpg year overflow issues
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


class StoreHistory(SQLModel, table=True):
    """
    Store history table (SCD Type 2 - full change history).

    Stores all changes to Store table with temporal validity (valid_from, valid_to).
    Each change creates a new version with is_current=True, previous version is closed.

    FK to t_d_store.id (stable) ensures history is linked to correct store.

    Table: t_d_store_history
    Pattern: SCD Type 2 (Slowly Changing Dimension Type 2)

    Architecture Notes:
        - Stores FULL history of all Store table changes
        - FK store_id points to stable t_d_store.id (NOT versioned)
        - Each change: close old version (is_current=False, set valid_to) + create new version
        - Used ONLY for audit and GET /stores/{id}/history endpoint
        - NOT used in regular queries (no JOINs in fact table queries)

    Change Tracking:
        - change_type: Type of change (CREATE/UPDATE/ARCHIVE/RESTORE)
        - changed_fields: Array of field names that were changed (['name', 'address'])
        - changed_by_user_id: Who made the change (NULL for automatic changes)

    Indexes:
        - store_id: Fast lookup of history for specific store
        - valid_from: Temporal queries (find version at specific time)
        - is_current: Find current version (should match Store table)
        - name: Search history by business key

    Attributes:
        history_id: Surrogate primary key for history records
        store_id: Foreign key to t_d_store.id (stable PK)
        creator_id: Creator user ID (snapshot at time of change)
        name: Store name snapshot at time of change
        address: Address snapshot at time of change (optional)
        description: Description snapshot at time of change (optional)
        code: Business code snapshot at time of change (optional)
        is_active: Active status snapshot at time of change
        valid_from: Start of validity period (when change occurred)
        valid_to: End of validity period (9999-12-31 for current version)
        is_current: True for current version (matches Store table)
        change_type: Type of change (CREATE/UPDATE/ARCHIVE/RESTORE)
        changed_fields: Array of changed field names (e.g., ['name', 'address'])
        changed_by_user_id: Who made the change (NULL for automatic)
        created_at: When history record was created

    Examples:
        # CREATE change (new store)
        >>> history = StoreHistory(
        ...     store_id=1,
        ...     creator_id=123,
        ...     name="Walmart",
        ...     address="123 Main St",
        ...     is_active=True,
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="CREATE",
        ...     changed_fields=None  # Initial creation
        ... )

        # UPDATE change (address change)
        >>> # 1. Close old version
        >>> old_history.is_current = False
        >>> old_history.valid_to = datetime.utcnow()
        >>> # 2. Create new version
        >>> new_history = StoreHistory(
        ...     store_id=1,
        ...     creator_id=123,
        ...     name="Walmart",
        ...     address="456 New St",  # Changed
        ...     is_active=True,
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="UPDATE",
        ...     changed_fields=["address"],
        ...     changed_by_user_id=456
        ... )

    Notes:
        - valid_to = 9999-12-31 23:59:59 UTC for current version
        - Only ONE record per store_id should have is_current=True
        - change_type values: CREATE, UPDATE, ARCHIVE, RESTORE
        - changed_fields is NULL for CREATE (nothing changed yet)
    """

    __tablename__ = "t_d_store_history"

    # Primary key
    history_id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key for history records"
    )

    # Foreign key to main table (stable)
    store_id: int = Field(
        foreign_key="t_d_store.id",
        index=True,
        nullable=False,
        description="Foreign key to t_d_store.id (stable PK)"
    )

    # Snapshot of Store fields at time of change
    creator_id: int = Field(
        nullable=False,
        index=True,
        description="Creator user ID (snapshot at time of change)"
    )
    name: str = Field(
        nullable=False,
        max_length=255,
        index=True,
        description="Store name snapshot at time of change"
    )
    address: str | None = Field(
        default=None,
        description="Address snapshot at time of change"
    )
    description: str | None = Field(
        default=None,
        description="Description snapshot at time of change"
    )
    code: str | None = Field(
        default=None,
        max_length=50,
        description="Business code snapshot at time of change"
    )
    is_active: bool = Field(
        nullable=False,
        description="Active status snapshot at time of change"
    )

    # SCD Type 2 fields
    valid_from: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
        description="Start of validity period (when change occurred)"
    )
    valid_to: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=FAR_FUTURE_DATETIME),
        description="End of validity period (9999-12-31 for current version)"
    )
    is_current: bool = Field(
        nullable=False,
        index=True,
        description="True for current version (matches Store table)"
    )

    # Change tracking metadata
    change_type: str = Field(
        nullable=False,
        max_length=50,
        description="Type of change: CREATE, UPDATE, ARCHIVE, RESTORE"
    )
    changed_fields: list[str] | None = Field(
        default=None,
        sa_column=Column(ARRAY(String), nullable=True),
        description="Array of changed field names (e.g., ['name', 'address']). NULL for CREATE."
    )
    changed_by_user_id: int | None = Field(
        default=None,
        description="Who made the change (NULL for automatic changes)"
    )

    # Audit field
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="When history record was created"
    )

    def __repr__(self) -> str:
        """String representation of StoreHistory model."""
        return (
            f"StoreHistory(history_id={self.history_id}, store_id={self.store_id}, "
            f"name='{self.name}', change_type='{self.change_type}', "
            f"is_current={self.is_current})"
        )
