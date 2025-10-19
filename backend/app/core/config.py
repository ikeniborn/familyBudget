"""
Application settings configuration.

This module provides centralized configuration management using Pydantic Settings.
All configuration values are loaded from environment variables or .env file.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application settings.

    All settings are loaded from environment variables or .env file.
    Uses Pydantic for validation and type checking.
    """

    # Application
    VERSION: str = "4.0.0"

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
    CORS_ORIGINS: list[str] = ["*"]

    # Logging
    LOG_LEVEL: str = "INFO"

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
