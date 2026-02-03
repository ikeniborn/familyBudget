"""
Article history table model with SCD Type 2 pattern.

This module defines the ArticleHistory model that stores full change history
for Article table with temporal validity (valid_from, valid_to).

All changes to Article table are logged here with metadata about what changed,
when, and who made the change.
"""
from typing import Optional

from datetime import datetime, timezone

from sqlalchemy import ARRAY, DateTime, String
from sqlmodel import Column, Field, SQLModel

# Far future datetime constant for SCD Type 2 valid_to field
# Uses timezone-aware UTC to prevent asyncpg year overflow issues
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


class ArticleHistory(SQLModel, table=True):
    """
    Article history table (SCD Type 2 - full change history).

    Stores all changes to Article table with temporal validity (valid_from, valid_to).
    Each change creates a new version with is_current=True, previous version is closed.

    FK to t_d_article.id (stable) ensures history is linked to correct article.

    Table: t_d_article_history
    Pattern: SCD Type 2 (Slowly Changing Dimension Type 2)

    Architecture Notes:
        - Stores FULL history of all Article table changes
        - FK article_id points to stable t_d_article.id (NOT versioned)
        - Each change: close old version (is_current=False, set valid_to) + create new version
        - Used ONLY for audit and GET /articles/{id}/history endpoint
        - NOT used in regular queries (no JOINs in fact table queries)

    Change Tracking:
        - change_type: Type of change (CREATE/UPDATE/ARCHIVE/RESTORE/HIERARCHY_CHANGE)
        - changed_fields: Array of field names that were changed (['name', 'description'])
        - changed_by_user_id: Who made the change (NULL for automatic changes)

    Indexes:
        - article_id: Fast lookup of history for specific article
        - valid_from: Temporal queries (find version at specific time)
        - is_current: Find current version (should match Article table)
        - name, type: Search history by business key

    Attributes:
        history_id: Surrogate primary key for history records
        article_id: Foreign key to t_d_article.id (stable PK)
        user_id: Owner user ID (snapshot at time of change)
        parent_id: Parent article ID for hierarchy (snapshot at time of change)
        name: Article name snapshot at time of change
        description: Description snapshot at time of change (optional)
        type: Article type snapshot at time of change ('income' or 'expense')
        code: Business code snapshot at time of change (optional)
        is_active: Active status snapshot at time of change
        valid_from: Start of validity period (when change occurred)
        valid_to: End of validity period (9999-12-31 for current version)
        is_current: True for current version (matches Article table)
        change_type: Type of change (CREATE/UPDATE/ARCHIVE/RESTORE/HIERARCHY_CHANGE)
        changed_fields: Array of changed field names (e.g., ['name', 'parent_id'])
        changed_by_user_id: Who made the change (NULL for automatic)
        created_at: When history record was created

    Examples:
        # CREATE change (new article)
        >>> history = ArticleHistory(
        ...     article_id=1,
        ...     user_id=123,
        ...     parent_id=None,
        ...     name="Food",
        ...     type="expense",
        ...     is_active=True,
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="CREATE",
        ...     changed_fields=None  # Initial creation
        ... )

        # UPDATE change (name change)
        >>> # 1. Close old version
        >>> old_history.is_current = False
        >>> old_history.valid_to = datetime.utcnow()
        >>> # 2. Create new version
        >>> new_history = ArticleHistory(
        ...     article_id=1,
        ...     user_id=123,
        ...     parent_id=None,
        ...     name="Food & Drinks",  # Changed
        ...     type="expense",
        ...     is_active=True,
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="UPDATE",
        ...     changed_fields=["name"],  # What changed
        ...     changed_by_user_id=2  # Admin user_id
        ... )

        # ARCHIVE change (is_active = False)
        >>> history = ArticleHistory(
        ...     article_id=1,
        ...     user_id=123,
        ...     parent_id=None,
        ...     name="Food",
        ...     type="expense",
        ...     is_active=False,  # Changed from True
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="ARCHIVE",
        ...     changed_fields=["is_active"],
        ...     changed_by_user_id=2  # Admin user_id
        ... )

        # HIERARCHY_CHANGE (parent_id change)
        >>> history = ArticleHistory(
        ...     article_id=1,
        ...     user_id=123,
        ...     parent_id=5,  # Changed from None
        ...     name="Food",
        ...     type="expense",
        ...     is_active=True,
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="HIERARCHY_CHANGE",
        ...     changed_fields=["parent_id"],
        ...     changed_by_user_id=2  # Admin user_id
        ... )

    Workflow:
        When Article table is updated via ArticleService:
        1. Close old ArticleHistory version (is_current=False, set valid_to)
        2. Update Article table in-place (SCD1)
        3. Create new ArticleHistory version (is_current=True, capture changes)
    """

    __tablename__ = "t_d_article_history"

    # Primary key (surrogate key for history records)
    history_id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key for history table"
    )

    # Foreign key to main Article table (stable PK)
    article_id: int = Field(
        foreign_key="t_d_article.id",
        nullable=False,
        index=True,
        description="Foreign key to t_d_article.id (stable - does NOT change on updates)"
    )

    # Business data snapshot (at the time of change)
    user_id: int = Field(
        foreign_key="t_d_user.id",
        nullable=False,
        index=True,
        description="Owner user ID at time of change (snapshot)"
    )
    parent_id: Optional[int] = Field(
        default=None,
        nullable=True,
        index=True,
        description="Parent article ID at time of change (snapshot for hierarchy tracking)"
    )
    name: str = Field(
        nullable=False,
        max_length=255,
        index=True,
        description="Article name at time of change (snapshot, indexed for search)"
    )
    description: Optional[str] = Field(
        default=None,
        description="Description at time of change (snapshot)"
    )
    type: str = Field(
        nullable=False,
        max_length=20,
        index=True,
        description="Article type at time of change: 'income' or 'expense' (snapshot)"
    )
    code: Optional[str] = Field(
        default=None,
        max_length=50,
        nullable=True,
        description="Business code at time of change (snapshot)"
    )
    is_active: bool = Field(
        nullable=False,
        description="Active status at time of change (snapshot)"
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
        description="True for current version (matches Article table)"
    )

    # Audit fields (metadata about the change)
    change_type: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Type of change: CREATE/UPDATE/ARCHIVE/RESTORE/HIERARCHY_CHANGE"
    )
    changed_fields: Optional[list[str]] = Field(
        sa_column=Column(ARRAY(String)),
        default=None,
        description="Array of field names that were changed (e.g., ['name', 'description'])"
    )
    changed_by_user_id: Optional[int] = Field(
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
        """String representation of ArticleHistory model."""
        return (
            f"ArticleHistory(history_id={self.history_id}, article_id={self.article_id}, "
            f"name='{self.name}', type='{self.type}', "
            f"is_current={self.is_current}, change_type={self.change_type}, "
            f"valid_from={self.valid_from})"
        )
