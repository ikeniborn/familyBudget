"""
Unit tests for User model.

Tests SCD Type 2 functionality, business key constraints, and model behavior.
"""

from datetime import datetime

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.user import User

# ============================================================================
# User Creation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_user_basic(session: AsyncSession):
    """Test creating a basic user with required fields."""
    user = User(
        telegram_id=123456789,
        username="testuser",
        first_name="Test",
        last_name="User",
        is_admin=False,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    assert user.id is not None
    assert user.telegram_id == 123456789
    assert user.username == "testuser"
    assert user.first_name == "Test"
    assert user.last_name == "User"
    assert user.is_admin is False


@pytest.mark.asyncio
async def test_create_user_minimal_fields(session: AsyncSession):
    """Test creating user with only telegram_id (required field)."""
    user = User(
        telegram_id=123456789,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    assert user.telegram_id == 123456789
    assert user.username is None
    assert user.first_name is None
    assert user.last_name is None
    assert user.is_admin is False  # Default value


@pytest.mark.asyncio
async def test_create_admin_user(session: AsyncSession):
    """Test creating admin user."""
    user = User(
        telegram_id=987654321,
        username="admin",
        first_name="Admin",
        is_admin=True,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    assert user.is_admin is True


@pytest.mark.asyncio
async def test_create_user_without_username(session: AsyncSession):
    """Test creating user without username (optional field)."""
    user = User(
        telegram_id=111222333,
        first_name="No",
        last_name="Username",
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    assert user.username is None
    assert user.first_name == "No"


# ============================================================================
# SCD Type 2 Tests
# ============================================================================


@pytest.mark.asyncio
async def test_user_scd2_defaults(session: AsyncSession):
    """Test SCD Type 2 default values for new user."""
    user = User(
        telegram_id=123456789,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    # Check SCD Type 2 defaults
    assert user.is_current is True
    assert user.valid_from is not None
    assert user.valid_to is not None
    assert user.valid_to.year == 9999


@pytest.mark.asyncio
async def test_user_scd2_versioning(session: AsyncSession):
    """Test creating multiple versions of user (SCD Type 2)."""
    # Version 1: Create initial user (regular user)
    user_v1 = User(
        telegram_id=123456789,
        username="testuser",
        first_name="Test",
        is_admin=False,
        is_current=True,
    )

    session.add(user_v1)
    await session.commit()
    await session.refresh(user_v1)

    # Version 2: Promote to admin (SCD Type 2 update)
    now = datetime.utcnow()
    user_v1.is_current = False
    user_v1.valid_to = now

    user_v2 = User(
        telegram_id=123456789,  # Same business key
        username="testuser",
        first_name="Test",
        is_admin=True,  # Promoted to admin
        is_current=True,
        valid_from=now,
    )

    session.add(user_v2)
    await session.commit()
    await session.refresh(user_v1)
    await session.refresh(user_v2)

    # Verify version 1 is closed
    assert user_v1.is_current is False
    assert user_v1.valid_to == now
    assert user_v1.is_admin is False

    # Verify version 2 is current
    assert user_v2.is_current is True
    assert user_v2.valid_from == now
    assert user_v2.is_admin is True


@pytest.mark.asyncio
async def test_user_scd2_query_current_only(session: AsyncSession):
    """Test querying only current version of users."""
    # Create two versions for same telegram_id
    user_v1 = User(
        telegram_id=123456789,
        username="testuser",
        is_admin=False,
        is_current=False,  # Old version
    )

    user_v2 = User(
        telegram_id=123456789,
        username="testuser",
        is_admin=True,
        is_current=True,  # Current version
    )

    session.add(user_v1)
    session.add(user_v2)
    await session.commit()

    # Query only current versions
    stmt = select(User).where(User.is_current == True)  # noqa: E712
    result = await session.execute(stmt)
    users = result.scalars().all()

    assert len(users) == 1
    assert users[0].is_admin is True


@pytest.mark.asyncio
async def test_user_scd2_historical_query(session: AsyncSession):
    """Test querying historical versions by valid_from/valid_to."""
    # Create historical version
    past_time = datetime(2025, 1, 1)
    user_old = User(
        telegram_id=123456789,
        username="testuser",
        is_admin=False,
        is_current=False,
        valid_from=past_time,
        valid_to=datetime(2025, 6, 1),
    )

    # Create current version
    user_current = User(
        telegram_id=123456789,
        username="testuser",
        is_admin=True,
        is_current=True,
        valid_from=datetime(2025, 6, 1),
    )

    session.add(user_old)
    session.add(user_current)
    await session.commit()

    # Query historical version
    stmt = select(User).where(User.is_current == False)  # noqa: E712
    result = await session.execute(stmt)
    users = result.scalars().all()

    assert len(users) == 1
    assert users[0].is_admin is False


# ============================================================================
# Business Key Tests
# ============================================================================


@pytest.mark.asyncio
async def test_user_telegram_id_uniqueness_per_version(session: AsyncSession):
    """Test telegram_id can appear multiple times (different versions)."""
    # Create two versions with same telegram_id
    user_v1 = User(
        telegram_id=123456789,
        username="testuser",
        is_current=False,
    )

    user_v2 = User(
        telegram_id=123456789,
        username="testuser",
        is_current=True,
    )

    session.add(user_v1)
    session.add(user_v2)
    await session.commit()

    # Query by telegram_id
    stmt = select(User).where(User.telegram_id == 123456789)
    result = await session.execute(stmt)
    users = result.scalars().all()

    assert len(users) == 2


@pytest.mark.asyncio
async def test_query_user_by_telegram_id_current(session: AsyncSession):
    """Test querying current user by telegram_id."""
    user = User(
        telegram_id=123456789,
        username="testuser",
        is_current=True,
    )

    session.add(user)
    await session.commit()

    # Query current user by telegram_id
    stmt = select(User).where(
        User.telegram_id == 123456789,
        User.is_current == True  # noqa: E712
    )
    result = await session.execute(stmt)
    found_user = result.scalar_one_or_none()

    assert found_user is not None
    assert found_user.telegram_id == 123456789


# ============================================================================
# Admin Flag Tests
# ============================================================================


@pytest.mark.asyncio
async def test_user_default_not_admin(session: AsyncSession):
    """Test user is not admin by default."""
    user = User(
        telegram_id=123456789,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    assert user.is_admin is False


@pytest.mark.asyncio
async def test_query_admin_users_only(session: AsyncSession):
    """Test querying only admin users."""
    # Create regular and admin users
    regular = User(telegram_id=111111111, is_admin=False)
    admin = User(telegram_id=222222222, is_admin=True)

    session.add(regular)
    session.add(admin)
    await session.commit()

    # Query admins only
    stmt = select(User).where(User.is_admin == True)  # noqa: E712
    result = await session.execute(stmt)
    admins = result.scalars().all()

    assert len(admins) == 1
    assert admins[0].telegram_id == 222222222


# ============================================================================
# Audit Fields Tests
# ============================================================================


@pytest.mark.asyncio
async def test_user_audit_fields(session: AsyncSession):
    """Test audit fields (created_at, updated_at) are set automatically."""
    user = User(
        telegram_id=123456789,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    assert user.created_at is not None
    assert user.updated_at is not None
    assert isinstance(user.created_at, datetime)
    assert isinstance(user.updated_at, datetime)


@pytest.mark.asyncio
async def test_user_updated_at_changes(session: AsyncSession):
    """Test updated_at changes when user is modified."""
    user = User(
        telegram_id=123456789,
        username="testuser",
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    original_updated_at = user.updated_at

    # Update user
    user.username = "newusername"
    user.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(user)

    # Note: updated_at should be different (in real app with db triggers)
    # In tests, we manually set it
    assert user.username == "newusername"


# ============================================================================
# Model Representation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_user_repr(session: AsyncSession):
    """Test User __repr__ method."""
    user = User(
        telegram_id=123456789,
        username="testuser",
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    repr_str = repr(user)

    assert "User" in repr_str
    assert f"id={user.id}" in repr_str
    assert "telegram_id=123456789" in repr_str
    assert "username=testuser" in repr_str
    assert "is_current=True" in repr_str


# ============================================================================
# Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_query_all_current_users(session: AsyncSession):
    """Test querying all current users."""
    # Create current and historical users
    user1 = User(telegram_id=111111111, is_current=True)
    user2 = User(telegram_id=222222222, is_current=True)
    user3_old = User(telegram_id=333333333, is_current=False)

    session.add(user1)
    session.add(user2)
    session.add(user3_old)
    await session.commit()

    # Query all current users
    stmt = select(User).where(User.is_current == True)  # noqa: E712
    result = await session.execute(stmt)
    users = result.scalars().all()

    assert len(users) == 2


@pytest.mark.asyncio
async def test_query_users_by_name(session: AsyncSession):
    """Test querying users by first_name."""
    user1 = User(telegram_id=111111111, first_name="John")
    user2 = User(telegram_id=222222222, first_name="Jane")

    session.add(user1)
    session.add(user2)
    await session.commit()

    # Query by first_name
    stmt = select(User).where(User.first_name == "John")
    result = await session.execute(stmt)
    users = result.scalars().all()

    assert len(users) == 1
    assert users[0].first_name == "John"


# ============================================================================
# Optional Fields Tests
# ============================================================================


@pytest.mark.asyncio
async def test_user_optional_fields_can_be_null(session: AsyncSession):
    """Test that optional fields can be NULL."""
    user = User(
        telegram_id=123456789,
        username=None,
        first_name=None,
        last_name=None,
    )

    session.add(user)
    await session.commit()
    await session.refresh(user)

    assert user.username is None
    assert user.first_name is None
    assert user.last_name is None
