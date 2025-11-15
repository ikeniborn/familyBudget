"""
Financial Center dimension table model with SCD Type 2.

This module defines the FinancialCenter model for financial centers (bank accounts,
wallets, cash) with support for:
- Slowly Changing Dimension Type 2 pattern for historical tracking
- Global financial centers shared across users and user-specific financial centers
"""

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class FinancialCenter(SQLModel, table=True):
    """
    Financial Center dimension table with SCD Type 2.

    Financial centers represent financial entities where money is stored
    (e.g., "Sberbank Account", "Cash Wallet", "Tinkoff Card").
    Can be user-specific or global (shared across all users).

    Table: t_d_financial_center
    Pattern: SCD Type 2

    Business Key: user_id + name (for uniqueness)

    Shared References Architecture:
        - All financial centers are shared across all users (accessible by everyone)
        - Only administrators can CREATE/UPDATE/DELETE financial centers
        - All users can READ all financial centers
        - user_id tracks the creator for audit trail purposes

    SCD Type 2 Pattern:
        Each financial center can have multiple versions over time:
        - Only one version has is_current=True
        - valid_from/valid_to define the validity period
        - Historical versions preserved for audit

    Attributes:
        id: Surrogate primary key (auto-generated)
        user_id: Owner user ID (required - tracks creator for audit)
        name: Financial center display name (required, max 255 chars)
        description: Optional description or notes (text field)
        code: Business code for external integrations (optional, auto-generated as CFO-1, CFO-2, ...)
        valid_from: Start of validity period for this record
        valid_to: End of validity period (9999-12-31 for current records)
        is_current: Flag indicating if this is the current version
        created_at: Timestamp when record was created
        updated_at: Timestamp when record was last updated

    Examples:
        # Bank account
        >>> fc = FinancialCenter(
        ...     user_id=123,
        ...     name="Sberbank",
        ...     description="Main Sberbank account"
        ... )

        # Cash wallet
        >>> cash = FinancialCenter(
        ...     user_id=123,
        ...     name="Cash Wallet",
        ...     description="Physical cash"
        ... )

    Notes:
        - All financial centers must have user_id (required field)
        - When updating, create new version and set old version's is_current=False
        - Unique constraint: (name, is_current) for current records
    """

    __tablename__ = "t_d_financial_center"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign keys
    user_id: int = Field(
        foreign_key="t_d_user.id",
        index=True,
        nullable=False,
        description="Owner user ID (required - all financial centers are user-specific)"
    )

    # Business keys and attributes
    name: str = Field(
        nullable=False,
        max_length=255,
        description="Financial center display name"
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes about the financial center"
    )
    code: Optional[str] = Field(
        default=None,
        max_length=50,
        nullable=True,
        index=True,
        description="Business code for external integrations (e.g., CFO-1, CFO-2). Auto-generated if not provided."
    )

    # SCD Type 2 fields
    valid_from: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Start of validity period"
    )
    valid_to: Optional[datetime] = Field(
        default=datetime(9999, 12, 31, 23, 59, 59),
        nullable=True,
        description="End of validity period (9999-12-31 for current)"
    )
    is_current: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="Current version flag"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record creation timestamp"
    )
    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Record last update timestamp"
    )

    def __repr__(self) -> str:
        """String representation of FinancialCenter model."""
        return (
            f"FinancialCenter(id={self.id}, name='{self.name}', "
            f"user_id={self.user_id}, is_current={self.is_current})"
        )
