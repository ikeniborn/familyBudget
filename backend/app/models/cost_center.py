"""
Cost Center dimension table model with SCD Type 1.

This module defines the CostCenter model for cost centers (projects, departments,
budget groups) with in-place updates (NO versioning). Full change history is stored
in separate CostCenterHistory table (SCD Type 2).

IMPORTANT: This is a breaking change from previous SCD Type 2 implementation.
Migration required to convert existing data.

Key features:
- SCD Type 1 (current data only, in-place updates)
- Global cost centers shared across users and user-specific cost centers
- Full change history in CostCenterHistory table
"""
from typing import Optional

from datetime import datetime

from sqlmodel import Field, SQLModel


class CostCenter(SQLModel, table=True):
    """
    Cost Center dimension table with SCD Type 1.

    Changes to this table are in-place updates (no versioning).
    Full change history is stored in CostCenterHistory table (SCD Type 2).

    Stable PK (id) ensures FK integrity in fact tables (t_f_budget_fact, etc).
    Unlike previous SCD Type 2 implementation, the id field NEVER changes when
    cost center is updated.

    Cost centers represent budget allocation categories for projects, departments,
    or other organizational units (e.g., "Home Renovation Project", "Marketing Dept").
    Can be user-specific or global (shared across all users).

    Table: t_d_cost_center
    Pattern: SCD Type 1

    Business Key: user_id + name (for uniqueness)

    Shared References Architecture:
        - All cost centers are shared across all users (accessible by everyone)
        - Only administrators can CREATE/UPDATE/DELETE cost centers
        - All users can READ all cost centers
        - user_id tracks the creator for audit trail purposes

    SCD Type 1 Pattern:
        - Main table contains ONLY current cost center data (no historical versions)
        - History is stored in separate t_d_cost_center_history table (SCD Type 2)
        - FK in fact tables (t_f_budget_fact.cost_center_id) remain stable (NO updates needed)
        - Cost center updates (name, code, etc.) are in-place (UPDATE, not INSERT)

    Migration from SCD Type 2:
        Old SCD2 fields REMOVED:
        - valid_from: Replaced by CostCenterHistory.valid_from
        - valid_to: Replaced by CostCenterHistory.valid_to
        - is_current: Replaced by CostCenterHistory.is_current

        Migration Strategy (Phase 2):
        1. Keep only is_current=True version in main table
        2. Move ALL versions to CostCenterHistory table
        3. Remap FK in fact tables (old versioned id → new stable id)

    Attributes:
        id: Surrogate primary key (stable - NEVER changes on updates)
        user_id: Owner user ID (required - tracks creator for audit, SCD1 - in-place update)
        name: Cost center display name (required, max 255 chars, SCD1 - in-place update)
        description: Optional description or notes (SCD1 - in-place update)
        code: Business code for external integrations (optional, SCD1 - in-place update)
        is_active: Active flag (True = visible in UI, False = archived, SCD1 - in-place update)
        created_at: Timestamp when record was created (immutable)
        updated_at: Timestamp when record was last updated (auto-updated on changes)

    Examples:
        # Home expenses cost center
        >>> cc = CostCenter(
        ...     user_id=123,
        ...     name="Home Expenses",
        ...     description="General home budget project"
        ... )

        # Vacation project cost center
        >>> vacation = CostCenter(
        ...     user_id=123,
        ...     name="Summer Vacation 2025",
        ...     description="Vacation trip to Europe"
        ... )

    Notes:
        - All cost centers must have user_id (required field)
        - When updating, use in-place UPDATE (CostCenterService will create history record)
        - Unique constraint: (name) for active records
        - Full change history is stored in CostCenterHistory table (SCD Type 2)
    """

    __tablename__ = "t_d_cost_center"

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
        description="Owner user ID (required - all cost centers are user-specific)"
    )

    # Business keys and attributes
    name: str = Field(
        nullable=False,
        max_length=255,
        description="Cost center display name"
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes about the cost center"
    )
    code: Optional[str] = Field(
        default=None,
        max_length=50,
        nullable=True,
        index=True,
        description="Business code for external integrations (e.g., MVZ-1, MVZ-2). Auto-generated if not provided."
    )

    # Active status flag (archived cost centers functionality)
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
    # - valid_from: Moved to CostCenterHistory table
    # - valid_to: Moved to CostCenterHistory table
    # - is_current: Moved to CostCenterHistory table
    #
    # Full change history is now stored in separate CostCenterHistory table (SCD Type 2)

    def __repr__(self) -> str:
        """String representation of CostCenter model."""
        return (
            f"CostCenter(id={self.id}, name='{self.name}', "
            f"user_id={self.user_id}, is_active={self.is_active})"
        )
