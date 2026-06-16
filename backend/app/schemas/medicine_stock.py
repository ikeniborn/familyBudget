"""Pydantic schemas for medicine stock (аптечка)."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator


class MedicineStockCreate(BaseModel):
    medicine_id: int = Field(...)
    quantity_remaining: Decimal = Field(..., ge=0)
    quantity_initial: Decimal = Field(..., ge=0)
    unit: str = Field(..., max_length=50, min_length=1)
    expiry_date: date = Field(...)
    purchase_date: date | None = Field(default=None)
    purchase_price: Decimal | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=100)

    @field_validator("unit")
    @classmethod
    def unit_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("unit cannot be empty")
        return v.strip()


class MedicineStockUpdate(BaseModel):
    quantity_remaining: Decimal | None = Field(default=None, ge=0)
    quantity_initial: Decimal | None = Field(default=None, ge=0)
    unit: str | None = Field(default=None, max_length=50, min_length=1)
    expiry_date: date | None = Field(default=None)
    purchase_date: date | None = Field(default=None)
    purchase_price: Decimal | None = Field(default=None, ge=0)
    location: str | None = Field(default=None, max_length=100)


class MedicineStockResponse(BaseModel):
    id: int
    medicine_id: int
    quantity_remaining: Decimal
    quantity_initial: Decimal
    unit: str
    expiry_date: date
    purchase_date: date | None
    purchase_price: Decimal | None
    location: str | None
    creator_id: int
    version: int
    deleted_at: datetime | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MedicineStockListResponse(BaseModel):
    stock: list[MedicineStockResponse]
    total: int
    limit: int
    offset: int
