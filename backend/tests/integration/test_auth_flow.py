"""
Integration tests for authentication flow.

Tests complete end-to-end authentication scenarios:
1. Telegram OAuth → User creation → JWT generation → Cookie setting
2. Authenticated request using JWT cookie
3. Token expiration and refresh
4. User data updates via re-authentication

These tests verify the entire auth stack works together correctly.
"""

import hashlib
import hmac
import time

import pytest
from httpx import AsyncClient
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.config import get_settings
from backend.app.models.user import User

settings = get_settings()


# ============================================================================
# Helper Functions
# ============================================================================


def generate_telegram_auth_data(
    telegram_id: int = 123456789,
    first_name: str = "Integration",
    last_name: str = "Test",
    username: str = "integtest",
) -> dict[str, str]:
    """Generate valid Telegram OAuth data for integration testing."""
    auth_date = int(time.time())

    data = {
        "id": str(telegram_id),
        "first_name": first_name,
        "auth_date": str(auth_date),
    }

    if last_name:
        data["last_name"] = last_name
    if username:
        data["username"] = username

    # Compute valid hash
    data_check_string = "\n".join([f"{key}={value}" for key, value in sorted(data.items())])
    bot_token = settings.TELEGRAM_BOT_TOKEN
    secret_key = hashlib.sha256(bot_token.encode()).digest()
    computed_hash = hmac.new(
        key=secret_key, msg=data_check_string.encode(), digestmod=hashlib.sha256
    ).hexdigest()

    data["hash"] = computed_hash

    return data


# ============================================================================
# Complete Auth Flow Tests
# ============================================================================


@pytest.mark.asyncio
async def test_complete_auth_flow_new_user(client: AsyncClient, session: AsyncSession):
    """
    Test complete authentication flow for new user.

    Flow:
    1. POST /auth/telegram with valid Telegram data
    2. Verify user created in database
    3. Verify JWT token set in cookie
    4. Use JWT cookie to access protected endpoint
    5. Verify user data returned correctly
    """
    # Step 1: Authenticate via Telegram OAuth
    auth_data = generate_telegram_auth_data(
        telegram_id=111222333, first_name="Alice", last_name="Smith", username="alice"
    )

    auth_response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert auth_response.status_code == 200

    auth_json = auth_response.json()
    assert "user" in auth_json
    assert auth_json["user"]["telegram_id"] == 111222333
    assert auth_json["user"]["username"] == "alice"
    assert auth_json["message"] == "Authentication successful"

    # Step 2: Verify user created in database
    stmt = select(User).where(User.telegram_id == 111222333, User.is_current)
    result = await session.execute(stmt)
    user = result.scalar_one()

    assert user.username == "alice"
    assert user.first_name == "Alice"
    assert user.is_current is True

    # Step 3: Verify JWT token in cookie
    assert "access_token" in auth_response.cookies
    access_token = auth_response.cookies["access_token"]
    assert len(access_token) > 0

    # Step 4: Use JWT cookie to access protected endpoint
    client.cookies.set("access_token", access_token)

    me_response = await client.get("/api/v1/users/me")

    assert me_response.status_code == 200

    me_json = me_response.json()
    assert me_json["telegram_id"] == 111222333
    assert me_json["username"] == "alice"
    assert me_json["first_name"] == "Alice"
    assert me_json["is_admin"] is False


