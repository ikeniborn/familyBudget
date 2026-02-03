"""
Recurring Plan Model

Defines the template for recurring (scheduled) payments in the Family Budget application.
Recurring plans generate BudgetFact records automatically based on frequency settings.

Pattern: Dimension table (SCD Type 1 with soft delete)
Table: t_d_recurring_plan
"""
from typing import Optional

from datetime import date, datetime
from decimal import Decimal

from sqlmodel import Field, SQLModel


class RecurringPlan(SQLModel, table=True):
    """
    Recurring plan template for scheduled payments.

    Stores configuration for recurring income/expense transactions.
    The scheduler job uses this template to auto-generate BudgetFact records.

    Table: t_d_recurring_plan
    Pattern: Dimension table (SCD Type 1 with soft delete via is_active)

    Frequency Types:
        - daily: Every day
        - weekly: Every week on specific day (frequency_value = 0-6, Mon=0)
        - monthly: Every month on specific day (frequency_value = 1-28)
        - quarterly: Every 3 months on specific day (frequency_value = 1-28)

    Duration Options:
        - Indefinite: end_date and occurrences_count both NULL
        - By count: occurrences_count set, stops after N occurrences
        - By date: end_date set, stops after that date

    Examples:
        # Monthly rent payment on the 5th
        >>> plan = RecurringPlan(
        ...     user_id=123,
        ...     article_id=45,
        ...     financial_center_id=1,
        ...     amount=Decimal("50000.00"),
        ...     description="Rent payment",
        ...     frequency_type="monthly",
        ...     frequency_value=5,
        ...     start_date=date(2025, 1, 5),
        ...     record_type="plan"
        ... )

        # Weekly grocery budget on Saturdays
        >>> plan = RecurringPlan(
        ...     user_id=123,
        ...     article_id=12,
        ...     financial_center_id=2,
        ...     amount=Decimal("5000.00"),
        ...     description="Weekly groceries",
        ...     frequency_type="weekly",
        ...     frequency_value=5,  # Saturday
        ...     start_date=date(2025, 1, 4),
        ...     occurrences_count=12,  # For 12 weeks
        ...     record_type="plan"
        ... )
    """

    __tablename__ = "t_d_recurring_plan"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Auto-incrementing primary key"
    )

    # Foreign keys to dimensions (required)
    user_id: int = Field(
        nullable=False,
        foreign_key="t_d_user.id",
        index=True,
        description="User who owns this recurring plan"
    )

    article_id: int = Field(
        nullable=False,
        foreign_key="t_d_article.id",
        index=True,
        description="Budget category/article for generated transactions"
    )

    financial_center_id: int = Field(
        nullable=False,
        foreign_key="t_d_financial_center.id",
        description="Financial center for generated transactions"
    )

    cost_center_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_cost_center.id",
        description="Cost center (optional) for generated transactions"
    )

    # Frequency configuration
    frequency_type: str = Field(
        nullable=False,
        max_length=20,
        description="Frequency type: daily, weekly, monthly, quarterly"
    )

    frequency_value: Optional[int] = Field(
        default=None,
        description="Day value: for weekly 0-6 (Mon=0), for monthly/quarterly 1-28"
    )

    # Schedule dates
    start_date: date = Field(
        nullable=False,
        description="First occurrence date"
    )

    end_date: Optional[date] = Field(
        default=None,
        description="Last occurrence date (optional, NULL = indefinite)"
    )

    # Occurrence tracking
    occurrences_count: Optional[int] = Field(
        default=None,
        description="Maximum number of occurrences (optional, NULL = indefinite)"
    )

    occurrences_generated: int = Field(
        default=0,
        nullable=False,
        description="Number of BudgetFact records already generated"
    )

    # Transaction template fields
    amount: Decimal = Field(
        nullable=False,
        max_digits=15,
        decimal_places=2,
        description="Transaction amount (always positive)"
    )

    description: Optional[str] = Field(
        default=None,
        max_length=1000,
        description="Transaction description template"
    )

    record_type: str = Field(
        default="plan",
        max_length=10,
        nullable=False,
        description="Record type for generated facts: 'plan' or 'fact'"
    )

    # Reminder settings
    enable_reminder: bool = Field(
        default=False,
        nullable=False,
        description="Whether to create reminders for each generated fact"
    )

    reminder_hour: Optional[int] = Field(
        default=None,
        ge=0,
        le=23,
        description="Hour of reminder time (0-23) in SYSTEM_TIMEZONE. Required if enable_reminder=true"
    )

    reminder_minute: Optional[int] = Field(
        default=None,
        ge=0,
        le=59,
        description="Minute of reminder time (0-59) in SYSTEM_TIMEZONE. Required if enable_reminder=true"
    )

    # Status and tracking
    is_active: bool = Field(
        default=True,
        nullable=False,
        index=True,
        description="Active status (soft delete via is_active=false)"
    )

    next_generation_date: Optional[date] = Field(
        default=None,
        index=True,
        description="Next date for fact generation (used by scheduler)"
    )

    last_generated_date: Optional[date] = Field(
        default=None,
        description="Date of last generated fact"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when record was created"
    )

    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="Timestamp when record was last updated"
    )

    def __repr__(self) -> str:
        """String representation for debugging."""
        try:
            return (
                f"RecurringPlan("
                f"id={self.id}, "
                f"user_id={self.user_id}, "
                f"article_id={self.article_id}, "
                f"frequency={self.frequency_type}, "
                f"amount={self.amount}, "
                f"is_active={self.is_active}"
                f")"
            )
        except Exception:
            d = self.__dict__
            return (
                f"RecurringPlan("
                f"id={d.get('id', '?')}, "
                f"user_id={d.get('user_id', '?')}, "
                f"frequency={d.get('frequency_type', '?')}"
                f")"
            )
