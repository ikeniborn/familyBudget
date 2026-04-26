"""
Pydantic schemas for Recurring Plan API.

Defines request/response models for recurring payment management.
Recurring plans generate BudgetFact records automatically based on frequency.
"""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

from backend.app.utils.timezone import now_local

FrequencyType = Literal["monthly", "quarterly", "yearly"]
RecordType = Literal["plan", "fact"]
DurationType = Literal["indefinite", "count", "end_date"]


class RecurringPlanCreate(BaseModel):
    """
    Schema for creating a recurring plan.

    Validation Rules:
        - article_id, financial_center_id: Required
        - frequency_type: Required (daily/weekly/monthly/quarterly)
        - frequency_value: Required for weekly (0-6) and monthly/quarterly (1-28)
        - start_date: Required, cannot be more than 10 years in the past
        - amount: Required, must be > 0
        - duration: Either indefinite, count, or end_date

    Notes:
        - user_id is set from current_user
        - Generated facts inherit all template fields
    """

    article_id: int = Field(
        ...,
        gt=0,
        description="Budget category ID",
        examples=[1, 5]
    )

    financial_center_id: int = Field(
        ...,
        gt=0,
        description="Financial center (account) ID",
        examples=[1, 2]
    )

    cost_center_id: int | None = Field(
        default=None,
        gt=0,
        description="Cost center ID (optional)",
        examples=[None, 1]
    )

    frequency_type: FrequencyType = Field(
        ...,
        description="Frequency type: daily, weekly, monthly, quarterly",
        examples=["monthly", "weekly"]
    )

    frequency_value: int | None = Field(
        default=None,
        description="Day value: for weekly 0-6 (Mon=0), for monthly/quarterly 1-28",
        examples=[5, 15, None]
    )

    start_date: date = Field(
        ...,
        description="First occurrence date",
        examples=["2025-01-05"]
    )

    end_date: date | None = Field(
        default=None,
        description="Last occurrence date (optional)",
        examples=[None, "2025-12-31"]
    )

    occurrences_count: int | None = Field(
        default=None,
        gt=0,
        le=365,
        description="Maximum occurrences (optional, max 365)",
        examples=[None, 12, 52]
    )

    amount: int = Field(
        ...,
        gt=0,
        strict=True,
        le=1_000_000_000,
        description="Transaction amount in rubles (positive integer)",
        examples=[50000, 5000]
    )

    description: str | None = Field(
        default=None,
        max_length=1000,
        description="Transaction description template",
        examples=["Monthly rent", "Weekly groceries"]
    )

    record_type: RecordType = Field(
        default="plan",
        description="Record type for generated facts: 'plan' or 'fact'",
        examples=["plan", "fact"]
    )

    enable_reminder: bool = Field(
        default=False,
        description="Whether to create reminders for each generated fact",
        examples=[False, True]
    )

    reminder_hour: int | None = Field(
        default=None,
        ge=0,
        le=23,
        description="Hour of reminder time (0-23) in SYSTEM_TIMEZONE",
        examples=[9, 14]
    )

    reminder_minute: int | None = Field(
        default=None,
        ge=0,
        le=59,
        description="Minute of reminder time (0-59) in SYSTEM_TIMEZONE",
        examples=[0, 30]
    )

    @field_validator("start_date")
    @classmethod
    def validate_start_date(cls, v: date) -> date:
        """Validate start_date is within reasonable range."""
        from datetime import timedelta
        today = now_local().date()
        ten_years_ago = today - timedelta(days=365 * 10)

        if v < ten_years_ago:
            raise ValueError("Start date cannot be more than 10 years in the past")

        return v

    @model_validator(mode="after")
    def validate_frequency_value(self):
        """Validate frequency_value based on frequency_type.

        Rules:
        - monthly/quarterly: 1-28 (day of month)
        - yearly: 101-1231 (MMDD format, e.g., 115 = Jan 15, 1231 = Dec 31)
        """
        freq_type = self.frequency_type
        freq_value = self.frequency_value

        if freq_type in ("monthly", "quarterly"):
            if freq_value is None:
                raise ValueError(f"frequency_value is required for {freq_type} frequency")
            if not (1 <= freq_value <= 28):
                raise ValueError("frequency_value must be 1-28 for monthly/quarterly")

        elif freq_type == "yearly":
            if freq_value is None:
                raise ValueError("frequency_value is required for yearly frequency")
            if not (101 <= freq_value <= 1231):
                raise ValueError("yearly frequency_value must be 101-1231 (MMDD format)")

            # Decode and validate month/day
            month = freq_value // 100
            day = freq_value % 100

            if not (1 <= month <= 12):
                raise ValueError(f"Invalid month: {month} (must be 1-12)")

            # Days in month validation (no Feb 29 support)
            days_in_month = {1:31, 2:28, 3:31, 4:30, 5:31, 6:30,
                             7:31, 8:31, 9:30, 10:31, 11:30, 12:31}
            max_day = days_in_month[month]

            if not (1 <= day <= max_day):
                raise ValueError(
                    f"Invalid day {day} for month {month}. Must be 1-{max_day}"
                )

            # Log successful validation
            import logging
            logger = logging.getLogger(__name__)
            logger.info(
                f"[VALIDATION] yearly frequency_value={freq_value} validated "
                f"(month={month}, day={day})"
            )

        return self

    @model_validator(mode="after")
    def validate_end_date(self):
        """Validate end_date is after start_date."""
        if self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must be on or after start_date")
        return self

    @model_validator(mode="after")
    def validate_duration_options(self):
        """Validate that only one duration option is set."""
        if self.end_date and self.occurrences_count:
            raise ValueError("Cannot set both end_date and occurrences_count")
        return self

    @model_validator(mode="after")
    def validate_reminder_time(self):
        """Validate reminder time is complete when enabled."""
        if self.enable_reminder:
            if self.reminder_hour is None or self.reminder_minute is None:
                raise ValueError("reminder_hour and reminder_minute required when enable_reminder=true")
        return self

    @field_validator("description")
    @classmethod
    def trim_description(cls, v: str | None) -> str | None:
        """Trim description whitespace."""
        if v:
            v = v.strip()
            return v if v else None
        return None

    model_config = {
        "json_schema_extra": {
            "example": {
                "article_id": 5,
                "financial_center_id": 1,
                "frequency_type": "monthly",
                "frequency_value": 5,
                "start_date": "2025-01-05",
                "amount": 50000,
                "description": "Monthly rent payment",
                "record_type": "plan"
            }
        }
    }


