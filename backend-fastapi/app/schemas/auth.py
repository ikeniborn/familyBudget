"""
Authentication schemas.
"""
from typing import Optional
from pydantic import BaseModel, Field, validator


class TelegramAuthData(BaseModel):
    """Telegram authentication data schema."""
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class UserRegistration(BaseModel):
    """User registration schema."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    user_name: str = Field(..., min_length=1, max_length=100)
    user_email: Optional[str] = Field(None, regex=r'^[^@]+@[^@]+\.[^@]+$')
    
    @validator('username')
    def validate_username(cls, v):
        if not v.replace('_', '').replace('-', '').isalnum():
            raise ValueError('Username can only contain letters, numbers, underscores and hyphens')
        return v.lower()


class UserLogin(BaseModel):
    """User login schema."""
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=1)


class TokenData(BaseModel):
    """Token data schema."""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenRefresh(BaseModel):
    """Token refresh schema."""
    refresh_token: str


class AuthResponse(BaseModel):
    """Authentication response schema."""
    success: bool
    user: dict
    tokens: TokenData


class PasswordEnabledResponse(BaseModel):
    """Password authentication enabled response."""
    enabled: bool
    password_auth_enabled: Optional[bool] = None  # For backward compatibility
    
    def dict(self, **kwargs):
        data = super().dict(**kwargs)
        # Ensure both fields are present for backward compatibility
        data['password_auth_enabled'] = data['enabled']
        return data