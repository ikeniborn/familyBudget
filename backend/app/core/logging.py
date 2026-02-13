"""
Structured Logging Configuration.

This module configures structured JSON logging for the application using python-json-logger.

Features:
    - JSON format logs for easy parsing
    - Correlation ID injection for request tracing
    - Contextual logging with extra fields
    - Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
    - Standard fields: timestamp, level, message, module, function, line

Usage:
    from backend.app.core.logging import get_logger

    logger = get_logger(__name__)
    logger.info("User logged in", extra={"user_id": 123})
"""

import logging
import sys
from typing import Any

from pythonjsonlogger import jsonlogger


class CustomJsonFormatter(jsonlogger.JsonFormatter):
    """
    Custom JSON formatter with additional fields.

    Adds standard fields to all log records:
    - timestamp: ISO 8601 format
    - level: Log level (INFO, ERROR, etc.)
    - logger_name: Logger name (module path)
    - module: Module name
    - function: Function name
    - line: Line number
    - correlation_id: Request correlation ID (if available)
    """

    def add_fields(
        self,
        log_record: dict[str, Any],
        record: logging.LogRecord,
        message_dict: dict[str, Any],
    ) -> None:
        """
        Add custom fields to log record.

        Args:
            log_record: Dictionary to be logged as JSON
            record: Original LogRecord
            message_dict: Additional fields from extra parameter
        """
        super().add_fields(log_record, record, message_dict)

        # Add standard fields
        log_record["timestamp"] = self.formatTime(record, self.datefmt)
        log_record["level"] = record.levelname
        log_record["logger_name"] = record.name
        log_record["module"] = record.module
        log_record["function"] = record.funcName
        log_record["line"] = record.lineno

        # Add correlation_id if available (set by middleware)
        if hasattr(record, "correlation_id"):
            log_record["correlation_id"] = record.correlation_id

        # Add request context if available
        if hasattr(record, "request_method"):
            log_record["request_method"] = record.request_method
        if hasattr(record, "request_path"):
            log_record["request_path"] = record.request_path
        if hasattr(record, "request_ip"):
            log_record["request_ip"] = record.request_ip


def setup_logging(level: str = "INFO", log_format: str = "json") -> None:
    """
    Setup logging for the application.

    Supports both JSON and text formats. JSON is recommended for production
    (easy parsing by log aggregators), text for local development (human readable).

    Args:
        level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Log format ("json" or "text")

    Example:
        >>> setup_logging("DEBUG", "json")
        >>> logger = logging.getLogger(__name__)
        >>> logger.info("Application started")
    """
    # Create console handler
    handler = logging.StreamHandler(sys.stdout)

    # Choose formatter based on log_format
    if log_format.lower() == "text":
        # Human-readable text format for development
        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    else:
        # JSON format for production (default)
        formatter = CustomJsonFormatter(
            fmt="%(timestamp)s %(level)s %(name)s %(message)s",
            datefmt="%Y-%m-%dT%H:%M:%S",
        )

    handler.setFormatter(formatter)

    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, level.upper()))
    root_logger.addHandler(handler)

    # Suppress noisy loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.error").setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get logger instance with structured logging support.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Logger instance configured with JSON formatter

    Example:
        >>> logger = get_logger(__name__)
        >>> logger.info("User action", extra={"user_id": 123, "action": "login"})
        # Output:
        # {
        #   "timestamp": "2025-10-13T12:00:00",
        #   "level": "INFO",
        #   "logger_name": "app.api.users",
        #   "message": "User action",
        #   "user_id": 123,
        #   "action": "login"
        # }
    """
    return logging.getLogger(name)


class StructuredLogger:
    """
    Wrapper for structured logging with convenience methods.

    Provides methods for common logging patterns with automatic context injection.

    Example:
        >>> logger = StructuredLogger(__name__)
        >>> logger.info("User logged in", user_id=123)
        >>> logger.error("Database error", error=str(e), query="SELECT ...")
    """

    def __init__(self, name: str):
        """
        Initialize structured logger.

        Args:
            name: Logger name (typically __name__)
        """
        self.logger = get_logger(name)

    def debug(self, message: str, **kwargs: Any) -> None:
        """Log debug message with extra fields."""
        self.logger.debug(message, extra=kwargs)

    def info(self, message: str, **kwargs: Any) -> None:
        """Log info message with extra fields."""
        self.logger.info(message, extra=kwargs)

    def warning(self, message: str, **kwargs: Any) -> None:
        """Log warning message with extra fields."""
        self.logger.warning(message, extra=kwargs)

    def error(self, message: str, **kwargs: Any) -> None:
        """Log error message with extra fields."""
        self.logger.error(message, extra=kwargs)

    def critical(self, message: str, **kwargs: Any) -> None:
        """Log critical message with extra fields."""
        self.logger.critical(message, extra=kwargs)

    def exception(self, message: str, **kwargs: Any) -> None:
        """
        Log exception with traceback.

        Should be called from except block to include exception info.

        Example:
            >>> try:
            ...     risky_operation()
            ... except Exception as e:
            ...     logger.exception("Operation failed", operation="risky")
        """
        self.logger.exception(message, extra=kwargs)
