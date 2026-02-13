"""
Unit tests for authentication and authorization dependencies.

Tests FastAPI dependencies for user authentication and admin authorization:
    - get_current_user(): Extract user_id from request.state and load User from database
    - get_current_admin(): Validate that current user has admin privileges

These dependencies are used throughout the API for authentication and authorization.
"""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.auth import get_current_admin, get_current_user
from backend.app.models.user import User

# ============================================================================
# get_current_user() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_current_user_success(session: AsyncSession, test_user: User):
    """Test get_current_user successfully loads user from database."""
    # Create mock request with user_id in state
    mock_request = MagicMock()
    mock_request.state.user_id = test_user.id

    # Call get_current_user
    current_user = await get_current_user(mock_request, session)

    # Should return the test user
    assert current_user is not None
    assert current_user.id == test_user.id
    assert current_user.telegram_id == test_user.telegram_id
    assert current_user.username == test_user.username


@pytest.mark.asyncio
async def test_get_current_user_no_user_id_in_state(session: AsyncSession):
    """Test get_current_user raises 401 when user_id not in request.state."""
    # Create mock request WITHOUT user_id in state
    mock_request = MagicMock()
    mock_request.state = MagicMock(spec=[])  # Empty state

    # Should raise 401 Unauthorized
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(mock_request, session)

    assert exc_info.value.status_code == 401
    assert "Authentication required" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_user_user_not_found_in_database(session: AsyncSession):
    """Test get_current_user raises 404 when user_id doesn't exist in database."""
    # Create mock request with non-existent user_id
    mock_request = MagicMock()
    mock_request.state.user_id = 99999  # Non-existent user

    # Should raise 404 Not Found
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(mock_request, session)

    assert exc_info.value.status_code == 404
    assert "User not found" in exc_info.value.detail


@pytest.mark.skip(reason="Test obsolete: User model migrated from SCD Type 2 to SCD Type 1. Historical versions now stored in t_d_user_history table, not t_d_user. The fields is_current, valid_from, valid_to were removed from User model.")
@pytest.mark.asyncio
async def test_get_current_user_only_loads_current_version(session: AsyncSession):
    """Test get_current_user only loads current version (is_current=True)."""
    from datetime import datetime

    # Create two versions of same user
    old_user = User(
        telegram_id=123456789,
        username="olduser",
        is_admin=False,
        is_current=False,  # Old version
        valid_to=datetime(2025, 1, 1),
    )
    current_user = User(
        telegram_id=123456789,
        username="newuser",
        is_admin=False,
        is_current=True,  # Current version
        valid_from=datetime(2025, 1, 1),
        valid_to=datetime(9999, 12, 31),
    )

    session.add(old_user)
    session.add(current_user)
    await session.commit()
    await session.refresh(current_user)

    # Create mock request with current_user.id
    mock_request = MagicMock()
    mock_request.state.user_id = current_user.id

    # Call get_current_user
    loaded_user = await get_current_user(mock_request, session)

    # Should load the current version (not the old one)
    assert loaded_user.username == "newuser"
    assert loaded_user.is_current is True


@pytest.mark.asyncio
async def test_get_current_user_loads_all_user_fields(session: AsyncSession, test_user: User):
    """Test get_current_user loads all user fields correctly."""
    mock_request = MagicMock()
    mock_request.state.user_id = test_user.id

    current_user = await get_current_user(mock_request, session)

    # Verify all fields are loaded
    assert current_user.id == test_user.id
    assert current_user.telegram_id == test_user.telegram_id
    assert current_user.username == test_user.username
    assert current_user.first_name == test_user.first_name
    assert current_user.last_name == test_user.last_name
    assert current_user.is_admin == test_user.is_admin
    # Note: is_current field removed - User model uses SCD Type 1 (current data only)


@pytest.mark.asyncio
async def test_get_current_user_multiple_calls_same_user(
    session: AsyncSession, test_user: User
):
    """Test multiple calls to get_current_user for same user_id."""
    mock_request = MagicMock()
    mock_request.state.user_id = test_user.id

    # Call multiple times
    user1 = await get_current_user(mock_request, session)
    user2 = await get_current_user(mock_request, session)

    # Should return same user data
    assert user1.id == user2.id
    assert user1.telegram_id == user2.telegram_id


# ============================================================================
# get_current_admin() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_current_admin_success(test_admin: User):
    """Test get_current_admin allows admin user."""
    # Call get_current_admin with admin user
    admin_user = await get_current_admin(test_admin)

    # Should return the admin user
    assert admin_user is not None
    assert admin_user.id == test_admin.id
    assert admin_user.is_admin is True


@pytest.mark.asyncio
async def test_get_current_admin_regular_user_denied(test_user: User):
    """Test get_current_admin raises 403 for regular user."""
    # test_user is not admin
    assert test_user.is_admin is False

    # Should raise 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(test_user)

    assert exc_info.value.status_code == 403
    assert "Admin access required" in exc_info.value.detail


