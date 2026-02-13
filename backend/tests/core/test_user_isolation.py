"""
Unit tests for user data isolation helpers.

Tests helper functions for implementing user-level data isolation in multi-tenant scenarios.
Each user should only access their own data unless they have admin privileges.

Functions tested:
    - apply_user_filter(): Add WHERE user_id = current_user.id to SQL statements
    - can_access_resource(): Check if user can access a resource
    - ensure_user_owns_resource(): Raise 403 if user cannot access resource
    - get_user_id_for_create(): Get user_id to assign when creating resources
"""

import pytest
from fastapi import HTTPException
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.user_isolation import (
    apply_user_filter,
    can_access_resource,
    ensure_user_owns_resource,
    get_user_id_for_create,
)
from backend.app.models.fact import BudgetFact
from backend.app.models.user import User

# ============================================================================
# apply_user_filter() Tests
# ============================================================================


@pytest.mark.asyncio
async def test_apply_user_filter_regular_user(
    session: AsyncSession, test_user: User, test_admin: User, test_article_root
):
    """Test apply_user_filter filters results for regular user."""
    from datetime import date
    from decimal import Decimal

    # Create facts for different users
    user_fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    admin_fact = BudgetFact(
        user_id=test_admin.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("200.00"),
    )

    session.add(user_fact)
    session.add(admin_fact)
    await session.commit()

    # Create query and apply user filter
    statement = select(BudgetFact)
    statement = apply_user_filter(statement, test_user)

    # Execute query
    result = await session.execute(statement)
    facts = result.scalars().all()

    # Regular user should only see their own facts
    assert len(facts) == 1
    assert facts[0].user_id == test_user.id
    assert facts[0].amount == Decimal("100.00")


@pytest.mark.asyncio
async def test_apply_user_filter_admin_sees_all(
    session: AsyncSession, test_user: User, test_admin: User, test_article_root
):
    """Test apply_user_filter does NOT filter for admin user."""
    from datetime import date
    from decimal import Decimal

    # Create facts for different users
    user_fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    admin_fact = BudgetFact(
        user_id=test_admin.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("200.00"),
    )

    session.add(user_fact)
    session.add(admin_fact)
    await session.commit()

    # Create query and apply user filter with admin
    statement = select(BudgetFact)
    statement = apply_user_filter(statement, test_admin)

    # Execute query
    result = await session.execute(statement)
    facts = result.scalars().all()

    # Admin should see all facts (no filtering)
    assert len(facts) == 2
    user_ids = {fact.user_id for fact in facts}
    assert test_user.id in user_ids
    assert test_admin.id in user_ids


@pytest.mark.asyncio
async def test_apply_user_filter_with_additional_where_clauses(
    session: AsyncSession, test_user: User, test_article_root
):
    """Test apply_user_filter works with additional WHERE clauses."""
    from datetime import date
    from decimal import Decimal

    # Create facts with different dates
    fact1 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 1),
        amount=Decimal("100.00"),
    )
    fact2 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 15),
        amount=Decimal("200.00"),
    )

    session.add(fact1)
    session.add(fact2)
    await session.commit()

    # Create query with date filter AND user filter
    statement = select(BudgetFact).where(BudgetFact.fact_date >= date(2025, 10, 10))
    statement = apply_user_filter(statement, test_user)

    # Execute query
    result = await session.execute(statement)
    facts = result.scalars().all()

    # Should only return fact2 (user's fact after Oct 10)
    assert len(facts) == 1
    assert facts[0].fact_date == date(2025, 10, 15)


@pytest.mark.asyncio
async def test_apply_user_filter_empty_result(session: AsyncSession, test_user: User):
    """Test apply_user_filter returns empty result when user has no data."""
    # Don't create any facts

    # Create query and apply user filter
    statement = select(BudgetFact)
    statement = apply_user_filter(statement, test_user)

    # Execute query
    result = await session.execute(statement)
    facts = result.scalars().all()

    # Should return empty list
    assert len(facts) == 0


@pytest.mark.asyncio
async def test_apply_user_filter_custom_column_name(
    session: AsyncSession, test_user: User, test_admin: User
):
    """Test apply_user_filter with custom user_id_column parameter."""
    # Note: BudgetFact uses 'user_id' by default
    # This test verifies the parameter works (even though default is correct)

    # Create query and explicitly specify column name
    statement = select(BudgetFact)
    statement = apply_user_filter(statement, test_user, user_id_column="user_id")

    # Should work correctly
    result = await session.execute(statement)
    facts = result.scalars().all()

    # Should return only user's facts
    for fact in facts:
        assert fact.user_id == test_user.id


