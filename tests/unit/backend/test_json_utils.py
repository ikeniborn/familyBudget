"""
Unit tests for backend.app.core.json_utils module.

Tests cover:
- Basic serialization/deserialization
- Decimal, datetime, UUID, Pydantic model handling
- Sort keys for caching
- Error handling
- Roundtrip consistency
- Edge cases (sets, None, unicode, nested structures)
- Convenience functions
"""

from __future__ import annotations

from datetime import date, datetime, time, timezone
from decimal import Decimal
from typing import Any
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from pydantic import BaseModel

from backend.app.core.json_utils import (
    default_serializer,
    dumps,
    dumps_for_cache,
    dumps_pretty,
    is_orjson_available,
    loads,
)


# ===== Test Fixtures =====


class SamplePydanticModel(BaseModel):
    """Sample Pydantic model for testing."""

    id: int
    name: str
    amount: Decimal | None = None


class ObjectWithDict:
    """Sample object with __dict__ for testing."""

    def __init__(self, value: str) -> None:
        self.value = value


class UnsupportedObject:
    """Object without __dict__ that cannot be serialized."""

    __slots__ = ("value",)

    def __init__(self, value: str) -> None:
        self.value = value


# ===== TestDumps =====


class TestDumps:
    """Test basic dumps() functionality."""

    def test_dumps_simple_dict(self) -> None:
        """dumps() should serialize simple dict to JSON string."""
        data = {"name": "test", "value": 123}
        result = dumps(data)

        assert isinstance(result, str)
        assert "name" in result
        assert "test" in result
        assert "123" in result

    def test_dumps_returns_str_not_bytes(self) -> None:
        """dumps() should always return str, not bytes."""
        data = {"key": "value"}
        result = dumps(data)

        assert isinstance(result, str)
        assert not isinstance(result, bytes)

    def test_dumps_list(self) -> None:
        """dumps() should serialize lists."""
        data = [1, 2, 3, "four"]
        result = dumps(data)

        assert isinstance(result, str)
        parsed = loads(result)
        assert parsed == data

    def test_dumps_nested_structure(self) -> None:
        """dumps() should handle nested structures."""
        data = {
            "level1": {
                "level2": {
                    "items": [1, 2, 3],
                    "value": "nested",
                }
            }
        }
        result = dumps(data)
        parsed = loads(result)

        assert parsed == data

    def test_dumps_empty_structures(self) -> None:
        """dumps() should handle empty dict/list."""
        assert dumps({}) == "{}"
        assert dumps([]) == "[]"

    def test_dumps_none(self) -> None:
        """dumps() should serialize None to null."""
        result = dumps(None)
        assert result == "null"

    def test_dumps_unicode(self) -> None:
        """dumps() should handle unicode characters."""
        data = {"emoji": "🚀", "russian": "привет", "chinese": "你好"}
        result = dumps(data)
        parsed = loads(result)

        assert parsed == data


# ===== TestDecimalSerialization =====


class TestDecimalSerialization:
    """Test Decimal serialization."""

    def test_decimal_to_float(self) -> None:
        """Decimal should serialize to float."""
        data = {"amount": Decimal("123.45")}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["amount"] == 123.45
        assert isinstance(parsed["amount"], float)

    def test_decimal_precision(self) -> None:
        """Decimal precision should be preserved in output."""
        data = {"amount": Decimal("999999.999999")}
        result = dumps(data)

        assert "999999.999999" in result

    def test_decimal_negative(self) -> None:
        """Negative Decimal should serialize correctly."""
        data = {"amount": Decimal("-42.5")}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["amount"] == -42.5

    def test_decimal_zero(self) -> None:
        """Zero Decimal should serialize to 0."""
        data = {"amount": Decimal("0")}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["amount"] == 0.0


# ===== TestDatetimeSerialization =====


