"""Unit tests for /waterfall: 4-way bucket split (income/expense/transfers_in/transfers_out)."""
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter

pytestmark = pytest.mark.asyncio


async def _seed(session, test_user, *, fc_name, art_name, art_type, amount, day, month=10, year=2025):
    fc = FinancialCenter(name=fc_name, is_active=True, user_id=test_user.id)
    session.add(fc)
    await session.flush()
    art = Article(code=art_name, name=art_name, type=art_type, parent_id=None, user_id=test_user.id)
    session.add(art)
    await session.flush()
    session.add(BudgetFact(
        financial_center_id=fc.id, article_id=art.id,
        fact_date=date(year, month, day), amount=Decimal(amount), record_type="fact",
        user_id=test_user.id,
    ))
    return fc, art


async def test_waterfall_returns_transfers_in_out_arrays(
    auth_client: AsyncClient, session, test_user
):
    await _seed(session, test_user, fc_name="FC-A", art_name="cred", art_type="credit", amount="500", day=5)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "transfers_in" in data and isinstance(data["transfers_in"], list)
    assert "transfers_out" in data and isinstance(data["transfers_out"], list)
    assert sum(data["transfers_in"]) == 500.0


async def test_waterfall_income_excludes_credit(
    auth_client: AsyncClient, session, test_user
):
    await _seed(session, test_user, fc_name="FC-B", art_name="salary", art_type="income", amount="50000", day=1)
    await _seed(session, test_user, fc_name="FC-C", art_name="cred", art_type="credit", amount="500", day=2)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )
    data = r.json()
    assert sum(data["income"]) == 50000.0
    assert 500.0 not in data["income"]


async def test_waterfall_expense_excludes_debit(
    auth_client: AsyncClient, session, test_user
):
    await _seed(session, test_user, fc_name="FC-D", art_name="food", art_type="expense", amount="10000", day=1)
    await _seed(session, test_user, fc_name="FC-E", art_name="deb", art_type="debit", amount="300", day=2)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31"},
    )
    data = r.json()
    assert sum(data["expense"]) == 10000.0
    assert 300.0 not in data["expense"]


async def test_waterfall_balance_includes_transfers(
    auth_client: AsyncClient, session, test_user
):
    """balance per period = initial + income - expense + transfers_in - transfers_out."""
    await _seed(session, test_user, fc_name="FC-F", art_name="salary", art_type="income", amount="50000", day=1)
    await _seed(session, test_user, fc_name="FC-G", art_name="cred", art_type="credit", amount="500", day=1)
    await _seed(session, test_user, fc_name="FC-H", art_name="deb", art_type="debit", amount="500", day=1)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-02"},
    )
    data = r.json()
    # transfers net = 0; income = 50000; balance ends at initial + 50000
    assert data["balance"][-1] - data["initial_balance"] == 50000.0


async def test_waterfall_drilldown_article_id_unchanged(
    auth_client: AsyncClient, session, test_user
):
    _, art = await _seed(session, test_user, fc_name="FC-I", art_name="salary", art_type="income", amount="50000", day=1)
    await session.commit()
    r = await auth_client.get(
        "/api/v1/analytics/waterfall",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "article_id": art.id},
    )
    data = r.json()
    assert data["article_id"] == art.id
    assert data["article_name"] is not None
