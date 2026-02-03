"""
High-performance JSON serialization utilities with orjson.

This module provides unified JSON serialization with:
- 3-10x faster performance using orjson (when available)
- Graceful fallback to stdlib json
- Consistent handling of datetime, Decimal, UUID, Pydantic models
- Always returns str (not bytes) for compatibility

Usage:
    from backend.app.core.json_utils import dumps, loads

    # Basic usage
    result = dumps({"amount": Decimal("123.45"), "ts": datetime.now()})
    data = loads(result)

    # For caching (deterministic output)
    cache_key = dumps_for_cache(data)

    # For debugging (pretty-printed)
    print(dumps_pretty(data))
"""

from __future__ import annotations

import json as _json_stdlib  # Always available for fallback
import logging
from collections.abc import Callable
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Optional, Union
from uuid import UUID

from starlette.responses import Response

# Type alias for JSON serializer function
JsonSerializer = Callable[[Any], Any]

logger = logging.getLogger(__name__)

# Try to import orjson for high-performance serialization
_ORJSON_AVAILABLE: bool = False
_orjson: Any = None

try:
    import orjson as _orjson

    _ORJSON_AVAILABLE = True
except ImportError:
    logger.warning(
        "orjson not available, falling back to stdlib json. "
        "Install with: pip install orjson>=3.10.0"
    )


def default_serializer(obj: Any) -> Any:
    """
    Default serializer for non-standard JSON types.

    Handles:
    - Decimal -> float (preserves precision for display)
    - datetime/date/time -> ISO 8601 string
    - UUID -> string
    - Pydantic models -> dict via model_dump
    - Objects with __dict__ -> dict

    Args:
        obj: Object to serialize

    Returns:
        JSON-serializable representation

    Raises:
        TypeError: If object type is not supported
    """
    # Decimal -> float (for JSON compatibility)
    if isinstance(obj, Decimal):
        return float(obj)

    # Datetime types -> ISO 8601
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, date):
        return obj.isoformat()
    if isinstance(obj, time):
        return obj.isoformat()

    # UUID -> string
    if isinstance(obj, UUID):
        return str(obj)

    # Pydantic v2 models
    if hasattr(obj, "model_dump"):
        return obj.model_dump(mode="json")

    # Generic objects with __dict__
    if hasattr(obj, "__dict__"):
        return obj.__dict__

    # Set -> list (common edge case)
    if isinstance(obj, (set, frozenset)):
        return list(obj)

    raise TypeError(
        f"Object of type {type(obj).__name__} is not JSON serializable. "
        f"Value: {repr(obj)[:100]}"
    )


def dumps(
    obj: Any,
    *,
    default: Optional[JsonSerializer] = None,
    sort_keys: bool = False,
    indent: bool = False,
) -> str:
    """
    Serialize object to JSON string.

    Unlike orjson.dumps(), this function always returns str (not bytes)
    for compatibility with existing code.

    Args:
        obj: Object to serialize
        default: Custom serializer function (optional, uses _default_serializer by default)
        sort_keys: Sort dictionary keys (useful for cache hashing)
        indent: Pretty-print with indentation

    Returns:
        JSON string

    Raises:
        TypeError: If object cannot be serialized
    """
    serializer = default if default is not None else default_serializer

    if _ORJSON_AVAILABLE:
        # Build orjson options
        options = _orjson.OPT_SERIALIZE_NUMPY  # Always enable numpy support if available

        if sort_keys:
            options |= _orjson.OPT_SORT_KEYS

        if indent:
            options |= _orjson.OPT_INDENT_2

        # orjson.dumps returns bytes, decode to str
        result_bytes = _orjson.dumps(obj, default=serializer, option=options)
        return result_bytes.decode("utf-8")
    else:
        # Fallback to stdlib json
        return _json_stdlib.dumps(
            obj,
            default=serializer,
            sort_keys=sort_keys,
            indent=2 if indent else None,
            ensure_ascii=False,
        )


def loads(data: Union[str, bytes]) -> Any:
    """
    Deserialize JSON string or bytes to Python object.

    Accepts both str and bytes for flexibility.

    IMPORTANT: This function raises ValueError (not json.JSONDecodeError) for invalid JSON.
    When migrating from stdlib json, update exception handling:
        # Before: except json.JSONDecodeError
        # After:  except ValueError

    Args:
        data: JSON string or bytes

    Returns:
        Deserialized Python object

    Raises:
        ValueError: If JSON is invalid. This wraps both orjson.JSONDecodeError
            and json.JSONDecodeError for consistent API across backends.

    Example:
        >>> try:
        ...     data = loads('{"key": "value"}')
        ... except ValueError as e:
        ...     print(f"Invalid JSON: {e}")
    """
    if _ORJSON_AVAILABLE:
        # orjson.loads accepts both str and bytes
        try:
            return _orjson.loads(data)
        except _orjson.JSONDecodeError as e:
            # Re-raise as ValueError for consistent API
            raise ValueError(f"Invalid JSON: {e}") from e
    else:
        # stdlib json.loads accepts str, bytes since Python 3.6
        try:
            return _json_stdlib.loads(data)
        except _json_stdlib.JSONDecodeError as e:
            raise ValueError(f"Invalid JSON: {e}") from e


def is_orjson_available() -> bool:
    """
    Check if orjson is available.

    Returns:
        True if orjson is loaded, False if using stdlib fallback
    """
    return _ORJSON_AVAILABLE


def dumps_for_cache(obj: Any, *, default: Optional[JsonSerializer] = None) -> str:
    """
    Serialize object to deterministic JSON string for caching.

    Uses sort_keys=True for consistent output regardless of dict ordering.
    Useful for cache key generation and content hashing.

    Args:
        obj: Object to serialize
        default: Custom serializer function (optional)

    Returns:
        Deterministic JSON string
    """
    return dumps(obj, default=default, sort_keys=True, indent=False)


def dumps_pretty(obj: Any, *, default: Optional[JsonSerializer] = None) -> str:
    """
    Serialize object to pretty-printed JSON string.

    Useful for debugging and logging.

    Args:
        obj: Object to serialize
        default: Custom serializer function (optional)

    Returns:
        Pretty-printed JSON string with 2-space indentation
    """
    return dumps(obj, default=default, sort_keys=False, indent=True)


class ORJSONResponse(Response):
    """
    FastAPI Response class using orjson for high-performance JSON serialization.

    Benefits:
        - 3-10x faster than stdlib json
        - Native datetime, Decimal, UUID support via default_serializer
        - Graceful fallback to stdlib json if orjson unavailable

    Usage:
        from backend.app.core.json_utils import ORJSONResponse

        @app.get("/data")
        async def get_data() -> Response:
            return ORJSONResponse(content={"key": "value"})

        # Or set as default for entire FastAPI app:
        app = FastAPI(default_response_class=ORJSONResponse)
    """

    media_type = "application/json"

    def render(self, content: Any) -> bytes:
        """
        Render content to JSON bytes.

        Uses orjson if available, falls back to stdlib json otherwise.

        Args:
            content: Python object to serialize

        Returns:
            JSON-encoded bytes
        """
        if _ORJSON_AVAILABLE:
            return _orjson.dumps(
                content,
                default=default_serializer,
                option=_orjson.OPT_SERIALIZE_NUMPY,
            )
        # Fallback to stdlib json
        return _json_stdlib.dumps(
            content,
            default=default_serializer,
            ensure_ascii=False,
        ).encode("utf-8")
