"""Pydantic schemas for intake_log marking."""
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class IntakeMarkRequest(BaseModel):
    """take/skip body. version is required for optimistic locking (409 on mismatch)."""
    version: int = Field(..., ge=1)
    dose_taken: Decimal | None = Field(default=None, gt=0)
    stock_id: int | None = Field(default=None, description="Deduct from this package; else FIFO by expiry")
    comment: str | None = Field(default=None)


class IntakeResponse(BaseModel):
    id: int
    course_id: int
    patient_id: int
    scheduled_at: datetime
    taken_at: datetime | None
    status: str
    dose_taken: Decimal | None
    stock_id: int | None
    comment: str | None
    marked_by: int | None
    version: int

    model_config = {"from_attributes": True}


class IntakeListItem(IntakeResponse):
    """Intake plus denormalized display fields for the dashboard."""
    medicine_name: str
    patient_name: str
    dose_amount: Decimal
    dose_unit: str
    with_food: str | None


class IntakeListResponse(BaseModel):
    intakes: list[IntakeListItem]
    total: int
