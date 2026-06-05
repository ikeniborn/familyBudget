"""
Budget Fact Model

Defines the fact table for budget transactions in a star schema architecture.
This table stores actual income/expense transactions with references to dimension tables.

Pattern: Fact table (partitioned by month at DB level)
Table: t_f_budget_fact
"""
from datetime import date, datetime

from sqlalchemy import BigInteger, Column
from sqlmodel import Field, SQLModel


class BudgetFact(SQLModel, table=True):
    """
    Budget fact table for income/expense transactions.

    Stores actual budget transactions (facts) with references to dimensions.
    This is a fact table in a star schema - it doesn't use SCD2.

    Foreign keys capture the dimension IDs at the time of transaction,
    allowing historical analysis even if dimension records change.

    Table: t_f_budget_fact
    Pattern: Fact table (partitioned by month at DB level)

    Note: Table is partitioned by fact_date (monthly) at the database level
    for improved query performance and data management.

    Examples:
        # Expense transaction
        >>> fact = BudgetFact(
        ...     user_id=123,
        ...     article_id=45,
        ...     fact_date=date(2025, 10, 9),
        ...     amount=Decimal("50.75"),
        ...     description="Weekly groceries at supermarket"
        ... )

        # Income transaction
        >>> fact = BudgetFact(
        ...     user_id=123,
        ...     article_id=10,
        ...     fact_date=date(2025, 10, 1),
        ...     amount=Decimal("3000.00"),
        ...     description="October salary"
        ... )
    """

    __tablename__ = "t_f_budget_fact"

    # Primary key
    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Auto-incrementing primary key (BIGSERIAL in PostgreSQL)"
    )

    # Foreign keys to dimensions (required)
    user_id: int = Field(
        nullable=False,
        foreign_key="t_d_user.id",
        index=True,
        description="User who created this transaction"
    )

    article_id: int = Field(
        nullable=False,
        foreign_key="t_d_article.id",
        index=True,
        description="Budget category/article for this transaction"
    )

    # Optional foreign keys to additional dimensions
    financial_center_id: int | None = Field(
        default=None,
        foreign_key="t_d_financial_center.id",
        description="Financial center (optional dimension for advanced budgeting)"
    )

    cost_center_id: int | None = Field(
        default=None,
        foreign_key="t_d_cost_center.id",
        description="Cost center (optional dimension for advanced budgeting)"
    )

    # Fact attributes
    fact_date: date = Field(
        nullable=False,
        index=True,
        description="Date of transaction (used for partitioning and time-based queries)"
    )

    amount: int = Field(
        sa_column=Column(BigInteger(), nullable=False),
        description="Transaction amount in rubles (integer, always positive; sign determined by article_type)"
    )

    description: str | None = Field(
        default=None,
        max_length=None,  # TEXT field in PostgreSQL
        description="Optional transaction description/notes"
    )

    record_type: str = Field(
        default="fact",
        max_length=10,
        nullable=False,
        description="Record type: 'fact' for actual transactions, 'plan' for budget plans"
    )

    # Transfer support
    transfer_id: int | None = Field(
        default=None,
        nullable=True,
        description="Links paired expense/income transactions for transfers between financial centers"
    )

    # Recurring plan support (no FK due to partitioning)
    recurring_plan_id: int | None = Field(
        default=None,
        nullable=True,
        index=True,
        description="Reference to recurring plan template (t_d_recurring_plan.id)"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when record was created"
    )

    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when record was last updated"
    )

    def __repr__(self) -> str:
        """
        String representation for debugging.

        Uses __dict__ to avoid DetachedInstanceError when object is not bound to session.
        This is important for logging middleware that may try to repr() detached objects.
        """
        try:
            # Try normal attribute access first (works if object is attached to session)
            return (
                f"BudgetFact("
                f"id={self.id}, "
                f"user_id={self.user_id}, "
                f"article_id={self.article_id}, "
                f"fact_date={self.fact_date}, "
                f"amount={self.amount}, "
                f"record_type={self.record_type}"
                f")"
            )
        except Exception:
            # Fallback to __dict__ if object is detached from session
            d = self.__dict__
            return (
                f"BudgetFact("
                f"id={d.get('id', '?')}, "
                f"user_id={d.get('user_id', '?')}, "
                f"article_id={d.get('article_id', '?')}, "
                f"fact_date={d.get('fact_date', '?')}, "
                f"amount={d.get('amount', '?')}, "
                f"record_type={d.get('record_type', '?')}"
                f")"
            )


# Backward compatibility alias for old tests
Fact = BudgetFact
