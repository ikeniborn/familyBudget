"""
Medicine Reminder model for medicine intake notifications.

One row per (intake_log_id, recipient_user_id) — a scheduled push to one recipient
for one dose. Mirrors ScheduledReminder but targets medicine intakes instead of budget plans.
"""
from datetime import datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class MedicineReminder(SQLModel, table=True):
    """
    A scheduled push for one intake_log to one recipient.

    Table: t_medicine_reminder
    Pattern: Service table (no SCD history tracking)

    Constraints:
        - UNIQUE(intake_log_id, recipient_user_id): one reminder per intake per recipient
        - CASCADE behaviour enforced in service layer

    Status values:
        - pending: Reminder scheduled, not yet sent
        - sent: Reminder successfully sent via at least one channel
        - failed: All send attempts failed after max retries
        - cancelled: Reminder cancelled (course paused / intake skipped)

    Attributes:
        id: Primary key
        intake_log_id: Reference to medicine intake log entry
        recipient_user_id: User to notify (may differ from patient — e.g. parent)
        reminder_datetime: When to send (naive datetime in SYSTEM_TIMEZONE)
        status: Current status (pending/sent/failed/cancelled)
        sent_at: When reminder was actually sent
        telegram_sent: Whether Telegram notification was sent
        web_push_sent: Whether Web Push notification was sent
        error_message: Last error message (for debugging)
        retry_count: Number of failed send attempts (max 3 before marking as failed)
        created_at: When reminder was created
        updated_at: When reminder was last modified
    """

    __tablename__ = "t_medicine_reminder"
    __table_args__ = (
        UniqueConstraint("intake_log_id", "recipient_user_id", name="uq_medicine_reminder_intake_recipient"),
    )

    id: int | None = Field(
        default=None,
        primary_key=True,
        description="Auto-incrementing primary key"
    )

    intake_log_id: int = Field(
        foreign_key="t_f_medicine_intake_log.id",
        index=True,
        nullable=False,
        description="Reference to the scheduled dose (intake log entry)"
    )

    recipient_user_id: int = Field(
        foreign_key="t_d_user.id",
        nullable=False,
        description="Whom to notify (may differ from patient — e.g. parent notified for child)"
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
