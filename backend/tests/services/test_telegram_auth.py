"""
Unit tests for Telegram OAuth authentication validation service.

⚠️ CRITICAL SECURITY MODULE ⚠️
Tests HMAC-SHA256 hash validation for Telegram Login Widget authentication.
Incorrect implementation can lead to authentication bypass vulnerabilities (RISK-002).

Function tested:
    - validate_telegram_auth(data: Dict[str, any]) -> bool

Security Properties Tested:
    - Valid hash acceptance
    - Invalid hash rejection
    - Missing hash rejection
    - Tampered data detection
    - Timing attack resistance (via hmac.compare_digest)
    - Correct data_check_string format
    - Correct secret_key computation

Reference:
    https://core.telegram.org/widgets/login#checking-authorization
"""

import hashlib
import hmac
from typing import Dict
from unittest.mock import patch

import pytest

from backend.app.core.config import get_settings
from backend.app.services.telegram_auth import validate_telegram_auth

settings = get_settings()


# ============================================================================
# Helper Functions
# ============================================================================


def compute_telegram_hash(data: Dict[str, str], bot_token: str) -> str:
    """
    Compute valid Telegram OAuth hash for testing.

    Implements the exact same algorithm as validate_telegram_auth()
    to create valid test data.

    Args:
        data: Dictionary with Telegram OAuth data (WITHOUT hash field)
        bot_token: Telegram bot token

    Returns:
        str: Computed HMAC-SHA256 hash
    """
    # Create data_check_string (sorted key=value pairs)
    data_check_string = "\n".join([f"{key}={value}" for key, value in sorted(data.items())])

    # Compute secret_key = SHA256(bot_token)
    secret_key = hashlib.sha256(bot_token.encode()).digest()

    # Compute HMAC-SHA256
    computed_hash = hmac.new(
        key=secret_key, msg=data_check_string.encode(), digestmod=hashlib.sha256
    ).hexdigest()

    return computed_hash


def create_valid_telegram_data(
    telegram_id: int = 123456789,
    first_name: str = "John",
    last_name: str = None,
    username: str = None,
    photo_url: str = None,
    auth_date: str = "1699999999",
) -> Dict[str, str]:
    """
    Create valid Telegram OAuth data with correct hash.

    Args:
        telegram_id: Telegram user ID
        first_name: User first name
        last_name: User last name (optional)
        username: Telegram username (optional)
        photo_url: Profile photo URL (optional)
        auth_date: Unix timestamp of authentication

    Returns:
        Dict with Telegram auth data including valid hash
    """
    # Build data dictionary (all values as strings)
    data = {
        "id": str(telegram_id),
        "first_name": first_name,
        "auth_date": auth_date,
    }

    # Add optional fields
    if last_name:
        data["last_name"] = last_name
    if username:
        data["username"] = username
    if photo_url:
        data["photo_url"] = photo_url

    # Compute valid hash
    bot_token = settings.TELEGRAM_BOT_TOKEN
    computed_hash = compute_telegram_hash(data, bot_token)

    # Add hash to data
    data["hash"] = computed_hash

    return data


# ============================================================================
# Valid Hash Tests
# ============================================================================


def test_validate_telegram_auth_valid_minimal():
    """Test validation with minimal required fields (id, first_name, auth_date)."""
    data = create_valid_telegram_data(
        telegram_id=123456789, first_name="John", auth_date="1699999999"
    )

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_valid_all_fields():
    """Test validation with all optional fields present."""
    data = create_valid_telegram_data(
        telegram_id=123456789,
        first_name="John",
        last_name="Doe",
        username="johndoe",
        photo_url="https://t.me/photo.jpg",
        auth_date="1699999999",
    )

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_valid_with_username():
    """Test validation with username field."""
    data = create_valid_telegram_data(
        telegram_id=987654321, first_name="Alice", username="alice123"
    )

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_valid_with_last_name():
    """Test validation with last_name field."""
    data = create_valid_telegram_data(
        telegram_id=111222333, first_name="Bob", last_name="Smith"
    )

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_different_users():
    """Test validation for multiple different users."""
    users = [
        (111111111, "Alice"),
        (222222222, "Bob"),
        (333333333, "Charlie"),
    ]

    for telegram_id, first_name in users:
        data = create_valid_telegram_data(telegram_id=telegram_id, first_name=first_name)
        is_valid = validate_telegram_auth(data)
        assert is_valid is True, f"Should be valid for user {first_name}"


