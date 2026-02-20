"""
Integration tests for Recurring Plan Service.

Tests the RecurringPlanService functionality:
1. Exact occurrences_count facts generated (bounded by occurrences_count)
2. Facts bounded by end_date (plan deactivated when end_date reached)
3. Facts have recurring_plan_id populated
4. Logging during fact generation
"""

import logging
from datetime import date, timedelta
from decimal import Decimal

import pytest
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User
from backend.app.schemas.recurring_plan import RecurringPlanCreate
from backend.app.services.recurring_plan_service import RecurringPlanService


@pytest.mark.asyncio
async def test_generate_exact_occurrences_count_facts(
    session: AsyncSession, test_user: User
):
    """
    Test: Generate EXACT occurrences_count facts.

    Scenario:
        - Create monthly recurring plan with occurrences_count=1
        - Expect EXACTLY 1 fact generated
        - Verify occurrences_generated == 1
    """
    service = RecurringPlanService()

    # Create dependencies
    article = Article(
        code="ART-1",
        name="Test Recurring Payment",
        type="expense",
        parent_id=None,
        user_id=test_user.id,
    )
    session.add(article)

    financial_center = FinancialCenter(
        code="CFO-1",
        name="Test Financial Center",
        user_id=test_user.id,
    )
    session.add(financial_center)

    await session.commit()
    await session.refresh(article)
    await session.refresh(financial_center)

    today = date.today()
    data = RecurringPlanCreate(
        article_id=article.id,
        financial_center_id=financial_center.id,
        frequency_type="monthly",
        frequency_value=min(today.day, 28),
        start_date=today,
        occurrences_count=1,
        amount=Decimal("1000.00"),
        record_type="plan",
    )

    assert test_user.id is not None
    plan = await service.create_recurring_plan(session, data, test_user.id)

    result = await session.execute(
        select(BudgetFact).where(BudgetFact.recurring_plan_id == plan.id)
    )
    facts = list(result.scalars().all())

    assert len(facts) == 1, f"Expected exactly 1 fact, got {len(facts)}"
    assert plan.occurrences_generated == 1


@pytest.mark.asyncio
async def test_generate_facts_bounded_by_end_date(
    session: AsyncSession, test_user: User
):
    """
    Test: Generate facts up to end_date, then deactivate plan.

    Scenario:
        - Create monthly recurring plan with end_date = next monthly occurrence
        - Generates EXACTLY 2 facts (start_date and second monthly occurrence)
        - Verify plan.is_active = False after reaching end_date
    """
    service = RecurringPlanService()

    # Create dependencies
    article = Article(
        code="ART-2",
        name="Test Recurring with End Date",
        type="expense",
        parent_id=None,
        user_id=test_user.id,
    )
    session.add(article)

    financial_center = FinancialCenter(
        code="CFO-2",
        name="Test FC for End Date",
        user_id=test_user.id,
    )
    session.add(financial_center)

    await session.commit()
    await session.refresh(article)
    await session.refresh(financial_center)

    # Use day <= 28 so the target day is valid in every month (including February)
    today = date.today()
    target_day = min(today.day, 28)
    start_date = today.replace(day=target_day)

    # Second fact lands on the same day next month
    next_month_start = (start_date.replace(day=1) + timedelta(days=32)).replace(day=1)
    second_fact_date = next_month_start.replace(day=target_day)

    data = RecurringPlanCreate(
        article_id=article.id,
        financial_center_id=financial_center.id,
        frequency_type="monthly",
        frequency_value=target_day,
        start_date=start_date,
        end_date=second_fact_date,
        amount=Decimal("5000.00"),
        record_type="plan",
    )

    assert test_user.id is not None
    plan = await service.create_recurring_plan(session, data, test_user.id)

    result = await session.execute(
        select(BudgetFact).where(BudgetFact.recurring_plan_id == plan.id)
    )
    facts = list(result.scalars().all())

    assert len(facts) == 2, f"Expected exactly 2 facts, got {len(facts)}"
    assert not plan.is_active


@pytest.mark.asyncio
async def test_facts_have_recurring_plan_id(session: AsyncSession, test_user: User):
    """
    Test Problems 1 and 2: Facts are created with recurring_plan_id populated.

    Scenario:
        - Create monthly recurring plan
        - Verify facts are generated
        - Verify all facts have recurring_plan_id = plan.id
    """
    service = RecurringPlanService()

    # Create dependencies
    article = Article(
        code="ART-3",
        name="Monthly Rent",
        type="expense",
        parent_id=None,
        user_id=test_user.id,
    )
    session.add(article)

    financial_center = FinancialCenter(
        code="CFO-3",
        name="Main Account",
        user_id=test_user.id,
    )
    session.add(financial_center)

    await session.commit()
    await session.refresh(article)
    await session.refresh(financial_center)

    # Create monthly recurring plan
    today = date.today()
    data = RecurringPlanCreate(
        article_id=article.id,
        financial_center_id=financial_center.id,
        frequency_type="monthly",
        frequency_value=15,  # 15th of each month
        start_date=today,
        amount=Decimal("50000.00"),
        record_type="plan",
    )

    assert test_user.id is not None
    plan = await service.create_recurring_plan(session, data, test_user.id)

    # Verify facts generated
    result = await session.execute(
        select(BudgetFact).where(BudgetFact.recurring_plan_id == plan.id)
    )
    facts = list(result.scalars().all())

    assert len(facts) > 0, "No facts generated"

    # Verify all facts have recurring_plan_id
    for fact in facts:
        assert (
            fact.recurring_plan_id == plan.id
        ), f"Fact {fact.id} has recurring_plan_id={fact.recurring_plan_id}, expected {plan.id}"


@pytest.mark.asyncio
async def test_logging_during_generation(
    session: AsyncSession, test_user: User, caplog
):
    """
    Test Problem 1: Logging works during fact generation.

    Scenario:
        - Create recurring plan
        - Capture logs
        - Verify log messages are present
    """
    caplog.set_level(logging.INFO)

    service = RecurringPlanService()

    # Create dependencies
    article = Article(
        code="ART-4",
        name="Test Logging Plan",
        type="expense",
        parent_id=None,
        user_id=test_user.id,
    )
    session.add(article)

    financial_center = FinancialCenter(
        code="CFO-4",
        name="Test FC Logging",
        user_id=test_user.id,
    )
    session.add(financial_center)

    await session.commit()
    await session.refresh(article)
    await session.refresh(financial_center)

    today = date.today()
    data = RecurringPlanCreate(
        article_id=article.id,
        financial_center_id=financial_center.id,
        frequency_type="monthly",
        frequency_value=min(today.day, 28),
        start_date=today,
        occurrences_count=5,
        amount=Decimal("100.00"),
        record_type="plan",
    )

    assert test_user.id is not None
    plan = await service.create_recurring_plan(session, data, test_user.id)

    # Verify logs
    assert "[RECURRING] Starting" in caplog.text
    assert f"Plan {plan.id}" in caplog.text
    assert "Generated" in caplog.text
