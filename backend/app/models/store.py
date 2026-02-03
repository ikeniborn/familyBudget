"""
Store dimension table model with SCD Type 1.

This module defines the Store model for shopping locations (supermarkets, shops, etc.).
Full change history is stored in separate StoreHistory table (SCD Type 2).

Key features:
- SCD Type 1 (current data only, in-place updates)
- Shared across all users (admin-managed)
- Full change history in StoreHistory table
"""
from typing import Optional

from datetime import datetime

from sqlmodel import Field, SQLModel


class Store(SQLModel, table=True):
    """
    Store dimension table with SCD Type 1.

    Changes to this table are in-place updates (no versioning).
    Full change history is stored in StoreHistory table (SCD Type 2).

    Stable PK (id) ensures FK integrity in fact tables (t_f_shopping_list_item).

    Stores represent shopping locations (e.g., "Walmart", "Costco", "Local Bakery").
    Shared across all users - only administrators can CREATE/UPDATE/DELETE.
    All users can READ all stores.

    Table: t_d_store
    Pattern: SCD Type 1 (current data only)

    Business Key: name (for uniqueness)

    Shared References Architecture:
        - All stores are shared across all users (accessible by everyone)
        - Only administrators can CREATE/UPDATE/DELETE stores
        - All users can READ all stores
        - creator_id tracks the creator for audit trail purposes

    SCD Type 1 Pattern:
        - Main table contains ONLY current store data (no historical versions)
        - History is stored in separate t_d_store_history table (SCD Type 2)
        - FK in fact tables (t_f_shopping_list_item.store_id) remain stable
        - Store updates (name, address, etc.) are in-place (UPDATE, not INSERT)

    Attributes:
        id: Surrogate primary key (stable - NEVER changes on updates)
        creator_id: Creator user ID (required - tracks creator for audit, SCD1)
        name: Store display name (required, max 255 chars, SCD1 - in-place update)
        address: Physical address (optional, SCD1 - in-place update)
        description: Optional description or notes (SCD1 - in-place update)
        code: Business code for external integrations (optional, SCD1 - in-place update)
        is_active: Active flag (True = visible in UI, False = archived, SCD1)
        created_at: Timestamp when record was created (immutable)
        updated_at: Timestamp when record was last updated (auto-updated on changes)

    Examples:
        # Store creation
        >>> store = Store(
        ...     creator_id=123,
        ...     name="Walmart",
        ...     address="123 Main St, City, State 12345"
        ... )

        # Update store in-place (SCD Type 1)
        >>> store.address = "456 New St, City, State 12345"
        >>> await session.commit()  # UPDATE, not INSERT

    Notes:
        - Only administrators can manage stores (checked at API level)
        - All users can view all stores (no filtering by creator_id)
        - Unique constraint: name (case-insensitive)
        - Full change history is stored in StoreHistory table (SCD Type 2)
    """

    __tablename__ = "t_d_store"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign keys
    creator_id: int = Field(
        foreign_key="t_d_user.id",
        index=True,
        nullable=False,
        description="Creator user ID (required - tracks creator for audit trail)"
    )

    # Business keys and attributes
    name: str = Field(
        nullable=False,
        max_length=255,
        index=True,
        description="Store display name (unique)"
    )
    address: Optional[str] = Field(
        default=None,
        description="Physical address of the store"
    )
    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes about the store"
    )
    code: Optional[str] = Field(
        default=None,
        max_length=50,
        nullable=True,
        index=True,
        description="Business code for external integrations (e.g., STORE-1, STORE-2). Auto-generated if not provided."
    )

    # Active status flag (archived stores functionality)
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

    def __repr__(self) -> str:
        """String representation of Store model."""
        return (
            f"Store(id={self.id}, name='{self.name}', "
            f"creator_id={self.creator_id}, is_active={self.is_active})"
        )
