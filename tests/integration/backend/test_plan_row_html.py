"""
Verify get_fact_row_html plan-branch matches renderFactsTable TypeScript output.
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
async def plan_fact(
    db_session: AsyncSession, test_user: User
) -> BudgetFact:
    fc = FinancialCenter(user_id=test_user.id, name="TestFC", is_active=True)
    db_session.add(fc)
    await db_session.commit()
    await db_session.refresh(fc)

    article = Article(
        user_id=test_user.id, parent_id=None, name="TestArticle",
        type="expense", is_active=True,
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)

    fact = BudgetFact(
        user_id=test_user.id,
        fact_date=date(2026, 6, 1),
        article_id=article.id,
        financial_center_id=fc.id,
        amount=5000,
        description="Test plan",
        record_type="plan",
    )
    db_session.add(fact)
    await db_session.commit()
    await db_session.refresh(fact)
    return fact


@pytest.mark.asyncio
async def test_plan_row_html_id_cell_no_badge(authenticated_client: AsyncClient, plan_fact: BudgetFact):
    """ID cell must be plain <td class="text-base-content/50 text-xs">, not badge-ghost."""
    resp = await authenticated_client.get(
        f"/api/v1/facts/{plan_fact.id}/row-html",
        params={"record_type": "plan"},
    )
    assert resp.status_code == 200
    html = resp.text
    assert 'badge-ghost' not in html
    assert 'text-base-content/50 text-xs' in html


@pytest.mark.asyncio
async def test_plan_row_html_article_cell_no_color_span(authenticated_client: AsyncClient, plan_fact: BudgetFact):
    """Article name must be plain text in <td>, no color span wrapper."""
    resp = await authenticated_client.get(
        f"/api/v1/facts/{plan_fact.id}/row-html",
        params={"record_type": "plan"},
    )
    assert resp.status_code == 200
    html = resp.text
    desktop, _, _ = html.partition("|||")
    assert '<span class="text-error">' not in desktop
    assert '<span class="text-success">' not in desktop
    assert '<span class="text-info">' not in desktop
    assert '<span class="text-warning">' not in desktop


@pytest.mark.asyncio
async def test_plan_row_html_updated_at_class(authenticated_client: AsyncClient, plan_fact: BudgetFact):
    """Updated-at cell must have text-base-content/60 class (matching TypeScript renderFactsTable)."""
    resp = await authenticated_client.get(
        f"/api/v1/facts/{plan_fact.id}/row-html",
        params={"record_type": "plan"},
    )
    assert resp.status_code == 200
    html = resp.text
    desktop, _, _ = html.partition("|||")
    assert 'text-base-content/60' in desktop
