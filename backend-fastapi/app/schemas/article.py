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
    user_id: Optional[int] = Field(None, description="User ID (null for shared articles)")
    managed_by: Optional[int] = Field(None, description="Manager user ID")


class ArticleUpdate(BaseModel):
    """Article update schema."""
    code: Optional[str] = Field(None, min_length=1, max_length=50, description="Article code")
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)
    is_active: Optional[bool] = None
    managed_by: Optional[int] = Field(None, description="Manager user ID")


class ArticleInDB(ArticleBase):
    """Article schema for database operations."""
    id: int
    user_id: Optional[int] = None
    created_by: Optional[int] = None
    managed_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    is_shared: bool = Field(default=False, description="Whether this is a shared article")
    is_editable: bool = Field(default=True, description="Whether current user can edit this article")

    class Config:
        from_attributes = True


class ArticlePublic(ArticleInDB):
    """Public article schema."""

    @classmethod
    def from_db_model(cls, article, current_user=None):
        """Create schema instance from database model."""
        is_shared = article.user_id is None
        is_editable = True

        # Determine editability based on admin role and ownership
        if current_user:
            user_role = current_user.get('role', 'user')
            user_id = current_user.get('user_id')

            if is_shared:
                # Shared articles only editable by admins
                is_editable = user_role == 'admin'
            else:
                # User articles editable by owner or admins
                is_editable = user_id == article.user_id or user_role == 'admin'

        return cls(
            id=article.id,
            code=article.code,
            name=article.name,
            description=article.description,
            is_active=article.is_active,
            user_id=article.user_id,
            created_by=article.created_by,
            managed_by=article.managed_by,
            created_at=article.created_at,
            updated_at=article.updated_at,
            is_shared=is_shared,
            is_editable=is_editable
        )


class ArticleStats(BaseModel):
    """Article statistics schema."""
    total: int = Field(description="Total articles count")
    active: int = Field(description="Active articles count")
    inactive: int = Field(description="Inactive articles count")
    shared: int = Field(description="Shared articles count")
    user_specific: int = Field(description="User-specific articles count")