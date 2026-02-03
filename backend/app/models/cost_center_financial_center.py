"""
CostCenter to FinancialCenter linking table (many-to-many).

Simple linking table (no SCD Type 2 needed - just current links).
Implements "whitelist" pattern:
- No entries = available for ALL financial centers
- Has entries = available ONLY for listed financial centers

This model enables filtering of cost centers based on selected financial center
when creating new transactions.
"""

from datetime import datetime

from sqlmodel import Field, SQLModel


class CostCenterFinancialCenter(SQLModel, table=True):
    """
    Linking table between CostCenter and FinancialCenter.

    Table: t_cost_center_financial_center
    Pattern: Simple linking (no SCD2)

    Business Rules:
    - No links = cost center available for ALL financial centers
    - Has links = cost center available ONLY for linked financial centers

    Usage:
    - When creating a transaction, filter cost centers by selected financial center
    - Cost centers without any links pass the filter (available for all)
    - Cost centers with links must match the selected financial center

    Attributes:
        id: Surrogate primary key
        cost_center_id: FK to t_d_cost_center
        financial_center_id: FK to t_d_financial_center
        created_at: Timestamp when link was created
    """

    __tablename__ = "t_cost_center_financial_center"

    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    cost_center_id: int = Field(
        foreign_key="t_d_cost_center.id",
        index=True,
        nullable=False,
        description="FK to cost center"
    )

    financial_center_id: int = Field(
        foreign_key="t_d_financial_center.id",
        index=True,
        nullable=False,
        description="FK to financial center"
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Link creation timestamp"
    )