class TestDatetimeSerialization:
    """Test datetime/date/time serialization to ISO 8601."""

    def test_datetime_to_iso8601(self) -> None:
        """datetime should serialize to ISO 8601 string."""
        dt = datetime(2024, 1, 15, 10, 30, 45)
        data = {"timestamp": dt}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["timestamp"] == "2024-01-15T10:30:45"

    def test_datetime_with_timezone(self) -> None:
        """datetime with timezone should include timezone in ISO string."""
        dt = datetime(2024, 1, 15, 10, 30, 45, tzinfo=timezone.utc)
        data = {"timestamp": dt}
        result = dumps(data)
        parsed = loads(result)

        assert "2024-01-15T10:30:45" in parsed["timestamp"]
        assert "+00:00" in parsed["timestamp"] or "Z" in parsed["timestamp"]

    def test_date_to_iso8601(self) -> None:
        """date should serialize to ISO 8601 date string."""
        d = date(2024, 1, 15)
        data = {"date": d}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["date"] == "2024-01-15"

    def test_time_to_iso8601(self) -> None:
        """time should serialize to ISO 8601 time string."""
        t = time(10, 30, 45)
        data = {"time": t}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["time"] == "10:30:45"


# ===== TestUUIDSerialization =====


class TestUUIDSerialization:
    """Test UUID serialization."""

    def test_uuid_to_string(self) -> None:
        """UUID should serialize to string."""
        test_uuid = UUID("12345678-1234-5678-1234-567812345678")
        data = {"id": test_uuid}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["id"] == "12345678-1234-5678-1234-567812345678"
        assert isinstance(parsed["id"], str)

    def test_random_uuid(self) -> None:
        """Random UUID should serialize correctly."""
        test_uuid = uuid4()
        data = {"id": test_uuid}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["id"] == str(test_uuid)


# ===== TestPydanticSerialization =====


class TestPydanticSerialization:
    """Test Pydantic model serialization."""

    def test_pydantic_model_dump(self) -> None:
        """Pydantic model should serialize via model_dump."""
        model = SamplePydanticModel(id=1, name="test", amount=Decimal("99.99"))
        data = {"item": model}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["item"]["id"] == 1
        assert parsed["item"]["name"] == "test"
        # Pydantic model_dump(mode="json") serializes Decimal to string
        assert parsed["item"]["amount"] == "99.99"

    def test_pydantic_model_with_none(self) -> None:
        """Pydantic model with None fields should serialize correctly."""
        model = SamplePydanticModel(id=1, name="test")  # amount is None
        data = {"item": model}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["item"]["id"] == 1
        assert parsed["item"]["amount"] is None


# ===== TestObjectWithDict =====


class TestObjectWithDict:
    """Test objects with __dict__ serialization."""

    def test_object_with_dict(self) -> None:
        """Object with __dict__ should serialize its attributes."""
        obj = ObjectWithDict(value="test_value")
        data = {"obj": obj}
        result = dumps(data)
        parsed = loads(result)

        assert parsed["obj"]["value"] == "test_value"


# ===== TestSortKeys =====


class TestSortKeys:
    """Test sort_keys functionality for cache hashing."""

    def test_sort_keys_deterministic(self) -> None:
        """sort_keys=True should produce deterministic output."""
        data1 = {"z": 1, "a": 2, "m": 3}
        data2 = {"a": 2, "m": 3, "z": 1}

        result1 = dumps(data1, sort_keys=True)
        result2 = dumps(data2, sort_keys=True)

        assert result1 == result2

    def test_sort_keys_order(self) -> None:
        """sort_keys=True should output keys in alphabetical order."""
        data = {"zebra": 1, "apple": 2, "banana": 3}
        result = dumps(data, sort_keys=True)

        # Keys should appear in order: apple, banana, zebra
        apple_pos = result.index("apple")
        banana_pos = result.index("banana")
        zebra_pos = result.index("zebra")

        assert apple_pos < banana_pos < zebra_pos

    def test_no_sort_keys_preserves_insertion_order(self) -> None:
        """Without sort_keys, insertion order should be preserved (Python 3.7+)."""
        data = {"z": 1, "a": 2, "m": 3}
        result = dumps(data, sort_keys=False)

        # In modern Python, dict preserves insertion order
        z_pos = result.index("z")
        a_pos = result.index("a")
        m_pos = result.index("m")

        assert z_pos < a_pos < m_pos


