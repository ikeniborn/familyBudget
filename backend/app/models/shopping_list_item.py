"""
ShoppingListItem fact table model (Header+Lines pattern - Lines).

This module defines the ShoppingListItem model (lines) for shopping list items.
This is the lines table in the Header+Lines pattern.
Header is stored in ShoppingList table.

Key features:
- SHARED across all users (anyone can add/edit/delete items)
- Many-to-one relationship with ShoppingList (shopping_list_id FK)
"""
from datetime import datetime
from decimal import Decimal

from sqlmodel import Field, SQLModel


class ShoppingListItem(SQLModel, table=True):
    """
    ShoppingListItem lines table (Header+Lines pattern).

    Represents individual items in a shopping list.
    Belongs to a ShoppingList (many-to-one relationship).

    Table: t_f_shopping_list_item
    Pattern: Header+Lines (Lines)

    Shared References Architecture:
        - All items are SHARED across all users
        - Any user can CREATE/UPDATE/DELETE any item
        - creator_id tracks who created the item (audit only, NOT for filtering)
        - Items belong to a shopping list (shopping_list_id FK)

    Optimistic Locking:
        - version field: incremented on each update
        - Used for conflict detection during sync
        - If client version != server version, conflict is detected

    Soft Delete:
        - deleted_at field: NULL = active, NOT NULL = soft-deleted
        - Soft-deleted items are excluded from regular queries
        - Kept for autocomplete history and conflict resolution

    Attributes:
        id: Surrogate primary key
        creator_id: Creator user ID (required - tracks who added the item, audit only)
        shopping_list_id: Foreign key to t_f_shopping_list.id (required, CASCADE on delete)
        store_id: Foreign key to t_d_store.id (REQUIRED - which store to buy from)
        product_group_id: Foreign key to t_d_product_group.id (REQUIRED - product category)
        product_name: Product name (REQUIRED, max 255 chars, e.g., "Organic Milk 1L")
        quantity: Quantity to buy (OPTIONAL, decimal, e.g., 2.5)
        unit: Unit of measurement (OPTIONAL, max 50 chars, e.g., "kg", "liters", "pieces")
        comment: Optional comment or notes (e.g., "buy on sale", "specific brand")
        is_completed: Completion flag (True = marked as bought, False = still needed)
        completed_at: When item was marked as completed (for conflict resolution)
        version: Optimistic locking version (incremented on each update)
        deleted_at: Soft delete timestamp (NULL = active, NOT NULL = deleted)
        last_modified_by: User ID who last modified this item
        created_at: Timestamp when item was created (immutable)
        updated_at: Timestamp when item was last updated (auto-updated on changes)

    Examples:
        # Create shopping list item
        >>> item = ShoppingListItem(
        ...     creator_id=123,
        ...     shopping_list_id=1,
        ...     store_id=5,
        ...     product_group_id=10,
        ...     product_name="Organic Milk 1L",
        ...     quantity=Decimal("2"),
        ...     unit="bottles",
        ...     is_completed=False,
        ... )

        # Mark item as completed
        >>> item.is_completed = True
        >>> await session.commit()

    Notes:
        - store_id, product_group_id, product_name are REQUIRED
        - quantity, unit, comment are OPTIONAL
        - Deleting ShoppingList CASCADE deletes all associated items
        - All users can add/edit/delete any item (no permission checks)
    """

    __tablename__ = "t_f_shopping_list_item"

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
        description="Creator user ID (required - tracks who added the item, audit only)"
    )
    shopping_list_id: int = Field(
        foreign_key="t_f_shopping_list.id",
        index=True,
        nullable=False,
        description="Foreign key to t_f_shopping_list.id (CASCADE on delete)"
    )
    store_id: int = Field(
        foreign_key="t_d_store.id",
        index=True,
        nullable=False,
        description="Foreign key to t_d_store.id (REQUIRED - which store to buy from)"
    )
    product_group_id: int = Field(
        foreign_key="t_d_product_group.id",
        index=True,
        nullable=False,
        description="Foreign key to t_d_product_group.id (REQUIRED - product category)"
    )

    # Business attributes
    product_name: str = Field(
        nullable=False,
        max_length=255,
        index=True,
        description="Product name (REQUIRED, e.g., 'Organic Milk 1L')"
    )
    quantity: Decimal | None = Field(
        default=None,
        max_digits=10,
        decimal_places=3,
        description="Quantity to buy (OPTIONAL, e.g., 2.5)"
    )
    unit: str | None = Field(
        default=None,
        max_length=50,
        description="Unit of measurement (OPTIONAL, e.g., 'kg', 'liters', 'pieces')"
    )
    comment: str | None = Field(
        default=None,
        description="Optional comment or notes (e.g., 'buy on sale', 'specific brand')"
    )
    position: int | None = Field(
        default=None,
        nullable=True,
        description="Position in list for ordering (auto-assigned if null)"
    )

    # Completion status
    is_completed: bool = Field(
        default=False,
        nullable=False,
        index=True,
        description="Completion flag (True = marked as bought, False = still needed)"
    )
    completed_at: datetime | None = Field(
        default=None,
        nullable=True,
        description="When item was marked as completed (for conflict resolution priority)"
    )

    # Optimistic locking
    version: int = Field(
        default=1,
        nullable=False,
        description="Optimistic locking version (incremented on each update)"
    )

    # Soft delete
    deleted_at: datetime | None = Field(
        default=None,
        nullable=True,
        index=True,
        description="Soft delete timestamp (NULL = active, NOT NULL = deleted)"
    )

    # Audit fields
    last_modified_by: int | None = Field(
        default=None,
        foreign_key="t_d_user.id",
        nullable=True,
        description="User ID who last modified this item"
    )
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
        """String representation of ShoppingListItem model."""
        return (
            f"ShoppingListItem(id={self.id}, product_name='{self.product_name}', "
            f"shopping_list_id={self.shopping_list_id}, is_completed={self.is_completed})"
        )
