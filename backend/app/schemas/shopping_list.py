"""
Pydantic schemas for ShoppingList endpoints.

This module defines request/response schemas for ShoppingList CRUD operations.
Shopping lists are the header in Header+Lines pattern (items are in ShoppingListItem).
"""
import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ShoppingListCreate(BaseModel):
    """
    Schema for creating a new shopping list.

    Validation Rules:
        - name: Required, max 255 characters
        - description: Optional

    Notes:
        - creator_id is set automatically from current_user
        - All users can create shopping lists
        - Lists are SHARED (visible to all users)
    """

    name: str = Field(
        ...,
        max_length=255,
        min_length=1,
        description="Shopping list name",
        examples=["Weekly Groceries", "Party Supplies", "Monthly Shopping"]
    )

    description: str | None = Field(
        default=None,
        description="Optional description or notes",
        examples=["Shopping list for week of 2025-01-10", None]
    )

    is_active: bool = Field(
        default=True,
        description="Active status (True = visible in UI, False = archived/completed)",
        examples=[True]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        """
        Validate shopping list name.

        Rules:
        - Cannot be empty or whitespace only
        - Must contain at least one alphanumeric character
        - Leading/trailing whitespace is trimmed
        """
        if not v or not v.strip():
            raise ValueError("Shopping list name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Shopping list name must contain at least one alphanumeric character"
            )

        return trimmed


class ShoppingListUpdate(BaseModel):
    """
    Schema for updating an existing shopping list.

    All fields are optional (partial update).

    Validation Rules:
        - At least one field should be provided
        - Same validation as ShoppingListCreate for provided fields

    Notes:
        - Any user can update any shopping list (SHARED model)
        - Cannot change creator_id (lists belong to creator)
    """

    name: str | None = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Shopping list name",
        examples=["Updated Weekly Groceries"]
    )

    description: str | None = Field(
        default=None,
        description="Optional description or notes",
        examples=["Updated description"]
    )

    is_active: bool | None = Field(
        default=None,
        description="Active status (True = visible in UI, False = archived/completed)",
        examples=[True, False]
    )

    google_sheets_url: str | None = Field(
        default=None,
        max_length=2048,
        description="Google Sheets URL for this list (None = not provided, not cleared)",
        examples=["https://docs.google.com/spreadsheets/d/abc123/edit"]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        """Validate shopping list name if provided."""
        if v is None:
            return None

        if not v or not v.strip():
            raise ValueError("Shopping list name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Shopping list name must contain at least one alphanumeric character"
            )

        return trimmed


class GoogleSheetsUrlResponse(BaseModel):
    """Response schema for google-sheets-url endpoints."""

    google_sheets_url: str | None = Field(
        default=None,
        description="Saved Google Sheets URL for this list",
    )
    has_saved_url: bool = Field(
        description="Whether a URL has been saved for this list"
    )

    model_config = {"from_attributes": True}


class GoogleSheetsUrlUpdate(BaseModel):
    """Request schema for updating google-sheets-url."""

    google_sheets_url: str | None = Field(
        default=None,
        max_length=2048,
        description="New Google Sheets URL (None to clear)",
    )


class ShoppingListResponse(BaseModel):
    """
    Schema for shopping list responses.

    Includes all shopping list fields from the database.

    Notes:
        - SHARED model: Visible to all users
        - Only creator can DELETE (checked at API level)
    """

    id: int = Field(
        description="Shopping list ID (surrogate key)",
        examples=[1]
    )

    temp_id: str | None = Field(
        default=None,
        description="Client-side UUID for offline sync",
        examples=["550e8400-e29b-41d4-a716-446655440000"]
    )

    creator_id: int = Field(
        description="Creator user ID (owner - used for delete permission)",
        examples=[123]
    )

    name: str = Field(
        description="Shopping list name",
        examples=["Weekly Groceries"]
    )

    description: str | None = Field(
        description="Optional description",
        examples=["Shopping list for week of 2025-01-10", None]
    )

    is_active: bool = Field(
        description="Active status (True = visible in UI, False = archived/completed)",
        examples=[True]
    )

    # Audit fields
    created_at: datetime = Field(
        description="Record creation timestamp",
        examples=["2025-01-10T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Record last update timestamp",
        examples=["2025-01-10T12:00:00Z"]
    )

    model_config = {
        "from_attributes": True,  # Allow ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "creator_id": 123,
                "name": "Weekly Groceries",
                "description": "Shopping list for week of 2025-01-10",
                "is_active": True,
                "created_at": "2025-01-10T12:00:00Z",
                "updated_at": "2025-01-10T12:00:00Z"
            }
        }
    }


