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
    user_id: Optional[int] = Field(None, description="User ID (null for shared centers)")
    managed_by: Optional[int] = Field(None, description="Manager user ID")


class FinancialCenterUpdate(BaseModel):
    """Financial center update schema."""
    code: Optional[str] = Field(None, min_length=1, max_length=20, description="Financial center code")
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None
    managed_by: Optional[int] = Field(None, description="Manager user ID")


class FinancialCenterInDB(FinancialCenterBase):
    """Financial center schema for database operations."""
    id: int
    user_id: Optional[int] = None
    created_by: Optional[int] = None
    managed_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_shared: bool = Field(default=False, description="Whether this is a shared center")
    is_editable: bool = Field(default=True, description="Whether current user can edit this center")

    class Config:
        from_attributes = True


class FinancialCenterPublic(FinancialCenterInDB):
    """Public financial center schema."""

    @classmethod
    def from_db_model(cls, center, current_user=None):
        """Create schema instance from database model."""
        is_shared = center.user_id is None
        is_editable = True

        # Determine editability based on admin role and ownership
        if current_user:
            user_role = current_user.get('role', 'user')
            user_id = current_user.get('user_id')

            if is_shared:
                # Shared centers only editable by admins
                is_editable = user_role == 'admin'
            else:
                # User centers editable by owner or admins
                is_editable = user_id == center.user_id or user_role == 'admin'

        return cls(
            id=center.id,
            code=center.code,
            name=center.name,
            description=center.description,
            is_active=center.is_active,
            user_id=center.user_id,
            created_by=center.created_by,
            managed_by=center.managed_by,
            created_at=center.created_at,
            updated_at=center.updated_at,
            is_shared=is_shared,
            is_editable=is_editable
        )