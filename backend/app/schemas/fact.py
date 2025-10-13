"""
Pydantic schemas for Fact endpoints.

This module defines request/response schemas for budget fact (transaction) CRUD operations.
Facts represent actual income/expense transactions.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator


class FactCreate(BaseModel):
    """
    Schema for creating a new budget fact (transaction).

    Validation Rules:
        - article_id: Required, must exist
        - fact_date: Required, cannot be in future
        - amount: Required, must be > 0
        - description: Optional, max 1000 characters

    Notes:
        - user_id is set automatically from current_user
        - financial_center_id and cost_center_id are optional (for future use)
    """

    article_id: int = Field(
        ...,
        gt=0,
        description="Budget category/article ID (must exist)",
        examples=[1, 5, 10]
    )

    fact_date: date = Field(
        ...,
        description="Transaction date (cannot be in future)",
        examples=["2025-10-13", "2025-09-15"]
    )

    amount: Decimal = Field(
        ...,
        gt=0,
        max_digits=15,
        decimal_places=2,
        description="Transaction amount (positive values only)",
        examples=["50.75", "1200.00", "15.99"]
    )

    description: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Optional transaction description/notes",
        examples=["Weekly groceries", "October salary", None]
    )

    financial_center_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Financial center ID (optional, for advanced budgeting)",
        examples=[None, 1]
    )

    cost_center_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Cost center ID (optional, for advanced budgeting)",
        examples=[None, 1]
    )

    @field_validator("fact_date")
    @classmethod
    def date_validation(cls, v: date) -> date:
        """
        Validate transaction date.

        Rules:
        - Cannot be in the future
        - Cannot be more than 10 years in the past (configurable)
        """
        today = date.today()

        if v > today:
            raise ValueError("Fact date cannot be in the future")

        # Check if date is too old (more than 10 years ago)
        ten_years_ago = today - timedelta(days=365 * 10)
        if v < ten_years_ago:
            raise ValueError(
                f"Fact date cannot be more than 10 years in the past (earliest: {ten_years_ago.isoformat()})"
            )

        return v

    @field_validator("amount")
    @classmethod
    def amount_validation(cls, v: Decimal) -> Decimal:
        """
        Validate transaction amount.

        Rules:
        - Must be positive (> 0)
        - Cannot exceed 1 billion (reasonable upper limit)
        - Maximum 2 decimal places
        """
        if v <= 0:
            raise ValueError("Amount must be greater than zero")

        # Check upper bound (1 billion)
        max_amount = Decimal("1000000000.00")
        if v > max_amount:
            raise ValueError(
                f"Amount cannot exceed {max_amount:,.2f} (1 billion)"
            )

        # Check decimal places (should be handled by Field, but double-check)
        if v.as_tuple().exponent < -2:
            raise ValueError("Amount cannot have more than 2 decimal places")

        return v

    @field_validator("description")
    @classmethod
    def description_trimmed(cls, v: Optional[str]) -> Optional[str]:
        """
        Trim and validate description.

        Rules:
        - Trim leading/trailing whitespace
        - Return None if empty after trimming
        """
        if not v:
            return None

        trimmed = v.strip()

        if not trimmed:
            return None

        return trimmed


class FactUpdate(BaseModel):
    """
    Schema for updating an existing budget fact.

    All fields are optional (partial update).
    Note: Unlike Articles, Facts do NOT use SCD Type 2.
    Updates modify the record in-place.

    Validation Rules:
        - Same validation as FactCreate for provided fields
        - At least one field must be provided
    """

    article_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Budget category/article ID",
        examples=[5]
    )

    fact_date: Optional[date] = Field(
        default=None,
        description="Transaction date",
        examples=["2025-10-13"]
    )

    amount: Optional[Decimal] = Field(
        default=None,
        gt=0,
        max_digits=15,
        decimal_places=2,
        description="Transaction amount",
        examples=["75.00"]
    )

    description: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Transaction description/notes",
        examples=["Updated description"]
    )

    financial_center_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Financial center ID",
        examples=[1]
    )

    cost_center_id: Optional[int] = Field(
        default=None,
        gt=0,
        description="Cost center ID",
        examples=[1]
    )

    @field_validator("fact_date")
    @classmethod
    def date_validation(cls, v: Optional[date]) -> Optional[date]:
        """Validate transaction date if provided."""
        if v is None:
            return None

        today = date.today()

        if v > today:
            raise ValueError("Fact date cannot be in the future")

        # Check if date is too old (more than 10 years ago)
        ten_years_ago = today - timedelta(days=365 * 10)
        if v < ten_years_ago:
            raise ValueError(
                f"Fact date cannot be more than 10 years in the past (earliest: {ten_years_ago.isoformat()})"
            )

        return v

    @field_validator("amount")
    @classmethod
    def amount_validation(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        """Validate transaction amount if provided."""
        if v is None:
            return None

        if v <= 0:
            raise ValueError("Amount must be greater than zero")

        # Check upper bound (1 billion)
        max_amount = Decimal("1000000000.00")
        if v > max_amount:
            raise ValueError(
                f"Amount cannot exceed {max_amount:,.2f} (1 billion)"
            )

        # Check decimal places
        if v.as_tuple().exponent < -2:
            raise ValueError("Amount cannot have more than 2 decimal places")

        return v

    @field_validator("description")
    @classmethod
    def description_trimmed(cls, v: Optional[str]) -> Optional[str]:
        """Trim and validate description if provided."""
        if not v:
            return None

        trimmed = v.strip()

        if not trimmed:
            return None

        return trimmed


class FactResponse(BaseModel):
    """
    Schema for budget fact responses.

    Includes all fact fields including audit timestamps.

    Notes:
        - No SCD Type 2 fields (is_current, valid_from, valid_to)
        - Facts are simple transactional records
    """

    id: int = Field(
        description="Fact ID (primary key)",
        examples=[1, 123]
    )

    user_id: int = Field(
        description="Owner user ID",
        examples=[123]
    )

    article_id: int = Field(
        description="Budget category/article ID",
        examples=[1]
    )

    fact_date: date = Field(
        description="Transaction date",
        examples=["2025-10-13"]
    )

    amount: Decimal = Field(
        description="Transaction amount",
        examples=["50.75"]
    )

    description: Optional[str] = Field(
        description="Transaction description/notes",
        examples=["Weekly groceries", None]
    )

    financial_center_id: Optional[int] = Field(
        default=None,
        description="Financial center ID (optional)",
        examples=[None, 1]
    )

    cost_center_id: Optional[int] = Field(
        default=None,
        description="Cost center ID (optional)",
        examples=[None, 1]
    )

    # Audit fields
    created_at: datetime = Field(
        description="Record creation timestamp",
        examples=["2025-10-13T12:00:00Z"]
    )

    updated_at: datetime = Field(
        description="Record last update timestamp",
        examples=["2025-10-13T12:30:00Z"]
    )

    model_config = {
        "from_attributes": True,  # Allow ORM mode for SQLModel compatibility
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 123,
                "article_id": 5,
                "fact_date": "2025-10-13",
                "amount": "50.75",
                "description": "Weekly groceries at supermarket",
                "financial_center_id": None,
                "cost_center_id": None,
                "created_at": "2025-10-13T12:00:00Z",
                "updated_at": "2025-10-13T12:00:00Z"
            }
        }
    }


class FactListResponse(BaseModel):
    """
    Schema for paginated fact list responses.

    Returns list of facts with pagination metadata.
    """

    facts: list[FactResponse] = Field(
        description="List of budget facts",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of facts (before pagination)",
        examples=[100]
    )

    limit: int = Field(
        description="Maximum number of facts returned",
        examples=[50]
    )

    offset: int = Field(
        description="Number of facts skipped",
        examples=[0]
    )


class FactSummary(BaseModel):
    """
    Schema for aggregated fact summary.

    Provides income/expense totals for a given period.
    """

    total_income: Decimal = Field(
        description="Total income amount",
        examples=["5000.00"]
    )

    total_expense: Decimal = Field(
        description="Total expense amount",
        examples=["3500.00"]
    )

    balance: Decimal = Field(
        description="Balance (income - expense)",
        examples=["1500.00"]
    )

    count_income: int = Field(
        description="Number of income transactions",
        examples=[5]
    )

    count_expense: int = Field(
        description="Number of expense transactions",
        examples=[42]
    )

    date_from: Optional[date] = Field(
        default=None,
        description="Start date of period (if filtered)",
        examples=["2025-10-01", None]
    )

    date_to: Optional[date] = Field(
        default=None,
        description="End date of period (if filtered)",
        examples=["2025-10-31", None]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "total_income": "5000.00",
                "total_expense": "3500.00",
                "balance": "1500.00",
                "count_income": 5,
                "count_expense": 42,
                "date_from": "2025-10-01",
                "date_to": "2025-10-31"
            }
        }
    }
