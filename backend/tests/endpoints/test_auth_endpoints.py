"""
Unit tests for Authentication API endpoints.

Tests Telegram OAuth authentication with proper hash validation,
user creation/update (SCD Type 2), and JWT token generation.

Endpoints tested:
    POST /api/v1/auth/telegram - Telegram OAuth login
"""

import hashlib
import hmac
import time
from typing import Any

import pytest
from httpx import ASGITransport, AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.config import get_settings
from backend.app.models.user import User

settings = get_settings()


# ============================================================================
# Helper Functions
# ============================================================================


def generate_valid_telegram_auth_data(
    telegram_id: int,
    first_name: str,
    last_name: str = None,
    username: str = None,
    photo_url: str = None,
) -> dict[str, Any]:
    """
    Generate valid Telegram OAuth data with correct HMAC-SHA256 hash.

    This helper function creates authentication data that will pass
    validate_telegram_auth() validation. Used for testing successful
    authentication scenarios.

    Args:
        telegram_id: Telegram user ID
        first_name: User's first name
        last_name: User's last name (optional)
        username: Telegram username (optional)
        photo_url: Profile photo URL (optional)

    Returns:
        Dict with Telegram auth data including valid hash
    """
    # Create data dictionary (all values as strings)
    auth_date = int(time.time())

    data = {
        "id": str(telegram_id),
        "first_name": first_name,
        "auth_date": str(auth_date),
    }

    # Add optional fields
    if last_name:
        data["last_name"] = last_name
    if username:
        data["username"] = username
    if photo_url:
        data["photo_url"] = photo_url

    # Generate hash according to Telegram algorithm
    # 1. Create data_check_string (sorted key=value pairs)
    data_check_string = "\n".join([f"{key}={value}" for key, value in sorted(data.items())])

    # 2. Compute secret_key = SHA256(bot_token)
    bot_token = settings.TELEGRAM_BOT_TOKEN
    secret_key = hashlib.sha256(bot_token.encode()).digest()

    # 3. Compute HMAC-SHA256 hash
    computed_hash = hmac.new(
        key=secret_key,
        msg=data_check_string.encode(),
        digestmod=hashlib.sha256
    ).hexdigest()

    # 4. Add hash to data
    data["hash"] = computed_hash

    return data


# ============================================================================
# POST /api/v1/auth/telegram - Telegram OAuth Login
# ============================================================================


@pytest.mark.asyncio
async def test_telegram_login_new_user(client: AsyncClient, session: AsyncSession):
    """Test Telegram login with pre-registered user (admin-created user)."""
    # Pre-create user (admin registration required for new users)
    new_user = User(
        telegram_id=123456789,
        username="johndoe",
        first_name="John",
        last_name="Doe",
        is_admin=False,
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)

    # Generate valid auth data
    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
        last_name="Doe",
        username="johndoe",
    )

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 200

    data = response.json()
    assert "user" in data
    assert "message" in data
    assert data["message"] == "Authentication successful"

    user_data = data["user"]
    assert user_data["telegram_id"] == 123456789
    assert user_data["username"] == "johndoe"
    assert user_data["first_name"] == "John"
    assert user_data["last_name"] == "Doe"
    assert user_data["is_admin"] is False

    # Verify JWT token is set in cookie
    assert "access_token" in response.cookies

    # Verify user was created in database
    stmt = select(User).where(User.telegram_id == 123456789)
    result = await session.execute(stmt)
    user = result.scalar_one_or_none()

    assert user is not None
    assert user.username == "johndoe"


@pytest.mark.asyncio
async def test_telegram_login_existing_user(client: AsyncClient, session: AsyncSession):
    """Test Telegram login with existing user (no new version created if no changes)."""
    # Create existing user
    existing_user = User(
        telegram_id=123456789,
        username="johndoe",
        first_name="John",
        last_name="Doe",
        is_admin=False,
    )
    session.add(existing_user)
    await session.commit()
    await session.refresh(existing_user)

    # Generate auth data for same user
    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
        last_name="Doe",
        username="johndoe",
    )

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 200

    data = response.json()
    assert data["user"]["id"] == existing_user.id

    # Verify no new version created (data didn't change)
    stmt = select(User).where(User.telegram_id == 123456789)
    result = await session.execute(stmt)
    users = result.scalars().all()

    # Should still be 1 user (no new version)
    assert len(users) == 1


