"""
Financial Center schemas.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class FinancialCenterBase(BaseModel):
    """Base financial center schema."""
    code: str = Field(..., min_length=1, max_length=20, description="Financial center code")
    name: str = Field(..., min_length=1, max_length=255, description="Financial center name")
    description: Optional[str] = Field(None, max_length=500, description="Financial center description")
    is_active: bool = Field(True, description="Financial center active status")


class FinancialCenterCreate(FinancialCenterBase):
    """Financial center creation schema."""
    user_id: int = Field(..., description="User ID")


class FinancialCenterUpdate(BaseModel):
    """Financial center update schema."""
    code: Optional[str] = Field(None, min_length=1, max_length=20, description="Financial center code")
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class FinancialCenterInDB(FinancialCenterBase):
    """Financial center schema for database operations."""
    id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class FinancialCenterPublic(FinancialCenterInDB):
    """Public financial center schema."""

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