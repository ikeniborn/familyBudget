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

    Business Key: user_id + code (for user cost centers) or code (for global)

    Global vs User Cost Centers:
        - Global cost centers (is_global=True): Shared across all users, user_id=NULL
        - User cost centers (is_global=False): Specific to a user, user_id=<user_id>

    SCD Type 2 Pattern:
        Each cost center can have multiple versions over time:
        - Only one version has is_current=True
        - valid_from/valid_to define the validity period
        - Historical versions preserved for audit

    Attributes:
        id: Surrogate primary key (auto-generated)
        user_id: Owner user ID (NULL for global cost centers)
        code: Business key for the cost center (optional, max 50 chars)
        name: Cost center display name (required, max 255 chars)
        description: Optional description or notes (text field)
        is_global: Flag indicating if cost center is shared across all users
        valid_from: Start of validity period for this record
        valid_to: End of validity period (9999-12-31 for current records)
        is_current: Flag indicating if this is the current version
        created_at: Timestamp when record was created
        updated_at: Timestamp when record was last updated

    Examples:
        # Global cost center (shared across users)
        >>> cc = CostCenter(
        ...     code="PROJ_HOME",
        ...     name="Home Expenses",
        ...     description="General home budget project",
        ...     is_global=True
        ... )

        # User-specific cost center
        >>> vacation = CostCenter(
        ...     user_id=123,
        ...     name="Summer Vacation 2025",
        ...     description="Vacation trip to Europe",
        ...     is_global=False
        ... )

    Notes:
        - Global cost centers (is_global=True) must have user_id=NULL
        - User cost centers (is_global=False) must have user_id set
        - When updating, create new version and set old version's is_current=False
        - code is required for global cost centers
    """

    __tablename__ = "t_d_cost_center"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign keys
    user_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_user.id",
        index=True,
        description="Owner user ID (NULL for global cost centers)"
    )

    # Business keys and attributes
    code: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Business key for cost center identification"
    )
    name: str = Field(
        nullable=False,
        max_length=255,
        description="Cost center display name"
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes about the cost center"
    )
    is_global: bool = Field(
        default=False,
        nullable=False,
        description="Global cost centers are shared across all users (user_id must be NULL)"
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
            f"user_id={self.user_id}, is_global={self.is_global}, "
            f"is_current={self.is_current})"
        )
