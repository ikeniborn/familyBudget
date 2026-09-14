"""
Tests for POST /api/v1/ai/analytics-chat (ai-analytics-chat).

Provider mocked with sequential answers (scope extraction, then the
grounded answer). Pins:

1. Disabled AI -> honest 503.
2. The backend computes the aggregates itself and passes them to the
   second model call: only facts inside the extracted period/filter are
   summed; the endpoint is read-only.
3. Scope extraction failure -> honest 422.
"""
import json
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User
from backend.app.schemas.ai import AISettingsUpdate
from backend.app.services import ai_settings_service, llm_parse_service
from backend.app.services.ai_provider_client import AIProviderClient
from backend.app.services.partition_service import ensure_partitions_for_dates

pytestmark = [pytest.mark.integration, pytest.mark.destructive]


@pytest_asyncio.fixture
async def seeded_facts(db_session: AsyncSession, test_user: User) -> dict:
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()

    fc = FinancialCenter(user_id=test_user.id, name="Карта", is_active=True)
    article = Article(
        user_id=test_user.id, parent_id=None, name="Продукты",
        type="expense", is_active=True,
    )
    db_session.add(fc)
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(fc)
    await db_session.refresh(article)

    today = date.today()
    await ensure_partitions_for_dates(
        db_session, [today, today - timedelta(days=90)]
    )
    inside = BudgetFact(
        user_id=test_user.id, article_id=article.id,
        financial_center_id=fc.id, fact_date=today,
        amount=1200, record_type="fact",
    )
    outside = BudgetFact(
        user_id=test_user.id, article_id=article.id,
        financial_center_id=fc.id, fact_date=today - timedelta(days=90),
        amount=5000, record_type="fact",
    )
    db_session.add(inside)
    db_session.add(outside)
    await db_session.commit()
    yield {"article": article, "fc": fc}
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()


async def enable_text(db_session: AsyncSession, user_id: int) -> None:
    await ai_settings_service.update_settings(
        db_session,
        AISettingsUpdate(enabled=True, model_text="test-model", confidence_threshold=0.7),
        updated_by=user_id,
    )
    await db_session.commit()


def mock_chat_sequence(monkeypatch, answers: list[str], seen: list[str]) -> None:
    """Return the queued answers in order; record every user payload."""

    async def fake_chat(self, model, messages, response_format=None, max_tokens=1024, temperature=0.1):
        seen.append(messages[-1]["content"])
        return answers.pop(0)

    monkeypatch.setattr(AIProviderClient, "chat_completions", fake_chat)


async def test_disabled_returns_503(authenticated_client: AsyncClient, seeded_facts):
    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat", json={"question": "затраты за месяц?"}
    )
    assert response.status_code == 503


async def test_grounded_answer_uses_backend_aggregates(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    await enable_text(db_session, test_user.id)
    article = seeded_facts["article"]
    today = date.today()
    start = today.replace(day=1)
    seen: list[str] = []
    scope = json.dumps(
        {
            "period_start": start.isoformat(),
            "period_end": today.isoformat(),
            "article_ids": [article.id],
            "record_type": "fact",
        }
    )
    mock_chat_sequence(
        monkeypatch, [scope, "За текущий месяц на продукты потрачено 1 200 ₽."], seen
    )

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Какие затраты по продуктам за текущий месяц?"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["answer"].startswith("За текущий месяц")
    assert data["period_start"] == start.isoformat()
    # Only the in-period fact is aggregated (5000 from 90 days ago excluded).
    assert data["expense_total"] == 1200
    assert data["income_total"] == 0

    # The second model call received the backend-computed aggregates.
    assert len(seen) == 2
    assert '"expense_total": 1200' in seen[1]
    assert "Продукты" in seen[1]


async def test_scope_garbage_returns_422(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    await enable_text(db_session, test_user.id)
    seen: list[str] = []
    mock_chat_sequence(monkeypatch, ["cannot help with that"], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat", json={"question": "как дела?"}
    )
    assert response.status_code == 422
