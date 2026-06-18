"""Medicine SCD Type 2 audit history (mirrors product_group_history)."""
from datetime import datetime, timezone

from sqlalchemy import ARRAY, DateTime, String
from sqlmodel import Column, Field, SQLModel

FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


class MedicineHistory(SQLModel, table=True):
    """One row per change to a Medicine. Current version has is_current=True."""

    __tablename__ = "t_d_medicine_history"

    history_id: int | None = Field(default=None, primary_key=True)
    medicine_id: int = Field(foreign_key="t_d_medicine.id", index=True, nullable=False)

    # Snapshot of catalog fields
    creator_id: int = Field(nullable=False, index=True)
    name: str = Field(nullable=False, max_length=255, index=True)
    inn: str | None = Field(default=None, max_length=255)
    form: str = Field(nullable=False, max_length=20)
    dosage: str | None = Field(default=None, max_length=100)
    prescription_required: bool = Field(nullable=False)
    notes: str | None = Field(default=None)
    is_active: bool = Field(nullable=False)

    # SCD2 temporal
    valid_from: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )
    valid_to: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, default=FAR_FUTURE_DATETIME),
    )
    is_current: bool = Field(nullable=False, index=True)

    # Change metadata
    change_type: str = Field(nullable=False, max_length=50, description="CREATE/UPDATE/ARCHIVE/RESTORE")
    changed_fields: list[str] | None = Field(default=None, sa_column=Column(ARRAY(String), nullable=True))
    changed_by_user_id: int | None = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
