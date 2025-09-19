"""
Cost Center schemas.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class CostCenterBase(BaseModel):
    """Base cost center schema."""
    code: str = Field(..., min_length=1, max_length=20, description="Cost center code")
    name: str = Field(..., min_length=1, max_length=255, description="Cost center name")
    description: Optional[str] = Field(None, max_length=500, description="Cost center description")
    is_active: bool = Field(True, description="Cost center active status")


class CostCenterCreate(CostCenterBase):
    """Cost center creation schema."""
    user_id: Optional[int] = Field(None, description="User ID (set automatically from session)")


class CostCenterUpdate(BaseModel):
    """Cost center update schema."""
    code: Optional[str] = Field(None, min_length=1, max_length=20, description="Cost center code")
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class CostCenterInDB(CostCenterBase):
    """Cost center schema for database operations."""
    id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CostCenterPublic(CostCenterInDB):
    """Public cost center schema."""

    @classmethod
    def from_db_model(cls, center, current_user=None):
        """Create schema instance from database model."""
        return cls(
            id=center.id,
            code=center.code,
            name=center.name,
            description=center.description,
            is_active=center.is_active,
            user_id=center.user_id,
            created_at=center.created_at,
            updated_at=center.updated_at
        )