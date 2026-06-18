"""Medicine stock — one package = one row (mirrors shopping_list_item: soft-delete + version)."""
from datetime import date, datetime
from decimal import Decimal

from sqlmodel import Field, SQLModel


class MedicineStock(SQLModel, table=True):
    """A single physical package of a medicine on the shelf (аптечка)."""

    __tablename__ = "t_f_medicine_stock"

    id: int | None = Field(default=None, primary_key=True)
    medicine_id: int = Field(foreign_key="t_d_medicine.id", index=True, nullable=False)
    quantity_remaining: Decimal = Field(max_digits=10, decimal_places=3, nullable=False)
    quantity_initial: Decimal = Field(max_digits=10, decimal_places=3, nullable=False)
    unit: str = Field(nullable=False, max_length=50, description="шт/мл/доз")
    expiry_date: date = Field(nullable=False, index=True, description="Alert when < 30 days")
    purchase_date: date | None = Field(default=None)
    purchase_price: Decimal | None = Field(default=None, max_digits=10, decimal_places=2,
                                           description="Module analytics only — NOT budget")
    location: str | None = Field(default=None, max_length=100, description="e.g. 'Кухня, шкаф'")
    creator_id: int = Field(foreign_key="t_d_user.id", index=True, nullable=False)
    version: int = Field(default=1, nullable=False, description="Optimistic locking")
    deleted_at: datetime | None = Field(default=None, index=True, description="Soft delete (NULL = active)")
    last_modified_by: int | None = Field(default=None, foreign_key="t_d_user.id")
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
