"""
Pydantic schemas for FinancialCenter endpoints.

This module defines request/response schemas for FinancialCenter CRUD operations.
Financial centers represent bank accounts, wallets, and other financial entities.
"""

import re
from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class FinancialCenterCreate(BaseModel):
    """
    Schema for creating a new financial center.

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
        description="Financial center display name",
        examples=["Sberbank Account", "Cash Wallet", "Tinkoff Card"]
    )

    description: str | None = Field(
        default=None,
        description="Optional description or notes",
        examples=["Main checking account", None]
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
        Validate financial center name.

        Rules:
        - Cannot be empty or whitespace only
        - Must contain at least one alphanumeric character
        - Leading/trailing whitespace is trimmed
        """
        if not v or not v.strip():
            raise ValueError("Financial center name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Financial center name must contain at least one alphanumeric character"
            )

        return trimmed


class FinancialCenterUpdate(BaseModel):
    """
    Schema for updating an existing financial center.

    All fields are optional (partial update).
    Updates financial center IN-PLACE (SCD Type 1) and creates history snapshot (SCD Type 2).

    Validation Rules:
        - At least one field should be provided
        - Same validation as FinancialCenterCreate for provided fields

    Notes:
        - Update modifies financial center IN-PLACE (id remains stable)
        - Creates FinancialCenterHistory snapshot for audit trail
        - Cannot change user_id (financial centers belong to creator)
    """

    name: str | None = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Financial center display name",
        examples=["Updated Sberbank Account"]
    )

    description: str | None = Field(
        default=None,
        description="Optional description or notes",
        examples=["Updated description"]
    )

    is_active: bool | None = Field(
        default=None,
        description="Active status (True = visible in UI, False = archived)",
        examples=[True, False]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        """Validate financial center name if provided."""
        if v is None:
            return None

        if not v or not v.strip():
            raise ValueError("Financial center name cannot be empty")

        trimmed = v.strip()

        # Check if name contains at least one alphanumeric character
        if not re.search(r'[a-zA-Z0-9а-яА-ЯёЁ]', trimmed):
            raise ValueError(
                "Financial center name must contain at least one alphanumeric character"
            )

        return trimmed


class FinancialCenterResponse(BaseModel):
    """
    Schema for financial center responses.

    Includes all financial center fields from the database.

    Notes:
        - SCD Type 1: Returns current data (no versioning)
        - Historical versions are stored in FinancialCenterHistory table
    """

    id: int = Field(
        description="Financial center ID (surrogate key)",
        examples=[1]
    )

    user_id: int = Field(
        description="Owner user ID",
        examples=[123]
    )

    name: str = Field(
        description="Financial center display name",
        examples=["Sberbank Account"]
    )

    code: str | None = Field(
        default=None,
        description="Business code for external integrations",
        examples=["CFO-1", "CFO-2", None]
    )

    description: str | None = Field(
        description="Optional description",
        examples=["Main checking account", None]
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

    model_config = {
        "from_attributes": True,  # Allow ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 123,
                "code": "BANK_SBER",
                "name": "Sberbank Account",
                "description": "Main checking account",
                "is_active": True,
                "created_at": "2025-10-14T12:00:00Z",
                "updated_at": "2025-10-14T12:00:00Z"
            }
        }
    }


class FinancialCenterListResponse(BaseModel):
    """
    Schema for paginated financial center list responses.

    Returns list of financial centers with pagination metadata.
    """

    financial_centers: list[FinancialCenterResponse] = Field(
        description="List of financial centers",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of financial centers (before pagination)",
        examples=[10]
    )

    limit: int = Field(
        description="Maximum number of financial centers returned",
        examples=[100]
    )

    offset: int = Field(
        description="Number of financial centers skipped",
        examples=[0]
    )

    @property
    def items(self) -> list[FinancialCenterResponse]:
        """Alias for backward compatibility with frontend DataLayer"""
        return self.financial_centers
