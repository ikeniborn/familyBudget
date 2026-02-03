"""
ProductGroup dimension table model with SCD Type 1 and hierarchical structure.

This module defines the ProductGroup model for product categories with in-place updates
(NO versioning). Full change history is stored in separate ProductGroupHistory table (SCD Type 2).

Key features:
- SCD Type 1 (current data only, in-place updates)
- Hierarchical organization using adjacency list (parent_id)
- Shared across all users (admin-managed)
- Full change history in ProductGroupHistory table
"""

from datetime import datetime

from sqlmodel import Field, SQLModel


class ProductGroup(SQLModel, table=True):
    """
    ProductGroup (product category) dimension table with SCD Type 1 and hierarchy support.

    Changes to this table are in-place updates (no versioning).
    Full change history is stored in ProductGroupHistory table (SCD Type 2).

    Stable PK (id) ensures FK integrity in fact tables (t_f_shopping_list_item).

    Product groups represent categories (e.g., "Dairy", "Vegetables", "Meat").
    Supports hierarchical organization via parent_id (adjacency list pattern).
    Shared across all users - only administrators can CREATE/UPDATE/DELETE.

    Table: t_d_product_group
    Pattern: SCD Type 1 + Adjacency List (parent_id for hierarchy)

    Business Key: name (for uniqueness)

    Hierarchical Structure:
        The parent_id creates a tree structure:
        - Root groups: parent_id = NULL
        - Child groups: parent_id references parent group's id
        - Example hierarchy:
            Food (id=1, parent_id=NULL)
            ├── Dairy (id=2, parent_id=1)
            │   ├── Milk (id=4, parent_id=2)
            │   └── Cheese (id=5, parent_id=2)
            └── Vegetables (id=3, parent_id=1)

    Shared References Architecture:
        - All product groups are shared across all users (accessible by everyone)
        - Only administrators can CREATE/UPDATE/DELETE product groups
        - All users can READ all product groups
        - creator_id tracks the creator for audit trail purposes

    SCD Type 1 Pattern:
        - Main table contains ONLY current product group data (no historical versions)
        - History is stored in separate t_d_product_group_history table (SCD Type 2)
        - FK in fact tables (t_f_shopping_list_item.product_group_id) remain stable
        - Product group updates (name, parent_id, etc.) are in-place (UPDATE, not INSERT)

    Attributes:
        id: Surrogate primary key (stable - NEVER changes on updates)
        creator_id: Creator user ID (required - tracks creator for audit, SCD1)
        parent_id: Parent product group ID for hierarchy (NULL for root, SCD1)
        name: Product group display name (required, max 255 chars, SCD1)
        description: Optional description or notes (SCD1 - in-place update)
        code: Business code for external integrations (optional, SCD1)
        is_active: Active flag (True = visible in UI, False = archived, SCD1)
        created_at: Timestamp when record was created (immutable)
        updated_at: Timestamp when record was last updated (auto-updated on changes)

    Examples:
        # Root product group (top-level category)
        >>> product_group = ProductGroup(
        ...     creator_id=123,
        ...     name="Food"
        ... )

        # Child product group (subcategory)
        >>> dairy = ProductGroup(
        ...     creator_id=123,
        ...     parent_id=1,
        ...     name="Dairy"
        ... )

    Notes:
        - Only administrators can manage product groups (checked at API level)
        - All users can view all product groups (no filtering by creator_id)
        - Parent group must exist before creating child group
        - Unique constraint: name (case-insensitive)
        - Full change history is stored in ProductGroupHistory table (SCD Type 2)
        - Hierarchy is also stored in ProductGroupHierarchy table (Closure Table)
    """

    __tablename__ = "t_d_product_group"

    # Primary key
    id: int | None = Field(
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
    parent_id: int | None = Field(
        default=None,
        foreign_key="t_d_product_group.id",
        index=True,
        description="Parent product group ID for hierarchy (adjacency list pattern)"
    )

    # Business keys and attributes
    name: str = Field(
        nullable=False,
        max_length=255,
        index=True,
        description="Product group display name (unique)"
    )
    description: str | None = Field(
        default=None,
        description="Optional description or notes about the product group"
    )
    code: str | None = Field(
        default=None,
        max_length=50,
        nullable=True,
        index=True,
        description="Business code for external integrations (e.g., PGRP-1, PGRP-2). Auto-generated if not provided."
    )

    # Active status flag (archived categories functionality)
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
        """String representation of ProductGroup model."""
        return (
            f"ProductGroup(id={self.id}, name='{self.name}', "
            f"creator_id={self.creator_id}, parent_id={self.parent_id}, "
            f"is_active={self.is_active})"
        )
