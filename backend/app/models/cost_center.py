"""
Cost Center dimension table model with SCD Type 2.

This module defines the CostCenter model for cost centers (projects, departments,
budget groups) with support for:
- Slowly Changing Dimension Type 2 pattern for historical tracking
- Global cost centers shared across users and user-specific cost centers
"""

from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class CostCenter(SQLModel, table=True):
    """
    Cost Center dimension table with SCD Type 2.

    Cost centers represent budget allocation categories for projects, departments,
    or other organizational units (e.g., "Home Renovation Project", "Marketing Dept").
    Can be user-specific or global (shared across all users).

    Table: t_d_cost_center
    Pattern: SCD Type 2

    Business Key: user_id + name (for uniqueness)

    User-specific Cost Centers:
        - All cost centers are user-specific with required user_id
        - Each user maintains their own set of cost centers

    SCD Type 2 Pattern:
        Each cost center can have multiple versions over time:
        - Only one version has is_current=True
        - valid_from/valid_to define the validity period
        - Historical versions preserved for audit

    Attributes:
        id: Surrogate primary key (auto-generated)
        user_id: Owner user ID (required)
        name: Cost center display name (required, max 255 chars)
        description: Optional description or notes (text field)
        valid_from: Start of validity period for this record
        valid_to: End of validity period (9999-12-31 for current records)
        is_current: Flag indicating if this is the current version
        created_at: Timestamp when record was created
        updated_at: Timestamp when record was last updated

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
        - When updating, create new version and set old version's is_current=False
        - Unique constraint: (user_id, name, is_current) for current records
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
        """String representation of CostCenter model."""
        return (
            f"CostCenter(id={self.id}, name='{self.name}', "
            f"user_id={self.user_id}, is_current={self.is_current})"
        )