# ===== TestLoads =====


class TestLoads:
    """Test loads() functionality."""

    def test_loads_string(self) -> None:
        """loads() should deserialize JSON string."""
        json_str = '{"name": "test", "value": 123}'
        result = loads(json_str)

        assert result == {"name": "test", "value": 123}

    def test_loads_bytes(self) -> None:
        """loads() should deserialize JSON bytes."""
        json_bytes = b'{"name": "test", "value": 123}'
        result = loads(json_bytes)

        assert result == {"name": "test", "value": 123}

    def test_loads_invalid_json_raises_valueerror(self) -> None:
        """loads() should raise ValueError for invalid JSON."""
        with pytest.raises(ValueError, match="Invalid JSON"):
            loads("not valid json")

    def test_loads_empty_string_raises_valueerror(self) -> None:
        """loads() should raise ValueError for empty string."""
        with pytest.raises(ValueError, match="Invalid JSON"):
            loads("")


# ===== TestRoundtrip =====


class TestRoundtrip:
    """Test dumps/loads roundtrip consistency."""

    def test_roundtrip_simple(self) -> None:
        """Simple data should roundtrip correctly."""
        data = {"name": "test", "value": 123, "active": True, "items": [1, 2, 3]}

        result = loads(dumps(data))
        assert result == data

    def test_roundtrip_complex(self) -> None:
        """Complex data with special types should roundtrip (with type conversion)."""
        original = {
            "id": UUID("12345678-1234-5678-1234-567812345678"),
            "amount": Decimal("123.45"),
            "timestamp": datetime(2024, 1, 15, 10, 30, 45),
        }

        json_str = dumps(original)
        result = loads(json_str)

        # Types are converted but values preserved
        assert result["id"] == "12345678-1234-5678-1234-567812345678"
        assert result["amount"] == 123.45
        assert result["timestamp"] == "2024-01-15T10:30:45"


# ===== TestEdgeCases =====


class TestEdgeCases:
    """Test edge cases."""

    def test_set_to_list(self) -> None:
        """Set should serialize to list."""
        data = {"items": {1, 2, 3}}
        result = dumps(data)
        parsed = loads(result)

        # Set order is not guaranteed, so check contents
        assert set(parsed["items"]) == {1, 2, 3}

    def test_frozenset_to_list(self) -> None:
        """Frozenset should serialize to list."""
        data = {"items": frozenset([1, 2, 3])}
        result = dumps(data)
        parsed = loads(result)

        assert set(parsed["items"]) == {1, 2, 3}

    def test_deeply_nested(self) -> None:
        """Deeply nested structures should serialize."""
        data: dict[str, Any] = {"level": 0}
        current = data
        for i in range(1, 10):
            current["nested"] = {"level": i}
            current = current["nested"]

        result = dumps(data)
        parsed = loads(result)

        # Verify nesting
        current = parsed
        for i in range(10):
            assert current["level"] == i
            if i < 9:
                current = current["nested"]

    def test_large_numbers(self) -> None:
        """Large numbers within 64-bit range should serialize correctly."""
        # orjson only supports integers within 64-bit range
        data = {
            "big_int": 10**18,  # Within 64-bit signed range
            "big_float": 1.23e50,
        }
        result = dumps(data)
        parsed = loads(result)

        assert parsed["big_int"] == 10**18
        assert abs(parsed["big_float"] - 1.23e50) < 1e45  # Allow some floating point error

    def test_special_string_characters(self) -> None:
        """Special characters in strings should be escaped."""
        data = {"text": 'Hello "World"\nNew\tLine'}
        result = dumps(data)
        parsed = loads(result)

        assert parsed == data

    def test_unsupported_type_raises_typeerror(self) -> None:
        """Unsupported types should raise TypeError."""
        obj = UnsupportedObject("test")

        with pytest.raises(TypeError, match="not JSON serializable"):
            dumps({"obj": obj})


