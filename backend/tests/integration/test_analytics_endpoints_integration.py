"""Integration tests for /trends + /waterfall: real DB, full request cycle, 3 scenarios."""
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.services.balance_aggregation_service import refresh_monthly_balances

pytestmark = pytest.mark.asyncio


async def _seed_minimal(session, test_user, *, fcs):
    """Create FCs + 4 articles (income/expense/credit/debit). Return fc_name -> fc.id."""
    fc_ids = {}
    for name in fcs:
        fc = FinancialCenter(name=name, code=name, is_active=True, user_id=test_user.id)
        session.add(fc)
        await session.flush()
        fc_ids[name] = fc.id

    for art_name, t in [("salary", "income"), ("food", "expense"),
                        ("cred", "credit"), ("deb", "debit")]:
        art = Article(code=art_name, name=art_name, type=t, parent_id=None, user_id=test_user.id)
        session.add(art)
    await session.flush()
    return fc_ids


async def _fact(session, test_user, *, fc_id, art_name, amount, day, month=10, year=2025):
    from sqlmodel import select as _select
    stmt = _select(Article).where(Article.name == art_name)
    art = (await session.execute(stmt)).scalar_one()
    session.add(BudgetFact(
        financial_center_id=fc_id, article_id=art.id,
        fact_date=date(year, month, day), amount=Decimal(amount), record_type="fact",
        user_id=test_user.id,
    ))


async def test_scenario_1_family_without_transfers(auth_client: AsyncClient, session, test_user):
    fc_ids = await _seed_minimal(session, test_user, fcs=["FC-1"])
    await _fact(session, test_user, fc_id=fc_ids["FC-1"], art_name="salary", amount="50000", day=5)
    await _fact(session, test_user, fc_id=fc_ids["FC-1"], art_name="food", amount="10000", day=10)
    await session.commit()

    trends = (await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )).json()
    assert sum(trends["income"]) == 50000.0
    assert sum(trends["expense"]) == 10000.0

    wf = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )).json()
    assert sum(wf["transfers_in"]) == 0.0
    assert sum(wf["transfers_out"]) == 0.0
    assert round(wf["balance"][-1] - wf["initial_balance"], 2) == 40000.0


async def test_scenario_2_family_with_inter_account_transfer(auth_client: AsyncClient, session, test_user):
    fc_ids = await _seed_minimal(session, test_user, fcs=["FC-1", "FC-2"])
    await _fact(session, test_user, fc_id=fc_ids["FC-1"], art_name="salary", amount="50000", day=5)
    # Transfer FC-1 -> FC-2 of 5000
    await _fact(session, test_user, fc_id=fc_ids["FC-1"], art_name="deb", amount="5000", day=10)
    await _fact(session, test_user, fc_id=fc_ids["FC-2"], art_name="cred", amount="5000", day=10)
    await session.commit()

    trends = (await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )).json()
    assert sum(trends["income"]) == 50000.0
    assert sum(trends["expense"]) == 0.0  # transfer excluded

    wf_all = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )).json()
    assert sum(wf_all["income"]) == 50000.0
    assert sum(wf_all["expense"]) == 0.0
    assert sum(wf_all["transfers_in"]) == 5000.0
    assert sum(wf_all["transfers_out"]) == 5000.0
    assert round(wf_all["balance"][-1] - wf_all["initial_balance"], 2) == 50000.0

    wf_fc1 = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "cfo_id": fc_ids["FC-1"]},
    )).json()
    # FC-1: +50000 income, -5000 debit => net 45000
    assert round(wf_fc1["balance"][-1] - wf_fc1["initial_balance"], 2) == 45000.0

    wf_fc2 = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "cfo_id": fc_ids["FC-2"]},
    )).json()
    # FC-2: +5000 credit only
    assert round(wf_fc2["balance"][-1] - wf_fc2["initial_balance"], 2) == 5000.0


async def test_scenario_3_custom_range_mid_month_start(auth_client: AsyncClient, session, test_user):
    fc_ids = await _seed_minimal(session, test_user, fcs=["FC-1"])
    # September: 100000 income
    await _fact(session, test_user, fc_id=fc_ids["FC-1"], art_name="salary", amount="100000", day=10, month=9)
    # October 1-14: 2000 income, 5000 expense
    await _fact(session, test_user, fc_id=fc_ids["FC-1"], art_name="salary", amount="2000", day=8, month=10)
    await _fact(session, test_user, fc_id=fc_ids["FC-1"], art_name="food", amount="5000", day=12, month=10)
    # October 15+: 3000 income (inside requested range)
    await _fact(session, test_user, fc_id=fc_ids["FC-1"], art_name="salary", amount="3000", day=20, month=10)
    await session.commit()
    await refresh_monthly_balances(session, year=2025, month=9, financial_center_id=fc_ids["FC-1"])

    wf = (await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-15", "date_to": "2025-10-31", "cfo_id": fc_ids["FC-1"]},
    )).json()
    # initial = closing(Sep) + delta(Oct 1-14) = 100000 + (2000 - 5000) = 97000
    assert wf["initial_balance"] == 97000.0
    assert sum(wf["income"]) == 3000.0
    assert round(wf["balance"][-1], 2) == 100000.0
