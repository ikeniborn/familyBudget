"""
Application settings configuration.

This module provides centralized configuration management using Pydantic Settings.
All configuration values are loaded from environment variables or .env file.
"""

from functools import lru_cache

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings.

    All settings are loaded from environment variables or .env file.
    Uses Pydantic for validation and type checking.
    """

    # Application
    VERSION: str = "4.0.0"
    ENVIRONMENT: str = "production"  # "development" or "production"
    APP_ENV: str = "production"  # Alias for ENVIRONMENT (for compatibility)

    # Database
    DATABASE_URL: str

    # JWT
    JWT_SECRET: str
    JWT_EXPIRY_DAYS: int = 7

    # Telegram
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_BOT_USERNAME: str | None = None  # Bot username for Telegram Login Widget (e.g., "ikenibornbudgetbot")
    # Note: If not provided, will be auto-fetched from Telegram API at startup
    ADMIN_TELEGRAM_ID: int  # Telegram ID of the admin user

    # CORS
    CORS_ORIGINS: list[str] = Field(default_factory=list)

    # SSL
    SSL_TYPE: str = "letsencrypt"  # SSL certificate type: none, letsencrypt, self-signed, existing

    # Logging
    LOG_LEVEL: str = "INFO"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """
        Parse comma-separated string to list.

        Supports both string (comma-separated) and list inputs.

        Examples:
            "https://example.com,https://app.example.com" -> ["https://example.com", "https://app.example.com"]
            ["https://example.com"] -> ["https://example.com"]
        """
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @field_validator("CORS_ORIGINS")
    @classmethod
    def validate_cors(cls, v):
        """
        Validate CORS origins - block wildcard for security.

        Wildcard CORS with credentials is a critical security vulnerability
        that allows any website to steal user data (CSRF attacks).

        Raises:
            ValueError: If wildcard "*" found or origins list is empty
        """
        if "*" in v:
            raise ValueError(
                "Wildcard CORS not allowed. Specify exact origins in ALLOWED_ORIGINS env var."
            )
        if not v:
            raise ValueError(
                "CORS_ORIGINS cannot be empty. Specify at least one origin in ALLOWED_ORIGINS env var."
            )
        return v

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    """
    Get application settings singleton.

    Returns cached Settings instance to avoid repeated .env file reads.
    Uses lru_cache to ensure single instance across application.

    Returns:
        Settings: Application settings instance
    """
    return Settings()
