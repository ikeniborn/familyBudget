"""
Unit tests for User Service (Hybrid SCD1 + History SCD2).

Tests:
- update_user_profile: SCD1 update + UserHistory snapshot
- get_user_history: Retrieve full change history
- get_user_version_at_date: Time-travel queries
- create_initial_history: Initial history record creation
"""

import pytest
from datetime import datetime, date, timezone
from sqlmodel import select

from backend.app.models.user import User
from backend.app.models.user_history import UserHistory
from backend.app.services.user_service import (
    update_user_profile,
    get_user_history,
    get_user_version_at_date,
    create_initial_history,
)


@pytest.mark.asyncio
@pytest.mark.unit
async def test_create_initial_history(db_session):
    """
    Test: create_initial_history creates first UserHistory record.

    Expected:
    - UserHistory record created with is_current=True
    - changed_fields is None (initial creation)
    - valid_from is set, valid_to is far future (9999-12-31)
    """
    # Create new user
    user = User(
        telegram_id=123456789,
        username="john_doe",
        first_name="John",
        last_name="Doe",
        is_admin=False,
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # Create initial history
    history = await create_initial_history(session=db_session, user=user)

    # Assertions
    assert history.user_id == user.id
    assert history.telegram_id == user.telegram_id
    assert history.username == "john_doe"
    assert history.is_current is True
    assert history.change_type == "CREATE"
    assert history.changed_fields is None  # Initial creation
    assert history.changed_by_user_id is None  # Automatic
    assert history.valid_to.year == 9999


@pytest.mark.asyncio
@pytest.mark.unit
async def test_update_user_profile_creates_history(db_session):
    """
    Test: update_user_profile updates User (SCD1) and creates UserHistory snapshot (SCD2).

    Expected:
    - User.id remains the same (stable FK)
    - User fields updated in-place
    - Old UserHistory version closed (is_current=False, valid_to set)
    - New UserHistory version created (is_current=True)
    - changed_fields detected automatically
    """
    # Setup: Create user with initial history
    user = User(
        telegram_id=123456789,
        username="john_doe",
        first_name="John",
        is_admin=False,
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    await create_initial_history(session=db_session, user=user)

    original_id = user.id

    # Update profile
    updated_user = await update_user_profile(
        session=db_session,
        user=user,
        updates={"username": "john_updated", "is_admin": True},
        changed_by_user_id=2,
        change_type="ROLE_CHANGE",
    )

    # Assertions: User table (SCD1)
    assert updated_user.id == original_id  # STABLE ID
    assert updated_user.username == "john_updated"
    assert updated_user.is_admin is True

    # Assertions: UserHistory (SCD2)
    history = await get_user_history(session=db_session, user_id=user.id)
    assert len(history) == 2  # CREATE + ROLE_CHANGE

    # Check current version
    current = history[0]  # Newest first (order by valid_from DESC)
    assert current.is_current is True
    assert current.username == "john_updated"
    assert current.is_admin is True
    assert current.change_type == "ROLE_CHANGE"
    assert "username" in current.changed_fields
    assert "is_admin" in current.changed_fields
    assert current.changed_by_user_id == 2

    # Check old version closed
    old = history[1]
    assert old.is_current is False
    assert old.valid_to < datetime(9999, 1, 1, tzinfo=timezone.utc)  # Not far future (timezone-aware)
    assert old.username == "john_doe"
    assert old.is_admin is False


@pytest.mark.asyncio
@pytest.mark.unit
async def test_update_user_profile_no_changes_returns_existing(db_session):
    """
    Test: update_user_profile with no field changes returns existing user (no history record).

    Expected:
    - User returned unchanged
    - No new UserHistory record created (optimization)
    """
    # Setup
    user = User(
        telegram_id=123456789,
        username="john_doe",
        first_name="John",
        is_admin=False,
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    await create_initial_history(session=db_session, user=user)

    # Update with same values (no changes)
    updated_user = await update_user_profile(
        session=db_session,
        user=user,
        updates={"username": "john_doe", "is_admin": False},  # Same values
        change_type="UPDATE",
    )

    # Assertions
    assert updated_user.id == user.id
    assert updated_user.username == "john_doe"

    # Check history - should still have only 1 record (CREATE)
    history = await get_user_history(session=db_session, user_id=user.id)
    assert len(history) == 1  # No new record created


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_user_history_returns_all_versions(db_session):
    """
    Test: get_user_history returns all versions ordered newest first.

    Expected:
    - All UserHistory versions returned (is_current=True and False)
    - Ordered by valid_from DESC (newest first)
    """
    # Setup: Create user and make multiple updates
    user = User(
        telegram_id=123456789,
        username="john_v1",
        is_admin=False,
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    await create_initial_history(session=db_session, user=user)

    # Update 1: Change username
    await update_user_profile(
        session=db_session,
        user=user,
        updates={"username": "john_v2"},
        change_type="UPDATE",
    )

    # Update 2: Activate user
    await update_user_profile(
        session=db_session,
        user=user,
        updates={"is_active": True},
        changed_by_user_id=1,
        change_type="ROLE_CHANGE",
    )

    # Get history
    history = await get_user_history(session=db_session, user_id=user.id)

    # Assertions
    assert len(history) == 3  # CREATE + 2 updates

    # Check order (newest first)
    assert history[0].change_type == "ROLE_CHANGE"  # Most recent
    assert history[0].is_current is True
    assert history[1].change_type == "UPDATE"
    assert history[1].is_current is False
    assert history[2].change_type == "CREATE"  # Oldest
    assert history[2].is_current is False

    # Check valid_from ordering (newest → oldest)
    assert history[0].valid_from > history[1].valid_from
    assert history[1].valid_from > history[2].valid_from


@pytest.mark.asyncio
@pytest.mark.unit
async def test_get_user_version_at_date(db_session):
    """
    Test: get_user_version_at_date retrieves correct version for target date.

    Expected:
    - Returns version where valid_from <= target_date < valid_to
    - Returns None if user didn't exist at target_date
    """
    # Setup: Create user with multiple updates at different times
    user = User(
        telegram_id=123456789,
        username="john_v1",
        is_admin=False,
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)

    # CREATE version (v1)
    v1 = await create_initial_history(session=db_session, user=user)
    v1_date = v1.valid_from.date()

    # Wait a bit and create v2 (simulate time passing)
    import asyncio
    await asyncio.sleep(0.1)

    await update_user_profile(
        session=db_session,
        user=user,
        updates={"username": "john_v2"},
        change_type="UPDATE",
    )

    # Get v2 date
    history = await get_user_history(session=db_session, user_id=user.id)
    v2_date = history[0].valid_from.date()  # Current version

    # Test 1: Query at v1 date
    version_at_v1 = await get_user_version_at_date(
        session=db_session,
        user_id=user.id,
        target_date=v1_date,
    )
    assert version_at_v1 is not None
    assert version_at_v1.username == "john_v1"

    # Test 2: Query at v2 date (current)
    version_at_v2 = await get_user_version_at_date(
        session=db_session,
        user_id=user.id,
        target_date=v2_date,
    )
    assert version_at_v2 is not None
    assert version_at_v2.username == "john_v2"
    assert version_at_v2.is_current is True

    # Test 3: Query at far future date (should return current version)
    future_date = date(2099, 12, 31)
    version_at_future = await get_user_version_at_date(
        session=db_session,
        user_id=user.id,
        target_date=future_date,
    )
    assert version_at_future is not None
    assert version_at_future.username == "john_v2"


@pytest.mark.asyncio
@pytest.mark.unit
async def test_multiple_field_updates_tracked_in_changed_fields(db_session):
    """
    Test: changed_fields array contains all fields that were modified.

    Expected:
    - changed_fields contains exact list of modified fields
    - Unmodified fields NOT in changed_fields
    """
    # Setup
    user = User(
        telegram_id=123456789,
        username="john_doe",
        first_name="John",
        last_name="Doe",
        is_admin=False,
        is_active=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    await create_initial_history(session=db_session, user=user)

    # Update multiple fields
    await update_user_profile(
        session=db_session,
        user=user,
        updates={
            "username": "john_updated",
            "first_name": "Johnny",
            "is_admin": True,
            # last_name NOT updated
        },
        change_type="UPDATE",
    )

    # Get history
    history = await get_user_history(session=db_session, user_id=user.id)
    current = history[0]

    # Assertions
    assert "username" in current.changed_fields
    assert "first_name" in current.changed_fields
    assert "is_admin" in current.changed_fields
    assert "last_name" not in current.changed_fields  # Not modified
    assert len(current.changed_fields) == 3
