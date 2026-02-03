"""
Pydantic schemas for Fact endpoints.

This module defines request/response schemas for budget fact (transaction) CRUD operations.
Facts represent actual income/expense transactions.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, Field, field_validator, model_validator

from backend.app.schemas.recurring_plan import RecurringPlanResponse
from backend.app.utils.timezone import now_local


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

    description: str | None = Field(
        default=None,
        max_length=1000,
        description="Optional transaction description/notes",
        examples=["Weekly groceries", "October salary", None]
    )

    financial_center_id: int = Field(
        ...,
        gt=0,
        description="Financial center ID (required, for budgeting and tracking)",
        examples=[1, 2]
    )

    cost_center_id: int | None = Field(
        default=None,
        gt=0,
        description="Cost center ID (optional, for advanced budgeting)",
        examples=[None, 1]
    )

    record_type: str = Field(
        default="fact",
        max_length=10,
        description="Record type: 'fact' for actual transactions, 'plan' for budget plans",
        examples=["fact", "plan"]
    )

    is_offline_sync: bool = Field(
        default=False,
        description="True if record created via offline synchronization",
        examples=[False, True]
    )

    content_hash: str | None = Field(
        default=None,
        max_length=32,
        description="MD5 hash of content (article_id|amount|fact_date|description|record_type) for duplicate detection",
        examples=[None, "a1b2c3d4e5f6789012345678901234"]
    )

    sync_hash: str | None = Field(
        default=None,
        max_length=32,
        description="MD5 hash for offline sync deduplication (content_hash|user_id|created_date). Prevents duplicate records during repeated sync attempts.",
        examples=[None, "x7y8z9w1v2u3t4s5r6q7p8o9n0m1l2"]
    )

    @field_validator("record_type")
    @classmethod
    def record_type_validation(cls, v: str) -> str:
        """
        Validate record_type.

        Rules:
        - Must be either 'fact' or 'plan'
        """
        if v not in ("fact", "plan"):
            raise ValueError("record_type must be either 'fact' or 'plan'")
        return v

    @model_validator(mode='after')
    def validate_date_by_record_type(self):
        """
        Validate transaction date based on record_type.

        Rules:
        - For 'fact' (actual transactions): date cannot be in the future
        - For 'plan' (budget plans): date can be in future
        - Both: date must be within reasonable range (not more than 10 years in past)
        """
        fact_date = self.fact_date
        record_type = self.record_type
        today = now_local().date()  # Uses SYSTEM_TIMEZONE from config

        # Check if date is too old (more than 10 years ago) - applies to both fact and plan
        ten_years_ago = today - timedelta(days=365 * 10)
        if fact_date < ten_years_ago:
            raise ValueError(
                f"Date cannot be more than 10 years in the past (earliest: {ten_years_ago.isoformat()})"
            )

        # For 'fact' records: date cannot be in future
        # Allow +1 day tolerance for timezone differences
        # (user in UTC+14 can be up to 14 hours ahead of UTC server time)
        if record_type == "fact" and fact_date > today + timedelta(days=1):
            raise ValueError("Fact date cannot be in the future for actual transactions")

        return self

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
    def description_trimmed(cls, v: str | None) -> str | None:
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

    article_id: int | None = Field(
        default=None,
        gt=0,
        description="Budget category/article ID",
        examples=[5]
    )

    fact_date: date | None = Field(
        default=None,
        description="Transaction date",
        examples=["2025-10-13"]
    )

    amount: Decimal | None = Field(
        default=None,
        gt=0,
        max_digits=15,
        decimal_places=2,
        description="Transaction amount",
        examples=["75.00"]
    )

    description: str | None = Field(
        default=None,
        max_length=1000,
        description="Transaction description/notes",
        examples=["Updated description"]
    )

    financial_center_id: int | None = Field(
        default=None,
        gt=0,
        description="Financial center ID",
        examples=[1]
    )

    cost_center_id: int | None = Field(
        default=None,
        gt=0,
        description="Cost center ID",
        examples=[1]
    )

    record_type: str | None = Field(
        default=None,
        max_length=10,
        description="Record type: 'fact' or 'plan'",
        examples=["fact", "plan"]
    )

    is_offline_sync: bool | None = Field(
        default=None,
        description="Offline sync flag (usually not updated)",
        examples=[None, True, False]
    )

    @field_validator("record_type")
    @classmethod
    def record_type_validation(cls, v: str | None) -> str | None:
        """Validate record_type if provided."""
        if v is not None and v not in ("fact", "plan"):
            raise ValueError("record_type must be either 'fact' or 'plan'")
        return v

    @field_validator("fact_date")
    @classmethod
    def date_validation(cls, v: date | None) -> date | None:
        """Validate transaction date if provided.

        Note: Plans (record_type='plan') can have future dates up to 5 years ahead.
        Since we don't know record_type at schema level during updates,
        we allow future dates for all FactUpdate operations.
        """
        if v is None:
            return None

        today = now_local().date()  # Uses SYSTEM_TIMEZONE from config

        # Check if date is too old (more than 10 years ago)
        ten_years_ago = today - timedelta(days=365 * 10)
        if v < ten_years_ago:
            raise ValueError(
                f"Fact date cannot be more than 10 years in the past (earliest: {ten_years_ago.isoformat()})"
            )

        # Check if date is too far in the future (more than 5 years)
        five_years_future = today + timedelta(days=365 * 5)
        if v > five_years_future:
            raise ValueError(
                f"Fact date cannot be more than 5 years in the future (latest: {five_years_future.isoformat()})"
            )

        return v

    @field_validator("amount")
    @classmethod
    def amount_validation(cls, v: Decimal | None) -> Decimal | None:
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
    def description_trimmed(cls, v: str | None) -> str | None:
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

    Includes all fact fields including audit timestamps and article details.

    Notes:
        - No SCD Type 2 fields (is_current, valid_from, valid_to)
        - Facts are simple transactional records
        - Includes article_type and article_name for frontend convenience
    """

    id: int = Field(
        description="Fact ID (primary key)",
        examples=[1, 123]
    )

    user_id: int = Field(
        description="Owner user ID",
        examples=[123]
    )

    user_name: str | None = Field(
        default=None,
        description="User display name (fallback chain: first_name → username → last_name → telegram_id → id)",
        examples=["Иван", "User 740775802", "Пользователь #1", None]
    )

    article_id: int = Field(
        description="Budget category/article ID",
        examples=[1]
    )

    article_type: str = Field(
        description="Article type (income or expense)",
        examples=["expense", "income"]
    )

    article_name: str = Field(
        description="Article name for display",
        examples=["Groceries", "Salary"]
    )

    fact_date: date = Field(
        description="Transaction date",
        examples=["2025-10-13"]
    )

    amount: Decimal = Field(
        description="Transaction amount",
        examples=["50.75"]
    )

    description: str | None = Field(
        description="Transaction description/notes",
        examples=["Weekly groceries", None]
    )

    financial_center_id: int | None = Field(
        default=None,
        description="Financial center ID (optional)",
        examples=[None, 1]
    )

    financial_center_name: str | None = Field(
        default=None,
        description="Financial center name for display",
        examples=[None, "Личные средства", "Кредитная карта"]
    )

    cost_center_id: int | None = Field(
        default=None,
        description="Cost center ID (optional)",
        examples=[None, 1]
    )

    cost_center_name: str | None = Field(
        default=None,
        description="Cost center name for display",
        examples=[None, "Продукты", "Транспорт"]
    )

    record_type: str = Field(
        description="Record type: 'fact' for actual transactions, 'plan' for budget plans",
        examples=["fact", "plan"]
    )

    is_offline_sync: bool = Field(
        default=False,
        description="True if record was created via offline synchronization",
        examples=[False, True]
    )

    recurring_plan_id: int | None = Field(
        default=None,
        description="ID of recurring plan that generated this fact (None for manual entries)",
        examples=[None, 1, 5]
    )

    recurring_plan: Optional['RecurringPlanResponse'] = Field(
        default=None,
        description="Full recurring plan details when recurring_plan_id is set (null for manual entries)",
        examples=[None, {
            "id": 1,
            "frequency_display": "Ежемесячно",
            "next_generation_date": "2026-01-15",
            "is_active": True
        }]
    )

    has_reminder: bool = Field(
        default=False,
        description="True if ScheduledReminder exists for this fact (for display bell icon)",
        examples=[False, True]
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
                "user_name": "Иван",
                "article_id": 5,
                "article_type": "expense",
                "article_name": "Продукты",
                "fact_date": "2025-10-13",
                "amount": "50.75",
                "description": "Weekly groceries at supermarket",
                "financial_center_id": 1,
                "financial_center_name": "Личные средства",
                "cost_center_id": None,
                "cost_center_name": None,
                "record_type": "fact",
                "is_offline_sync": False,
                "recurring_plan_id": None,
                "recurring_plan": None,
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

    date_from: date | None = Field(
        default=None,
        description="Start date of period (if filtered)",
        examples=["2025-10-01", None]
    )

    date_to: date | None = Field(
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