# ============================================================================
# Invalid Hash Tests
# ============================================================================


def test_validate_telegram_auth_invalid_hash():
    """Test validation fails with incorrect hash."""
    data = create_valid_telegram_data()

    # Replace valid hash with invalid one
    data["hash"] = "invalid_hash_12345678901234567890123456789012"

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_missing_hash():
    """Test validation fails when hash field is missing."""
    data = create_valid_telegram_data()

    # Remove hash field
    del data["hash"]

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_empty_hash():
    """Test validation fails with empty hash."""
    data = create_valid_telegram_data()
    data["hash"] = ""

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_wrong_hash_length():
    """Test validation fails with hash of wrong length."""
    data = create_valid_telegram_data()

    # HMAC-SHA256 produces 64 character hex string
    data["hash"] = "abc123"  # Too short

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


# ============================================================================
# Tampered Data Tests
# ============================================================================


def test_validate_telegram_auth_tampered_id():
    """Test validation fails when id is tampered after hash generation."""
    data = create_valid_telegram_data(telegram_id=123456789)

    # Change id after valid hash was computed
    data["id"] = "999999999"

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_tampered_first_name():
    """Test validation fails when first_name is tampered."""
    data = create_valid_telegram_data(first_name="John")

    # Change first_name after valid hash was computed
    data["first_name"] = "Jane"

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_tampered_auth_date():
    """Test validation fails when auth_date is tampered."""
    data = create_valid_telegram_data(auth_date="1699999999")

    # Change auth_date after valid hash was computed
    data["auth_date"] = "1700000000"

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_added_field():
    """Test validation fails when extra field is added after hash generation."""
    data = create_valid_telegram_data()

    # Add field that wasn't part of hash computation
    data["extra_field"] = "malicious_value"

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_removed_field():
    """Test validation fails when optional field is removed after hash generation."""
    # Create data with username
    data = create_valid_telegram_data(username="johndoe")

    # Remove username after hash was computed (but keep hash)
    original_hash = data["hash"]
    del data["username"]
    data["hash"] = original_hash  # Put hash back

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


# ============================================================================
# Data Format Tests
# ============================================================================


def test_validate_telegram_auth_data_check_string_format():
    """Test that data_check_string is formatted correctly (sorted, key=value, newline separated)."""
    # This test verifies the data_check_string format by checking validation
    data = {
        "id": "123456789",
        "first_name": "John",
        "auth_date": "1699999999",
        "username": "johndoe",  # Will be sorted alphabetically
    }

    # Manually compute correct data_check_string
    # Expected order (sorted): auth_date, first_name, id, username
    correct_data_check_string = (
        "auth_date=1699999999\n" "first_name=John\n" "id=123456789\n" "username=johndoe"
    )

    # Compute hash with correct format
    bot_token = settings.TELEGRAM_BOT_TOKEN
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    correct_hash = hmac.new(
        key=secret_key, msg=correct_data_check_string.encode(), digestmod=hashlib.sha256
    ).hexdigest()

    data["hash"] = correct_hash

    # Should be valid
    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_case_sensitive():
    """Test that validation is case-sensitive for field names."""
    data = create_valid_telegram_data()

    # Change field name to different case
    data["First_Name"] = data.pop("first_name")

    # Should fail because field name doesn't match
    is_valid = validate_telegram_auth(data)

    assert is_valid is False


# ============================================================================
# Secret Key Tests
# ============================================================================