# ===== TestConvenienceFunctions =====


class TestConvenienceFunctions:
    """Test convenience functions."""

    def test_dumps_for_cache(self) -> None:
        """dumps_for_cache() should use sort_keys=True."""
        data1 = {"z": 1, "a": 2}
        data2 = {"a": 2, "z": 1}

        result1 = dumps_for_cache(data1)
        result2 = dumps_for_cache(data2)

        assert result1 == result2

    def test_dumps_pretty_has_indentation(self) -> None:
        """dumps_pretty() should include indentation."""
        data = {"name": "test", "items": [1, 2, 3]}
        result = dumps_pretty(data)

        # Pretty output should have newlines and spaces
        assert "\n" in result
        assert "  " in result  # 2-space indentation

    def test_dumps_pretty_readable(self) -> None:
        """dumps_pretty() output should be human-readable."""
        data = {"outer": {"inner": "value"}}
        result = dumps_pretty(data)

        # Should have multiple lines
        lines = result.strip().split("\n")
        assert len(lines) > 1


# ===== TestIsOrjsonAvailable =====


class TestIsOrjsonAvailable:
    """Test is_orjson_available() function."""

    def test_is_orjson_available_returns_bool(self) -> None:
        """is_orjson_available() should return boolean."""
        result = is_orjson_available()
        assert isinstance(result, bool)


# ===== TestDefaultSerializer =====


class TestDefaultSerializer:
    """Test default_serializer() directly."""

    def test_default_serializer_decimal(self) -> None:
        """default_serializer() should convert Decimal to float."""
        result = default_serializer(Decimal("123.45"))
        assert result == 123.45
        assert isinstance(result, float)

    def test_default_serializer_datetime(self) -> None:
        """default_serializer() should convert datetime to ISO string."""
        dt = datetime(2024, 1, 15, 10, 30, 45)
        result = default_serializer(dt)
        assert result == "2024-01-15T10:30:45"

    def test_default_serializer_uuid(self) -> None:
        """default_serializer() should convert UUID to string."""
        test_uuid = UUID("12345678-1234-5678-1234-567812345678")
        result = default_serializer(test_uuid)
        assert result == "12345678-1234-5678-1234-567812345678"

    def test_default_serializer_set(self) -> None:
        """default_serializer() should convert set to list."""
        result = default_serializer({1, 2, 3})
        assert isinstance(result, list)
        assert set(result) == {1, 2, 3}


# ===== TestCustomDefault =====


class TestCustomDefault:
    """Test custom default serializer."""

    def test_custom_default_function(self) -> None:
        """dumps() should use custom default function when provided."""

        def custom_serializer(obj: Any) -> Any:
            if isinstance(obj, UnsupportedObject):
                return {"custom": obj.value}
            raise TypeError(f"Cannot serialize {type(obj)}")

        obj = UnsupportedObject("test_value")
        result = dumps({"item": obj}, default=custom_serializer)
        parsed = loads(result)

        assert parsed["item"] == {"custom": "test_value"}


# ===== TestStdlibFallback =====


