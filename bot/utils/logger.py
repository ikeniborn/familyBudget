"""
Logging configuration for the Telegram bot.

Provides structured logging with configurable log levels.
"""

import logging
import sys
from typing import Optional

from bot.config.settings import get_settings

settings = get_settings()


def setup_logger(name: str = "bot", level: Optional[str] = None) -> logging.Logger:
    """
    Setup and configure logger for the bot.

    Args:
        name: Logger name
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
               If None, uses settings.LOG_LEVEL

    Returns:
        logging.Logger: Configured logger instance
    """
    log_level = level or settings.LOG_LEVEL
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    # Create logger
    logger = logging.getLogger(name)
    logger.setLevel(numeric_level)

    # Avoid adding duplicate handlers
    if logger.handlers:
        return logger

    # Create console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(numeric_level)

    # Create formatter
    formatter = logging.Formatter(
        settings.LOG_FORMAT,
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(formatter)

    # Add handler to logger
    logger.addHandler(console_handler)

    return logger


# Global logger instance
logger = setup_logger()


def get_logger(name: str = "bot") -> logging.Logger:
    """
    Get logger instance.

    Args:
        name: Logger name

    Returns:
        logging.Logger: Logger instance
    """
    return logging.getLogger(name)