class RecurringPlanUpdate(BaseModel):
    """
    Schema for updating a recurring plan.

    Only future-affecting fields can be updated:
    - amount, description, cost_center_id
    - end_date, occurrences_count (to stop earlier)
    - is_active (to pause/resume)

    Note: frequency_type, frequency_value, start_date cannot be changed.
    """

    amount: int | None = Field(
        default=None,
        gt=0,
        strict=True,
        le=1_000_000_000,
        description="New transaction amount in rubles (positive integer)",
        examples=[55000]
    )

    description: str | None = Field(
        default=None,
        max_length=1000,
        description="New description template",
        examples=["Updated rent payment"]
    )

    cost_center_id: int | None = Field(
        default=None,
        description="New cost center ID (null to clear)",
        examples=[None, 1]
    )

    end_date: date | None = Field(
        default=None,
        description="New end date (to stop earlier)",
        examples=["2025-06-30"]
    )

    is_active: bool | None = Field(
        default=None,
        description="Active status (false to pause)",
        examples=[True, False]
    )

    @field_validator("description")
    @classmethod
    def trim_description(cls, v: str | None) -> str | None:
        """Trim description whitespace."""
        if v:
            v = v.strip()
            return v if v else None
        return v  # Allow None passthrough

    model_config = {
        "json_schema_extra": {
            "example": {
                "amount": "55000.00",
                "description": "Updated rent payment",
                "is_active": True
            }
        }
    }


