"""
Integration tests for Web Apps validate endpoint.

Tests the full endpoint flow including database interactions.
"""

import hashlib
import hmac
import json
import time
from urllib.parse import quote, urlencode

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import get_settings
from backend.app.models import User

settings = get_settings()


@pytest.mark.integration
@pytest.mark.backend
@pytest.mark.webapp
@pytest.mark.destructive
class TestWebAppValidateEndpoint:
    """Test /api/v1/webapp/validate endpoint."""

    async def test_validate_with_valid_initdata(
        self, client: AsyncClient, db_session: AsyncSession, monkeypatch
    ):
        """Test validation endpoint with valid initData."""
        # Mock bot token
        bot_token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
        monkeypatch.setattr("backend.app.services.webapp_auth.settings.TELEGRAM_BOT_TOKEN", bot_token)

        # CRITICAL FIX: Create user in database BEFORE validation
        # Endpoint returns HTTP 403 if user not registered (even if hash is valid)
        test_user = User(
            telegram_id=123456789,
            username="testuser",
            first_name="Test",
            last_name="User",
            is_admin=False,
        )
        db_session.add(test_user)
        await db_session.commit()
        await db_session.refresh(test_user)

        # Create valid initData
        user_data = {
            "id": 123456789,
            "first_name": "Test",
            "last_name": "User",
            "username": "testuser",
        }

        auth_date = int(time.time())

        data = {
            "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
            "user": quote(json.dumps(user_data)),
            "auth_date": str(auth_date),
        }

        # Create valid hash
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

        # Make request
        response = await client.post(
            "/api/v1/webapp/validate",
            json={"initData": init_data}
        )

        # Assert response
        assert response.status_code == 200

        json_data = response.json()
        assert json_data["valid"] is True
        assert "user" in json_data
        assert json_data["user"]["telegram_id"] == 123456789
        assert json_data["user"]["first_name"] == "Test"
        assert "access_token" in json_data
        assert len(json_data["access_token"]) > 0

    async def test_validate_with_invalid_hash(
        self, client: AsyncClient, monkeypatch
    ):
        """Test validation endpoint with invalid hash."""
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
            "hash": "invalid_hash_12345",
        }

        init_data = urlencode(data)

        response = await client.post(
            "/api/v1/webapp/validate",
            json={"initData": init_data}
        )

        assert response.status_code == 401
        # API returns {'message': '...', 'status_code': 401} format (not 'detail')
        response_data = response.json()
        # Check if error message contains "Invalid initData" in any field
        assert "Invalid initData" in response_data.get("message", "") or "Invalid initData" in response_data.get("detail", "")

    async def test_validate_with_expired_auth_date(
        self, client: AsyncClient, monkeypatch
    ):
        """Test validation endpoint with expired auth_date."""
        bot_token = "123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11"
        monkeypatch.setattr("backend.app.services.webapp_auth.settings.TELEGRAM_BOT_TOKEN", bot_token)

        user_data = {
            "id": 123456789,
            "first_name": "Test",
        }

        # 2 hours ago (expired)
        auth_date = int(time.time()) - 7200

        data = {
            "query_id": "AAHdF6IQAAAAAN0XohDhrOrc",
            "user": quote(json.dumps(user_data)),
            "auth_date": str(auth_date),
        }

        # Create valid hash (but expired)
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

        response = await client.post(
            "/api/v1/webapp/validate",
            json={"initData": init_data}
        )

        assert response.status_code == 401

    async def test_validate_creates_user_if_not_exists(
        self, client: AsyncClient, db_session: AsyncSession, monkeypatch
    ):
        """Test that validation creates user in database if doesn't exist."""
        # TODO: Implement this test when user creation logic is added
        # This test should verify:
        # 1. User doesn't exist before validation
        # 2. Validation succeeds
        # 3. User exists in database after validation
        # 4. User data matches initData
        pytest.skip("User creation logic not yet implemented")

    async def test_validate_returns_existing_user(
        self, client: AsyncClient, db_session: AsyncSession, monkeypatch
    ):
        """Test that validation returns existing user from database."""
        # TODO: Implement this test when user creation logic is added
        # This test should verify:
        # 1. User exists in database
        # 2. Validation succeeds
        # 3. Returned user matches existing user
        pytest.skip("User creation logic not yet implemented")
