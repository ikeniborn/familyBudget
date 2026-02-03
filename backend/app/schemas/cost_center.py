"""
Pydantic schemas for CostCenter endpoints.

This module defines request/response schemas for CostCenter CRUD operations.
Cost centers represent projects, departments, and other budget allocation categories.
"""

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class CostCenterCreate(BaseModel):
    """
    Schema for creating a new cost center.

    Validation Rules:
        - name: Required, max 255 characters
        - description: Optional

    Notes:
        - user_id is set automatically from current_user
    """

    name: str = Field(
        ...,
        max_length=255,
        min_length=1,
        description="Cost center display name",
        examples=["Home Renovation", "Marketing Department", "Vacation 2025"]
    )

    description: str | None = Field(
        default=None,
        description="Optional description or notes",
        examples=["Kitchen and bathroom renovation project", None]
    )

    is_active: bool = Field(
        default=True,
        description="Active status (True = visible in UI, False = archived)",
        examples=[True]
    )

    financial_center_ids: list[int] | None = Field(
        default=None,
        description="List of financial center IDs this cost center is available for. "
                    "NULL/empty = available for all.",
        examples=[[1, 2, 3], None]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        """
        Validate cost center name.

        Rules:
        - Cannot be empty or whitespace only
        - Must contain at least one alphanumeric character
        - Leading/trailing whitespace is trimmed
        """
        if not v or not v.strip():
            raise ValueError("Cost center name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Cost center name must contain at least one alphanumeric character"
            )

        return trimmed


class CostCenterUpdate(BaseModel):
    """
    Schema for updating an existing cost center.

    All fields are optional (partial update).
    Updates cost center IN-PLACE (SCD Type 1) and creates history snapshot (SCD Type 2).

    Validation Rules:
        - At least one field should be provided
        - Same validation as CostCenterCreate for provided fields

    Notes:
        - Update modifies cost center IN-PLACE (id remains stable)
        - Creates CostCenterHistory snapshot for audit trail
        - Cannot change user_id (cost centers belong to creator)
    """

    name: str | None = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Cost center display name",
        examples=["Updated Home Renovation"]
    )

    description: str | None = Field(
        default=None,
        description="Optional description or notes",
        examples=["Updated description with new scope"]
    )

    is_active: bool | None = Field(
        default=None,
        description="Active status (True = visible in UI, False = archived)",
        examples=[True, False]
    )

    financial_center_ids: list[int] | None = Field(
        default=None,
        description="List of financial center IDs. Pass empty list [] to clear all links "
                    "(available for all).",
        examples=[[1, 2], []]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        """Validate cost center name if provided."""
        if v is None:
            return None

        if not v or not v.strip():
            raise ValueError("Cost center name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Cost center name must contain at least one alphanumeric character"
            )

        return trimmed


class CostCenterResponse(BaseModel):
    """
    Schema for cost center responses.

    Includes all cost center fields from the database.

    Notes:
        - SCD Type 1: Returns current data (no versioning)
        - Historical versions are stored in CostCenterHistory table
    """

    id: int = Field(
        description="Cost center ID (surrogate key)",
        examples=[1]
    )

    user_id: int = Field(
        description="Owner user ID",
        examples=[123]
    )

    name: str = Field(
        description="Cost center display name",
        examples=["Home Renovation"]
    )

    code: str | None = Field(
        default=None,
        description="Business code for external integrations",
        examples=["MVZ-1", "MVZ-2", None]
    )

    description: str | None = Field(
        description="Optional description",
        examples=["Kitchen and bathroom renovation", None]
    )

    is_active: bool = Field(
        description="Active status (True = visible in UI, False = archived)",
        examples=[True]
    )

    # Audit fields
    created_at: datetime = Field(
        description="Record creation timestamp",
        examples=["2025-10-14T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Record last update timestamp",
        examples=["2025-10-14T12:00:00Z"]
    )

    financial_center_ids: list[int] = Field(
        default_factory=list,
        description="List of financial center IDs this cost center is linked to. "
                    "Empty list = available for all financial centers.",
        examples=[[1, 2], []]
    )

    model_config = {
        "from_attributes": True,  # Allow ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 123,
                "code": "PROJ_HOME",
                "name": "Home Renovation",
                "description": "Kitchen and bathroom renovation",
                "is_active": True,
                "created_at": "2025-10-14T12:00:00Z",
                "updated_at": "2025-10-14T12:00:00Z",
                "financial_center_ids": [1, 2]
            }
        }
    }


class CostCenterListResponse(BaseModel):
    """
    Schema for paginated cost center list responses.

    Returns list of cost centers with pagination metadata.
    """

    cost_centers: list[CostCenterResponse] = Field(
        description="List of cost centers",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of cost centers (before pagination)",
        examples=[10]
    )

    limit: int = Field(
        description="Maximum number of cost centers returned",
        examples=[100]
    )

    offset: int = Field(
        description="Number of cost centers skipped",
        examples=[0]
    )
