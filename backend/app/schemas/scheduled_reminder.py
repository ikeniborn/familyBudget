"""
Pydantic schemas for Scheduled Reminder API.

Defines request/response models for plan reminder management.
Each plan can have at most one scheduled reminder.
"""
from typing import Optional

from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ReminderCreate(BaseModel):
    """
    Schema for creating a scheduled reminder.

    Validation Rules:
        - reminder_datetime: Required, must be in the future

    Notes:
        - One reminder per plan (enforced by DB constraint)
        - fact_id is passed in URL path, not request body
    """

    reminder_datetime: datetime = Field(
        ...,
        description="When to send the reminder (naive, in SYSTEM_TIMEZONE). Must be in the future.",
        examples=["2025-12-10T09:00:00"]
    )

    @field_validator('reminder_datetime')
    @classmethod
    def reminder_must_be_future(cls, v: datetime) -> datetime:
        """Ensure reminder datetime is in the future (in SYSTEM_TIMEZONE)."""
        from backend.app.utils.timezone import now_local
        now = now_local().replace(tzinfo=None)  # Naive datetime in SYSTEM_TIMEZONE
        if v <= now:
            raise ValueError("Reminder datetime must be in the future")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "reminder_datetime": "2025-12-10T09:00:00"
            }
        }
    }


class ReminderUpdate(BaseModel):
    """
    Schema for updating a scheduled reminder.

    Only reminder_datetime can be updated.
    Status changes are handled internally.
    """

    reminder_datetime: datetime = Field(
        ...,
        description="New reminder datetime (naive, in SYSTEM_TIMEZONE). Must be in the future.",
        examples=["2025-12-15T14:00:00"]
    )

    @field_validator('reminder_datetime')
    @classmethod
    def reminder_must_be_future(cls, v: datetime) -> datetime:
        """Ensure reminder datetime is in the future (in SYSTEM_TIMEZONE)."""
        from backend.app.utils.timezone import now_local
        now = now_local().replace(tzinfo=None)  # Naive datetime in SYSTEM_TIMEZONE
        if v <= now:
            raise ValueError("Reminder datetime must be in the future")
        return v

    model_config = {
        "json_schema_extra": {
            "example": {
                "reminder_datetime": "2025-12-15T14:00:00"
            }
        }
    }


class ReminderResponse(BaseModel):
    """
    Schema for reading reminder data.

    Used in GET endpoints and as response for create/update operations.
    """

    id: int = Field(
        description="Reminder ID",
        examples=[1]
    )

    fact_id: int = Field(
        description="Associated budget plan ID",
        examples=[42]
    )

    reminder_datetime: datetime = Field(
        description="When to send the reminder (UTC)",
        examples=["2025-12-10T09:00:00Z"]
    )

    status: str = Field(
        description="Reminder status: pending, sent, failed, cancelled",
        examples=["pending"]
    )

    sent_at: Optional[datetime] = Field(
        default=None,
        description="When reminder was actually sent (UTC)",
        examples=["2025-12-10T09:00:05Z"]
    )

    telegram_sent: bool = Field(
        description="Whether Telegram notification was sent",
        examples=[False]
    )

    web_push_sent: bool = Field(
        description="Whether Web Push notification was sent",
        examples=[False]
    )

    error_message: Optional[str] = Field(
        default=None,
        description="Last error message if failed",
        examples=[None]
    )

    retry_count: int = Field(
        description="Number of failed send attempts",
        examples=[0]
    )

    created_at: datetime = Field(
        description="When reminder was created",
        examples=["2025-12-05T10:00:00Z"]
    )

    updated_at: datetime = Field(
        description="When reminder was last modified",
        examples=["2025-12-05T10:00:00Z"]
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "fact_id": 42,
                "reminder_datetime": "2025-12-10T09:00:00Z",
                "status": "pending",
                "sent_at": None,
                "telegram_sent": False,
                "web_push_sent": False,
                "error_message": None,
                "retry_count": 0,
                "created_at": "2025-12-05T10:00:00Z",
                "updated_at": "2025-12-05T10:00:00Z"
            }
        }
    }


class ReminderWithPlanInfo(ReminderResponse):
    """
    Extended reminder response with plan details.

    Used for displaying reminders in notifications page.
    """

    article_name: Optional[str] = Field(
        default=None,
        description="Category name from linked plan",
        examples=["Продукты"]
    )

    amount: Optional[float] = Field(
        default=None,
        description="Plan amount",
        examples=[5000.00]
    )

    fact_date: Optional[datetime] = Field(
        default=None,
        description="Plan date",
        examples=["2025-12-15"]
    )

    description: Optional[str] = Field(
        default=None,
        description="Plan description",
        examples=["Закупка продуктов на неделю"]
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "fact_id": 42,
                "reminder_datetime": "2025-12-10T09:00:00Z",
                "status": "pending",
                "sent_at": None,
                "telegram_sent": False,
                "web_push_sent": False,
                "error_message": None,
                "retry_count": 0,
                "created_at": "2025-12-05T10:00:00Z",
                "updated_at": "2025-12-05T10:00:00Z",
                "article_name": "Продукты",
                "amount": 5000.00,
                "fact_date": "2025-12-15",
                "description": "Закупка продуктов на неделю"
            }
        }
    }


class ReminderListResponse(BaseModel):
    """
    Schema for paginated reminder list responses.

    Used in GET /reminders endpoint.
    """

    items: list[ReminderWithPlanInfo] = Field(
        description="List of reminders with plan info",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of reminders (before pagination)",
        examples=[5]
    )

    skip: int = Field(
        description="Number of reminders skipped",
        examples=[0]
    )

    limit: int = Field(
        description="Maximum number of reminders returned",
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
