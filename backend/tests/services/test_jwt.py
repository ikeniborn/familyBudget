"""
Unit tests for JWT service.

Tests JWT token creation, validation, expiration handling, and security properties.
This is a CRITICAL SECURITY module - comprehensive testing is essential.

Functions tested:
    - create_access_token(user_id: int) -> str
    - decode_access_token(token: str) -> Optional[int]
"""

from datetime import datetime, timedelta
from unittest.mock import patch

from jose import jwt

from backend.app.services.jwt import (
    ALGORITHM,
    SECRET_KEY,
    TOKEN_EXPIRE_DAYS,
    create_access_token,
    decode_access_token,
)

# ============================================================================
# create_access_token() Tests
# ============================================================================


def test_create_access_token_basic():
    """Test creating a basic access token with user_id."""
    user_id = 123
    token = create_access_token(user_id)

    # Token should be a non-empty string
    assert isinstance(token, str)
    assert len(token) > 0

    # Token should be a valid JWT format (header.payload.signature)
    parts = token.split(".")
    assert len(parts) == 3


def test_create_access_token_contains_user_id():
    """Test that created token contains correct user_id claim."""
    user_id = 456
    token = create_access_token(user_id)

    # Decode token manually to verify claims
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    assert "user_id" in payload
    assert payload["user_id"] == user_id


def test_create_access_token_contains_expiration():
    """Test that created token contains expiration claim."""
    user_id = 789
    token = create_access_token(user_id)

    # Decode token to check expiration
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    assert "exp" in payload
    assert isinstance(payload["exp"], int)

    # Expiration should be approximately TOKEN_EXPIRE_DAYS from now
    exp_datetime = datetime.utcfromtimestamp(payload["exp"])
    expected_exp = datetime.utcnow() + timedelta(days=TOKEN_EXPIRE_DAYS)

    # Allow 5 seconds tolerance for test execution time
    time_diff = abs((exp_datetime - expected_exp).total_seconds())
    assert time_diff < 5


def test_create_access_token_contains_issued_at():
    """Test that created token contains issued_at (iat) claim."""
    user_id = 101
    token = create_access_token(user_id)

    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    assert "iat" in payload
    assert isinstance(payload["iat"], int)

    # Issued at should be approximately now
    iat_datetime = datetime.utcfromtimestamp(payload["iat"])
    now = datetime.utcnow()

    # Allow 5 seconds tolerance
    time_diff = abs((iat_datetime - now).total_seconds())
    assert time_diff < 5


def test_create_access_token_different_users():
    """Test creating tokens for different users produces different tokens."""
    token1 = create_access_token(user_id=111)
    token2 = create_access_token(user_id=222)

    # Tokens should be different
    assert token1 != token2

    # But both should decode to correct user_ids
    payload1 = jwt.decode(token1, SECRET_KEY, algorithms=[ALGORITHM])
    payload2 = jwt.decode(token2, SECRET_KEY, algorithms=[ALGORITHM])

    assert payload1["user_id"] == 111
    assert payload2["user_id"] == 222


def test_create_access_token_uses_correct_algorithm():
    """Test that token is signed with HS256 algorithm."""
    user_id = 333
    token = create_access_token(user_id)

    # Decode token header to check algorithm
    header = jwt.get_unverified_header(token)

    assert "alg" in header
    assert header["alg"] == "HS256"


# ============================================================================
# decode_access_token() Tests
# ============================================================================


def test_decode_access_token_valid():
    """Test decoding a valid access token returns correct user_id."""
    user_id = 555
    token = create_access_token(user_id)

    # Decode token
    decoded_user_id = decode_access_token(token)

    assert decoded_user_id is not None
    assert decoded_user_id == user_id


def test_decode_access_token_expired():
    """Test decoding an expired token returns None."""
    user_id = 666

    # Create token with past expiration (expired 1 day ago)
    past_time = datetime.utcnow() - timedelta(days=1)
    claims = {
        "user_id": user_id,
        "exp": past_time,
        "iat": past_time - timedelta(days=7),
    }

    expired_token = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)

    # Should return None for expired token
    decoded_user_id = decode_access_token(expired_token)

    assert decoded_user_id is None


def test_decode_access_token_invalid_signature():
    """Test decoding token with invalid signature returns None."""
    user_id = 777
    token = create_access_token(user_id)

    # Tamper with token signature (change last character)
    tampered_token = token[:-1] + ("X" if token[-1] != "X" else "Y")

    # Should return None for invalid signature
    decoded_user_id = decode_access_token(tampered_token)

    assert decoded_user_id is None


def test_decode_access_token_malformed():
    """Test decoding malformed token returns None."""
    malformed_tokens = [
        "not.a.jwt",  # Not enough parts
        "invalid_jwt_string",  # Not JWT format
        "",  # Empty string
        "header.payload",  # Missing signature
    ]

    for malformed_token in malformed_tokens:
        decoded_user_id = decode_access_token(malformed_token)
        assert decoded_user_id is None, f"Should return None for: {malformed_token}"


