"""Medicine catalog model (Dimension, SCD Type 1; history in t_d_medicine_history)."""
from datetime import datetime

from sqlmodel import Field, SQLModel


class Medicine(SQLModel, table=True):
    """Shared family medicine catalog. Soft-archive only (is_active=False)."""

    __tablename__ = "t_d_medicine"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(nullable=False, max_length=255, index=True, description="Trade name")
    inn: str | None = Field(default=None, max_length=255, index=True, description="INN — groups analogues")
    form: str = Field(
        nullable=False, max_length=20,
        description="tablet/capsule/syrup/drops/ointment/spray/injection/other",
    )
    dosage: str | None = Field(default=None, max_length=100, description="e.g. '200 mg'")
    prescription_required: bool = Field(default=False, nullable=False)
    notes: str | None = Field(default=None, description="Free text")
    is_active: bool = Field(default=True, nullable=False, index=True, description="Soft-archive flag")
    creator_id: int = Field(foreign_key="t_d_user.id", index=True, nullable=False)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
