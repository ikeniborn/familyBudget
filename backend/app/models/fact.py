"""
Budget Fact Model

Defines the fact table for budget transactions in a star schema architecture.
This table stores actual income/expense transactions with references to dimension tables.

Pattern: Fact table (partitioned by month at DB level)
Table: t_f_budget_fact
"""

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

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
    id: Optional[int] = Field(
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
    financial_center_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_financial_center.id",
        description="Financial center (optional dimension for advanced budgeting)"
    )

    cost_center_id: Optional[int] = Field(
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

    amount: Decimal = Field(
        nullable=False,
        max_digits=15,
        decimal_places=2,
        description="Transaction amount with sign: positive for income, negative for expense"
    )

    description: Optional[str] = Field(
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
        """String representation for debugging."""
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
