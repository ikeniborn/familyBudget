"""
Bot configuration settings.

Loads configuration from environment variables with sensible defaults.
"""

import os
from typing import Optional

from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()


class Settings:
    """Bot configuration settings."""

    # Telegram Bot Configuration
    TELEGRAM_BOT_TOKEN: str = os.getenv("TELEGRAM_BOT_TOKEN", "")

    # Backend API Configuration
    BACKEND_API_URL: str = os.getenv("BACKEND_API_URL", "http://localhost:8000/api/v1")
    BACKEND_TIMEOUT: int = int(os.getenv("BACKEND_TIMEOUT", "30"))
    API_INTERNAL_KEY: str = os.getenv("API_INTERNAL_KEY", "")

    # Domain (for WebApp URL generation)
    DOMAIN: str = os.getenv("DOMAIN", "localhost")

    # Bot Behavior
    USE_WEBHOOK: bool = os.getenv("USE_WEBHOOK", "false").lower() == "true"
    WEBHOOK_URL: Optional[str] = os.getenv("WEBHOOK_URL", None)
    WEBHOOK_PORT: int = int(os.getenv("WEBHOOK_PORT", "8443"))
    WEBHOOK_LISTEN: str = os.getenv("WEBHOOK_LISTEN", "0.0.0.0")

    # Polling Configuration (if not using webhook)
    POLL_INTERVAL: int = int(os.getenv("POLL_INTERVAL", "1"))
    POLL_TIMEOUT: int = int(os.getenv("POLL_TIMEOUT", "10"))

    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    LOG_FORMAT: str = os.getenv(
        "LOG_FORMAT",
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )

    # Proxy for Telegram API requests (optional)
    # Supported formats (PTB v21 + httpx backend):
    #   http://host:port  or  http://user:pass@host:port
    #   https://host:port
    #   socks5://host:port  (needs: pip install "python-telegram-bot[socks]")
    # NOT supported: tg://proxy?server=...&port=...&secret=...  (MTProxy Telegram client format)
    TELEGRAM_PROXY_URL: Optional[str] = os.getenv("TELEGRAM_PROXY_URL", None)

    # Security
    ALLOWED_TELEGRAM_IDS: Optional[str] = os.getenv("ALLOWED_TELEGRAM_IDS", None)

    def validate(self) -> bool:
        """
        Validate configuration.

        Returns:
            bool: True if configuration is valid

        Raises:
            ValueError: If configuration is invalid
        """
        if not self.TELEGRAM_BOT_TOKEN:
            raise ValueError("TELEGRAM_BOT_TOKEN is required")

        if self.USE_WEBHOOK and not self.WEBHOOK_URL:
            raise ValueError("WEBHOOK_URL is required when USE_WEBHOOK=true")

        return True

    @property
    def allowed_telegram_ids_list(self) -> list[int]:
        """
        Get list of allowed Telegram IDs.

        Returns:
            list[int]: List of allowed user IDs, or empty list if not configured
        """
        if not self.ALLOWED_TELEGRAM_IDS:
            return []

        return [int(id_str.strip()) for id_str in self.ALLOWED_TELEGRAM_IDS.split(",")]


# Global settings instance
settings = Settings()


def get_settings() -> Settings:
    """
    Get bot settings instance.

    Returns:
        Settings: Bot configuration settings
    """
    return settings
