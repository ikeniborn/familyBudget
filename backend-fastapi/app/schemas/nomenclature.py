"""
Nomenclature schemas.
"""
from pydantic import BaseModel, Field


class NomenclatureBase(BaseModel):
    """Base nomenclature schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Nomenclature name")
    account_name: str = Field(..., min_length=1, max_length=255, description="Account name")
    bill_name: str = Field(..., min_length=1, max_length=255, description="Bill name")
    operation: str = Field(..., min_length=1, max_length=255, description="Operation name")
    is_budget: bool = Field(..., description="Is budget flag")
    is_fact: bool = Field(..., description="Is fact flag")


class NomenclatureCreate(NomenclatureBase):
    """Nomenclature creation schema."""
    pass


class NomenclatureUpdate(BaseModel):
    """Nomenclature update schema."""
    name: str = Field(None, min_length=1, max_length=255)
    account_name: str = Field(None, min_length=1, max_length=255)
    bill_name: str = Field(None, min_length=1, max_length=255)
    operation: str = Field(None, min_length=1, max_length=255)
    is_budget: bool = None
    is_fact: bool = None


class NomenclatureInDB(NomenclatureBase):
    """Nomenclature schema for database operations."""
    id: int

    class Config:
        from_attributes = True


class NomenclaturePublic(NomenclatureInDB):
    """Public nomenclature schema."""
    pass