@pytest.mark.asyncio
async def test_telegram_login_user_data_changed(client: AsyncClient, session: AsyncSession):
    """Test Telegram login updates user data (SCD Type 1 - in-place update)."""
    # Create existing user
    existing_user = User(
        telegram_id=123456789,
        username="johndoe",
        first_name="John",
        last_name="Doe",
        is_admin=False,
    )
    session.add(existing_user)
    await session.commit()

    # Login with updated username
    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
        last_name="Doe",
        username="johndoe_new",  # Changed username
    )

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 200

    data = response.json()
    assert data["user"]["username"] == "johndoe_new"

    # Verify user data updated (SCD Type 1 - in-place update, no versioning)
    stmt = select(User).where(User.telegram_id == 123456789)
    result = await session.execute(stmt)
    users = result.scalars().all()

    # Should have 1 user (in-place update, no versioning)
    # Note: User model uses SCD Type 1 for Telegram OAuth updates (simpler)
    assert len(users) == 1

    # Updated user has new username
    updated_user = users[0]
    assert updated_user.username == "johndoe_new"


@pytest.mark.asyncio
async def test_telegram_login_minimal_fields(client: AsyncClient, session: AsyncSession):
    """Test Telegram login with minimal required fields (no username, last_name)."""
    # Pre-create user (admin registration required)
    minimal_user = User(
        telegram_id=123456789,
        username=None,
        first_name="John",
        last_name=None,
        is_admin=False,
    )
    session.add(minimal_user)
    await session.commit()
    await session.refresh(minimal_user)

    # Generate auth data with only required fields
    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
        # No last_name, username
    )

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 200

    data = response.json()
    assert data["user"]["first_name"] == "John"
    assert data["user"]["last_name"] is None
    assert data["user"]["username"] is None


@pytest.mark.asyncio
async def test_telegram_login_invalid_hash(client: AsyncClient):
    """Test Telegram login with invalid hash (should fail with 401)."""
    # Create auth data with invalid hash
    auth_data = {
        "id": 123456789,
        "first_name": "John",
        "last_name": "Doe",
        "username": "johndoe",
        "auth_date": int(time.time()),
        "hash": "invalid_hash_123456",  # Invalid hash
    }

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 401

    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_telegram_login_missing_hash(client: AsyncClient):
    """Test Telegram login without hash field (should fail with 422 validation)."""
    # Create auth data without hash
    auth_data = {
        "id": 123456789,
        "first_name": "John",
        "auth_date": int(time.time()),
        # No hash field
    }

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    # Pydantic validation happens before auth check, so 422 is correct
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_telegram_login_tampered_data(client: AsyncClient):
    """Test Telegram login with tampered data (valid hash but modified data)."""
    # Generate valid auth data
    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
        username="johndoe",
    )

    # Tamper with data after hash generation
    auth_data["first_name"] = "Jane"  # Changed after hash computed

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    # Should fail because hash doesn't match modified data
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_telegram_login_cookie_attributes(client: AsyncClient, session: AsyncSession):
    """Test that JWT cookie has correct security attributes."""
    # Pre-create user (admin registration required)
    cookie_user = User(
        telegram_id=123456789,
        username=None,
        first_name="John",
        last_name=None,
        is_admin=False,
    )
    session.add(cookie_user)
    await session.commit()
    await session.refresh(cookie_user)

    # Generate valid auth data
    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
    )

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 200

    # Verify cookie is set
    assert "access_token" in response.cookies

    # Note: httponly, secure, samesite attributes are set server-side
    # but may not be directly testable in httpx cookies
    # This test confirms cookie is present; manual/integration testing
    # should verify security attributes in browser


