"""Medicine course model — an intake plan assigned to a family member."""
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import JSON
from sqlmodel import Column, Field, SQLModel


class MedicineCourse(SQLModel, table=True):
    """A course of a medicine for one patient (family member)."""

    __tablename__ = "t_f_medicine_course"

    id: int | None = Field(default=None, primary_key=True)
    medicine_id: int = Field(foreign_key="t_d_medicine.id", index=True, nullable=False)
    patient_id: int = Field(foreign_key="t_d_family_member.id", index=True, nullable=False,
                            description="Who the course is for")
    prescribed_by: str | None = Field(default=None, max_length=255, description="Doctor / self")
    dose_amount: Decimal = Field(max_digits=10, decimal_places=3, nullable=False, description="Per intake")
    dose_unit: str = Field(nullable=False, max_length=50)
    intake_times: list[str] = Field(
        sa_column=Column(JSON, nullable=False),
        description='["08:00","14:00","20:00"] in SYSTEM_TIMEZONE; frequency = len(intake_times)',
    )
    with_food: str | None = Field(default=None, max_length=10, description="before/with/after/any")
    start_date: date = Field(nullable=False)
    end_date: date | None = Field(default=None, description="NULL = ongoing")
    schedule_type: str = Field(default="daily", nullable=False, max_length=20,
                               description="daily/every_n_days/weekdays")
    schedule_config: dict | None = Field(
        default=None, sa_column=Column(JSON, nullable=True),
        description='{"n":2} or {"days":["mon","wed","fri"]}',
    )
    is_active: bool = Field(default=True, nullable=False, index=True)
    reminders_enabled: bool = Field(default=True, nullable=False)
    notification_channels: list[str] = Field(
        default_factory=lambda: ["telegram", "web_push"],
        sa_column=Column(JSON, nullable=False),
    )
    snooze_minutes: int = Field(default=30, nullable=False, description="Per-course snooze override")
    comment: str | None = Field(default=None)
    deleted_at: datetime | None = Field(default=None, index=True, description="Soft delete (completed course)")
    creator_id: int = Field(foreign_key="t_d_user.id", index=True, nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
