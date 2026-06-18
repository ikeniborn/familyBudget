"""Pydantic schemas for medicine courses."""
import re
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator

VALID_SCHEDULE = {"daily", "every_n_days", "weekdays"}
VALID_FOOD = {"before", "with", "after", "any"}
_TIME_RE = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class MedicineCourseCreate(BaseModel):
    medicine_id: int
    patient_id: int
    dose_amount: Decimal = Field(..., gt=0)
    dose_unit: str = Field(..., max_length=50, min_length=1)
    intake_times: list[str] = Field(..., min_length=1)
    start_date: date
    prescribed_by: str | None = Field(default=None, max_length=255)
    with_food: str | None = Field(default=None)
    end_date: date | None = Field(default=None)
    duration_days: int | None = Field(default=None, ge=1,
        description="If given (and end_date omitted) → end_date computed server-side")
    schedule_type: str = Field(default="daily")
    schedule_config: dict | None = Field(default=None)
    reminders_enabled: bool = Field(default=True)
    notification_channels: list[str] = Field(default_factory=lambda: ["telegram", "web_push"])
    snooze_minutes: int = Field(default=30, ge=1, le=720)
    comment: str | None = Field(default=None)

    @field_validator("intake_times")
    @classmethod
    def times_valid(cls, v: list[str]) -> list[str]:
        for t in v:
            if not _TIME_RE.match(t):
                raise ValueError(f"intake_times entries must be 'HH:MM'; got {t!r}")
        return v

    @field_validator("schedule_type")
    @classmethod
    def schedule_valid(cls, v: str) -> str:
        if v not in VALID_SCHEDULE:
            raise ValueError(f"schedule_type must be one of {sorted(VALID_SCHEDULE)}")
        return v

    @field_validator("with_food")
    @classmethod
    def food_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_FOOD:
            raise ValueError(f"with_food must be one of {sorted(VALID_FOOD)}")
        return v


class MedicineCourseUpdate(BaseModel):
    dose_amount: Decimal | None = Field(default=None, gt=0)
    dose_unit: str | None = Field(default=None, max_length=50, min_length=1)
    intake_times: list[str] | None = Field(default=None, min_length=1)
    prescribed_by: str | None = Field(default=None, max_length=255)
    with_food: str | None = Field(default=None)
    end_date: date | None = Field(default=None)
    schedule_type: str | None = Field(default=None)
    schedule_config: dict | None = Field(default=None)
    reminders_enabled: bool | None = Field(default=None)
    notification_channels: list[str] | None = Field(default=None)
    snooze_minutes: int | None = Field(default=None, ge=1, le=720)
    comment: str | None = Field(default=None)

    @field_validator("intake_times")
    @classmethod
    def times_valid(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return None
        for t in v:
            if not _TIME_RE.match(t):
                raise ValueError(f"intake_times entries must be 'HH:MM'; got {t!r}")
        return v

    @field_validator("schedule_type")
    @classmethod
    def schedule_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_SCHEDULE:
            raise ValueError(f"schedule_type must be one of {sorted(VALID_SCHEDULE)}")
        return v

    @field_validator("with_food")
    @classmethod
    def food_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_FOOD:
            raise ValueError(f"with_food must be one of {sorted(VALID_FOOD)}")
        return v


class StockEstimate(BaseModel):
    """Read-only aggregate: remaining stock and how long it lasts for this course."""
    remaining: Decimal
    intakes_left: int
    days_left: int | None
    in_stock: bool


class MedicineCourseResponse(BaseModel):
    id: int
    medicine_id: int
    patient_id: int
    prescribed_by: str | None
    dose_amount: Decimal
    dose_unit: str
    intake_times: list[str]
    with_food: str | None
    start_date: date
    end_date: date | None
    schedule_type: str
    schedule_config: dict | None
    is_active: bool
    reminders_enabled: bool
    notification_channels: list[str]
    snooze_minutes: int
    comment: str | None
    deleted_at: datetime | None
    creator_id: int
    created_at: datetime
    updated_at: datetime
    estimate: StockEstimate | None = None  # populated on detail/list when requested

    model_config = {"from_attributes": True}


class MedicineCourseListResponse(BaseModel):
    courses: list[MedicineCourseResponse]
    total: int
    limit: int
    offset: int
