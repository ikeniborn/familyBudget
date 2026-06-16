"""Pydantic schemas for family members."""
from datetime import date, datetime

from pydantic import BaseModel, Field, field_validator


class FamilyMemberCreate(BaseModel):
    name: str = Field(..., max_length=255, min_length=1)
    guardian_user_id: int | None = Field(
        default=None,
        description="Guardian user id; defaults to the current user when omitted",
    )
    linked_user_id: int | None = Field(default=None)
    birth_date: date | None = Field(default=None)
    notes: str | None = Field(default=None)

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("Name cannot be empty")
        return v.strip()


class FamilyMemberUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=255, min_length=1)
    guardian_user_id: int | None = Field(default=None)
    linked_user_id: int | None = Field(default=None)
    birth_date: date | None = Field(default=None)
    notes: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)


class FamilyMemberResponse(BaseModel):
    id: int
    name: str
    guardian_user_id: int
    linked_user_id: int | None
    birth_date: date | None
    notes: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class FamilyMemberListResponse(BaseModel):
    family_members: list[FamilyMemberResponse]
    total: int
