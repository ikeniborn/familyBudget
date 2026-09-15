"""Pydantic schemas for medicine stock (аптечка)."""
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator


def validate_stock_invariants(quantity_remaining: Decimal | None, quantity_initial: Decimal | None,
                              expiry_date: date | None, purchase_date: date | None) -> None:
    """Cross-field stock invariants; raises ValueError. Shared by create and merged PATCH."""
    if quantity_remaining is not None and quantity_initial is not None \
            and quantity_remaining > quantity_initial:
        raise ValueError("quantity_remaining must not exceed quantity_initial")
    if expiry_date is not None and purchase_date is not None and expiry_date < purchase_date:
        raise ValueError("expiry_date must not be before purchase_date")


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

    @model_validator(mode="after")
    def invariants(self) -> "MedicineStockCreate":
        validate_stock_invariants(self.quantity_remaining, self.quantity_initial,
                                  self.expiry_date, self.purchase_date)
        return self


class MedicineStockUpdate(BaseModel):
    version: int = Field(..., ge=1,
        description="Optimistic lock: the version the client last read; stale → 409")
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


class MedicineSpendByMedicine(BaseModel):
    medicine_id: int
    medicine_name: str
    total_spent: Decimal
    package_count: int


class MedicineAnalyticsResponse(BaseModel):
    total_spent: Decimal
    by_medicine: list[MedicineSpendByMedicine]
