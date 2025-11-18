"""
Pydantic schemas for CostCenter endpoints.

This module defines request/response schemas for CostCenter CRUD operations.
Cost centers represent projects, departments, and other budget allocation categories.
"""

import re
from datetime import datetime
from typing import Optional

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

    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes",
        examples=["Kitchen and bathroom renovation project", None]
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
    When updated, creates new SCD Type 2 version with is_current=True.

    Validation Rules:
        - At least one field should be provided
        - Same validation as CostCenterCreate for provided fields

    Notes:
        - Update creates NEW version with is_current=True
        - Old version gets is_current=False, valid_to=now()
        - Cannot change user_id (cost centers belong to creator)
    """

    name: Optional[str] = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Cost center display name",
        examples=["Updated Home Renovation"]
    )

    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes",
        examples=["Updated description with new scope"]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
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
        - Only current versions (is_current=True) are returned by default
        - Historical versions can be queried via /cost-centers/{id}/history endpoint
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

    code: Optional[str] = Field(
        default=None,
        description="Business code for external integrations",
        examples=["MVZ-1", "MVZ-2", None]
    )

    description: Optional[str] = Field(
        description="Optional description",
        examples=["Kitchen and bathroom renovation", None]
    )

    # SCD Type 2 fields
    valid_from: datetime = Field(
        description="Start of validity period",
        examples=["2025-10-14T12:00:00Z"]
    )

    valid_to: datetime = Field(
        description="End of validity period (9999-12-31 for current)",
        examples=["9999-12-31T23:59:59Z"]
    )

    is_current: bool = Field(
        description="True if this is the current version",
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

    model_config = {
        "from_attributes": True,  # Allow ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 123,
                "code": "PROJ_HOME",
                "name": "Home Renovation",
                "description": "Kitchen and bathroom renovation",
                "valid_from": "2025-10-14T12:00:00Z",
                "valid_to": "9999-12-31T23:59:59Z",
                "is_current": True,
                "created_at": "2025-10-14T12:00:00Z",
                "updated_at": "2025-10-14T12:00:00Z"
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
