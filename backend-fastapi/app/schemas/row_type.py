"""
Row Type schemas.
"""
from pydantic import BaseModel, Field


class RowTypeBase(BaseModel):
    """Base row type schema."""
    name: str = Field(..., min_length=1, max_length=255, description="Row type name")


class RowTypeCreate(RowTypeBase):
    """Row type creation schema."""
    pass


class RowTypeUpdate(BaseModel):
    """Row type update schema."""
    name: str = Field(None, min_length=1, max_length=255)


class RowTypeInDB(RowTypeBase):
    """Row type schema for database operations."""
    id: int

    class Config:
        from_attributes = True


class RowTypePublic(RowTypeInDB):
    """Public row type schema."""
    pass