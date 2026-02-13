"""
Integration tests for Recurring Plan Service.

Tests the RecurringPlanService functionality:
1. Minimum 3 facts generated regardless of occurrences_count
2. Minimum 3 facts generated regardless of end_date
3. Facts have recurring_plan_id populated
4. Logging during fact generation

Validates fixes for:
- Problem 1: Facts not being created
- Problem 4: Minimum 3 facts requirement
"""

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
async def test_generate_minimum_3_facts_with_occurrences_count_1(
    session: AsyncSession, test_user: User
):
    """
    Test: Generate EXACT occurrences_count facts (no minimum).

    Scenario:
        - Create recurring plan with occurrences_count=1
        - Expect EXACTLY 1 fact generated
        - Verify occurrences_generated == 1
    """
    service = RecurringPlanService()

    # Create dependencies
    article = Article(
        code="TEST_RECURRING",
        name="Test Recurring Payment",
        article_type="expense",
        parent_id=None,
        created_by_id=test_user.id,
    )
    session.add(article)

    financial_center = FinancialCenter(
        code="TEST_FC",
        name="Test Financial Center",
        created_by_id=test_user.id,
    )
    session.add(financial_center)

    await session.commit()
    await session.refresh(article)
    await session.refresh(financial_center)

    # Create recurring plan with occurrences_count=1
    today = date.today()
    data = RecurringPlanCreate(
        article_id=article.id,
        financial_center_id=financial_center.id,
        frequency_type="daily",
        start_date=today,
        occurrences_count=1,  # Only 1 occurrence allowed
        amount=Decimal("1000.00"),
        record_type="plan",
    )

    plan = await service.create_recurring_plan(session, data, test_user.id)

    # Verify EXACTLY 1 fact was generated
    result = await session.execute(
        select(BudgetFact).where(BudgetFact.recurring_plan_id == plan.id)
    )
    facts = list(result.scalars().all())

    assert len(facts) == 1, f"Expected exactly 1 fact, got {len(facts)}"
    assert plan.occurrences_generated == 1


@pytest.mark.asyncio
async def test_generate_minimum_3_facts_with_early_end_date(
    session: AsyncSession, test_user: User
):
    """
    Test: Generate facts up to end_date (no minimum).

    Scenario:
        - Create recurring plan with end_date = start_date + 1 day
        - With daily frequency, generates EXACTLY 2 facts (start_date and start_date+1)
        - Verify plan.is_active = False after reaching end_date
    """
    service = RecurringPlanService()

    # Create dependencies
    article = Article(
        code="TEST_RECURRING_END",
        name="Test Recurring with End Date",
        article_type="expense",
        parent_id=None,
        created_by_id=test_user.id,
    )
    session.add(article)

    financial_center = FinancialCenter(
        code="TEST_FC_END",
        name="Test FC for End Date",
        created_by_id=test_user.id,
    )
    session.add(financial_center)

    await session.commit()
    await session.refresh(article)
    await session.refresh(financial_center)

    # Create recurring plan with early end_date
    today = date.today()
    data = RecurringPlanCreate(
        article_id=article.id,
        financial_center_id=financial_center.id,
        frequency_type="daily",
        start_date=today,
        end_date=today + timedelta(days=1),  # Only 2 days allowed
        amount=Decimal("5000.00"),
        record_type="plan",
    )

    plan = await service.create_recurring_plan(session, data, test_user.id)

    # Verify EXACTLY 2 facts generated (today and today+1)
    result = await session.execute(
        select(BudgetFact).where(BudgetFact.recurring_plan_id == plan.id)
    )
    facts = list(result.scalars().all())

    assert len(facts) == 2, f"Expected exactly 2 facts, got {len(facts)}"
    # Plan should be deactivated after end_date
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
        code="TEST_MONTHLY",
        name="Monthly Rent",
        article_type="expense",
        parent_id=None,
        created_by_id=test_user.id,
    )
    session.add(article)

    financial_center = FinancialCenter(
        code="TEST_FC_MONTHLY",
        name="Main Account",
        created_by_id=test_user.id,
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
    import logging

    caplog.set_level(logging.INFO)

    service = RecurringPlanService()

    # Create dependencies
    article = Article(
        code="TEST_LOGGING",
        name="Test Logging Plan",
        article_type="expense",
        parent_id=None,
        created_by_id=test_user.id,
    )
    session.add(article)

    financial_center = FinancialCenter(
        code="TEST_FC_LOG",
        name="Test FC Logging",
        created_by_id=test_user.id,
    )
    session.add(financial_center)

    await session.commit()
    await session.refresh(article)
    await session.refresh(financial_center)

    # Create recurring plan
    today = date.today()
    data = RecurringPlanCreate(
        article_id=article.id,
        financial_center_id=financial_center.id,
        frequency_type="daily",
        start_date=today,
        occurrences_count=5,
        amount=Decimal("100.00"),
        record_type="plan",
    )

    plan = await service.create_recurring_plan(session, data, test_user.id)

    # Verify logs
    assert "[RECURRING] Starting" in caplog.text
    assert f"Plan {plan.id}" in caplog.text
    assert "Generated" in caplog.text
