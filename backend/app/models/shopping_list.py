"""
ShoppingList fact table model (Header+Lines pattern - Header).

This module defines the ShoppingList model (header) for managing shopping lists.
This is the header table in the Header+Lines pattern.
Lines (items) are stored in ShoppingListItem table.

Key features:
- SHARED across all users (anyone can view and edit)
- Only the creator (owner) can DELETE their list
- Header+Lines pattern (one-to-many with ShoppingListItem)
"""

from datetime import datetime

from sqlmodel import Field, SQLModel


class ShoppingList(SQLModel, table=True):
    """
    ShoppingList header table (Header+Lines pattern).

    Represents a shopping list with metadata.
    Individual items are stored in ShoppingListItem table (one-to-many relationship).

    Table: t_f_shopping_list
    Pattern: Header+Lines (Header)

    Shared References Architecture:
        - All shopping lists are SHARED across all users
        - Any user can CREATE a new list
        - Any user can READ and UPDATE any list
        - Only the creator (owner) can DELETE their list
        - creator_id tracks the list owner for audit trail and delete permission

    Delete Permission:
        - DELETE endpoint checks: shopping_list.creator_id == current_user.id
        - If check fails: HTTP 403 Forbidden
        - Non-owners can view and edit but NOT delete

    Attributes:
        id: Surrogate primary key
        creator_id: Creator user ID (required - tracks list owner, used for delete permission)
        name: Shopping list name (required, max 255 chars)
        description: Optional description or notes
        is_active: Active flag (True = visible in UI, False = archived/completed)
        created_at: Timestamp when list was created (immutable)
        updated_at: Timestamp when list was last updated (auto-updated on changes)

    Examples:
        # Create shopping list
        >>> shopping_list = ShoppingList(
        ...     creator_id=123,
        ...     name="Weekly Groceries",
        ...     description="Shopping list for week of 2025-01-10"
        ... )

        # Archive list (mark as completed)
        >>> shopping_list.is_active = False
        >>> await session.commit()

        # Delete list (only owner can do this - checked at API level)
        >>> if shopping_list.creator_id == current_user.id:
        ...     await session.delete(shopping_list)  # CASCADE deletes items
        ...     await session.commit()
        ... else:
        ...     raise HTTPException(403, "Only list owner can delete")

    Notes:
        - Deleting a shopping list CASCADE deletes all associated items (ShoppingListItem)
        - creator_id is used for delete permission check (not for filtering/isolation)
        - All users can view all lists (no filtering by creator_id)
        - Landing page shows all active lists as grid of cards
    """

    __tablename__ = "t_f_shopping_list"

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
        description="Creator user ID (required - tracks list owner, used for delete permission check)"
    )

    # Business attributes
    name: str = Field(
        nullable=False,
        max_length=255,
        index=True,
        description="Shopping list name"
    )
    description: str | None = Field(
        default=None,
        description="Optional description or notes about the shopping list"
    )

    # Active status flag (completed/archived functionality)
    is_active: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="Active status flag (True = visible in UI, False = archived/completed)"
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
        """String representation of ShoppingList model."""
        return (
            f"ShoppingList(id={self.id}, name='{self.name}', "
            f"creator_id={self.creator_id}, is_active={self.is_active})"
        )