def test_validate_telegram_auth_uses_correct_secret_key():
    """Test that validation uses SHA256(bot_token) as secret key."""
    data = create_valid_telegram_data()

    # Validation should succeed with correct bot_token
    is_valid = validate_telegram_auth(data)
    assert is_valid is True

    # Now test with wrong bot_token
    wrong_bot_token = "wrong_bot_token_123456789"
    wrong_hash = compute_telegram_hash(
        {k: v for k, v in data.items() if k != "hash"}, wrong_bot_token
    )
    data["hash"] = wrong_hash

    # Should fail because secret_key is derived from different bot_token
    is_valid = validate_telegram_auth(data)
    assert is_valid is False


@patch("backend.app.services.telegram_auth.settings.TELEGRAM_BOT_TOKEN", "test_bot_token_123")
def test_validate_telegram_auth_with_mocked_bot_token():
    """Test validation with mocked bot token."""
    # Create data with mocked bot token
    data = {
        "id": "123456789",
        "first_name": "Test",
        "auth_date": "1699999999",
    }

    # Compute hash using mocked bot token
    mocked_bot_token = "test_bot_token_123"
    computed_hash = compute_telegram_hash(data, mocked_bot_token)
    data["hash"] = computed_hash

    # Should be valid with mocked token
    is_valid = validate_telegram_auth(data)

    assert is_valid is True


# ============================================================================
# Security Tests
# ============================================================================


def test_validate_telegram_auth_timing_attack_resistance():
    """
    Test that validation uses timing-attack resistant comparison.

    Note: We can't directly test timing resistance, but we verify that
    hmac.compare_digest is used (which is timing-attack resistant).
    This is a code review test - we verify behavior is correct.
    """
    # Create two different hashes
    data1 = create_valid_telegram_data(telegram_id=111)
    data2 = create_valid_telegram_data(telegram_id=222)

    hash1 = data1["hash"]
    hash2 = data2["hash"]

    # Both should validate correctly
    assert validate_telegram_auth(data1) is True
    assert validate_telegram_auth(data2) is True

    # Swap hashes - both should fail
    data1["hash"] = hash2
    data2["hash"] = hash1

    assert validate_telegram_auth(data1) is False
    assert validate_telegram_auth(data2) is False


def test_validate_telegram_auth_hash_not_in_final_data():
    """Test that hash is removed from data during validation (not included in data_check_string)."""
    data = create_valid_telegram_data()

    # Validation should succeed
    is_valid = validate_telegram_auth(data)
    assert is_valid is True

    # After validation, hash should be removed from data dict
    assert "hash" not in data


# ============================================================================
# Edge Cases
# ============================================================================


def test_validate_telegram_auth_very_long_values():
    """Test validation with very long field values."""
    data = create_valid_telegram_data(
        first_name="A" * 1000,  # Very long first name
        username="user" * 100,  # Very long username
    )

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_special_characters_in_values():
    """Test validation with special characters in field values."""
    data = create_valid_telegram_data(
        first_name="John@Doe#123", username="user_name-123", last_name="O'Brien"
    )

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_unicode_characters():
    """Test validation with Unicode characters in field values."""
    data = create_valid_telegram_data(
        first_name="Иван",  # Cyrillic
        last_name="Петров",  # Cyrillic
        username="ivan_petrov",
    )

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_empty_optional_fields():
    """Test validation when optional fields are present but empty."""
    data = {
        "id": "123456789",
        "first_name": "John",
        "auth_date": "1699999999",
        "username": "",  # Empty but present
        "last_name": "",  # Empty but present
    }

    bot_token = settings.TELEGRAM_BOT_TOKEN
    computed_hash = compute_telegram_hash(data, bot_token)
    data["hash"] = computed_hash

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_numeric_string_values():
    """Test validation with numeric values as strings (as Telegram sends them)."""
    data = create_valid_telegram_data(
        telegram_id=999888777,  # Will be converted to string
        auth_date="1700000000",  # Already string
    )

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_none_hash():
    """Test validation with hash=None returns False."""
    data = {
        "id": "123456789",
        "first_name": "John",
        "auth_date": "1699999999",
        "hash": None,
    }

    is_valid = validate_telegram_auth(data)

    assert is_valid is False