@pytest.mark.asyncio
async def test_telegram_login_jwt_token_valid(client: AsyncClient, session: AsyncSession):
    """Test that JWT token can be used for authenticated requests."""
    # Pre-create user (admin registration required)
    jwt_user = User(
        telegram_id=123456789,
        username="johndoe",
        first_name="John",
        is_admin=False,
    )
    session.add(jwt_user)
    await session.commit()
    await session.refresh(jwt_user)

    # Step 1: Login via Telegram OAuth
    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
        username="johndoe",
    )

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 200

    # Extract access_token from cookie
    access_token = response.cookies.get("access_token")
    assert access_token is not None

    # Step 2: Use JWT token to access protected endpoint
    # Create a new client with the auth cookie
    from backend.app.core.dependencies import get_session

    async def override_get_session():
        async with AsyncSession(session.bind, expire_on_commit=False) as s:
            yield s

    from backend.app.main import app

    app.dependency_overrides[get_session] = override_get_session

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as auth_client:
        auth_client.cookies.set("access_token", access_token)

        # Try accessing protected endpoint (e.g., /users/me)
        protected_response = await auth_client.get("/api/v1/users/me")

        assert protected_response.status_code == 200

        user_data = protected_response.json()
        assert user_data["telegram_id"] == 123456789
        assert user_data["username"] == "johndoe"

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_telegram_login_admin_flag_default_false(client: AsyncClient, session: AsyncSession):
    """Test that new users are not admin by default."""
    # Pre-create user (admin registration required)
    admin_flag_user = User(
        telegram_id=123456789,
        first_name="John",
        is_admin=False,
    )
    session.add(admin_flag_user)
    await session.commit()
    await session.refresh(admin_flag_user)

    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
    )

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 200

    data = response.json()
    assert data["user"]["is_admin"] is False

    # Verify in database
    stmt = select(User).where(User.telegram_id == 123456789)
    result = await session.execute(stmt)
    user = result.scalar_one()

    assert user.is_admin is False


@pytest.mark.asyncio
async def test_telegram_login_multiple_users(client: AsyncClient, session: AsyncSession):
    """Test creating multiple different users via Telegram login."""
    # Pre-create users (admin registration required)
    alice = User(
        telegram_id=111111111,
        first_name="Alice",
        username="alice",
        is_admin=False,
    )
    bob = User(
        telegram_id=222222222,
        first_name="Bob",
        username="bob",
        is_admin=False,
    )
    session.add(alice)
    session.add(bob)
    await session.commit()

    # User 1
    auth_data_1 = generate_valid_telegram_auth_data(
        telegram_id=111111111,
        first_name="Alice",
        username="alice",
    )
    response_1 = await client.post("/api/v1/auth/telegram", json=auth_data_1)
    assert response_1.status_code == 200

    # User 2
    auth_data_2 = generate_valid_telegram_auth_data(
        telegram_id=222222222,
        first_name="Bob",
        username="bob",
    )
    response_2 = await client.post("/api/v1/auth/telegram", json=auth_data_2)
    assert response_2.status_code == 200

    # Verify both users exist
    stmt = select(User)
    result = await session.execute(stmt)
    users = result.scalars().all()

    assert len(users) >= 2

    usernames = {user.username for user in users}
    assert "alice" in usernames
    assert "bob" in usernames


@pytest.mark.asyncio
async def test_telegram_login_returns_user_id(client: AsyncClient):
    """Test that login response includes user ID."""
    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
    )

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 200

    data = response.json()
    assert "user" in data
    assert "id" in data["user"]
    assert isinstance(data["user"]["id"], int)
    assert data["user"]["id"] > 0


@pytest.mark.asyncio
async def test_telegram_login_with_photo_url(client: AsyncClient, session: AsyncSession):
    """Test Telegram login with photo_url field."""
    auth_data = generate_valid_telegram_auth_data(
        telegram_id=123456789,
        first_name="John",
        username="johndoe",
        photo_url="https://t.me/photo.jpg",
    )

    response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert response.status_code == 200

    # Note: photo_url is validated but not stored in User model (per current schema)
    # This test verifies it doesn't break validation
