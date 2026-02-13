"""
Pydantic schemas for Notification management endpoints.

This module defines schemas for notification CRUD operations including
broadcast notification support (user_id=NULL).
"""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class NotificationCreate(BaseModel):
    """
    Schema for creating a notification record (bot internal use).

    Used by bot when budget threshold is exceeded.
    Supports both user-specific and broadcast notifications.

    Validation Rules:
        - user_id: Optional (NULL for broadcast to all users)
        - article_id: Required, positive integer
        - notification_type: Must be valid type
        - threshold_percent: 0-100
        - plan_amount, actual_amount: Required, positive
        - period_start, period_end: Valid date range

    Notes:
        - user_id=NULL creates broadcast notification
        - Unique constraint prevents duplicate broadcasts
    """

    user_id: int | None = Field(
        default=None,
        gt=0,
        description="User ID for user-specific notification. NULL = broadcast to all users",
        examples=[None, 123]
    )

    article_id: int = Field(
        ...,
        gt=0,
        description="Budget category/article ID that triggered notification",
        examples=[5]
    )

    notification_type: str = Field(
        ...,
        max_length=50,
        description="Type of notification",
        examples=["budget_threshold", "budget_exceeded", "weekly_report"]
    )

    threshold_percent: int = Field(
        default=90,
        ge=0,
        le=100,
        description="Threshold percentage (0-100)",
        examples=[90, 100]
    )

    plan_amount: Decimal = Field(
        ...,
        gt=0,
        decimal_places=2,
        description="Planned budget amount for period",
        examples=[10000.00]
    )

    actual_amount: Decimal = Field(
        ...,
        ge=0,
        decimal_places=2,
        description="Actual spending that triggered notification",
        examples=[9500.00]
    )

    period_start: date = Field(
        ...,
        description="Start of monitored period",
        examples=["2025-10-01"]
    )

    period_end: date = Field(
        ...,
        description="End of monitored period",
        examples=["2025-10-31"]
    )


class NotificationRead(BaseModel):
    """
    Schema for reading notification data.

    Used in GET endpoints for retrieving notification history.
    Includes all notification fields plus computed usage percentage.
    """

    id: int = Field(
        description="Notification ID",
        examples=[1]
    )

    user_id: int | None = Field(
        default=None,
        description="User ID (NULL = broadcast)",
        examples=[None, 123]
    )

    article_id: int = Field(
        description="Budget category ID",
        examples=[5]
    )

    article_name: str | None = Field(
        default=None,
        description="Budget category name (joined from Article table)",
        examples=["Продукты"]
    )

    notification_type: str = Field(
        description="Notification type",
        examples=["budget_threshold"]
    )

    threshold_percent: int = Field(
        description="Threshold percentage that triggered notification",
        examples=[90]
    )

    plan_amount: Decimal = Field(
        description="Planned budget amount",
        examples=[10000.00]
    )

    actual_amount: Decimal = Field(
        description="Actual spending amount",
        examples=[9500.00]
    )

    period_start: date = Field(
        description="Period start date",
        examples=["2025-10-01"]
    )

    period_end: date = Field(
        description="Period end date",
        examples=["2025-10-31"]
    )

    created_at: datetime = Field(
        description="Notification sent timestamp",
        examples=["2025-10-28T14:30:00Z"]
    )

    model_config = {
        "from_attributes": True,
        "json_schema_extra": {
            "example": {
                "id": 1,
                "user_id": None,
                "article_id": 5,
                "article_name": "Продукты",
                "notification_type": "budget_threshold",
                "threshold_percent": 90,
                "plan_amount": 10000.00,
                "actual_amount": 9500.00,
                "period_start": "2025-10-01",
                "period_end": "2025-10-31",
                "created_at": "2025-10-28T14:30:00Z"
            }
        }
    }


class NotificationList(BaseModel):
    """
    Schema for paginated notification list responses.

    Used in GET /notifications endpoint for browsing notification history.
    Supports filtering and pagination.
    """

    items: list[NotificationRead] = Field(
        description="List of notifications",
        examples=[[]]
    )

    total: int = Field(
        description="Total number of notifications (before pagination)",
        examples=[25]
    )

    skip: int = Field(
        description="Number of notifications skipped",
        examples=[0]
    )

    limit: int = Field(
        description="Maximum number of notifications returned",
        examples=[50]
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "items": [],
                "total": 25,
                "skip": 0,
                "limit": 50
            }
        }
    }