# ============================================================================
# can_access_resource() Tests
# ============================================================================


def test_can_access_resource_own_resource(test_user: User):
    """Test can_access_resource returns True for own resource."""
    resource_user_id = test_user.id

    can_access = can_access_resource(resource_user_id, test_user)

    assert can_access is True


def test_can_access_resource_other_user_resource(test_user: User):
    """Test can_access_resource returns False for other user's resource."""
    other_user_id = 999  # Different user

    can_access = can_access_resource(other_user_id, test_user)

    assert can_access is False


def test_can_access_resource_admin_any_resource(test_admin: User):
    """Test can_access_resource returns True for admin accessing any resource."""
    other_user_id = 999  # Different user

    can_access = can_access_resource(other_user_id, test_admin)

    # Admin can access any resource
    assert can_access is True


def test_can_access_resource_admin_own_resource(test_admin: User):
    """Test can_access_resource returns True for admin accessing own resource."""
    resource_user_id = test_admin.id

    can_access = can_access_resource(resource_user_id, test_admin)

    assert can_access is True


def test_can_access_resource_multiple_checks(test_user: User):
    """Test multiple calls to can_access_resource."""
    # Check own resource
    assert can_access_resource(test_user.id, test_user) is True

    # Check other resources
    assert can_access_resource(100, test_user) is False
    assert can_access_resource(200, test_user) is False
    assert can_access_resource(999, test_user) is False


# ============================================================================
# ensure_user_owns_resource() Tests
# ============================================================================


def test_ensure_user_owns_resource_own_resource(test_user: User):
    """Test ensure_user_owns_resource does not raise for own resource."""
    resource_user_id = test_user.id

    # Should not raise
    ensure_user_owns_resource(resource_user_id, test_user)


def test_ensure_user_owns_resource_other_user_resource(test_user: User):
    """Test ensure_user_owns_resource raises 403 for other user's resource."""
    other_user_id = 999  # Different user

    # Should raise 403 Forbidden
    with pytest.raises(HTTPException) as exc_info:
        ensure_user_owns_resource(other_user_id, test_user)

    assert exc_info.value.status_code == 403
    assert "Access denied" in exc_info.value.detail


def test_ensure_user_owns_resource_admin_any_resource(test_admin: User):
    """Test ensure_user_owns_resource allows admin to access any resource."""
    other_user_id = 999  # Different user

    # Should not raise for admin
    ensure_user_owns_resource(other_user_id, test_admin)


def test_ensure_user_owns_resource_admin_own_resource(test_admin: User):
    """Test ensure_user_owns_resource allows admin to access own resource."""
    resource_user_id = test_admin.id

    # Should not raise
    ensure_user_owns_resource(resource_user_id, test_admin)


def test_ensure_user_owns_resource_error_message(test_user: User):
    """Test ensure_user_owns_resource provides helpful error message."""
    other_user_id = 999

    with pytest.raises(HTTPException) as exc_info:
        ensure_user_owns_resource(other_user_id, test_user)

    # Error message should be clear
    assert "permission" in exc_info.value.detail.lower() or "access denied" in exc_info.value.detail.lower()


def test_ensure_user_owns_resource_multiple_calls(test_user: User):
    """Test multiple calls to ensure_user_owns_resource."""
    # Should not raise for own resource
    ensure_user_owns_resource(test_user.id, test_user)
    ensure_user_owns_resource(test_user.id, test_user)

    # Should raise for other resources
    with pytest.raises(HTTPException):
        ensure_user_owns_resource(100, test_user)

    with pytest.raises(HTTPException):
        ensure_user_owns_resource(200, test_user)


# ============================================================================
# get_user_id_for_create() Tests
# ============================================================================


def test_get_user_id_for_create_regular_user(test_user: User):
    """Test get_user_id_for_create returns current user's ID."""
    user_id = get_user_id_for_create(test_user)

    assert user_id == test_user.id


def test_get_user_id_for_create_admin_user(test_admin: User):
    """Test get_user_id_for_create returns admin's own ID (not special behavior)."""
    user_id = get_user_id_for_create(test_admin)

    # Even admin creates resources under their own user_id
    assert user_id == test_admin.id


