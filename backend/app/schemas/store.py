"""
Pydantic schemas for Store endpoints.

This module defines request/response schemas for Store CRUD operations.
Stores represent shopping locations (supermarkets, shops, etc.).
"""

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class StoreCreate(BaseModel):
    """
    Schema for creating a new store.

    Validation Rules:
        - name: Required, max 255 characters
        - address: Optional
        - description: Optional

    Notes:
        - creator_id is set automatically from current_user
        - Only administrators can create stores (checked at API level)
    """

    name: str = Field(
        ...,
        max_length=255,
        min_length=1,
        description="Store display name",
        examples=["Walmart", "Costco", "Local Bakery"]
    )

    address: str | None = Field(
        default=None,
        description="Physical address of the store",
        examples=["123 Main St, City, State 12345", None]
    )

    description: str | None = Field(
        default=None,
        description="Optional description or notes",
        examples=["24/7 grocery store", None]
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
        Validate store name.

        Rules:
        - Cannot be empty or whitespace only
        - Must contain at least one alphanumeric character
        - Leading/trailing whitespace is trimmed
        """
        if not v or not v.strip():
            raise ValueError("Store name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Store name must contain at least one alphanumeric character"
            )

        return trimmed


class StoreUpdate(BaseModel):
    """
    Schema for updating an existing store.

    All fields are optional (partial update).
    Updates store IN-PLACE (SCD Type 1) and creates history snapshot (SCD Type 2).

    Validation Rules:
        - At least one field should be provided
        - Same validation as StoreCreate for provided fields

    Notes:
        - Update modifies store IN-PLACE (id remains stable)
        - Creates StoreHistory snapshot for audit trail
        - Cannot change creator_id (stores belong to creator)
        - Only administrators can update stores (checked at API level)
    """

    name: str | None = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Store display name",
        examples=["Updated Walmart"]
    )

    address: str | None = Field(
        default=None,
        description="Physical address of the store",
        examples=["456 New St, City, State 12345"]
    )

    description: str | None = Field(
        default=None,
        description="Optional description or notes",
        examples=["Updated description with new hours"]
    )

    is_active: bool | None = Field(
        default=None,
        description="Active status (True = visible in UI, False = archived)",
        examples=[True, False]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        """Validate store name if provided."""
        if v is None:
            return None

        if not v or not v.strip():
            raise ValueError("Store name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Store name must contain at least one alphanumeric character"
            )

        return trimmed


class StoreResponse(BaseModel):
    """
    Schema for store responses.

    Includes all store fields from the database.

    Notes:
        - SCD Type 1: Returns current data (no versioning)
        - Historical versions are stored in StoreHistory table
        - Shared across all users (no filtering by creator_id)
    """

    id: int = Field(
        description="Store ID (surrogate key)",
        examples=[1]
    )

    creator_id: int = Field(
        description="Creator user ID (audit trail only)",
        examples=[123]
    )

    name: str = Field(
        description="Store display name",
        examples=["Walmart"]
    )

    address: str | None = Field(
        default=None,
        description="Physical address",
        examples=["123 Main St, City, State 12345", None]
    )

    code: str | None = Field(
        default=None,
        description="Business code for external integrations",
        examples=["STORE-1", "STORE-2", None]
    )

    description: str | None = Field(
        description="Optional description",
        examples=["24/7 grocery store", None]
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
                "code": "STORE-1",
                "name": "Walmart",
                "address": "123 Main St, City, State 12345",
                "description": "24/7 grocery store",
                "is_active": True,
                "created_at": "2025-01-10T12:00:00Z",
                "updated_at": "2025-01-10T12:00:00Z"
            }
        }
    }


class StoreListResponse(BaseModel):
    """
    Schema for paginated store list responses.

    Returns list of stores with pagination metadata.
    """

    stores: list[StoreResponse] = Field(
        description="List of stores",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of stores (before pagination)",
        examples=[10]
    )

    limit: int = Field(
        description="Maximum number of stores returned",
        examples=[100]
    )

    offset: int = Field(
        description="Number of stores skipped",
        examples=[0]
    )
