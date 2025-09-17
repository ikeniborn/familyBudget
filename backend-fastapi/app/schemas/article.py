"""
Article schemas.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class ArticleBase(BaseModel):
    """Base article schema."""
    code: str = Field(..., min_length=1, max_length=50, description="Article code")
    name: str = Field(..., min_length=1, max_length=255, description="Article name")
    description: Optional[str] = Field(None, max_length=500, description="Article description")
    is_active: bool = Field(True, description="Is active flag")


class ArticleCreate(ArticleBase):
    """Article creation schema."""
    user_id: int = Field(..., description="User ID")


class ArticleUpdate(BaseModel):
    """Article update schema."""
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="Article code")
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None


class ArticleInDB(ArticleBase):
    """Article schema for database operations."""
    id: int
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ArticlePublic(ArticleInDB):
    """Public article schema."""

    @classmethod
    def from_db_model(cls, article, current_user=None):
        """Create schema instance from database model."""
        return cls(
            id=article.id,
            code=article.code,
            name=article.name,
            description=article.description,
            is_active=article.is_active,
            user_id=article.user_id,
            created_at=article.created_at,
            updated_at=article.updated_at
        )


class ArticleStats(BaseModel):
    """Article statistics schema."""
    total: int = Field(description="Total articles count")
    active: int = Field(description="Active articles count")
    inactive: int = Field(description="Inactive articles count")