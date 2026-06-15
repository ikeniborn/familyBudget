"""Family member model — including children without an account."""
from datetime import date, datetime

from sqlmodel import Field, SQLModel


class FamilyMember(SQLModel, table=True):
    """A person medicine courses are assigned to. Reminders always go to guardian."""

    __tablename__ = "t_d_family_member"

    id: int | None = Field(default=None, primary_key=True)
    linked_user_id: int | None = Field(default=None, foreign_key="t_d_user.id", index=True,
                                       description="Set if this member has an account")
    guardian_user_id: int = Field(foreign_key="t_d_user.id", index=True, nullable=False,
                                  description="Guardian — reminders always sent here")
    name: str = Field(nullable=False, max_length=255, index=True)
    birth_date: date | None = Field(default=None, description="For age-based dosing")
    notes: str | None = Field(default=None, description="Allergies, specifics")
    is_active: bool = Field(default=True, nullable=False, index=True, description="Soft-archive flag (mirrors Medicine)")
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
