"""
Cost Center schemas.
"""
from pydantic import BaseModel, Field


class CostCenterBase(BaseModel):
    """Base cost center schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Cost center name")
    is_active: bool = Field(True, description="Cost center active status")


class CostCenterCreate(CostCenterBase):
    """Cost center creation schema."""
    pass


class CostCenterUpdate(BaseModel):
    """Cost center update schema."""
    name: str = Field(None, min_length=1, max_length=255)
    is_active: bool = None


class CostCenterInDB(CostCenterBase):
    """Cost center schema for database operations."""
    id: int
    user_id: int

    class Config:
        from_attributes = True


class CostCenterPublic(CostCenterInDB):
    """Public cost center schema."""
    pass