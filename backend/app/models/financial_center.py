"""
Financial Center dimension table model with SCD Type 1.

This module defines the FinancialCenter model for financial centers (bank accounts,
wallets, cash) with in-place updates (NO versioning). Full change history is stored
in separate FinancialCenterHistory table (SCD Type 2).

IMPORTANT: This is a breaking change from previous SCD Type 2 implementation.
Migration required to convert existing data.

Key features:
- SCD Type 1 (current data only, in-place updates)
- Global financial centers shared across users and user-specific financial centers
- Full change history in FinancialCenterHistory table
"""

from datetime import datetime

from sqlmodel import Field, SQLModel


class FinancialCenter(SQLModel, table=True):
    """
    Financial Center dimension table with SCD Type 1.

    Changes to this table are in-place updates (no versioning).
    Full change history is stored in FinancialCenterHistory table (SCD Type 2).

    Stable PK (id) ensures FK integrity in fact tables (t_f_budget_fact, etc).
    Unlike previous SCD Type 2 implementation, the id field NEVER changes when
    financial center is updated.

    Financial centers represent financial entities where money is stored
    (e.g., "Sberbank Account", "Cash Wallet", "Tinkoff Card").
    Can be user-specific or global (shared across all users).

    Table: t_d_financial_center
    Pattern: SCD Type 1

    Business Key: user_id + name (for uniqueness)

    Shared References Architecture:
        - All financial centers are shared across all users (accessible by everyone)
        - Only administrators can CREATE/UPDATE/DELETE financial centers
        - All users can READ all financial centers
        - user_id tracks the creator for audit trail purposes

    SCD Type 1 Pattern:
        - Main table contains ONLY current financial center data (no historical versions)
        - History is stored in separate t_d_financial_center_history table (SCD Type 2)
        - FK in fact tables (t_f_budget_fact.financial_center_id) remain stable (NO updates needed)
        - Financial center updates (name, code, etc.) are in-place (UPDATE, not INSERT)

    Migration from SCD Type 2:
        Old SCD2 fields REMOVED:
        - valid_from: Replaced by FinancialCenterHistory.valid_from
        - valid_to: Replaced by FinancialCenterHistory.valid_to
        - is_current: Replaced by FinancialCenterHistory.is_current

        Migration Strategy (Phase 2):
        1. Keep only is_current=True version in main table
        2. Move ALL versions to FinancialCenterHistory table
        3. Remap FK in fact tables (old versioned id → new stable id)

    Attributes:
        id: Surrogate primary key (stable - NEVER changes on updates)
        user_id: Owner user ID (required - tracks creator for audit, SCD1 - in-place update)
        name: Financial center display name (required, max 255 chars, SCD1 - in-place update)
        description: Optional description or notes (SCD1 - in-place update)
        code: Business code for external integrations (optional, SCD1 - in-place update)
        is_active: Active flag (True = visible in UI, False = archived, SCD1 - in-place update)
        created_at: Timestamp when record was created (immutable)
        updated_at: Timestamp when record was last updated (auto-updated on changes)

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
        - When updating, use in-place UPDATE (FinancialCenterService will create history record)
        - Unique constraint: (name) for active records
        - Full change history is stored in FinancialCenterHistory table (SCD Type 2)
    """

    __tablename__ = "t_d_financial_center"

    # Primary key
    id: int | None = Field(
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
    description: str | None = Field(
        default=None,
        description="Optional description or notes about the financial center"
    )
    code: str | None = Field(
        default=None,
        max_length=50,
        nullable=True,
        index=True,
        description="Business code for external integrations (e.g., CFO-1, CFO-2). Auto-generated if not provided."
    )

    # Active status flag (archived financial centers functionality)
    is_active: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="Active status flag (True = visible in UI dropdowns, False = archived, SCD1 - in-place update)"
    )

    # Audit fields
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
    # - valid_from: Moved to FinancialCenterHistory table
    # - valid_to: Moved to FinancialCenterHistory table
    # - is_current: Moved to FinancialCenterHistory table
    #
    # Full change history is now stored in separate FinancialCenterHistory table (SCD Type 2)

    def __repr__(self) -> str:
        """String representation of FinancialCenter model."""
        return (
            f"FinancialCenter(id={self.id}, name='{self.name}', "
            f"user_id={self.user_id}, is_active={self.is_active})"
        )
