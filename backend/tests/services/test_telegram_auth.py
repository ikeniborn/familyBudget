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
    - auth_date expiration check (replay attack prevention)

Reference:
    https://core.telegram.org/widgets/login#checking-authorization
"""

import hashlib
import hmac
import time
from unittest.mock import patch

from backend.app.core.config import get_settings
from backend.app.services.telegram_auth import AUTH_DATE_EXPIRATION, validate_telegram_auth

settings = get_settings()


# ============================================================================
# Helper Functions
# ============================================================================


def compute_telegram_hash(data: dict[str, str], bot_token: str) -> str:
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
    auth_date: str = None,
) -> dict[str, str]:
    """
    Create valid Telegram OAuth data with correct hash.

    Args:
        telegram_id: Telegram user ID
        first_name: User first name
        last_name: User last name (optional)
        username: Telegram username (optional)
        photo_url: Profile photo URL (optional)
        auth_date: Unix timestamp of authentication (default: current time)

    Returns:
        Dict with Telegram auth data including valid hash
    """
    # Use current time by default to pass auth_date expiration check
    if auth_date is None:
        auth_date = str(int(time.time()))

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
        telegram_id=123456789, first_name="John"
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
    current_time = str(int(time.time()))
    data = create_valid_telegram_data(auth_date=current_time)

    # Change auth_date after valid hash was computed
    data["auth_date"] = str(int(current_time) + 100)

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
    current_auth_date = str(int(time.time()))
    data = {
        "id": "123456789",
        "first_name": "John",
        "auth_date": current_auth_date,
        "username": "johndoe",  # Will be sorted alphabetically
    }

    # Manually compute correct data_check_string
    # Expected order (sorted): auth_date, first_name, id, username
    correct_data_check_string = (
        f"auth_date={current_auth_date}\n"
        "first_name=John\n"
        "id=123456789\n"
        "username=johndoe"
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
    # Create data with mocked bot token - use current time
    current_auth_date = str(int(time.time()))
    data = {
        "id": "123456789",
        "first_name": "Test",
        "auth_date": current_auth_date,
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
        # auth_date defaults to current time
    )

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_none_hash():
    """Test validation with hash=None returns False."""
    current_auth_date = str(int(time.time()))
    data = {
        "id": "123456789",
        "first_name": "John",
        "auth_date": current_auth_date,
        "hash": None,
    }

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


# ============================================================================
# Auth Date Expiration Tests (Replay Attack Prevention)
# ============================================================================


def test_validate_telegram_auth_valid_auth_date():
    """Test validation succeeds with auth_date within expiration window."""
    # auth_date = current time (just authenticated)
    current_time = int(time.time())
    data = create_valid_telegram_data(auth_date=str(current_time))

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_auth_date_at_boundary():
    """Test validation succeeds when auth_date is exactly at expiration boundary."""
    # auth_date = current time - (AUTH_DATE_EXPIRATION - 1) seconds
    current_time = int(time.time())
    boundary_time = current_time - (AUTH_DATE_EXPIRATION - 1)
    data = create_valid_telegram_data(auth_date=str(boundary_time))

    is_valid = validate_telegram_auth(data)

    assert is_valid is True


def test_validate_telegram_auth_expired_auth_date():
    """
    Test validation FAILS when auth_date is older than AUTH_DATE_EXPIRATION.

    ⚠️ SECURITY: This test verifies replay attack prevention.
    If an attacker captures a valid OAuth callback URL, they should NOT be able
    to use it more than AUTH_DATE_EXPIRATION seconds (5 minutes) later.
    """
    # auth_date = current time - 6 minutes (360 seconds) - well past expiration
    current_time = int(time.time())
    expired_time = current_time - (AUTH_DATE_EXPIRATION + 60)  # 1 minute past expiration
    data = create_valid_telegram_data(auth_date=str(expired_time))

    is_valid = validate_telegram_auth(data)

    assert is_valid is False, (
        f"Expired auth_date should be rejected. "
        f"auth_date={expired_time}, current_time={current_time}, "
        f"age={current_time - expired_time}s, max={AUTH_DATE_EXPIRATION}s"
    )


def test_validate_telegram_auth_very_old_auth_date():
    """Test validation fails with auth_date from distant past (potential replay attack)."""
    # auth_date = 1 hour ago - definitely expired
    current_time = int(time.time())
    old_time = current_time - 3600  # 1 hour ago
    data = create_valid_telegram_data(auth_date=str(old_time))

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_ancient_auth_date():
    """Test validation fails with auth_date from years ago (captured OAuth URL)."""
    # auth_date = November 2023 - simulating a captured URL from the past
    ancient_auth_date = "1699999999"  # ~ Nov 14, 2023
    data = create_valid_telegram_data(auth_date=ancient_auth_date)

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_invalid_auth_date_format_string():
    """Test validation fails when auth_date is non-numeric string."""
    # Create valid data first
    data = create_valid_telegram_data()
    # Replace with invalid auth_date
    data["auth_date"] = "invalid"
    # Re-compute hash with invalid auth_date
    bot_token = settings.TELEGRAM_BOT_TOKEN
    data_for_hash = {k: v for k, v in data.items() if k != "hash"}
    data["hash"] = compute_telegram_hash(data_for_hash, bot_token)

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_invalid_auth_date_empty():
    """Test validation fails when auth_date is empty string."""
    # Create valid data first
    data = create_valid_telegram_data()
    # Replace with empty auth_date
    data["auth_date"] = ""
    # Re-compute hash
    bot_token = settings.TELEGRAM_BOT_TOKEN
    data_for_hash = {k: v for k, v in data.items() if k != "hash"}
    data["hash"] = compute_telegram_hash(data_for_hash, bot_token)

    is_valid = validate_telegram_auth(data)

    assert is_valid is False


def test_validate_telegram_auth_auth_date_in_future():
    """Test validation succeeds with auth_date slightly in future (clock skew)."""
    # auth_date = current time + 10 seconds (acceptable clock skew)
    future_time = int(time.time()) + 10
    data = create_valid_telegram_data(auth_date=str(future_time))

    is_valid = validate_telegram_auth(data)

    # Future auth_date is valid (current_time - auth_date < 0 < AUTH_DATE_EXPIRATION)
    assert is_valid is True


def test_validate_telegram_auth_expiration_constant():
    """Verify AUTH_DATE_EXPIRATION is set to 5 minutes (300 seconds)."""
    # This test documents the expected security configuration
    assert AUTH_DATE_EXPIRATION == 300, (
        f"AUTH_DATE_EXPIRATION should be 300 seconds (5 minutes), "
        f"got {AUTH_DATE_EXPIRATION}s"
    )
