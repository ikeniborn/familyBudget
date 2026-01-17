"""
Core package containing configuration, security, and utilities.
"""

from backend.app.core.exceptions import (
    APIException,
    BadRequestException,
    ConflictException,
    DatabaseException,
    ForbiddenException,
    InternalServerException,
    NotFoundException,
    ServiceUnavailableException,
    UnauthorizedException,
    UnprocessableEntityException,
)
from backend.app.core.json_utils import (
    JsonSerializer,
    default_serializer,
    dumps,
    dumps_for_cache,
    dumps_pretty,
    is_orjson_available,
    loads,
)

__all__ = [
    # Exceptions
    "APIException",
    "BadRequestException",
    "UnauthorizedException",
    "ForbiddenException",
    "NotFoundException",
    "ConflictException",
    "UnprocessableEntityException",
    "InternalServerException",
    "DatabaseException",
    "ServiceUnavailableException",
    # JSON utilities
    "JsonSerializer",
    "default_serializer",
    "dumps",
    "loads",
    "dumps_for_cache",
    "dumps_pretty",
    "is_orjson_available",
]
