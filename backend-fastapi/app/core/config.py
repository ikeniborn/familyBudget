"""
Application configuration using Pydantic settings.
"""
import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Application settings."""
    
    # Environment
    ENVIRONMENT: str = Field(default="development", env="NODE_ENV")
    DEBUG: bool = Field(default=True, env="DEBUG")
    
    # Server configuration
    HOST: str = Field(default="0.0.0.0", env="HOST")
    PORT: int = Field(default=4000, env="PORT")
    
    # Database configuration
    DATABASE_URL: str = Field(
        default="postgresql+asyncpg://budget:budget123@postgres:5432/budgetdb",
        env="DATABASE_URL"
    )
    
    # Redis configuration
    REDIS_URL: str = Field(
        default="redis://redis:6379/0",
        env="REDIS_URL"
    )
    
    # Session configuration
    SESSION_SECRET: str = Field(
        default="your-super-secret-session-key-change-in-production",
        env="SESSION_SECRET"
    )
    SESSION_COOKIE_NAME: str = Field(default="familybudget.sid", env="SESSION_COOKIE_NAME")
    SESSION_EXPIRE_SECONDS: int = Field(default=86400, env="SESSION_EXPIRE_SECONDS")  # 24 hours
    
    # Authentication
    TELEGRAM_BOT_TOKEN: str = Field(default="", env="TELEGRAM_BOT_TOKEN")
    
    # Security
    SECRET_KEY: str = Field(
        default="your-super-secret-key-change-in-production",
        env="SECRET_KEY"
    )
    ALGORITHM: str = Field(default="HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(default=1440, env="ACCESS_TOKEN_EXPIRE_MINUTES")  # 24 hours
    
    # CORS settings
    ALLOWED_ORIGINS: List[str] = Field(
        default=[
            "http://localhost:3000",
            "http://localhost:5173",
            "http://localhost:4000",
            "https://budget.yourdomain.com"
        ],
        env="ALLOWED_ORIGINS"
    )
    
    ALLOWED_HOSTS: List[str] = Field(
        default=["localhost", "127.0.0.1", "budget.yourdomain.com"],
        env="ALLOWED_HOSTS"
    )
    
    # Pagination
    DEFAULT_PAGE_SIZE: int = Field(default=50, env="DEFAULT_PAGE_SIZE")
    MAX_PAGE_SIZE: int = Field(default=1000, env="MAX_PAGE_SIZE")
    
    @validator('ALLOWED_ORIGINS', pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from string or list."""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator('ALLOWED_HOSTS', pre=True)
    def parse_allowed_hosts(cls, v):
        """Parse allowed hosts from string or list."""
        if isinstance(v, str):
            return [host.strip() for host in v.split(",")]
        return v
    
    @validator('DEBUG', pre=True)
    def parse_debug(cls, v):
        """Parse debug flag from string."""
        if isinstance(v, str):
            return v.lower() in ("true", "1", "yes", "on")
        return v
    
    class Config:
        """Pydantic config."""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Global settings instance
settings = Settings()