class TestStdlibFallback:
    """Test stdlib json fallback when orjson is unavailable."""

    def test_dumps_with_stdlib_fallback(self) -> None:
        """dumps() should work with stdlib json when orjson unavailable."""
        import backend.app.core.json_utils as json_utils

        # Save original values
        original_available = json_utils._ORJSON_AVAILABLE
        original_json_stdlib = json_utils._json_stdlib

        try:
            # Mock orjson unavailable
            import json

            json_utils._ORJSON_AVAILABLE = False
            json_utils._json_stdlib = json

            data = {"name": "test", "value": 123}
            result = dumps(data)

            assert isinstance(result, str)
            assert "name" in result
            assert "test" in result
        finally:
            # Restore original values
            json_utils._ORJSON_AVAILABLE = original_available
            json_utils._json_stdlib = original_json_stdlib

    def test_loads_with_stdlib_fallback(self) -> None:
        """loads() should work with stdlib json when orjson unavailable."""
        import backend.app.core.json_utils as json_utils

        original_available = json_utils._ORJSON_AVAILABLE
        original_json_stdlib = json_utils._json_stdlib

        try:
            import json

            json_utils._ORJSON_AVAILABLE = False
            json_utils._json_stdlib = json

            json_str = '{"name": "test", "value": 123}'
            result = loads(json_str)

            assert result == {"name": "test", "value": 123}
        finally:
            json_utils._ORJSON_AVAILABLE = original_available
            json_utils._json_stdlib = original_json_stdlib

    def test_stdlib_fallback_with_special_types(self) -> None:
        """stdlib fallback should handle Decimal, datetime, UUID via default serializer."""
        import backend.app.core.json_utils as json_utils

        original_available = json_utils._ORJSON_AVAILABLE
        original_json_stdlib = json_utils._json_stdlib

        try:
            import json

            json_utils._ORJSON_AVAILABLE = False
            json_utils._json_stdlib = json

            data = {
                "amount": Decimal("99.99"),
                "timestamp": datetime(2024, 1, 15, 10, 30),
                "id": UUID("12345678-1234-5678-1234-567812345678"),
            }
            result = dumps(data)
            parsed = loads(result)

            assert parsed["amount"] == 99.99
            assert parsed["timestamp"] == "2024-01-15T10:30:00"
            assert parsed["id"] == "12345678-1234-5678-1234-567812345678"
        finally:
            json_utils._ORJSON_AVAILABLE = original_available
            json_utils._json_stdlib = original_json_stdlib

    def test_stdlib_fallback_invalid_json_raises_valueerror(self) -> None:
        """stdlib fallback should raise ValueError for invalid JSON."""
        import backend.app.core.json_utils as json_utils

        original_available = json_utils._ORJSON_AVAILABLE
        original_json_stdlib = json_utils._json_stdlib

        try:
            import json

            json_utils._ORJSON_AVAILABLE = False
            json_utils._json_stdlib = json

            with pytest.raises(ValueError, match="Invalid JSON"):
                loads("not valid json")
        finally:
            json_utils._ORJSON_AVAILABLE = original_available
            json_utils._json_stdlib = original_json_stdlib

    def test_stdlib_fallback_sort_keys(self) -> None:
        """stdlib fallback should support sort_keys."""
        import backend.app.core.json_utils as json_utils

        original_available = json_utils._ORJSON_AVAILABLE
        original_json_stdlib = json_utils._json_stdlib

        try:
            import json

            json_utils._ORJSON_AVAILABLE = False
            json_utils._json_stdlib = json

            data1 = {"z": 1, "a": 2}
            data2 = {"a": 2, "z": 1}

            result1 = dumps(data1, sort_keys=True)
            result2 = dumps(data2, sort_keys=True)

            assert result1 == result2
        finally:
            json_utils._ORJSON_AVAILABLE = original_available
            json_utils._json_stdlib = original_json_stdlib

    def test_stdlib_fallback_indent(self) -> None:
        """stdlib fallback should support indent (pretty-print)."""
        import backend.app.core.json_utils as json_utils

        original_available = json_utils._ORJSON_AVAILABLE
        original_json_stdlib = json_utils._json_stdlib

        try:
            import json

            json_utils._ORJSON_AVAILABLE = False
            json_utils._json_stdlib = json

            data = {"name": "test"}
            result = dumps(data, indent=True)

            assert "\n" in result
            assert "  " in result  # 2-space indentation
        finally:
            json_utils._ORJSON_AVAILABLE = original_available
            json_utils._json_stdlib = original_json_stdlib
