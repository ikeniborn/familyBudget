"""
Unit tests for Users API endpoints.

Tests CRUD operations for user management with proper authentication
and admin authorization checks.

Endpoints tested:
    GET /api/v1/users - List all users (admin only)
    GET /api/v1/users/me - Get current user info
    GET /api/v1/users/{id} - Get user by ID (admin or self)
    PUT /api/v1/users/{id} - Update user role (admin only, SCD Type 2)
"""

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.user import User

# ============================================================================
# GET /api/v1/users - List Users (Admin Only)
# ============================================================================


@pytest.mark.asyncio
async def test_list_users_as_admin(admin_client: AsyncClient, test_user: User, test_admin: User):
    """Test listing all users as admin."""
    response = await admin_client.get("/api/v1/users")

    assert response.status_code == 200

    data = response.json()
    assert "users" in data
    assert "total" in data
    assert "limit" in data
    assert "offset" in data

    assert data["total"] == 2  # test_user + test_admin
    assert len(data["users"]) == 2

    # Verify users are returned
    usernames = {user["username"] for user in data["users"]}
    assert "testuser" in usernames
    assert "testadmin" in usernames


@pytest.mark.asyncio
async def test_list_users_as_regular_user(auth_client: AsyncClient):
    """Test listing users as regular user (should fail with 403)."""
    response = await auth_client.get("/api/v1/users")

    assert response.status_code == 403

    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_list_users_unauthenticated(client: AsyncClient):
    """Test listing users without authentication (should fail with 401)."""
    response = await client.get("/api/v1/users")

    assert response.status_code == 401


@pytest.mark.asyncio
async def test_list_users_pagination(admin_client: AsyncClient, session: AsyncSession):
    """Test listing users with pagination parameters."""
    # Create additional users
    for i in range(5):
        user = User(
            telegram_id=100000000 + i,
            username=f"user{i}",
            is_admin=False,
            is_current=True,
        )
        session.add(user)
    await session.commit()

    # Test with limit=3
    response = await admin_client.get("/api/v1/users?limit=3&offset=0")

    assert response.status_code == 200

    data = response.json()
    assert data["limit"] == 3
    assert data["offset"] == 0
    assert len(data["users"]) == 3
    assert data["total"] == 7  # 5 new + 2 from fixtures


@pytest.mark.asyncio
async def test_list_users_empty(admin_client: AsyncClient, session: AsyncSession):
    """Test listing users when no users exist except admin."""
    # Note: admin_client fixture creates test_admin, so total should be 1
    # (test_user is created by auth_client fixture, not used here)

    response = await admin_client.get("/api/v1/users")

    assert response.status_code == 200

    data = response.json()
    # Should have at least test_admin from the fixture
    assert data["total"] >= 1


# ============================================================================
# GET /api/v1/users/me - Get Current User
# ============================================================================


@pytest.mark.asyncio
async def test_get_current_user_as_regular(auth_client: AsyncClient, test_user: User):
    """Test getting current user info as regular user."""
    response = await auth_client.get("/api/v1/users/me")

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == test_user.id
    assert data["telegram_id"] == test_user.telegram_id
    assert data["username"] == "testuser"
    assert data["first_name"] == "Test"
    assert data["last_name"] == "User"
    assert data["is_admin"] is False


@pytest.mark.asyncio
async def test_get_current_user_as_admin(admin_client: AsyncClient, test_admin: User):
    """Test getting current user info as admin."""
    response = await admin_client.get("/api/v1/users/me")

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == test_admin.id
    assert data["telegram_id"] == test_admin.telegram_id
    assert data["username"] == "testadmin"
    assert data["is_admin"] is True


@pytest.mark.asyncio
async def test_get_current_user_unauthenticated(client: AsyncClient):
    """Test getting current user without authentication (should fail)."""
    response = await client.get("/api/v1/users/me")

    assert response.status_code == 401


# ============================================================================
# GET /api/v1/users/{id} - Get User by ID
# ============================================================================


@pytest.mark.asyncio
async def test_get_user_by_id_as_admin(admin_client: AsyncClient, test_user: User):
    """Test getting user by ID as admin."""
    response = await admin_client.get(f"/api/v1/users/{test_user.id}")

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == test_user.id
    assert data["telegram_id"] == test_user.telegram_id
    assert data["username"] == "testuser"


@pytest.mark.asyncio
async def test_get_user_by_id_self(auth_client: AsyncClient, test_user: User):
    """Test getting own profile as regular user."""
    response = await auth_client.get(f"/api/v1/users/{test_user.id}")

    assert response.status_code == 200

    data = response.json()
    assert data["id"] == test_user.id
    assert data["username"] == "testuser"


@pytest.mark.asyncio
async def test_get_user_by_id_other_user(auth_client: AsyncClient, test_admin: User):
    """Test getting other user's profile as regular user (should fail)."""
    response = await auth_client.get(f"/api/v1/users/{test_admin.id}")

    assert response.status_code == 403

    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_get_user_by_id_not_found(admin_client: AsyncClient):
    """Test getting non-existent user by ID."""
    response = await admin_client.get("/api/v1/users/99999")

    assert response.status_code == 404

    data = response.json()
    assert "detail" in data