class ShoppingListCardResponse(BaseModel):
    """
    Schema for shopping list card responses (landing page grid).

    Includes shopping list data plus item count and completion statistics.
    Used for grid of cards on landing page AND for Dexie offline sync
    (LocalShoppingList in frontend).
    """

    id: int = Field(
        description="Shopping list ID",
        examples=[1]
    )

    temp_id: str | None = Field(
        default=None,
        description="Client-side UUID for offline sync"
    )

    creator_id: int = Field(
        description="Creator user ID (owner — used for delete permission)",
        examples=[123]
    )

    name: str = Field(
        description="Shopping list name",
        examples=["Weekly Groceries"]
    )

    description: str | None = Field(
        description="Optional description",
        examples=["Shopping list for week of 2025-01-10"]
    )

    is_active: bool = Field(
        description="Active status (True = visible in UI, False = archived)",
        examples=[True]
    )

    # Statistics
    total_items: int = Field(
        description="Total number of items in list",
        examples=[10]
    )

    completed_items: int = Field(
        description="Number of completed items",
        examples=[5]
    )

    completion_percentage: float = Field(
        description="Completion percentage (0-100)",
        examples=[50.0]
    )

    # Audit
    created_at: datetime = Field(
        description="Creation timestamp",
        examples=["2025-01-10T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Last update timestamp",
        examples=["2025-01-10T15:30:00Z"]
    )

    model_config = {
        "from_attributes": True
    }


class ShoppingListWithItemsResponse(BaseModel):
    """
    Schema for shopping list with items (detail view).

    Includes shopping list header plus all associated items.
    Used when opening a shopping list in detail view.
    """

    # Header fields
    id: int = Field(
        description="Shopping list ID",
        examples=[1]
    )

    creator_id: int = Field(
        description="Creator user ID",
        examples=[123]
    )

    name: str = Field(
        description="Shopping list name",
        examples=["Weekly Groceries"]
    )

    description: str | None = Field(
        description="Optional description",
        examples=["Shopping list for week of 2025-01-10"]
    )

    is_active: bool = Field(
        description="Active status",
        examples=[True]
    )

    created_at: datetime = Field(
        description="Creation timestamp",
        examples=["2025-01-10T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Last update timestamp",
        examples=["2025-01-10T15:30:00Z"]
    )

    # Items (forward reference, resolved at import)
    items: list["ShoppingListItemResponse"] = Field(
        default=[],
        description="List of shopping list items"
    )

    model_config = {
        "from_attributes": True
    }


class ShoppingListListResponse(BaseModel):
    """
    Schema for paginated shopping list list responses.

    Returns list of shopping lists with pagination metadata.
    Used for landing page grid (all lists).
    """

    shopping_lists: list[ShoppingListCardResponse] = Field(
        description="List of shopping lists with statistics",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of shopping lists (before pagination)",
        examples=[10]
    )

    limit: int = Field(
        description="Maximum number of shopping lists returned",
        examples=[100]
    )

    offset: int = Field(
        description="Number of shopping lists skipped",
        examples=[0]
    )


# Forward reference import (circular dependency resolution)
from backend.app.schemas.shopping_list_item import ShoppingListItemResponse  # noqa: E402

ShoppingListWithItemsResponse.model_rebuild()