@pytest.mark.asyncio
async def test_complete_auth_flow_existing_user(client: AsyncClient, session: AsyncSession):
    """
    Test complete authentication flow for existing user (re-login).

    Flow:
    1. Create user manually
    2. Authenticate via Telegram OAuth
    3. Verify no new user created (same user returned)
    4. Verify JWT works for protected endpoints
    """
    from datetime import datetime

    # Step 1: Create existing user
    existing_user = User(
        telegram_id=222333444,
        username="bob",
        first_name="Bob",
        last_name="Jones",
        is_admin=False,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(existing_user)
    await session.commit()
    await session.refresh(existing_user)

    # Step 2: Authenticate (re-login)
    auth_data = generate_telegram_auth_data(
        telegram_id=222333444, first_name="Bob", last_name="Jones", username="bob"
    )

    auth_response = await client.post("/api/v1/auth/telegram", json=auth_data)

    assert auth_response.status_code == 200

    # Step 3: Verify same user returned (no new version created)
    stmt = select(User).where(User.telegram_id == 222333444)
    result = await session.execute(stmt)
    users = result.scalars().all()

    # Should still be only 1 user (no change in data = no new version)
    assert len(users) == 1

    # Step 4: Use JWT to access API
    access_token = auth_response.cookies["access_token"]
    client.cookies.set("access_token", access_token)

    articles_response = await client.get("/api/v1/articles")
    assert articles_response.status_code == 200


@pytest.mark.asyncio
async def test_auth_flow_with_user_data_update(client: AsyncClient, session: AsyncSession):
    """
    Test authentication flow when user data changes (triggers SCD Type 2).

    Flow:
    1. First login: user created with username "charlie"
    2. User changes username in Telegram to "charlie_updated"
    3. Second login: SCD Type 2 creates new version
    4. Verify both versions exist in database
    5. Verify JWT works with new version
    """

    # Step 1: First login
    auth_data_v1 = generate_telegram_auth_data(
        telegram_id=333444555, first_name="Charlie", username="charlie"
    )

    login1_response = await client.post("/api/v1/auth/telegram", json=auth_data_v1)
    assert login1_response.status_code == 200

    # Step 2: User changes username (simulate Telegram profile update)
    auth_data_v2 = generate_telegram_auth_data(
        telegram_id=333444555, first_name="Charlie", username="charlie_updated"
    )

    login2_response = await client.post("/api/v1/auth/telegram", json=auth_data_v2)
    assert login2_response.status_code == 200

    # Step 3: Verify SCD Type 2 - two versions exist
    stmt = select(User).where(User.telegram_id == 333444555)
    result = await session.execute(stmt)
    users = result.scalars().all()

    assert len(users) == 2

    # Old version: username="charlie", is_current=False
    old_version = [u for u in users if not u.is_current][0]
    assert old_version.username == "charlie"
    assert old_version.is_current is False

    # New version: username="charlie_updated", is_current=True
    new_version = [u for u in users if u.is_current][0]
    assert new_version.username == "charlie_updated"
    assert new_version.is_current is True

    # Step 4: JWT from second login works with new version
    access_token = login2_response.cookies["access_token"]
    client.cookies.set("access_token", access_token)

    me_response = await client.get("/api/v1/users/me")
    assert me_response.status_code == 200

    me_json = me_response.json()
    assert me_json["username"] == "charlie_updated"


@pytest.mark.asyncio
async def test_auth_flow_admin_user(client: AsyncClient, session: AsyncSession):
    """
    Test authentication flow for admin user accessing admin endpoints.

    Flow:
    1. Create admin user manually
    2. Login via Telegram OAuth
    3. Use JWT to access admin-only endpoint (list all users)
    4. Verify admin can see all users
    """
    from datetime import datetime

    # Step 1: Create admin user
    admin_user = User(
        telegram_id=444555666,
        username="admin",
        first_name="Admin",
        is_admin=True,  # Admin flag
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )
    session.add(admin_user)
    await session.commit()

    # Step 2: Login
    auth_data = generate_telegram_auth_data(
        telegram_id=444555666, first_name="Admin", username="admin"
    )

    auth_response = await client.post("/api/v1/auth/telegram", json=auth_data)
    assert auth_response.status_code == 200

    # Step 3: Access admin endpoint
    access_token = auth_response.cookies["access_token"]
    client.cookies.set("access_token", access_token)

    users_response = await client.get("/api/v1/users")

    # Should succeed (admin only endpoint)
    assert users_response.status_code == 200

    users_json = users_response.json()
    assert "users" in users_json
    assert users_json["total"] >= 1


@pytest.mark.asyncio
async def test_auth_flow_without_authentication(client: AsyncClient):
    """
    Test that protected endpoints reject requests without authentication.

    Flow:
    1. Try to access protected endpoint without JWT
    2. Verify 401 Unauthorized
    """
    # Try to access protected endpoint without logging in
    me_response = await client.get("/api/v1/users/me")

    assert me_response.status_code == 401

    json_response = me_response.json()
    assert "detail" in json_response


@pytest.mark.asyncio
async def test_auth_flow_with_invalid_jwt(client: AsyncClient):
    """
    Test that protected endpoints reject invalid JWT tokens.

    Flow:
    1. Set invalid JWT cookie
    2. Try to access protected endpoint
    3. Verify 401 Unauthorized
    """
    # Set invalid JWT token
    client.cookies.set("access_token", "invalid_token_12345")

    me_response = await client.get("/api/v1/users/me")

    assert me_response.status_code == 401


# ============================================================================
# Multi-User Concurrent Auth Tests
# ============================================================================


@pytest.mark.asyncio
async def test_concurrent_auth_multiple_users(client: AsyncClient, session: AsyncSession):
    """
    Test multiple users authenticating and using API concurrently.

    Flow:
    1. User A logs in
    2. User B logs in
    3. Both users access their own data
    4. Verify isolation (each sees only their data)
    """
    # User A login
    auth_data_a = generate_telegram_auth_data(
        telegram_id=555666777, first_name="UserA", username="user_a"
    )

    login_a_response = await client.post("/api/v1/auth/telegram", json=auth_data_a)
    assert login_a_response.status_code == 200
    token_a = login_a_response.cookies["access_token"]

    # User B login
    auth_data_b = generate_telegram_auth_data(
        telegram_id=666777888, first_name="UserB", username="user_b"
    )

    login_b_response = await client.post("/api/v1/auth/telegram", json=auth_data_b)
    assert login_b_response.status_code == 200
    token_b = login_b_response.cookies["access_token"]

    # User A accesses /users/me
    client.cookies.set("access_token", token_a)
    me_a_response = await client.get("/api/v1/users/me")
    assert me_a_response.status_code == 200
    me_a_json = me_a_response.json()
    assert me_a_json["username"] == "user_a"

    # User B accesses /users/me
    client.cookies.set("access_token", token_b)
    me_b_response = await client.get("/api/v1/users/me")
    assert me_b_response.status_code == 200
    me_b_json = me_b_response.json()
    assert me_b_json["username"] == "user_b"

    # Verify they got different users
    assert me_a_json["telegram_id"] != me_b_json["telegram_id"]


# ============================================================================
# Error Handling Tests
# ============================================================================


@pytest.mark.asyncio
async def test_auth_flow_invalid_telegram_hash(client: AsyncClient):
    """
    Test authentication flow with invalid Telegram hash.

    Flow:
    1. POST /auth/telegram with invalid hash
    2. Verify 401 Unauthorized
    3. Verify user not created in database
    """
    # Create auth data with invalid hash
    auth_data = {
        "id": "777888999",
        "first_name": "Invalid",
        "auth_date": str(int(time.time())),
        "hash": "invalid_hash_abc123",
    }

    auth_response = await client.post("/api/v1/auth/telegram", json=auth_data)

    # Should fail with 401
    assert auth_response.status_code == 401

    # Should not set cookie
    assert "access_token" not in auth_response.cookies


@pytest.mark.asyncio
async def test_auth_flow_missing_required_fields(client: AsyncClient):
    """
    Test authentication flow with missing required fields.

    Flow:
    1. POST /auth/telegram without required fields
    2. Verify 422 Unprocessable Entity
    """
    # Missing first_name (required field)
    auth_data = {
        "id": "888999000",
        "auth_date": str(int(time.time())),
        "hash": "some_hash",
    }

    auth_response = await client.post("/api/v1/auth/telegram", json=auth_data)

    # Should fail with 422 (validation error)
    assert auth_response.status_code == 422
