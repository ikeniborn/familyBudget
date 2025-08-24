"""
Financial Center schemas.
"""
from pydantic import BaseModel, Field


class FinancialCenterBase(BaseModel):
    """Base financial center schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Financial center name")


class FinancialCenterCreate(FinancialCenterBase):
    """Financial center creation schema."""
    pass


class FinancialCenterUpdate(BaseModel):
    """Financial center update schema."""
    name: str = Field(None, min_length=1, max_length=255)


class FinancialCenterInDB(FinancialCenterBase):
    """Financial center schema for database operations."""
    id: int

    class Config:
        from_attributes = True


class FinancialCenterPublic(FinancialCenterInDB):
    """Public financial center schema."""
    pass