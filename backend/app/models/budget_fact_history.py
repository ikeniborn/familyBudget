"""
Budget Fact history table model with SCD Type 2 pattern.

This module defines the BudgetFactHistory model that stores full change history
for BudgetFact table with temporal validity (valid_from, valid_to).

All changes to BudgetFact table are logged here with metadata about what changed,
when, and who made the change. This includes CASCADE DELETIONS when dimension
records (articles, financial centers, cost centers) are deleted.
"""
from datetime import date, datetime, timezone

from sqlalchemy import ARRAY, BigInteger, DateTime, String
from sqlmodel import Column, Field, SQLModel

# Far future datetime constant for SCD Type 2 valid_to field
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


class BudgetFactHistory(SQLModel, table=True):
    """
    Budget Fact history table (SCD Type 2 - full change history).

    Stores all changes to BudgetFact table with temporal validity (valid_from, valid_to).
    Each change creates a new version with is_current=True, previous version is closed.

    Note: No foreign key constraint on fact_id because t_f_budget_fact is partitioned
    with composite PK (id, fact_date), and history must persist after fact deletion.
    Referential integrity is enforced at application level.

    Table: t_f_budget_fact_history
    Pattern: SCD Type 2 (Slowly Changing Dimension Type 2)

    Architecture Notes:
        - Stores FULL history of all BudgetFact table changes
        - fact_id references t_f_budget_fact.id (stable, NOT versioned) without FK constraint
        - Each change: close old version (is_current=False, set valid_to) + create new version
        - Used ONLY for audit and GET /facts/{id}/history endpoint
        - NOT used in regular queries (no JOINs in analytics queries)

    Change Tracking:
        - change_type: Type of change (CREATE/UPDATE/DELETE)
        - changed_fields: Array of field names that were changed (['amount', 'description'])
        - changed_by_user_id: Who made the change (NULL for automatic changes)
        - cascade_delete_source: For DELETE records - what triggered cascade deletion
          (e.g., "article_id:123", "financial_center_id:45", "cost_center_id:67")

    Cascade Deletion Tracking:
        When dimension records (articles, financial centers, cost centers) are deleted,
        ALL related facts are physically deleted. Before deletion, a DELETE history
        record is created with:
        - change_type="DELETE"
        - cascade_delete_source="article_id:123" (example)
        This preserves audit trail for cascade-deleted facts.

    Indexes:
        - fact_id: Fast lookup of history for specific fact
        - valid_from: Temporal queries (find version at specific time)
        - is_current: Find current version (should match BudgetFact table)
        - user_id: Filter by user
        - article_id: Filter by article
        - fact_date: Time-based queries

    Attributes:
        history_id: Surrogate primary key for history records
        fact_id: Reference to t_f_budget_fact.id (stable PK, no FK constraint)
        user_id: User snapshot at time of change
        article_id: Article snapshot at time of change
        financial_center_id: Financial center snapshot (optional)
        cost_center_id: Cost center snapshot (optional)
        fact_date: Transaction date snapshot
        amount: Amount snapshot
        description: Description snapshot
        record_type: Record type snapshot ('fact' or 'plan')
        transfer_id: Transfer ID snapshot (optional)
        valid_from: Start of validity period (when change occurred)
        valid_to: End of validity period (9999-12-31 for current version)
        is_current: True for current version (matches BudgetFact table)
        change_type: Type of change (CREATE/UPDATE/DELETE)
        changed_fields: Array of changed field names (e.g., ['amount', 'description'])
        changed_by_user_id: Who made the change (NULL for automatic)
        cascade_delete_source: What triggered cascade deletion (for DELETE records)
        created_at: When history record was created

    Examples:
        # CREATE change (new fact)
        >>> history = BudgetFactHistory(
        ...     fact_id=1,
        ...     user_id=123,
        ...     article_id=45,
        ...     fact_date=date(2025, 11, 27),
        ...     amount=Decimal("50.75"),
        ...     description="Groceries",
        ...     record_type="fact",
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="CREATE",
        ...     changed_fields=None  # Initial creation
        ... )

        # UPDATE change (amount changed)
        >>> # 1. Close old version
        >>> old_history.is_current = False
        >>> old_history.valid_to = datetime.utcnow()
        >>>
        >>> # 2. Create new version
        >>> new_history = BudgetFactHistory(
        ...     fact_id=1,
        ...     user_id=123,
        ...     article_id=45,
        ...     fact_date=date(2025, 11, 27),
        ...     amount=Decimal("55.00"),  # Changed
        ...     description="Groceries",
        ...     record_type="fact",
        ...     valid_from=datetime.utcnow(),
        ...     is_current=True,
        ...     change_type="UPDATE",
        ...     changed_fields=["amount"],
        ...     changed_by_user_id=123
        ... )

        # DELETE change (cascade deletion when article deleted)
        >>> delete_history = BudgetFactHistory(
        ...     fact_id=1,
        ...     user_id=123,
        ...     article_id=45,
        ...     fact_date=date(2025, 11, 27),
        ...     amount=Decimal("50.75"),
        ...     description="Groceries",
        ...     record_type="fact",
        ...     valid_from=datetime.utcnow(),
        ...     is_current=False,  # Deleted records are never current
        ...     change_type="DELETE",
        ...     changed_fields=None,  # Full deletion
        ...     changed_by_user_id=999,  # Admin who deleted article
        ...     cascade_delete_source="article_id:45"  # What triggered deletion
        ... )

    Notes:
        - History is NEVER deleted (permanent audit trail)
        - Cascade deletions are tracked via cascade_delete_source field
        - Use BudgetFactHistory for analytics on deleted transactions
        - Partitioning: Consider partitioning by fact_date if volume is high
    """

    __tablename__ = "t_f_budget_fact_history"

    # Primary key
    history_id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key for history records"
    )

    # Reference to fact table (stable ID)
    # Note: No foreign key constraint because:
    # 1. t_f_budget_fact is partitioned with composite PK (id, fact_date)
    # 2. History should persist even after fact deletion (audit trail)
    # 3. Referential integrity is enforced at application level
    fact_id: int = Field(
        index=True,
        nullable=False,
        description="Reference to t_f_budget_fact.id (stable PK)"
    )

    # Snapshot of fact attributes at time of change
    user_id: int = Field(
        nullable=False,
        index=True,
        description="User ID snapshot"
    )

    article_id: int = Field(
        nullable=False,
        index=True,
        description="Article ID snapshot"
    )

    financial_center_id: int | None = Field(
        default=None,
        description="Financial center ID snapshot (optional)"
    )

    cost_center_id: int | None = Field(
        default=None,
        description="Cost center ID snapshot (optional)"
    )

    fact_date: date = Field(
        nullable=False,
        index=True,
        description="Transaction date snapshot"
    )

    amount: int = Field(
        sa_column=Column(BigInteger(), nullable=False),
        description="Amount snapshot (rubles, integer)"
    )

    description: str | None = Field(
        default=None,
        max_length=None,
        description="Description snapshot"
    )

    record_type: str = Field(
        nullable=False,
        max_length=10,
        description="Record type snapshot ('fact' or 'plan')"
    )

    transfer_id: int | None = Field(
        default=None,
        description="Transfer ID snapshot (optional)"
    )

    # Offline sync flag
    is_offline_sync: bool = Field(
        default=False,
        nullable=False,
        description="Offline sync flag snapshot"
    )

    # SCD Type 2 fields
    valid_from: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
        description="Start of validity period"
    )

    valid_to: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
        default_factory=lambda: FAR_FUTURE_DATETIME,
        description="End of validity period (9999-12-31 for current version)"
    )

    is_current: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="True for current version"
    )

    # Change tracking
    change_type: str = Field(
        nullable=False,
        max_length=20,
        description="Type of change: CREATE, UPDATE, DELETE"
    )

    changed_fields: list[str] | None = Field(
        default=None,
        sa_column=Column(ARRAY(String)),
        description="List of changed field names (NULL for CREATE/DELETE)"
    )

    changed_by_user_id: int | None = Field(
        default=None,
        description="User who made the change (NULL for automatic changes)"
    )

    cascade_delete_source: str | None = Field(
        default=None,
        max_length=100,
        description="What triggered cascade deletion (e.g., 'article_id:123')"
    )

    # Audit field
    created_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False),
        default_factory=lambda: datetime.now(timezone.utc),
        description="When history record was created"
    )

    def __repr__(self) -> str:
        """String representation of BudgetFactHistory model."""
        return (
            f"BudgetFactHistory(history_id={self.history_id}, "
            f"fact_id={self.fact_id}, "
            f"change_type='{self.change_type}', "
            f"is_current={self.is_current}, "
            f"cascade_delete_source='{self.cascade_delete_source}')"
        )
