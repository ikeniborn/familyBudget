"""
Cost Center schemas.
"""
from pydantic import BaseModel, Field


class CostCenterBase(BaseModel):
    """Base cost center schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Cost center name")


class CostCenterCreate(CostCenterBase):
    """Cost center creation schema."""
    pass


class CostCenterUpdate(BaseModel):
    """Cost center update schema."""
    name: str = Field(None, min_length=1, max_length=255)


class CostCenterInDB(CostCenterBase):
    """Cost center schema for database operations."""
    id: int

    class Config:
        from_attributes = True


class CostCenterPublic(CostCenterInDB):
    """Public cost center schema."""
    pass