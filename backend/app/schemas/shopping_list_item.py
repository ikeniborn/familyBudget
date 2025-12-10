"""
Pydantic schemas for ShoppingListItem endpoints.

This module defines request/response schemas for ShoppingListItem CRUD operations.
Shopping list items are the lines in Header+Lines pattern (header is ShoppingList).
"""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field, field_validator


class ShoppingListItemCreate(BaseModel):
    """
    Schema for creating a new shopping list item.

    Validation Rules:
        - shopping_list_id: Required
        - store_id: Required
        - product_group_id: Required
        - product_name: Required, max 255 characters
        - quantity: Optional (decimal)
        - unit: Optional, max 50 characters
        - comment: Optional

    Notes:
        - creator_id is set automatically from current_user
        - All users can create items in any shopping list (SHARED model)
    """

    shopping_list_id: int = Field(
        ...,
        description="Shopping list ID (foreign key)",
        examples=[1]
    )

    store_id: int = Field(
        ...,
        description="Store ID (REQUIRED - which store to buy from)",
        examples=[5]
    )

    product_group_id: int = Field(
        ...,
        description="Product group ID (REQUIRED - product category)",
        examples=[10]
    )

    product_name: str = Field(
        ...,
        max_length=255,
        min_length=1,
        description="Product name (REQUIRED)",
        examples=["Organic Milk 1L", "Bread", "Apples"]
    )

    quantity: Optional[Decimal] = Field(
        default=None,
        ge=0,
        description="Quantity to buy (OPTIONAL)",
        examples=[2.5, None]
    )

    unit: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Unit of measurement (OPTIONAL)",
        examples=["kg", "liters", "pieces", None]
    )

    comment: Optional[str] = Field(
        default=None,
        description="Optional comment or notes",
        examples=["buy on sale", "specific brand", None]
    )

    is_completed: bool = Field(
        default=False,
        description="Completion flag (True = marked as bought, False = still needed)",
        examples=[False]
    )

    @field_validator("product_name")
    @classmethod
    def product_name_not_empty(cls, v: str) -> str:
        """
        Validate product name.

        Rules:
        - Cannot be empty or whitespace only
        - Leading/trailing whitespace is trimmed
        """
        if not v or not v.strip():
            raise ValueError("Product name cannot be empty")

        return v.strip()


class ShoppingListItemUpdate(BaseModel):
    """
    Schema for updating an existing shopping list item.

    All fields are optional (partial update).

    Validation Rules:
        - At least one field should be provided
        - Same validation as ShoppingListItemCreate for provided fields

    Notes:
        - Any user can update any item (SHARED model)
        - Cannot change shopping_list_id or creator_id
    """

    store_id: Optional[int] = Field(
        default=None,
        description="Store ID",
        examples=[5]
    )

    product_group_id: Optional[int] = Field(
        default=None,
        description="Product group ID",
        examples=[10]
    )

    product_name: Optional[str] = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Product name",
        examples=["Updated Organic Milk 1L"]
    )

    quantity: Optional[Decimal] = Field(
        default=None,
        ge=0,
        description="Quantity to buy",
        examples=[3.0]
    )

    unit: Optional[str] = Field(
        default=None,
        max_length=50,
        description="Unit of measurement",
        examples=["bottles"]
    )

    comment: Optional[str] = Field(
        default=None,
        description="Optional comment or notes",
        examples=["updated comment"]
    )

    is_completed: Optional[bool] = Field(
        default=None,
        description="Completion flag",
        examples=[True]
    )

    @field_validator("product_name")
    @classmethod
    def product_name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        """Validate product name if provided."""
        if v is None:
            return None

        if not v or not v.strip():
            raise ValueError("Product name cannot be empty")

        return v.strip()


class ShoppingListItemResponse(BaseModel):
    """
    Schema for shopping list item responses.

    Includes all shopping list item fields from the database.

    Notes:
        - SHARED model: All users can view/edit all items
        - sync_status is used for offline functionality
    """

    id: int = Field(
        description="Shopping list item ID (surrogate key)",
        examples=[1]
    )

    creator_id: int = Field(
        description="Creator user ID (audit trail only)",
        examples=[123]
    )

    shopping_list_id: int = Field(
        description="Shopping list ID (foreign key)",
        examples=[1]
    )

    store_id: int = Field(
        description="Store ID (which store to buy from)",
        examples=[5]
    )

    product_group_id: int = Field(
        description="Product group ID (product category)",
        examples=[10]
    )

    product_name: str = Field(
        description="Product name",
        examples=["Organic Milk 1L"]
    )

    quantity: Optional[Decimal] = Field(
        description="Quantity to buy",
        examples=[2.5, None]
    )

    unit: Optional[str] = Field(
        description="Unit of measurement",
        examples=["kg", None]
    )

    comment: Optional[str] = Field(
        description="Optional comment",
        examples=["buy on sale", None]
    )

    is_completed: bool = Field(
        description="Completion flag (True = marked as bought)",
        examples=[False]
    )

    sync_status: str = Field(
        description="Offline sync status: 'synced', 'pending', 'conflict'",
        examples=["synced"]
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
                "shopping_list_id": 1,
                "store_id": 5,
                "product_group_id": 10,
                "product_name": "Organic Milk 1L",
                "quantity": 2.5,
                "unit": "bottles",
                "comment": "buy on sale",
                "is_completed": False,
                "sync_status": "synced",
                "created_at": "2025-01-10T12:00:00Z",
                "updated_at": "2025-01-10T12:00:00Z"
            }
        }
    }


class BatchCompleteRequest(BaseModel):
    """
    Schema for batch complete operation.

    Marks multiple items as completed in a single request.
    """

    item_ids: List[int] = Field(
        ...,
        min_length=1,
        description="List of shopping list item IDs to mark as completed",
        examples=[[1, 2, 3]]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "item_ids": [1, 2, 3]
            }
        }
    }


class BatchDeleteRequest(BaseModel):
    """
    Schema for batch delete operation.

    Deletes multiple items in a single request.
    """

    item_ids: List[int] = Field(
        ...,
        min_length=1,
        description="List of shopping list item IDs to delete",
        examples=[[1, 2, 3]]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "item_ids": [1, 2, 3]
            }
        }
    }


class ShoppingListItemListResponse(BaseModel):
    """
    Schema for paginated shopping list item list responses.

    Returns list of items with pagination metadata.
    """

    items: list[ShoppingListItemResponse] = Field(
        description="List of shopping list items",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of items (before pagination)",
        examples=[10]
    )

    limit: int = Field(
        description="Maximum number of items returned",
        examples=[100]
    )

    offset: int = Field(
        description="Number of items skipped",
        examples=[0]
    )