@pytest.mark.asyncio
async def test_get_current_admin_checks_is_admin_flag(test_user: User):
    """Test get_current_admin specifically checks is_admin flag."""
    # Verify test_user.is_admin is False
    assert test_user.is_admin is False

    # Should fail
    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(test_user)

    assert exc_info.value.status_code == 403

    # Now manually set is_admin to True (simulate admin)
    test_user.is_admin = True

    # Should now succeed
    admin_user = await get_current_admin(test_user)
    assert admin_user.is_admin is True


@pytest.mark.asyncio
async def test_get_current_admin_returns_same_user_object(test_admin: User):
    """Test get_current_admin returns the same user object passed in."""
    admin_user = await get_current_admin(test_admin)

    # Should return the exact same user object
    assert admin_user is test_admin


# ============================================================================
# Integration Tests (get_current_user -> get_current_admin)
# ============================================================================


@pytest.mark.asyncio
async def test_get_current_user_then_admin_regular_user(
    session: AsyncSession, test_user: User
):
    """Test loading regular user then checking admin (should fail)."""
    # Step 1: Load user with get_current_user
    mock_request = MagicMock()
    mock_request.state.user_id = test_user.id

    current_user = await get_current_user(mock_request, session)

    # Step 2: Try to verify admin (should fail)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(current_user)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_get_current_user_then_admin_admin_user(
    session: AsyncSession, test_admin: User
):
    """Test loading admin user then checking admin (should succeed)."""
    # Step 1: Load admin with get_current_user
    mock_request = MagicMock()
    mock_request.state.user_id = test_admin.id

    current_user = await get_current_user(mock_request, session)

    # Step 2: Verify admin (should succeed)
    admin_user = await get_current_admin(current_user)

    assert admin_user.is_admin is True


# ============================================================================
# Edge Cases
# ============================================================================


@pytest.mark.asyncio
async def test_get_current_user_user_id_none_in_state(session: AsyncSession):
    """Test get_current_user when user_id is explicitly None."""
    mock_request = MagicMock()
    mock_request.state.user_id = None

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(mock_request, session)

    assert exc_info.value.status_code == 401


@pytest.mark.asyncio
async def test_get_current_user_user_id_zero(session: AsyncSession):
    """Test get_current_user with user_id=0 (edge case)."""
    mock_request = MagicMock()
    mock_request.state.user_id = 0

    # Should raise 404 (user with id=0 doesn't exist)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(mock_request, session)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_current_user_negative_user_id(session: AsyncSession):
    """Test get_current_user with negative user_id."""
    mock_request = MagicMock()
    mock_request.state.user_id = -1

    # Should raise 404 (negative ids don't exist)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(mock_request, session)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_current_user_very_large_user_id(session: AsyncSession):
    """Test get_current_user with very large user_id."""
    mock_request = MagicMock()
    mock_request.state.user_id = 2**31 - 1  # Max 32-bit signed integer

    # Should raise 404 (doesn't exist)
    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(mock_request, session)

    assert exc_info.value.status_code == 404


@pytest.mark.asyncio
async def test_get_current_admin_none_user():
    """Test get_current_admin with None user (should fail)."""
    # This shouldn't happen in real code due to type hints, but test defensively
    with pytest.raises(AttributeError):
        await get_current_admin(None)


# ============================================================================
# Type Annotation Tests (Static Analysis)
# ============================================================================


def test_get_current_user_type_annotations():
    """Test that get_current_user has correct type annotations."""
    from typing import get_type_hints

    hints = get_type_hints(get_current_user)

    # Should return User
    assert hints.get("return") == User


def test_get_current_admin_type_annotations():
    """Test that get_current_admin has correct type annotations."""
    from typing import get_type_hints

    hints = get_type_hints(get_current_admin)

    # Should accept User and return User
    assert hints.get("return") == User


# ============================================================================
# Dependency Chain Tests
# ============================================================================


@pytest.mark.asyncio
async def test_dependency_chain_regular_user_to_admin_endpoint(
    session: AsyncSession, test_user: User
):
    """Test that regular user is blocked when trying to access admin endpoint."""
    # Simulate request hitting admin endpoint
    mock_request = MagicMock()
    mock_request.state.user_id = test_user.id

    # Step 1: get_current_user loads user
    current_user = await get_current_user(mock_request, session)
    assert current_user.is_admin is False

    # Step 2: get_current_admin blocks non-admin
    with pytest.raises(HTTPException) as exc_info:
        await get_current_admin(current_user)

    assert exc_info.value.status_code == 403


@pytest.mark.asyncio
async def test_dependency_chain_admin_user_to_admin_endpoint(
    session: AsyncSession, test_admin: User
):
    """Test that admin user can access admin endpoint."""
    # Simulate request hitting admin endpoint
    mock_request = MagicMock()
    mock_request.state.user_id = test_admin.id

    # Step 1: get_current_user loads user
    current_user = await get_current_user(mock_request, session)
    assert current_user.is_admin is True

    # Step 2: get_current_admin allows admin
    admin_user = await get_current_admin(current_user)
    assert admin_user.id == test_admin.id
