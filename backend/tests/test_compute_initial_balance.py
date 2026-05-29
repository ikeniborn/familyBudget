"""Unit tests for analytics._compute_initial_balance."""
from datetime import date
from decimal import Decimal

import pytest
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.api.v1.analytics import _compute_initial_balance
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter

pytestmark = pytest.mark.asyncio


async def _make_fc(session, test_user, name="FC-test"):
    fc = FinancialCenter(name=name, is_active=True, user_id=test_user.id)
    session.add(fc)
    await session.flush()
    return fc


async def _add_fact(session, *, fc_id, article_id, day, month, year, amount, test_user):
    session.add(BudgetFact(
        financial_center_id=fc_id,
        article_id=article_id,
        fact_date=date(year, month, day),
        amount=Decimal(amount),
        record_type="fact",
        user_id=test_user.id,
    ))


async def _add_article(session, *, name, type_, test_user):
    art = Article(name=name, type=type_, parent_id=None, user_id=test_user.id)
    session.add(art)
    await session.flush()
    return art


async def test_initial_balance_uses_aggregate_when_aligned_to_month_start(session, test_user):
    """When start_date.day == 1, balance == aggregate snapshot, no delta."""
    fc = await _make_fc(session, test_user)
    inc = await _add_article(session, name="salary", type_="income", test_user=test_user)
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=10, month=9, year=2025, amount="100000", test_user=test_user)
    await session.commit()
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2025, month=9)

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=fc.id)
    assert result == Decimal("100000.00")


async def test_initial_balance_uses_aggregate_plus_delta_when_mid_month(session, test_user):
    fc = await _make_fc(session, test_user)
    inc = await _add_article(session, name="salary", type_="income", test_user=test_user)
    exp = await _add_article(session, name="food", type_="expense", test_user=test_user)
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=10, month=9, year=2025, amount="100000", test_user=test_user)
    await _add_fact(session, fc_id=fc.id, article_id=exp.id, day=3, month=10, year=2025, amount="5000", test_user=test_user)
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=8, month=10, year=2025, amount="2000", test_user=test_user)
    await _add_fact(session, fc_id=fc.id, article_id=exp.id, day=20, month=10, year=2025, amount="99999", test_user=test_user)
    await session.commit()
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2025, month=9)

    result = await _compute_initial_balance(session, date(2025, 10, 15), cfo_id=fc.id)
    # 100000 + 2000 - 5000 = 97000
    assert result == Decimal("97000.00")


async def test_initial_balance_sums_across_active_fcs_when_no_cfo_id(session, test_user):
    fc1 = await _make_fc(session, test_user, "FC-1")
    fc2 = await _make_fc(session, test_user, "FC-2")
    inc = await _add_article(session, name="salary", type_="income", test_user=test_user)
    await _add_fact(session, fc_id=fc1.id, article_id=inc.id, day=10, month=9, year=2025, amount="50000", test_user=test_user)
    await _add_fact(session, fc_id=fc2.id, article_id=inc.id, day=10, month=9, year=2025, amount="30000", test_user=test_user)
    await session.commit()
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2025, month=9)

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=None)
    assert result == Decimal("80000.00")


async def test_initial_balance_per_cfo_when_cfo_id_set(session, test_user):
    fc1 = await _make_fc(session, test_user, "FC-1")
    fc2 = await _make_fc(session, test_user, "FC-2")
    inc = await _add_article(session, name="salary", type_="income", test_user=test_user)
    await _add_fact(session, fc_id=fc1.id, article_id=inc.id, day=10, month=9, year=2025, amount="50000", test_user=test_user)
    await _add_fact(session, fc_id=fc2.id, article_id=inc.id, day=10, month=9, year=2025, amount="30000", test_user=test_user)
    await session.commit()
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2025, month=9)

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=fc1.id)
    assert result == Decimal("50000.00")


async def test_initial_balance_fallback_to_full_scan_when_aggregate_missing(session, test_user):
    """No aggregate row → get_opening_balances_bulk falls back to full scan."""
    fc = await _make_fc(session, test_user)
    inc = await _add_article(session, name="salary", type_="income", test_user=test_user)
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=10, month=9, year=2025, amount="100000", test_user=test_user)
    await session.commit()
    # Intentionally DO NOT call refresh_monthly_balances

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=fc.id)
    assert result == Decimal("100000.00")


async def test_initial_balance_zero_when_no_transactions(session, test_user):
    fc = await _make_fc(session, test_user)
    await session.commit()

    result = await _compute_initial_balance(session, date(2025, 10, 1), cfo_id=fc.id)
    assert result == Decimal("0.00")


async def test_initial_balance_january_uses_december_prev_year(session, test_user):
    fc = await _make_fc(session, test_user)
    inc = await _add_article(session, name="salary", type_="income", test_user=test_user)
    await _add_fact(session, fc_id=fc.id, article_id=inc.id, day=15, month=12, year=2024, amount="77000", test_user=test_user)
    await session.commit()
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances
    await refresh_monthly_balances(session, year=2024, month=12)

    result = await _compute_initial_balance(session, date(2025, 1, 1), cfo_id=fc.id)
    assert result == Decimal("77000.00")