@pytest.mark.asyncio
async def test_get_user_by_id_unauthenticated(client: AsyncClient, test_user: User):
    """Test getting user by ID without authentication."""
    response = await client.get(f"/api/v1/users/{test_user.id}")

    assert response.status_code == 401


# ============================================================================
# PUT /api/v1/users/{id} - Update User Role (Admin Only, SCD Type 2)
# ============================================================================


@pytest.mark.asyncio
async def test_update_user_role_promote_to_admin(
    admin_client: AsyncClient, session: AsyncSession, test_user: User
):
    """Test promoting regular user to admin (SCD Type 2)."""
    # Verify initial state
    assert test_user.is_admin is False

    # Promote to admin
    response = await admin_client.put(
        f"/api/v1/users/{test_user.id}",
        json={"is_admin": True}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["is_admin"] is True

    # Verify SCD Type 2: new version created
    from sqlmodel import select
    stmt = select(User).where(User.telegram_id == test_user.telegram_id)
    result = await session.execute(stmt)
    versions = result.scalars().all()

    assert len(versions) == 2  # Old version + new version

    # Old version: is_current=False, is_admin=False
    old_version = [v for v in versions if not v.is_current][0]
    assert old_version.is_admin is False
    assert old_version.is_current is False

    # New version: is_current=True, is_admin=True
    new_version = [v for v in versions if v.is_current][0]
    assert new_version.is_admin is True
    assert new_version.is_current is True


@pytest.mark.asyncio
async def test_update_user_role_demote_from_admin(
    admin_client: AsyncClient, session: AsyncSession, test_admin: User
):
    """Test demoting admin to regular user (SCD Type 2)."""
    # Verify initial state
    assert test_admin.is_admin is True

    # Demote to regular user
    response = await admin_client.put(
        f"/api/v1/users/{test_admin.id}",
        json={"is_admin": False}
    )

    assert response.status_code == 200

    data = response.json()
    assert data["is_admin"] is False


@pytest.mark.asyncio
async def test_update_user_role_no_change(admin_client: AsyncClient, test_user: User):
    """Test updating user with same role (no change, no new version)."""
    # Update with same is_admin value
    response = await admin_client.put(
        f"/api/v1/users/{test_user.id}",
        json={"is_admin": False}  # Already False
    )

    assert response.status_code == 200

    data = response.json()
    assert data["is_admin"] is False
    assert data["id"] == test_user.id  # Same ID, no new version


@pytest.mark.asyncio
async def test_update_user_role_as_regular_user(auth_client: AsyncClient, test_admin: User):
    """Test updating user role as regular user (should fail)."""
    response = await auth_client.put(
        f"/api/v1/users/{test_admin.id}",
        json={"is_admin": False}
    )

    assert response.status_code == 403


@pytest.mark.asyncio
async def test_update_user_role_not_found(admin_client: AsyncClient):
    """Test updating non-existent user."""
    response = await admin_client.put(
        "/api/v1/users/99999",
        json={"is_admin": True}
    )

    assert response.status_code == 404


@pytest.mark.asyncio
async def test_update_user_role_unauthenticated(client: AsyncClient, test_user: User):
    """Test updating user role without authentication."""
    response = await client.put(
        f"/api/v1/users/{test_user.id}",
        json={"is_admin": True}
    )

    assert response.status_code == 401


# ============================================================================
# Additional Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_get_user_with_minimal_fields(admin_client: AsyncClient, session: AsyncSession):
    """Test getting user that has minimal fields (no username, names)."""
    # Create user with only telegram_id
    minimal_user = User(
        telegram_id=999888777,
        username=None,
        first_name=None,
        last_name=None,
        is_admin=False,
        is_current=True,
    )
    session.add(minimal_user)
    await session.commit()
    await session.refresh(minimal_user)

    response = await admin_client.get(f"/api/v1/users/{minimal_user.id}")

    assert response.status_code == 200

    data = response.json()
    assert data["telegram_id"] == 999888777
    assert data["username"] is None
    assert data["first_name"] is None
    assert data["last_name"] is None


@pytest.mark.asyncio
async def test_list_users_only_current_versions(admin_client: AsyncClient, session: AsyncSession):
    """Test that list_users returns only current versions (is_current=True)."""
    from datetime import datetime

    # Create user with 2 versions
    old_version = User(
        telegram_id=111222333,
        username="olduser",
        is_admin=False,
        is_current=False,  # Old version
        valid_to=datetime(2025, 1, 1),
    )
    current_version = User(
        telegram_id=111222333,
        username="newuser",
        is_admin=False,
        is_current=True,  # Current version
    )

    session.add(old_version)
    session.add(current_version)
    await session.commit()

    response = await admin_client.get("/api/v1/users")

    assert response.status_code == 200

    data = response.json()
    # Should only return current versions
    usernames = [user["username"] for user in data["users"]]

    # old_version (olduser) should NOT be in results
    assert "olduser" not in usernames
    # current_version (newuser) SHOULD be in results
    assert "newuser" in usernames
