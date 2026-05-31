"""Unit tests for /trends endpoint: credit/debit exclusion from income/expense."""
from datetime import date
from decimal import Decimal

import pytest
from httpx import AsyncClient
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User

pytestmark = pytest.mark.asyncio


async def _seed_article(session: AsyncSession, *, name: str, type_: str, user_id: int) -> int:
    art = Article(code=name.upper(), name=name, type=type_, parent_id=None, user_id=user_id)
    session.add(art)
    await session.flush()
    return art.id


async def _seed_fact(session: AsyncSession, *, article_id: int, fc_id: int, amount: str, day: int, user_id: int) -> None:
    session.add(BudgetFact(
        article_id=article_id,
        financial_center_id=fc_id,
        fact_date=date(2025, 10, day),
        amount=Decimal(amount),
        record_type="fact",
        user_id=user_id,
    ))


async def test_trends_excludes_credit_from_income(
    auth_client: AsyncClient, session: AsyncSession,
    test_user: User, test_financial_center: FinancialCenter,
):
    inc_id = await _seed_article(session, name="Salary", type_="income", user_id=test_user.id)
    cred_id = await _seed_article(session, name="Transfer in", type_="credit", user_id=test_user.id)
    await _seed_fact(session, article_id=inc_id, fc_id=test_financial_center.id, amount="50000", day=1, user_id=test_user.id)
    await _seed_fact(session, article_id=cred_id, fc_id=test_financial_center.id, amount="5000", day=2, user_id=test_user.id)
    await session.commit()

    r = await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "record_type": "fact"},
    )
    assert r.status_code == 200
    data = r.json()
    assert sum(data["income"]) == 50000.0
    assert 5000.0 not in data["income"]


async def test_trends_excludes_debit_from_expense(
    auth_client: AsyncClient, session: AsyncSession,
    test_user: User, test_financial_center: FinancialCenter,
):
    exp_id = await _seed_article(session, name="Food", type_="expense", user_id=test_user.id)
    deb_id = await _seed_article(session, name="Transfer out", type_="debit", user_id=test_user.id)
    await _seed_fact(session, article_id=exp_id, fc_id=test_financial_center.id, amount="10000", day=1, user_id=test_user.id)
    await _seed_fact(session, article_id=deb_id, fc_id=test_financial_center.id, amount="3000", day=2, user_id=test_user.id)
    await session.commit()

    r = await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "record_type": "fact"},
    )
    assert r.status_code == 200
    data = r.json()
    assert sum(data["expense"]) == 10000.0
    assert 3000.0 not in data["expense"]


async def test_trends_only_real_income_expense_returned(
    auth_client: AsyncClient, session: AsyncSession,
    test_user: User, test_financial_center: FinancialCenter,
):
    """Mixed transactions: only income+expense show in totals; transfers ignored."""
    inc_id = await _seed_article(session, name="Salary", type_="income", user_id=test_user.id)
    exp_id = await _seed_article(session, name="Food", type_="expense", user_id=test_user.id)
    cred_id = await _seed_article(session, name="Tr in", type_="credit", user_id=test_user.id)
    deb_id = await _seed_article(session, name="Tr out", type_="debit", user_id=test_user.id)
    for art_id, amount, day in [(inc_id, "50000", 1), (exp_id, "10000", 2),
                                  (cred_id, "5000", 3), (deb_id, "5000", 3)]:
        await _seed_fact(session, article_id=art_id, fc_id=test_financial_center.id, amount=amount, day=day, user_id=test_user.id)
    await session.commit()

    r = await auth_client.get(
        "/api/v1/analytics/trends",
        params={"date_from": "2025-10-01", "date_to": "2025-10-31", "record_type": "fact"},
    )
    assert r.status_code == 200
    data = r.json()
    assert sum(data["income"]) == 50000.0
    assert sum(data["expense"]) == 10000.0


async def test_trends_cumulative_mode_unchanged(
    auth_client: AsyncClient, session: AsyncSession,
    test_user: User, test_financial_center: FinancialCenter,
):
    inc_id = await _seed_article(session, name="Salary", type_="income", user_id=test_user.id)
    exp_id = await _seed_article(session, name="Food", type_="expense", user_id=test_user.id)
    await _seed_fact(session, article_id=inc_id, fc_id=test_financial_center.id, amount="100", day=1, user_id=test_user.id)
    await _seed_fact(session, article_id=exp_id, fc_id=test_financial_center.id, amount="40", day=2, user_id=test_user.id)
    await session.commit()

    r = await auth_client.get(
        "/api/v1/analytics/trends",
        params={
            "date_from": "2025-10-01", "date_to": "2025-10-03",
            "record_type": "fact", "chart_mode": "cumulative",
        },
    )
    assert r.status_code == 200
    data = r.json()
    assert data["chart_mode"] == "cumulative"
    assert data["income_period"] is not None
    # last cumulative point must equal sum of inputs
    assert data["income"][-1] == 100.0
    assert data["expense"][-1] == 40.0
