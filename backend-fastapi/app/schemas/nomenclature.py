"""
Nomenclature schemas.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class NomenclatureBase(BaseModel):
    """Base nomenclature schema."""
    code: str = Field(..., min_length=1, max_length=50, description="Nomenclature code")
    name: str = Field(..., min_length=1, max_length=255, description="Nomenclature name")
    description: Optional[str] = Field(None, max_length=500, description="Nomenclature description")
    nomenclature_type: Optional[str] = Field("EXPENSE", description="Nomenclature type (INCOME/EXPENSE)")
    account_name: Optional[str] = Field(None, min_length=1, max_length=255, description="Account name")
    bill_name: Optional[str] = Field(None, min_length=1, max_length=255, description="Bill name")
    operation: Optional[str] = Field(None, min_length=1, max_length=255, description="Operation name")
    is_budget: bool = Field(True, description="Is budget flag")
    is_fact: bool = Field(True, description="Is fact flag")
    is_active: bool = Field(True, description="Is active flag")
    parent_id: Optional[int] = Field(None, description="Parent nomenclature ID")
    article_id: Optional[int] = Field(None, description="Article ID")


class NomenclatureCreate(NomenclatureBase):
    """Nomenclature creation schema."""
    user_id: Optional[int] = Field(None, description="User ID (set automatically from session)")


class NomenclatureUpdate(BaseModel):
    """Nomenclature update schema."""
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="Nomenclature code")
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    nomenclature_type: Optional[str] = Field(None, description="Nomenclature type (INCOME/EXPENSE)")
    account_name: Optional[str] = Field(None, min_length=1, max_length=255)
    bill_name: Optional[str] = Field(None, min_length=1, max_length=255)
    operation: Optional[str] = Field(None, min_length=1, max_length=255)
    is_budget: Optional[bool] = None
    is_fact: Optional[bool] = None
    is_active: Optional[bool] = None
    parent_id: Optional[int] = Field(None, description="Parent nomenclature ID")
    article_id: Optional[int] = Field(None, description="Article ID")


class NomenclatureInDB(NomenclatureBase):
    """Nomenclature schema for database operations."""
    id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class NomenclaturePublic(NomenclatureInDB):
    """Public nomenclature schema."""

    @classmethod
    def from_db_model(cls, nomenclature, current_user=None):
        """Create schema instance from database model."""
        return cls(
            id=nomenclature.id,
            code=nomenclature.code,
            name=nomenclature.name,
            description=nomenclature.description,
            nomenclature_type=nomenclature.nomenclature_type.value if nomenclature.nomenclature_type else "EXPENSE",
            account_name=nomenclature.account_name,
            bill_name=nomenclature.bill_name,
            operation=nomenclature.operation,
            is_budget=nomenclature.is_budget,
            is_fact=nomenclature.is_fact,
            is_active=nomenclature.is_active,
            parent_id=nomenclature.parent_id,
            article_id=nomenclature.article_id,
            user_id=nomenclature.user_id,
            created_at=nomenclature.created_at,
            updated_at=nomenclature.updated_at
        )