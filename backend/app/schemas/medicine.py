"""Pydantic schemas for the medicine catalog."""
from datetime import datetime

from pydantic import BaseModel, Field, field_validator

VALID_FORMS = {"tablet", "capsule", "syrup", "drops", "ointment", "spray", "injection", "other"}


class MedicineCreate(BaseModel):
    name: str = Field(..., max_length=255, min_length=1)
    form: str = Field(..., description="One of VALID_FORMS")
    inn: str | None = Field(default=None, max_length=255)
    dosage: str | None = Field(default=None, max_length=100)
    prescription_required: bool = Field(default=False)
    notes: str | None = Field(default=None)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Medicine name cannot be empty")
        return v.strip()

    @field_validator("form")
    @classmethod
    def form_valid(cls, v: str) -> str:
        if v not in VALID_FORMS:
            raise ValueError(f"form must be one of {sorted(VALID_FORMS)}")
        return v


class MedicineUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255, min_length=1)
    form: str | None = Field(default=None)
    inn: str | None = Field(default=None, max_length=255)
    dosage: str | None = Field(default=None, max_length=100)
    prescription_required: bool | None = Field(default=None)
    notes: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)

    @field_validator("form")
    @classmethod
    def form_valid(cls, v: str | None) -> str | None:
        if v is not None and v not in VALID_FORMS:
            raise ValueError(f"form must be one of {sorted(VALID_FORMS)}")
        return v


class MedicineResponse(BaseModel):
    id: int
    name: str
    inn: str | None
    form: str
    dosage: str | None
    prescription_required: bool
    notes: str | None
    is_active: bool
    creator_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MedicineListResponse(BaseModel):
    medicines: list[MedicineResponse]
    total: int
    limit: int
    offset: int
