"""
Scheduled Reminder model for plan notifications.

Stores reminder configuration for budget plans (record_type='plan').
Each plan can have at most one scheduled reminder (enforced by UNIQUE constraint).
"""

from datetime import datetime

from sqlmodel import Field, SQLModel


class ScheduledReminder(SQLModel, table=True):
    """
    Scheduled reminder for a budget plan.

    Table: t_scheduled_reminder
    Pattern: Service table (no SCD history tracking)

    Constraints:
        - One reminder per plan (UNIQUE on fact_id)
        - fact_id must reference a plan (record_type='plan') - enforced in service layer
        - CASCADE delete when plan is deleted

    Status values:
        - pending: Reminder scheduled, not yet sent
        - sent: Reminder successfully sent via at least one channel
        - failed: All send attempts failed after max retries
        - cancelled: Reminder cancelled by user (via edit modal)

    Attributes:
        id: Primary key
        fact_id: Reference to budget plan (unique, one-to-one)
        reminder_datetime: When to send the reminder (naive datetime in SYSTEM_TIMEZONE)
        status: Current status (pending/sent/failed/cancelled)
        sent_at: When reminder was actually sent
        telegram_sent: Whether Telegram notification was sent
        web_push_sent: Whether Web Push notification was sent
        error_message: Last error message (for debugging)
        retry_count: Number of failed send attempts
        created_at: When reminder was created
        updated_at: When reminder was last modified
    """

    __tablename__ = "t_scheduled_reminder"

    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Auto-incrementing primary key"
    )

    fact_id: int = Field(
        nullable=False,
        # NOTE: No FK constraint because t_f_budget_fact is partitioned
        # (PK includes fact_date). Referential integrity at application level.
        index=True,
        unique=True,
        description="Reference to budget plan (one-to-one). No FK due to partitioned table."
    )

    reminder_datetime: datetime = Field(
        nullable=False,
        index=True,
        description="When to send the reminder (naive datetime in SYSTEM_TIMEZONE)"
    )

    status: str = Field(
        default="pending",
        max_length=20,
        nullable=False,
        description="Status: pending, sent, failed, cancelled"
    )

    sent_at: datetime | None = Field(
        default=None,
        description="When reminder was actually sent"
    )

    telegram_sent: bool = Field(
        default=False,
        description="Whether Telegram notification was sent successfully"
    )

    web_push_sent: bool = Field(
        default=False,
        description="Whether Web Push notification was sent to at least one subscription"
    )

    error_message: str | None = Field(
        default=None,
        max_length=1000,
        description="Last error message for debugging failed reminders"
    )

    retry_count: int = Field(
        default=0,
        description="Number of failed send attempts (max 3 before marking as failed)"
    )

    created_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="When reminder was created"
    )

    updated_at: datetime = Field(
        default_factory=datetime.utcnow,
        nullable=False,
        description="When reminder was last modified"
    )

    # Helper methods

    def is_due(self) -> bool:
        """Check if reminder is due (datetime <= now and still pending)."""
        # Import here to avoid circular imports
        from backend.app.utils.timezone import now_local
        # reminder_datetime is stored in SYSTEM_TIMEZONE, compare with current SYSTEM_TIMEZONE
        return self.status == "pending" and self.reminder_datetime <= now_local().replace(tzinfo=None)

    def is_pending(self) -> bool:
        """Check if reminder is still pending."""
        return self.status == "pending"

    def can_retry(self) -> bool:
        """Check if reminder can be retried (not reached max retries)."""
        return self.retry_count < 3

    def mark_sent(self) -> None:
        """Mark reminder as successfully sent."""
        self.status = "sent"
        self.sent_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def mark_failed(self, error_message: str) -> None:
        """Mark reminder as failed after max retries."""
        self.status = "failed"
        self.error_message = error_message[:1000] if error_message else None
        self.updated_at = datetime.utcnow()

    def increment_retry(self, error_message: str) -> None:
        """Increment retry count after a failed attempt."""
        self.retry_count += 1
        self.error_message = error_message[:1000] if error_message else None
        self.updated_at = datetime.utcnow()

        if not self.can_retry():
            self.mark_failed(error_message)
