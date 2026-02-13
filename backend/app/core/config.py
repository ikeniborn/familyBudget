"""
Application settings configuration.

This module provides centralized configuration management using Pydantic Settings.
All configuration values are loaded from environment variables or .env file.
"""
from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


def _read_version_from_file() -> str:
    """
    Read VERSION from file with fallback to default.

    Priority:
    1. /app/VERSION (Docker mount - primary for production)
    2. ../../VERSION (local development - relative to config.py)
    3. Default "0.0.0"

    This function is called at module load time, so the version is read once
    when the Settings class is instantiated. For version updates to take effect,
    uvicorn workers must be restarted (happens automatically during deploy).

    Returns:
        str: Version string (e.g., "6.6.1")
    """
    # Docker path (inside container) - primary for production
    docker_path = Path("/app/VERSION")
    if docker_path.exists():
        try:
            return docker_path.read_text().strip()
        except OSError:
            pass  # Fall through to next option

    # Local development path (relative to config.py)
    # config.py is at: backend/app/core/config.py
    # VERSION is at: VERSION (root)
    # So we need: ../../../../VERSION from config.py
    local_path = Path(__file__).parent.parent.parent.parent / "VERSION"
    if local_path.exists():
        try:
            return local_path.read_text().strip()
        except OSError:
            pass  # Fall through to default

    return "0.0.0"


class Settings(BaseSettings):
    """
    Application settings.

    All settings are loaded from environment variables or .env file.
    Uses Pydantic for validation and type checking.
    """

    # Application
    # VERSION is read from file at module load time (see _read_version_from_file)
    # This allows version updates without container recreation - just restart workers
    VERSION: str = _read_version_from_file()
    ENVIRONMENT: str = "production"  # "development" or "production"
    APP_ENV: str = "production"  # Alias for ENVIRONMENT (for compatibility)

    # Database
    DATABASE_URL: str

    # JWT
    JWT_SECRET: str
    JWT_EXPIRE_DAYS: int = 7

    # Telegram
    TELEGRAM_BOT_TOKEN: str
    TELEGRAM_BOT_USERNAME: str | None = None  # Bot username for Telegram Login Widget (e.g., "ikenibornbudgetbot")
    # Note: If not provided, will be auto-fetched from Telegram API at startup
    ADMIN_TELEGRAM_ID: int  # Telegram ID of the admin user

    # Admin Email Authentication (optional - emergency access without 2FA)
    ADMIN_EMAIL: str | None = None  # Admin email for emergency login (bypasses 2FA)
    ADMIN_PASSWORD: str | None = None  # Admin initial password (should be changed)

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

    # WebAuthn Biometric Authentication (v6.5.0+)
    WEBAUTHN_RP_ID: str = "localhost"  # Relying Party ID (domain name, e.g., "familybudget.example.com")
    WEBAUTHN_RP_NAME: str = "Family Budget"  # Relying Party Name (user-visible)
    WEBAUTHN_ORIGIN: str = "http://localhost:8000"  # Full origin URL with protocol

    # SSL
    SSL_TYPE: str = "letsencrypt"  # SSL certificate type: none, letsencrypt, self-signed, existing

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # "json" or "text"

    # Timezone (IANA format, e.g., "Europe/Moscow", "UTC")
    # System timezone for scheduler jobs and default for new users
    SYSTEM_TIMEZONE: str = "UTC"

    # Redis Configuration
    REDIS_URL: str | None = None  # e.g., redis://redis:6379/0
    REDIS_CACHE_TTL_DEFAULT: int = 60  # Default cache TTL in seconds

    # Cache TTL by category (all in seconds)
    REDIS_CACHE_TTL_REFERENCE: int = 300  # Reference data: Articles, Financial Centers, Cost Centers (5 min)
    REDIS_CACHE_TTL_DASHBOARD: int = 30  # Dashboard data: Quick stats, account balances (30 sec)
    REDIS_CACHE_TTL_DYNAMIC: int = 60  # Dynamic data: Facts list, recent transactions (1 min)
    REDIS_CACHE_TTL_SHORT: int = 10  # Short-lived data: Recent HTML fragments (10 sec)

    # Write-Behind Configuration
    WRITE_BEHIND_ENABLED: bool = True  # Enable async writes to PostgreSQL (Redis required)
    WRITE_BEHIND_MAX_RETRIES: int = 3  # Max retries before moving to DLQ
    WRITE_BEHIND_BATCH_SIZE: int = 100  # Max items to process in one batch
    WRITE_BEHIND_DLQ_TTL_DAYS: int = 7  # TTL for DLQ items (days)
    WRITE_BEHIND_DLQ_MAX_SIZE: int = 100  # Max DLQ size (oldest items removed when exceeded)

    # Frontend Features (Web Workers)
    ENABLE_WEB_WORKERS: bool = True  # Enable Web Workers for CPU-intensive operations (default: enabled)

    # WebSocket Configuration
    WS_RTT_THRESHOLD_MS: int = 5000  # Slow connection warning threshold in milliseconds (default: 5000ms)

    @field_validator("SYSTEM_TIMEZONE")
    @classmethod
    def validate_timezone(cls, v):
        """
        Validate IANA timezone name.

        Raises:
            ValueError: If timezone is not valid IANA timezone
        """
        from zoneinfo import available_timezones

        if v not in available_timezones():
            raise ValueError(
                f"Invalid timezone: {v}. Use IANA format (e.g., Europe/Moscow, UTC)"
            )
        return v

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
                "Wildcard CORS not allowed. Specify exact origins in CORS_ORIGINS env var."
            )
        if not v:
            raise ValueError(
                "CORS_ORIGINS cannot be empty. Specify at least one origin in CORS_ORIGINS env var."
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
