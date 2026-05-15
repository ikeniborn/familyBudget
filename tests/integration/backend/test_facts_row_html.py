"""
Integration tests for GET /api/v1/facts/{id}/row-html.
Ensures server-rendered fact row matches client renderFactRow markup
(spec 2026-05-15-facts-delete-stat-and-row-render-design).
"""
from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User


@pytest_asyncio.fixture
async def sample_fact(
    db_session: AsyncSession, test_user: User
) -> BudgetFact:
    fc = FinancialCenter(user_id=test_user.id, name="FC", is_active=True)
    db_session.add(fc)
    await db_session.commit()
    await db_session.refresh(fc)

    article = Article(
        user_id=test_user.id, parent_id=None, name="Food",
        type="expense", is_active=True,
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)

    fact = BudgetFact(
        user_id=test_user.id,
        fact_date=date(2026, 5, 15),
        article_id=article.id,
        financial_center_id=fc.id,
        amount=12345,
        description="Lunch",
    )
    db_session.add(fact)
    await db_session.commit()
    await db_session.refresh(fact)
    return fact


@pytest.mark.asyncio
async def test_row_html_fact_branch_matches_client(
    authenticated_client: AsyncClient, sample_fact: BudgetFact
):
    resp = await authenticated_client.get(
        f"/api/v1/facts/{sample_fact.id}/row-html?record_type=fact"
    )
    assert resp.status_code == 200
    html = resp.text

    desktop, _, mobile = html.partition("|||")

    assert desktop.count("<td") == 11, desktop
    assert f'<td class="text-base-content/50 text-xs">{sample_fact.id}</td>' in desktop
    assert "badge badge-ghost" not in desktop
    assert "text-xs text-base-content/50 whitespace-nowrap" in desktop
    assert "onchange=" not in desktop
    assert "Напоминание установлено" not in desktop
    assert "Регламентный платеж" not in desktop
    assert "Создано offline" not in desktop
    assert "Напоминание установлено" not in mobile
    assert "Регламентный платеж" not in mobile


@pytest.mark.asyncio
async def test_row_html_plan_branch_unchanged(
    authenticated_client: AsyncClient, sample_fact: BudgetFact
):
    """Plan branch keeps original 13-column structure."""
    resp = await authenticated_client.get(
        f"/api/v1/facts/{sample_fact.id}/row-html?record_type=plan"
    )
    assert resp.status_code == 200
    html = resp.text
    desktop, _, _ = html.partition("|||")
    assert desktop.count("<td") == 13
    assert "badge badge-ghost" in desktop
