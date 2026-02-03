"""
Pydantic schemas for ProductGroup endpoints.

This module defines request/response schemas for ProductGroup CRUD operations.
Product groups represent hierarchical product categories (e.g., "Food" → "Dairy" → "Milk").
"""
from typing import Optional

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ProductGroupCreate(BaseModel):
    """
    Schema for creating a new product group.

    Validation Rules:
        - name: Required, max 255 characters
        - parent_id: Optional (NULL for root groups)
        - description: Optional

    Notes:
        - creator_id is set automatically from current_user
        - Only administrators can create product groups (checked at API level)
        - Hierarchy is updated automatically in ProductGroupHierarchy table
    """

    name: str = Field(
        ...,
        max_length=255,
        min_length=1,
        description="Product group display name",
        examples=["Food", "Dairy", "Vegetables"]
    )

    parent_id: Optional[int] = Field(
        default=None,
        description="Parent product group ID (NULL for root groups)",
        examples=[1, None]
    )

    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes",
        examples=["All food items", None]
    )

    is_active: bool = Field(
        default=True,
        description="Active status (True = visible in UI, False = archived)",
        examples=[True]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        """
        Validate product group name.

        Rules:
        - Cannot be empty or whitespace only
        - Must contain at least one alphanumeric character
        - Leading/trailing whitespace is trimmed
        """
        if not v or not v.strip():
            raise ValueError("Product group name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Product group name must contain at least one alphanumeric character"
            )

        return trimmed


class ProductGroupUpdate(BaseModel):
    """
    Schema for updating an existing product group.

    All fields are optional (partial update).
    Updates product group IN-PLACE (SCD Type 1) and creates history snapshot (SCD Type 2).

    Validation Rules:
        - At least one field should be provided
        - Same validation as ProductGroupCreate for provided fields

    Notes:
        - Update modifies product group IN-PLACE (id remains stable)
        - Creates ProductGroupHistory snapshot for audit trail
        - Changing parent_id updates ProductGroupHierarchy closure table
        - Cannot change creator_id (product groups belong to creator)
        - Only administrators can update product groups (checked at API level)
    """

    name: Optional[str] = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Product group display name",
        examples=["Updated Food"]
    )

    parent_id: Optional[int] = Field(
        default=None,
        description="Parent product group ID (NULL for root groups)",
        examples=[1, None]
    )

    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes",
        examples=["Updated description"]
    )

    is_active: Optional[bool] = Field(
        default=None,
        description="Active status (True = visible in UI, False = archived)",
        examples=[True, False]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
        """Validate product group name if provided."""
        if v is None:
            return None

        if not v or not v.strip():
            raise ValueError("Product group name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Product group name must contain at least one alphanumeric character"
            )

        return trimmed


class ProductGroupResponse(BaseModel):
    """
    Schema for product group responses.

    Includes all product group fields from the database.

    Notes:
        - SCD Type 1: Returns current data (no versioning)
        - Historical versions are stored in ProductGroupHistory table
        - Shared across all users (no filtering by creator_id)
    """

    id: int = Field(
        description="Product group ID (surrogate key)",
        examples=[1]
    )

    creator_id: int = Field(
        description="Creator user ID (audit trail only)",
        examples=[123]
    )

    parent_id: Optional[int] = Field(
        default=None,
        description="Parent product group ID (NULL for root groups)",
        examples=[1, None]
    )

    name: str = Field(
        description="Product group display name",
        examples=["Food"]
    )

    code: Optional[str] = Field(
        default=None,
        description="Business code for external integrations",
        examples=["PGRP-1", "PGRP-2", None]
    )

    description: Optional[str] = Field(
        description="Optional description",
        examples=["All food items", None]
    )

    is_active: bool = Field(
        description="Active status (True = visible in UI, False = archived)",
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
                "parent_id": None,
                "code": "PGRP-1",
                "name": "Food",
                "description": "All food items",
                "is_active": True,
                "created_at": "2025-01-10T12:00:00Z",
                "updated_at": "2025-01-10T12:00:00Z"
            }
        }
    }


class ProductGroupTreeResponse(BaseModel):
    """
    Schema for product group tree responses.

    Includes product group data plus hierarchy information.
    Used for tree rendering in admin panel and hierarchical selectors.
    """

    id: int = Field(
        description="Product group ID",
        examples=[1]
    )

    parent_id: Optional[int] = Field(
        description="Parent product group ID",
        examples=[None]
    )

    name: str = Field(
        description="Product group name",
        examples=["Food"]
    )

    code: Optional[str] = Field(
        description="Business code",
        examples=["PGRP-1"]
    )

    is_active: bool = Field(
        description="Active status",
        examples=[True]
    )

    # Tree metadata
    depth: int = Field(
        description="Depth in tree (0=root, 1=direct child, etc.)",
        examples=[0]
    )

    has_children: bool = Field(
        description="Whether this group has child groups",
        examples=[True]
    )

    children: Optional[list["ProductGroupTreeResponse"]] = Field(
        default=None,
        description="Child product groups (recursive)",
        examples=[None]
    )

    model_config = {
        "from_attributes": True
    }


class ProductGroupListResponse(BaseModel):
    """
    Schema for paginated product group list responses.

    Returns list of product groups with pagination metadata.
    """

    product_groups: list[ProductGroupResponse] = Field(
        description="List of product groups",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of product groups (before pagination)",
        examples=[10]
    )

    limit: int = Field(
        description="Maximum number of product groups returned",
        examples=[100]
    )

    offset: int = Field(
        description="Number of product groups skipped",
        examples=[0]
    )


class ProductGroupMove(BaseModel):
    """
    Schema for moving product group in hierarchy.

    Used for drag-and-drop tree operations in admin panel.

    Notes:
        - Changes parent_id of the product group
        - Updates ProductGroupHierarchy closure table
        - Creates ProductGroupHistory snapshot with change_type='HIERARCHY_CHANGE'
    """

    new_parent_id: Optional[int] = Field(
        ...,
        description="New parent product group ID (NULL to move to root)",
        examples=[5, None]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "new_parent_id": 5
            }
        }
    }