class RecurringPlanResponse(BaseModel):
    """
    Schema for recurring plan responses.

    Includes all plan fields plus enriched data.
    """

    id: int = Field(description="Plan ID")
    user_id: int = Field(description="Owner user ID")

    article_id: int = Field(description="Category ID")
    article_name: str | None = Field(default=None, description="Category name")
    article_type: str | None = Field(default=None, description="Category type (income/expense)")

    financial_center_id: int = Field(description="Account ID")
    financial_center_name: str | None = Field(default=None, description="Account name")

    cost_center_id: int | None = Field(default=None, description="Cost center ID")
    cost_center_name: str | None = Field(default=None, description="Cost center name")

    frequency_type: FrequencyType = Field(description="Frequency type")
    frequency_value: int | None = Field(default=None, description="Day value")
    frequency_display: str | None = Field(
        default=None,
        description="Human-readable frequency (e.g., 'Every Monday', 'Every 5th of month')"
    )

    start_date: date = Field(description="First occurrence date")
    end_date: date | None = Field(default=None, description="Last occurrence date")
    occurrences_count: int | None = Field(default=None, description="Max occurrences")
    occurrences_generated: int = Field(description="Facts already generated")

    amount: int = Field(description="Transaction amount in rubles (integer)")
    description: str | None = Field(default=None, description="Description template")
    record_type: RecordType = Field(description="Generated record type")

    enable_reminder: bool = Field(description="Whether reminders are enabled")
    reminder_hour: int | None = Field(default=None, description="Reminder hour (0-23)")
    reminder_minute: int | None = Field(default=None, description="Reminder minute (0-59)")
    reminder_time_display: str | None = Field(
        default=None,
        description="Formatted reminder time (HH:MM)"
    )

    is_active: bool = Field(description="Active status")
    next_generation_date: date | None = Field(default=None, description="Next scheduled date")
    last_generated_date: date | None = Field(default=None, description="Last generated date")

    created_at: datetime = Field(description="Creation timestamp")
    updated_at: datetime = Field(description="Last update timestamp")

    @model_validator(mode="after")
    def compute_reminder_time_display(self):
        """Compute reminder_time_display as HH:MM string."""
        if self.enable_reminder and self.reminder_hour is not None and self.reminder_minute is not None:
            self.reminder_time_display = f"{self.reminder_hour:02d}:{self.reminder_minute:02d}"
        return self

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": 123,
                "article_id": 5,
                "article_name": "Аренда",
                "article_type": "expense",
                "financial_center_id": 1,
                "financial_center_name": "Основной счет",
                "cost_center_id": None,
                "cost_center_name": None,
                "frequency_type": "monthly",
                "frequency_value": 5,
                "frequency_display": "Каждое 5-е число месяца",
                "start_date": "2025-01-05",
                "end_date": None,
                "occurrences_count": None,
                "occurrences_generated": 3,
                "amount": "50000.00",
                "description": "Monthly rent",
                "record_type": "plan",
                "is_active": True,
                "next_generation_date": "2025-04-05",
                "last_generated_date": "2025-03-05",
                "created_at": "2025-01-01T10:00:00Z",
                "updated_at": "2025-03-05T02:00:00Z"
            }
        }
    }


class RecurringPlanListResponse(BaseModel):
    """
    Schema for paginated recurring plan list.
    """

    items: list[RecurringPlanResponse] = Field(
        description="List of recurring plans",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of plans (before pagination)",
        examples=[5]
    )

    skip: int = Field(
        description="Number of plans skipped",
        examples=[0]
    )

    limit: int = Field(
        description="Maximum plans returned",
        examples=[50]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "items": [],
                "total": 5,
                "skip": 0,
                "limit": 50
            }
        }
    }


class RecurringPlanStats(BaseModel):
    """
    Statistics for recurring plans dashboard.
    """

    active_count: int = Field(description="Number of active recurring plans")
    paused_count: int = Field(description="Number of paused plans")
    total_monthly_amount: int = Field(description="Sum of monthly recurring amounts in rubles")
    next_pending_count: int = Field(description="Plans with pending generation today")

    model_config = {
        "json_schema_extra": {
            "example": {
                "active_count": 5,
                "paused_count": 1,
                "total_monthly_amount": "75000.00",
                "next_pending_count": 2
            }
        }
    }
