"""
Unit tests for Web Apps authentication service.

Tests initData validation logic without database/HTTP dependencies.
"""

import hashlib
import hmac
import json
import time
from urllib.parse import quote, urlencode

import pytest

from backend.app.services.webapp_auth import (
    extract_user_from_initdata,
    validate_webapp_initdata,
)


class TestValidateWebAppInitData:
    """Test initData validation."""

    def test_valid_initdata(self, monkeypatch):
        """Test validation with valid initData."""
        # Mock settings
        bot_token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
        monkeypatch.setattr("backend.app.services.webapp_auth.settings.TELEGRAM_BOT_TOKEN", bot_token)

        # Create valid initData
        user_data = {
            "id": 123456789,
            "first_name": "Test",
            "last_name": "User",
            "username": "testuser",
        }

        auth_date = int(time.time())  # Current time

        data = {
            "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
            "user": quote(json.dumps(user_data)),
            "auth_date": str(auth_date),
        }

        # Create data_check_string
        data_check_string = "\n".join([f"{key}={value}" for key, value in sorted(data.items())])

        # Create secret key (CRITICAL: Web Apps algorithm)
        secret_key = hmac.new(
            key="WebAppData".encode(),
            msg=bot_token.encode(),
            digestmod=hashlib.sha256
        ).digest()

        # Compute hash
        computed_hash = hmac.new(
            key=secret_key,
            msg=data_check_string.encode(),
            digestmod=hashlib.sha256
        ).hexdigest()

        # Add hash to data
        data["hash"] = computed_hash

        # Convert to initData query string
        init_data = urlencode(data)

        # Test validation
        is_valid, extracted_user = validate_webapp_initdata(init_data)

        assert is_valid is True
        assert extracted_user is not None
        assert extracted_user["id"] == 123456789
        assert extracted_user["first_name"] == "Test"

    def test_invalid_hash(self, monkeypatch):
        """Test validation with invalid hash."""
        bot_token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
        monkeypatch.setattr("backend.app.services.webapp_auth.settings.TELEGRAM_BOT_TOKEN", bot_token)

        user_data = {
            "id": 123456789,
            "first_name": "Test",
        }

        auth_date = int(time.time())

        data = {
            "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
            "user": quote(json.dumps(user_data)),
            "auth_date": str(auth_date),
            "hash": "invalid_hash_12345",  # Invalid hash
        }

        init_data = urlencode(data)

        is_valid, extracted_user = validate_webapp_initdata(init_data)

        assert is_valid is False
        assert extracted_user is None

    def test_expired_auth_date(self, monkeypatch):
        """Test validation with expired auth_date (> 1 hour old)."""
        bot_token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
        monkeypatch.setattr("backend.app.services.webapp_auth.settings.TELEGRAM_BOT_TOKEN", bot_token)

        user_data = {
            "id": 123456789,
            "first_name": "Test",
        }

        # Set auth_date to 2 hours ago (expired)
        auth_date = int(time.time()) - 7200

        data = {
            "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
            "user": quote(json.dumps(user_data)),
            "auth_date": str(auth_date),
        }

        # Create valid hash (but data is expired)
        data_check_string = "\n".join([f"{key}={value}" for key, value in sorted(data.items())])
        secret_key = hmac.new(
            key="WebAppData".encode(),
            msg=bot_token.encode(),
            digestmod=hashlib.sha256
        ).digest()
        computed_hash = hmac.new(
            key=secret_key,
            msg=data_check_string.encode(),
            digestmod=hashlib.sha256
        ).hexdigest()
        data["hash"] = computed_hash

        init_data = urlencode(data)

        is_valid, extracted_user = validate_webapp_initdata(init_data)

        assert is_valid is False
        assert extracted_user is None

    def test_missing_hash(self):
        """Test validation with missing hash."""
        data = {
            "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
            "user": quote(json.dumps({"id": 123})),
            "auth_date": str(int(time.time())),
            # No hash field
        }

        init_data = urlencode(data)

        is_valid, extracted_user = validate_webapp_initdata(init_data)

        assert is_valid is False
        assert extracted_user is None


class TestExtractUserFromInitData:
    """Test user data extraction."""

    def test_extract_full_user_data(self):
        """Test extraction with all user fields."""
        user_data = {
            "id": 123456789,
            "first_name": "Test",
            "last_name": "User",
            "username": "testuser",
            "language_code": "ru",
        }

        extracted = extract_user_from_initdata(user_data)

        assert extracted["id"] == 123456789
        assert extracted["first_name"] == "Test"
        assert extracted["last_name"] == "User"
        assert extracted["username"] == "testuser"

    def test_extract_minimal_user_data(self):
        """Test extraction with minimal user fields (only id and first_name)."""
        user_data = {
            "id": 123456789,
            "first_name": "Test",
        }

        extracted = extract_user_from_initdata(user_data)

        assert extracted["id"] == 123456789
        assert extracted["first_name"] == "Test"
        assert extracted.get("last_name") is None
        assert extracted.get("username") is None
