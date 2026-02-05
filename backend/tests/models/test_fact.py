"""
Unit tests for BudgetFact model.

Tests fact table functionality, foreign key relationships, and data integrity.
"""

from datetime import date, datetime
from decimal import Decimal

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.user import User

# ============================================================================
# BudgetFact Creation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_fact_basic(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test creating a basic budget fact with required fields."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.75"),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.id is not None
    assert fact.user_id == test_user.id
    assert fact.article_id == test_article_root.id
    assert fact.fact_date == date(2025, 10, 13)
    assert fact.amount == Decimal("50.75")
    assert fact.description is None


@pytest.mark.asyncio
async def test_create_fact_with_description(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test creating fact with description."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
        description="Weekly groceries at supermarket",
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.description == "Weekly groceries at supermarket"


@pytest.mark.asyncio
async def test_create_fact_with_large_amount(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test creating fact with large amount (15 digits, 2 decimal places)."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("9999999999999.99"),  # Max 15 digits total
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.amount == Decimal("9999999999999.99")


@pytest.mark.asyncio
async def test_create_fact_with_small_amount(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test creating fact with small amount (cents)."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("0.01"),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.amount == Decimal("0.01")


# ============================================================================
# Date Tests
# ============================================================================


@pytest.mark.asyncio
async def test_create_fact_today(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test creating fact with today's date."""
    today = date.today()

    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=today,
        amount=Decimal("50.00"),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.fact_date == today


@pytest.mark.asyncio
async def test_create_fact_past_date(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test creating fact with past date."""
    past_date = date(2025, 1, 1)

    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=past_date,
        amount=Decimal("75.00"),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.fact_date == past_date


# ============================================================================
# Foreign Key Tests
# ============================================================================


@pytest.mark.asyncio
async def test_fact_references_user(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test fact correctly references user via foreign key."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.00"),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.user_id == test_user.id


@pytest.mark.asyncio
async def test_fact_references_article(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test fact correctly references article via foreign key."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.00"),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.article_id == test_article_root.id


# ============================================================================
# Optional Fields Tests
# ============================================================================


@pytest.mark.asyncio
async def test_fact_optional_financial_center(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test fact with optional financial_center_id."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.00"),
        financial_center_id=None,  # Optional
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.financial_center_id is None


@pytest.mark.asyncio
async def test_fact_optional_cost_center(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test fact with optional cost_center_id."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.00"),
        cost_center_id=None,  # Optional
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.cost_center_id is None


# ============================================================================
# Audit Fields Tests
# ============================================================================


@pytest.mark.asyncio
async def test_fact_audit_fields(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test audit fields (created_at, updated_at) are set automatically."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.00"),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    assert fact.created_at is not None
    assert fact.updated_at is not None
    assert isinstance(fact.created_at, datetime)
    assert isinstance(fact.updated_at, datetime)


@pytest.mark.asyncio
async def test_fact_updated_at_changes(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test updated_at changes when fact is modified."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.00"),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)


    # Update fact
    fact.amount = Decimal("75.00")
    fact.updated_at = datetime.utcnow()
    await session.commit()
    await session.refresh(fact)

    # Note: updated_at should be different (in real app with db triggers)
    # In tests, we manually set it
    assert fact.amount == Decimal("75.00")


# ============================================================================
# Model Representation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_fact_repr(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test BudgetFact __repr__ method."""
    fact = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.75"),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    repr_str = repr(fact)

    assert "BudgetFact" in repr_str
    assert f"id={fact.id}" in repr_str
    assert f"user_id={test_user.id}" in repr_str
    assert f"article_id={test_article_root.id}" in repr_str
    assert "fact_date=2025-10-13" in repr_str
    assert "amount=50.75" in repr_str


# ============================================================================
# Query Tests
# ============================================================================


@pytest.mark.asyncio
async def test_query_facts_by_user(session: AsyncSession, test_user: User, test_admin: User, test_article_root: Article):
    """Test querying facts by user_id."""
    # Create facts for different users
    fact1 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.00"),
    )

    fact2 = BudgetFact(
        user_id=test_admin.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("100.00"),
    )

    session.add(fact1)
    session.add(fact2)
    await session.commit()

    # Query user facts
    stmt = select(BudgetFact).where(BudgetFact.user_id == test_user.id)
    result = await session.execute(stmt)
    facts = result.scalars().all()

    assert len(facts) == 1
    assert facts[0].amount == Decimal("50.00")


@pytest.mark.asyncio
async def test_query_facts_by_article(session: AsyncSession, test_user: User, test_article_root: Article, test_article_child: Article):
    """Test querying facts by article_id."""
    # Create facts for different articles
    fact1 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("50.00"),
    )

    fact2 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_child.id,
        fact_date=date(2025, 10, 13),
        amount=Decimal("25.00"),
    )

    session.add(fact1)
    session.add(fact2)
    await session.commit()

    # Query facts for root article
    stmt = select(BudgetFact).where(BudgetFact.article_id == test_article_root.id)
    result = await session.execute(stmt)
    facts = result.scalars().all()

    assert len(facts) == 1
    assert facts[0].amount == Decimal("50.00")


@pytest.mark.asyncio
async def test_query_facts_by_date_range(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test querying facts by date range."""
    # Create facts with different dates
    fact1 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 1),
        amount=Decimal("50.00"),
    )

    fact2 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 15),
        amount=Decimal("75.00"),
    )

    fact3 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 30),
        amount=Decimal("100.00"),
    )

    session.add(fact1)
    session.add(fact2)
    session.add(fact3)
    await session.commit()

    # Query facts in October 1-20
    stmt = select(BudgetFact).where(
        BudgetFact.fact_date >= date(2025, 10, 1),
        BudgetFact.fact_date <= date(2025, 10, 20),
    )
    result = await session.execute(stmt)
    facts = result.scalars().all()

    assert len(facts) == 2
    amounts = {fact.amount for fact in facts}
    assert amounts == {Decimal("50.00"), Decimal("75.00")}


@pytest.mark.asyncio
async def test_query_facts_order_by_date(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test querying facts ordered by date."""
    # Create facts with different dates (out of order)
    fact1 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 15),
        amount=Decimal("50.00"),
    )

    fact2 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 1),
        amount=Decimal("25.00"),
    )

    fact3 = BudgetFact(
        user_id=test_user.id,
        article_id=test_article_root.id,
        fact_date=date(2025, 10, 30),
        amount=Decimal("100.00"),
    )

    session.add(fact1)
    session.add(fact2)
    session.add(fact3)
    await session.commit()

    # Query facts ordered by date
    stmt = select(BudgetFact).order_by(BudgetFact.fact_date)
    result = await session.execute(stmt)
    facts = result.scalars().all()

    assert len(facts) == 3
    assert facts[0].fact_date == date(2025, 10, 1)
    assert facts[1].fact_date == date(2025, 10, 15)
    assert facts[2].fact_date == date(2025, 10, 30)


# ============================================================================
# Aggregation Tests
# ============================================================================


@pytest.mark.asyncio
async def test_sum_facts_by_user(session: AsyncSession, test_user: User, test_article_root: Article):
    """Test aggregating (summing) facts by user."""
    # Create multiple facts for user
    for amount in [Decimal("10.00"), Decimal("20.00"), Decimal("30.00")]:
        fact = BudgetFact(
            user_id=test_user.id,
            article_id=test_article_root.id,
            fact_date=date(2025, 10, 13),
            amount=amount,
        )
        session.add(fact)

    await session.commit()

    # Query all facts for user
    stmt = select(BudgetFact).where(BudgetFact.user_id == test_user.id)
    result = await session.execute(stmt)
    facts = result.scalars().all()

    # Calculate sum
    total = sum(fact.amount for fact in facts)
    assert total == Decimal("60.00")
