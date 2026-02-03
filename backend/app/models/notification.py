"""
Notification model for budget alert tracking.

This module defines the Notification model that stores history of budget
notifications sent to users (or broadcast to all users).
"""
from typing import Optional

from datetime import date, datetime
from decimal import Decimal

from sqlmodel import Field, SQLModel


class Notification(SQLModel, table=True):
    """
    Notification history for budget alerts and reports.

    Stores records of notifications sent when budget thresholds are exceeded.
    Supports both user-specific and broadcast notifications (user_id=NULL).

    Table: t_notification
    Pattern: Transactional fact table (NO SCD Type 2)

    Attributes:
        id: Surrogate primary key (auto-generated)
        user_id: Foreign key to t_d_user.id (NULL for broadcast notifications)
        article_id: Foreign key to t_d_article.id (budget category)
        notification_type: Type of notification (threshold/exceeded/report)
        threshold_percent: Threshold percentage that triggered notification (e.g., 90)
        plan_amount: Planned budget amount for the period
        actual_amount: Actual spending amount that triggered notification
        period_start: Start date of monitored period (e.g., month start)
        period_end: End date of monitored period (e.g., month end)
        created_at: Timestamp when notification was sent

    Broadcast Notifications:
        - user_id = NULL means notification was sent to ALL users
        - Unique constraint prevents duplicate broadcasts for same period
        - Used for shared budget alerts in family budget scenarios

    Example:
        # Create broadcast notification (sent to all users)
        notification = Notification(
            user_id=None,  # Broadcast
            article_id=5,
            notification_type="budget_threshold",
            threshold_percent=90,
            plan_amount=Decimal("10000.00"),
            actual_amount=Decimal("9500.00"),
            period_start=date(2025, 10, 1),
            period_end=date(2025, 10, 31),
        )
    """

    __tablename__ = "t_notification"

    # Primary key
    id: Optional[int] = Field(
        default=None,
        primary_key=True,
        description="Surrogate primary key"
    )

    # Foreign keys
    user_id: Optional[int] = Field(
        default=None,
        foreign_key="t_d_user.id",
        nullable=True,
        index=True,
        description="User ID for user-specific notifications. NULL = broadcast to all users"
    )

    article_id: int = Field(
        foreign_key="t_d_article.id",
        nullable=False,
        index=True,
        description="Budget category/article that triggered notification"
    )

    # Notification details
    notification_type: str = Field(
        nullable=False,
        max_length=50,
        index=True,
        description="Type: budget_threshold, budget_exceeded, weekly_report"
    )

    threshold_percent: int = Field(
        default=90,
        nullable=False,
        description="Threshold percentage that triggered notification (e.g., 90 for 90%)"
    )

    plan_amount: Decimal = Field(
        nullable=False,
        max_digits=15,
        decimal_places=2,
        description="Planned budget amount for the period"
    )

    actual_amount: Decimal = Field(
        nullable=False,
        max_digits=15,
        decimal_places=2,
        description="Actual spending that triggered notification"
    )

    # Period definition
    period_start: date = Field(
        nullable=False,
        description="Start of monitored period (e.g., month start)"
    )

    period_end: date = Field(
        nullable=False,
        description="End of monitored period (e.g., month end)"
    )

    # Audit fields
    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        index=True,
        description="Timestamp when notification was sent"
    )

    def __repr__(self) -> str:
        """String representation of Notification model."""
        user_scope = "ALL USERS" if self.user_id is None else f"user_{self.user_id}"
        return (
            f"Notification(id={self.id}, {user_scope}, "
            f"type={self.notification_type}, article_id={self.article_id}, "
            f"period={self.period_start} to {self.period_end})"
        )

    def is_broadcast(self) -> bool:
        """
        Check if this is a broadcast notification.

        Returns:
            bool: True if notification was sent to all users (user_id=NULL)
        """
        return self.user_id is None

    def get_usage_percent(self) -> float:
        """
        Calculate budget usage percentage.

        Returns:
            float: Percentage of budget used (actual/plan * 100)
        """
        if self.plan_amount == 0:
            return 0.0
        return float((self.actual_amount / self.plan_amount) * 100)

    def is_threshold_exceeded(self) -> bool:
        """
        Check if threshold was exceeded.

        Returns:
            bool: True if actual amount exceeds threshold percentage of plan
        """
        return self.get_usage_percent() >= self.threshold_percent
