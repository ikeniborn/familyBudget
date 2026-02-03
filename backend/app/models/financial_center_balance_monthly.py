"""
Monthly aggregated balances for Financial Centers (optimization table).

This module defines the FinancialCenterBalanceMonthly model for storing
pre-calculated monthly balances to optimize balance queries.

Instead of scanning all transactions from the beginning of time,
we store the closing balance for each month/financial center combination.

Key features:
- Stores closing balance for each month (last day of month)
- Optimizes Opening Balance queries (no need to scan all history)
- Updated monthly or on-demand
- Unique constraint on (financial_center_id, year, month)
"""
from typing import Optional

from datetime import datetime
from decimal import Decimal

from sqlmodel import Field, Index, SQLModel


class FinancialCenterBalanceMonthly(SQLModel, table=True):
    """
    Monthly aggregated balances for Financial Centers.

    This table stores pre-calculated closing balances for each financial center
    at the end of each month. It serves as an optimization layer to avoid
    scanning all historical transactions when calculating current balances.

    Logic:
        Opening Balance for Month N = Closing Balance for Month N-1
        Current Balance for Month N = Opening Balance + Month Movements

    Table: t_agg_financial_center_balance_monthly
    Pattern: Aggregation table (updated monthly or on-demand)

    Business Key: (financial_center_id, year, month)

    Update Strategy:
        - Manual: Call refresh_monthly_balances() after end of month
        - Auto: Scheduled job (e.g., first day of new month)
        - On-demand: Lazy calculation if aggregate missing

    Attributes:
        id: Surrogate primary key
        financial_center_id: Reference to financial center
        year: Year (YYYY, e.g., 2025)
        month: Month (1-12)
        closing_balance: Balance at end of month (cumulative from all time)
        transaction_count: Number of transactions in this month (for verification)
        created_at: When this aggregate was calculated
        updated_at: Last update timestamp

    Examples:
        # Balance for Tinkoff account at end of November 2025
        >>> balance = FinancialCenterBalanceMonthly(
        ...     financial_center_id=1,
        ...     year=2025,
        ...     month=11,
        ...     closing_balance=150000.00,
        ...     transaction_count=45
        ... )

        # Query opening balance for December 2025
        >>> nov_balance = session.exec(
        ...     select(FinancialCenterBalanceMonthly)
        ...     .where(
        ...         FinancialCenterBalanceMonthly.financial_center_id == 1,
        ...         FinancialCenterBalanceMonthly.year == 2025,
        ...         FinancialCenterBalanceMonthly.month == 11
        ...     )
        ... ).first()
        >>> opening_balance_dec = nov_balance.closing_balance if nov_balance else 0.0

    Notes:
        - Unique constraint ensures one record per financial_center/year/month
        - closing_balance is cumulative (includes ALL transactions from beginning)
        - For current month, use aggregate + movements since start of month
        - If aggregate missing, fall back to full calculation
    """

    __tablename__ = "t_agg_financial_center_balance_monthly"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign keys
    financial_center_id: int = Field(
        foreign_key="t_d_financial_center.id",
        nullable=False,
        index=True,
        description="Reference to financial center"
    )

    # Period identifiers
    year: int = Field(
        nullable=False,
        index=True,
        description="Year (YYYY, e.g., 2025)"
    )
    month: int = Field(
        nullable=False,
        index=True,
        description="Month (1-12)"
    )

    # Aggregated values
    closing_balance: Decimal = Field(
        default=Decimal("0.00"),
        nullable=False,
        max_digits=15,
        decimal_places=2,
        description="Cumulative balance at end of month (all transactions from beginning of time)"
    )
    transaction_count: int = Field(
        default=0,
        nullable=False,
        description="Number of transactions in this month (for verification)"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="When this aggregate was calculated"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Last update timestamp"
    )

    # Indexes
    __table_args__ = (
        # Unique constraint for business key
        Index(
            "ix_fcb_monthly_unique",
            "financial_center_id",
            "year",
            "month",
            unique=True
        ),
        # Composite index for queries by period
        Index(
            "ix_fcb_monthly_period",
            "year",
            "month"
        ),
    )

    def __repr__(self) -> str:
        """String representation of FinancialCenterBalanceMonthly model."""
        return (
            f"FinancialCenterBalanceMonthly(id={self.id}, "
            f"financial_center_id={self.financial_center_id}, "
            f"year={self.year}, month={self.month}, "
            f"closing_balance={self.closing_balance})"
        )