def test_decode_access_token_missing_user_id_claim():
    """Test decoding token without user_id claim returns None."""
    # Create token without user_id claim
    claims = {
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow(),
        # No user_id
    }

    token_without_user_id = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)

    # Should return None when user_id is missing
    decoded_user_id = decode_access_token(token_without_user_id)

    assert decoded_user_id is None


def test_decode_access_token_user_id_null():
    """Test decoding token with null user_id returns None."""
    # Create token with user_id = None
    claims = {
        "user_id": None,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow(),
    }

    token_with_null_user_id = jwt.encode(claims, SECRET_KEY, algorithm=ALGORITHM)

    # Should return None when user_id is null
    decoded_user_id = decode_access_token(token_with_null_user_id)

    assert decoded_user_id is None


def test_decode_access_token_wrong_algorithm():
    """Test decoding token signed with wrong algorithm returns None."""
    user_id = 888

    # Create token with different algorithm (HS512 instead of HS256)
    claims = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow(),
    }

    wrong_algorithm_token = jwt.encode(claims, SECRET_KEY, algorithm="HS512")

    # Should return None because algorithm doesn't match
    decoded_user_id = decode_access_token(wrong_algorithm_token)

    assert decoded_user_id is None


def test_decode_access_token_wrong_secret():
    """Test decoding token signed with wrong secret returns None."""
    user_id = 999

    # Create token with different secret
    claims = {
        "user_id": user_id,
        "exp": datetime.utcnow() + timedelta(days=7),
        "iat": datetime.utcnow(),
    }

    wrong_secret_token = jwt.encode(claims, "wrong_secret_key_123", algorithm=ALGORITHM)

    # Should return None because signature verification fails
    decoded_user_id = decode_access_token(wrong_secret_token)

    assert decoded_user_id is None


# ============================================================================
# Round-trip Tests
# ============================================================================


def test_create_and_decode_round_trip():
    """Test creating and decoding token in round trip."""
    user_id = 1234

    # Create token
    token = create_access_token(user_id)

    # Decode token
    decoded_user_id = decode_access_token(token)

    # Should get back the same user_id
    assert decoded_user_id == user_id


def test_create_and_decode_multiple_users():
    """Test round trip for multiple different users."""
    user_ids = [1, 100, 999, 10000, 999999]

    for user_id in user_ids:
        token = create_access_token(user_id)
        decoded_user_id = decode_access_token(token)

        assert decoded_user_id == user_id


# ============================================================================
# Security Tests
# ============================================================================


def test_token_expiration_configurable():
    """Test that token expiration uses TOKEN_EXPIRE_DAYS setting."""
    user_id = 1111

    # Mock TOKEN_EXPIRE_DAYS to verify it's being used
    with patch("backend.app.services.jwt.TOKEN_EXPIRE_DAYS", 14):  # 14 days
        token = create_access_token(user_id)

        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        exp_datetime = datetime.utcfromtimestamp(payload["exp"])
        expected_exp = datetime.utcnow() + timedelta(days=14)

        time_diff = abs((exp_datetime - expected_exp).total_seconds())
        assert time_diff < 5


def test_token_uses_secure_secret():
    """Test that token uses SECRET_KEY from settings."""
    # Verify SECRET_KEY is not empty or default
    assert SECRET_KEY is not None
    assert len(SECRET_KEY) > 0
    assert SECRET_KEY != "default_secret_key"  # Should not be hardcoded default


def test_algorithm_is_hs256():
    """Test that algorithm is HS256 (HMAC-SHA256)."""
    assert ALGORITHM == "HS256"


def test_token_not_replayable():
    """Test that each token creation produces unique token (includes iat)."""
    user_id = 2222

    # Create two tokens for same user
    token1 = create_access_token(user_id)
    token2 = create_access_token(user_id)

    # Tokens should be different (different iat timestamps)
    assert token1 != token2

    # But both should decode to same user_id
    assert decode_access_token(token1) == user_id
    assert decode_access_token(token2) == user_id


# ============================================================================
# Edge Cases
# ============================================================================


def test_decode_access_token_very_long_token():
    """Test decoding extremely long invalid token returns None."""
    very_long_token = "a" * 10000

    decoded_user_id = decode_access_token(very_long_token)

    assert decoded_user_id is None


def test_create_access_token_user_id_zero():
    """Test creating token with user_id=0 (edge case)."""
    user_id = 0
    token = create_access_token(user_id)

    decoded_user_id = decode_access_token(token)

    # Should work even with user_id=0
    assert decoded_user_id == 0


def test_create_access_token_large_user_id():
    """Test creating token with very large user_id."""
    user_id = 2**31 - 1  # Max 32-bit signed integer

    token = create_access_token(user_id)
    decoded_user_id = decode_access_token(token)

    assert decoded_user_id == user_id


def test_decode_access_token_special_characters():
    """Test decoding token with special characters returns None."""
    invalid_tokens = [
        "header.payload.signature!@#$%",
        "тест.тест.тест",  # Non-ASCII characters
        "header\npayload\nsignature",  # Newlines
    ]

    for invalid_token in invalid_tokens:
        decoded_user_id = decode_access_token(invalid_token)
        assert decoded_user_id is None
