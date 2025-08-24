"""
User schemas.
"""
from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field


class UserBase(BaseModel):
    """Base user schema."""
    user_name: str = Field(..., min_length=1, max_length=100)
    user_email: Optional[str] = None
    username: Optional[str] = None
    telegram_id: Optional[str] = None
    auth_method: str = "telegram"
    is_active: bool = True


class UserCreate(UserBase):
    """User creation schema."""
    password_hash: Optional[str] = None


class UserUpdate(BaseModel):
    """User update schema."""
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    username: Optional[str] = None
    is_active: Optional[bool] = None


class UserInDB(UserBase):
    """User schema for database operations."""
    id: int
    password_hash: Optional[str] = None
    refresh_token: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserPublic(BaseModel):
    """Public user schema (without sensitive data)."""
    id: int
    user_name: str
    user_email: Optional[str] = None
    username: Optional[str] = None
    telegram_id: Optional[str] = None
    auth_method: str
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True