"""
Pydantic schemas for FinancialCenter endpoints.

This module defines request/response schemas for FinancialCenter CRUD operations.
Financial centers represent bank accounts, wallets, and other financial entities.
"""

import re
from datetime import datetime
from typing import Optional

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

    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes",
        examples=["Main checking account", None]
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
    When updated, creates new SCD Type 2 version with is_current=True.

    Validation Rules:
        - At least one field should be provided
        - Same validation as FinancialCenterCreate for provided fields

    Notes:
        - Update creates NEW version with is_current=True
        - Old version gets is_current=False, valid_to=now()
        - Cannot change user_id (financial centers belong to creator)
    """

    name: Optional[str] = Field(
        default=None,
        max_length=255,
        min_length=1,
        description="Financial center display name",
        examples=["Updated Sberbank Account"]
    )

    description: Optional[str] = Field(
        default=None,
        description="Optional description or notes",
        examples=["Updated description"]
    )

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: Optional[str]) -> Optional[str]:
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
        - Only current versions (is_current=True) are returned by default
        - Historical versions can be queried via /financial-centers/{id}/history endpoint
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

    code: Optional[str] = Field(
        default=None,
        description="Business code for external integrations",
        examples=["CFO-1", "CFO-2", None]
    )

    description: Optional[str] = Field(
        description="Optional description",
        examples=["Main checking account", None]
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
                "code": "BANK_SBER",
                "name": "Sberbank Account",
                "description": "Main checking account",
                "valid_from": "2025-10-14T12:00:00Z",
                "valid_to": "9999-12-31T23:59:59Z",
                "is_current": True,
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
