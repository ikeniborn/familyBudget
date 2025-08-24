"""
Registry schemas.
"""
from typing import Optional
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field


class RegistryBase(BaseModel):
    """Base registry schema."""
    operation_date: datetime = Field(..., description="Operation date")
    period_id: int = Field(..., description="Period ID")
    financial_center_id: int = Field(..., description="Financial center ID")
    cost_center_id: int = Field(..., description="Cost center ID")
    nomenclature_id: int = Field(..., description="Nomenclature ID")
    row_type_id: int = Field(..., description="Row type ID")
    cost_sum: Decimal = Field(..., description="Cost sum")
    comment: Optional[str] = Field(None, max_length=1000, description="Comment")


class RegistryCreate(RegistryBase):
    """Registry creation schema."""
    pass


class RegistryUpdate(BaseModel):
    """Registry update schema."""
    operation_date: Optional[datetime] = None
    period_id: Optional[int] = None
    financial_center_id: Optional[int] = None
    cost_center_id: Optional[int] = None
    nomenclature_id: Optional[int] = None
    row_type_id: Optional[int] = None
    cost_sum: Optional[Decimal] = None
    comment: Optional[str] = None


class RegistryInDB(RegistryBase):
    """Registry schema for database operations."""
    id: int
    user_id: int

    class Config:
        from_attributes = True


class RegistryPublic(RegistryInDB):
    """Public registry schema with related data."""
    pass


class RegistryWithDetails(RegistryInDB):
    """Registry schema with related entity details."""
    period: Optional[dict] = None
    financial_center: Optional[dict] = None
    cost_center: Optional[dict] = None
    nomenclature: Optional[dict] = None
    row_type: Optional[dict] = None
    user: Optional[dict] = None

    class Config:
        from_attributes = True