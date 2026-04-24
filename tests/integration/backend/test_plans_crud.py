"""
Integration tests for plan facts CRUD and cascade behavior.

Focus: regression coverage for BUG-003 (orphan ScheduledReminder rows after
DELETE /api/v1/facts/{id} and POST /api/v1/facts/batch-delete).
"""
from datetime import date, datetime, timedelta
from decimal import Decimal

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.scheduled_reminder import ScheduledReminder
from backend.app.models.user import User


@pytest_asyncio.fixture
async def plan_financial_center(db_session: AsyncSession, test_user: User) -> FinancialCenter:
    fc = FinancialCenter(
        user_id=test_user.id,
        name="Test FC for plans",
        is_active=True,
    )
    db_session.add(fc)
    await db_session.commit()
    await db_session.refresh(fc)
    return fc


@pytest_asyncio.fixture
async def plan_article(db_session: AsyncSession, test_user: User) -> Article:
    article = Article(
        user_id=test_user.id,
        parent_id=None,
        name="Plan article",
        type="expense",
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)
    return article


def _plan_payload(article_id: int, fc_id: int, amount: str = "1234.00") -> dict:
    """Build POST /facts body for a plan record dated next month."""
    plan_date = (date.today().replace(day=1) + timedelta(days=32)).replace(day=1)
    return {
        "article_id": article_id,
        "financial_center_id": fc_id,
        "fact_date": plan_date.isoformat(),
        "amount": amount,
        "description": "pytest plan",
        "record_type": "plan",
    }


@pytest.mark.integration
@pytest.mark.backend
@pytest.mark.destructive
class TestPlanFactsCascade:
    """Verify that deleting a plan fact also removes its ScheduledReminder."""

    async def test_create_plan_via_facts_api(
        self,
        authenticated_client: AsyncClient,
        plan_article: Article,
        plan_financial_center: FinancialCenter,
    ):
        response = await authenticated_client.post(
            "/api/v1/facts",
            json=_plan_payload(plan_article.id, plan_financial_center.id),
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["record_type"] == "plan"
        assert body["article_id"] == plan_article.id
        assert body["financial_center_id"] == plan_financial_center.id

    async def test_delete_plan_cascades_reminder(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        plan_article: Article,
        plan_financial_center: FinancialCenter,
    ):
        # 1. Create plan via API
        create_resp = await authenticated_client.post(
            "/api/v1/facts",
            json=_plan_payload(plan_article.id, plan_financial_center.id),
        )
        assert create_resp.status_code == 201, create_resp.text
        fact_id = create_resp.json()["id"]

        # 2. Insert a ScheduledReminder for this plan directly (skip API to avoid
        #    coupling test to ReminderService validation rules).
        reminder = ScheduledReminder(
            fact_id=fact_id,
            reminder_datetime=datetime.utcnow() + timedelta(days=1),
            status="pending",
        )
        db_session.add(reminder)
        await db_session.commit()

        # 3. DELETE /facts/{id} should also remove the reminder
        del_resp = await authenticated_client.delete(f"/api/v1/facts/{fact_id}")
        assert del_resp.status_code == 204, del_resp.text

        remaining = (
            await db_session.execute(
                select(ScheduledReminder).where(ScheduledReminder.fact_id == fact_id)
            )
        ).scalars().all()
        assert remaining == [], "ScheduledReminder must be cascade-deleted with the plan"

        fact_left = (
            await db_session.execute(select(BudgetFact).where(BudgetFact.id == fact_id))
        ).scalar_one_or_none()
        assert fact_left is None

    async def test_batch_delete_cascades_reminders(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        plan_article: Article,
        plan_financial_center: FinancialCenter,
    ):
        fact_ids = []
        for amount in ("100.00", "200.00", "300.00"):
            resp = await authenticated_client.post(
                "/api/v1/facts",
                json=_plan_payload(plan_article.id, plan_financial_center.id, amount),
            )
            assert resp.status_code == 201, resp.text
            fact_ids.append(resp.json()["id"])

        # Reminders on first two of three plans
        for fid in fact_ids[:2]:
            db_session.add(
                ScheduledReminder(
                    fact_id=fid,
                    reminder_datetime=datetime.utcnow() + timedelta(days=2),
                    status="pending",
                )
            )
        await db_session.commit()

        # Bulk delete all three plans
        batch_resp = await authenticated_client.post(
            "/api/v1/facts/batch-delete",
            json=fact_ids,
        )
        assert batch_resp.status_code == 200, batch_resp.text
        assert batch_resp.json()["deleted_count"] == len(fact_ids)

        # All reminders gone, no orphans
        leftover = (
            await db_session.execute(
                select(ScheduledReminder).where(ScheduledReminder.fact_id.in_(fact_ids))
            )
        ).scalars().all()
        assert leftover == []

    async def test_delete_plan_without_reminder_does_not_touch_other_facts(
        self,
        authenticated_client: AsyncClient,
        db_session: AsyncSession,
        plan_article: Article,
        plan_financial_center: FinancialCenter,
    ):
        """Regression for BUG-003 anecdote: deleting one plan must remove only that row."""
        ids = []
        for amount in ("11.00", "22.00", "33.00"):
            resp = await authenticated_client.post(
                "/api/v1/facts",
                json=_plan_payload(plan_article.id, plan_financial_center.id, amount),
            )
            assert resp.status_code == 201, resp.text
            ids.append(resp.json()["id"])

        target = ids[0]
        survivors = ids[1:]

        del_resp = await authenticated_client.delete(f"/api/v1/facts/{target}")
        assert del_resp.status_code == 204, del_resp.text

        remaining_ids = {
            f.id
            for f in (
                await db_session.execute(
                    select(BudgetFact).where(BudgetFact.id.in_(ids))
                )
            ).scalars().all()
        }
        assert remaining_ids == set(survivors)