def test_get_user_id_for_create_multiple_calls(test_user: User):
    """Test multiple calls to get_user_id_for_create return same ID."""
    user_id1 = get_user_id_for_create(test_user)
    user_id2 = get_user_id_for_create(test_user)
    user_id3 = get_user_id_for_create(test_user)

    assert user_id1 == user_id2 == user_id3 == test_user.id


def test_get_user_id_for_create_different_users(test_user: User, test_admin: User):
    """Test get_user_id_for_create returns different IDs for different users."""
    user_id1 = get_user_id_for_create(test_user)
    user_id2 = get_user_id_for_create(test_admin)

    assert user_id1 != user_id2
    assert user_id1 == test_user.id
    assert user_id2 == test_admin.id


# ============================================================================
# Integration Tests
# ============================================================================


@pytest.mark.asyncio
async def test_user_isolation_full_workflow(
    session: AsyncSession, test_user: User, test_admin: User, test_article_root
):
    """Test complete user isolation workflow: create, filter, check access."""
    from datetime import date
    from decimal import Decimal

    # Step 1: Create fact as regular user
    user_id_for_create = get_user_id_for_create(test_user)

    fact = BudgetFact(
        user_id=user_id_for_create,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    # Step 2: Filter query to show only user's facts
    statement = select(BudgetFact)
    statement = apply_user_filter(statement, test_user)

    result = await session.execute(statement)
    facts = result.scalars().all()

    # User should see their fact
    assert len(facts) == 1
    assert facts[0].id == fact.id

    # Step 3: Check if user can access their fact
    can_access = can_access_resource(fact.user_id, test_user)
    assert can_access is True

    # Step 4: Ensure user owns resource (should not raise)
    ensure_user_owns_resource(fact.user_id, test_user)


@pytest.mark.asyncio
async def test_admin_bypass_full_workflow(
    session: AsyncSession, test_user: User, test_admin: User, test_article_root
):
    """Test that admin can bypass all user isolation checks."""
    from datetime import date
    from decimal import Decimal

    # Create fact as regular user
    fact = BudgetFact(
        user_id=test_user.id,  # Regular user's fact
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )
    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    # Admin should be able to:

    # 1. See fact in filtered query
    statement = select(BudgetFact)
    statement = apply_user_filter(statement, test_admin)

    result = await session.execute(statement)
    facts = result.scalars().all()
    assert len(facts) >= 1

    # 2. Check access (should return True)
    can_access = can_access_resource(fact.user_id, test_admin)
    assert can_access is True

    # 3. Ensure ownership (should not raise)
    ensure_user_owns_resource(fact.user_id, test_admin)


# ============================================================================
# Edge Cases
# ============================================================================


def test_can_access_resource_user_id_zero(test_user: User):
    """Test can_access_resource with resource_user_id=0."""
    # If test_user.id is not 0, should return False
    can_access = can_access_resource(0, test_user)

    assert can_access == (test_user.id == 0)


def test_can_access_resource_negative_user_id(test_user: User):
    """Test can_access_resource with negative resource_user_id."""
    can_access = can_access_resource(-1, test_user)

    # Should return False (unless test_user.id is -1, which it shouldn't be)
    assert can_access is False


def test_ensure_user_owns_resource_user_id_zero(test_user: User):
    """Test ensure_user_owns_resource with resource_user_id=0."""
    if test_user.id != 0:
        # Should raise 403
        with pytest.raises(HTTPException) as exc_info:
            ensure_user_owns_resource(0, test_user)

        assert exc_info.value.status_code == 403


def test_get_user_id_for_create_returns_integer(test_user: User):
    """Test get_user_id_for_create returns an integer."""
    user_id = get_user_id_for_create(test_user)

    assert isinstance(user_id, int)
    assert user_id > 0


# ============================================================================
# Type Safety Tests
# ============================================================================


def test_apply_user_filter_type_annotations():
    """Test apply_user_filter has correct type annotations."""
    from typing import get_type_hints

    hints = get_type_hints(apply_user_filter)

    # Should accept User parameter
    assert "user" in hints


def test_can_access_resource_type_annotations():
    """Test can_access_resource has correct type annotations."""
    from typing import get_type_hints

    hints = get_type_hints(can_access_resource)

    # Should return bool
    assert hints.get("return") is bool


def test_get_user_id_for_create_type_annotations():
    """Test get_user_id_for_create has correct type annotations."""
    from typing import get_type_hints

    hints = get_type_hints(get_user_id_for_create)

    # Should return int
    assert hints.get("return") is int
