"""
Tests for POST /api/v1/ai/parse-batch (ai-bulk-entry).

Provider mocked at AIProviderClient.chat_completions — no network. Pins:

1. Disabled AI -> honest 503.
2. Valid model JSON array -> validated fact/plan drafts: a plan keeps its
   future date, a fact's future date is clamped to today with a warning,
   a missing account falls back to the main one.
3. not_understood / garbage -> honest 422, never a draft.
"""
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User
from backend.app.schemas.ai import AISettingsUpdate
from backend.app.services import ai_settings_service, llm_parse_service
from backend.app.services.ai_provider_client import AIProviderClient

pytestmark = [pytest.mark.integration, pytest.mark.destructive]


@pytest_asyncio.fixture
async def seeded_refs(db_session: AsyncSession, test_user: User) -> dict:
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()

    fc = FinancialCenter(user_id=test_user.id, name="Карта", is_active=True)
    article = Article(
        user_id=test_user.id, parent_id=None, name="Кафе",
        type="expense", is_active=True,
    )
    db_session.add(fc)
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(fc)
    await db_session.refresh(article)
    yield {"fc": fc, "article": article}
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()


async def enable_text(db_session: AsyncSession, user_id: int) -> None:
    await ai_settings_service.update_settings(
        db_session,
        AISettingsUpdate(enabled=True, model_text="test-model", confidence_threshold=0.7),
        updated_by=user_id,
    )
    await db_session.commit()


def mock_chat(monkeypatch, content: str) -> None:
    async def fake_chat(self, model, messages, response_format=None, max_tokens=1024, temperature=0.1):
        return content

    monkeypatch.setattr(AIProviderClient, "chat_completions", fake_chat)


async def test_disabled_returns_503(authenticated_client: AsyncClient, seeded_refs):
    response = await authenticated_client.post(
        "/api/v1/ai/parse-batch", json={"text": "кофе 350"}
    )
    assert response.status_code == 503


async def test_fact_and_plan_mix_validated(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_refs,
    monkeypatch,
):
    await enable_text(db_session, test_user.id)
    article = seeded_refs["article"]
    fc = seeded_refs["fc"]
    future = (date.today() + timedelta(days=20)).isoformat()
    mock_chat(
        monkeypatch,
        f'[{{"article_id": {article.id}, "amount": 350, '
        f'"fact_date": "{future}", "description": "кофе", '
        f'"financial_center_id": {fc.id}, "record_type": "fact", '
        '"confidence": 0.9},'
        f'{{"article_id": {article.id}, "amount": "900", '
        f'"fact_date": "{future}", "description": null, '
        '"financial_center_id": null, "record_type": "plan", '
        '"confidence": 0.4}]',
    )

    response = await authenticated_client.post(
        "/api/v1/ai/parse-batch",
        json={"text": "кофе 350, через 20 дней заплатить 900"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2

    fact, plan = data["items"]
    # A fact cannot live in the future: clamped to today with a warning.
    assert fact["record_type"] == "fact"
    assert fact["fact_date"] == date.today().isoformat()
    assert fact["warnings"]
    assert fact["confidence"] == "high"

    # A plan keeps its future date; missing account -> main one; string
    # amount coerced; low confidence flagged.
    assert plan["record_type"] == "plan"
    assert plan["fact_date"] == future
    assert plan["amount"] == 900
    assert plan["financial_center_id"] == fc.id
    assert plan["confidence"] == "low"
    assert any("Проверь категорию" in w for w in data["warnings"])


async def test_missing_amount_row_kept_empty(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_refs,
    monkeypatch,
):
    """A row without an amount survives with amount null, never invented."""
    await enable_text(db_session, test_user.id)
    article = seeded_refs["article"]
    fc = seeded_refs["fc"]
    mock_chat(
        monkeypatch,
        f'[{{"article_id": {article.id}, "amount": null, '
        f'"fact_date": "{date.today().isoformat()}", "description": "кофе", '
        f'"financial_center_id": {fc.id}, "record_type": "fact", '
        '"confidence": 0.9}]',
    )

    response = await authenticated_client.post(
        "/api/v1/ai/parse-batch", json={"text": "кофе счёт тбанк"}
    )
    assert response.status_code == 200
    item = response.json()["items"][0]
    assert item["amount"] is None
    assert any("Сумма не указана" in w for w in item["warnings"])


async def test_not_understood_returns_422(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_refs,
    monkeypatch,
):
    await enable_text(db_session, test_user.id)
    mock_chat(monkeypatch, '{"error": "not_understood"}')

    response = await authenticated_client.post(
        "/api/v1/ai/parse-batch", json={"text": "привет"}
    )
    assert response.status_code == 422


async def test_garbage_returns_422(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_refs,
    monkeypatch,
):
    await enable_text(db_session, test_user.id)
    mock_chat(monkeypatch, "I can not help with that")

    response = await authenticated_client.post(
        "/api/v1/ai/parse-batch", json={"text": "кофе 350"}
    )
    assert response.status_code == 422
