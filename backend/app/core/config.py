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

    # Internal API
    API_INTERNAL_KEY: str  # Shared secret for internal bot-to-backend communication

    # CORS
    # Use str | list[str] to prevent Pydantic Settings from auto-parsing as JSON
    CORS_ORIGINS: str | list[str] = Field(default="")

    # VAPID Keys for Web Push Notifications
    # Generate with: ./scripts/generate_vapid_keys.sh
    VAPID_PUBLIC_KEY: str | None = None
    VAPID_PRIVATE_KEY: str | None = None
    VAPID_CONTACT_EMAIL: str = "admin@example.com"

    # SSL
    SSL_TYPE: str = "letsencrypt"  # SSL certificate type: none, letsencrypt, self-signed, existing

    # Logging
    LOG_LEVEL: str = "INFO"

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, v):
        """
        Parse CORS origins from various formats.

        Supports:
        1. Comma-separated string: "https://example.com,https://app.example.com"
        2. JSON array string: '["https://example.com","https://app.example.com"]'
        3. Python list: ["https://example.com", "https://app.example.com"]

        Returns:
            list[str]: List of origin URLs

        Examples:
            "https://example.com,https://app.example.com" -> ["https://example.com", "https://app.example.com"]
            '["https://example.com"]' -> ["https://example.com"]
            ["https://example.com"] -> ["https://example.com"]
        """
        # Already a list - return as is
        if isinstance(v, list):
            return v

        # String input - try to parse
        if isinstance(v, str):
            # Empty string -> empty list
            if not v or v.strip() == "":
                return []

            # Try to parse as JSON array first (from env vars in docker-compose)
            if v.strip().startswith("["):
                try:
                    import json
                    parsed = json.loads(v)
                    if isinstance(parsed, list):
                        return parsed
                except (json.JSONDecodeError, ValueError):
                    pass  # Fall through to comma-separated parsing

            # Parse as comma-separated string
            return [origin.strip() for origin in v.split(",") if origin.strip()]

        # Unknown type - return as is and let validation fail
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
