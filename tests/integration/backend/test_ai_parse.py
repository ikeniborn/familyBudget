"""
Integration tests for POST /api/v1/ai/parse-transaction (phase 2).

The provider is mocked at AIProviderClient.chat_completions — no network.
Pins the contract from the intent:

1. Disabled AI (or missing text model) -> honest 503, no provider call.
2. Valid model JSON -> validated TransactionDraft mirroring FactCreate.
3. Model says not_understood / returns garbage -> honest 422, never a draft.
4. Confidence below the threshold -> "Проверь категорию" warning + low flag.
"""
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User
from backend.app.services import ai_settings_service, llm_parse_service
from backend.app.services.ai_provider_client import AIProviderClient

pytestmark = [pytest.mark.integration, pytest.mark.destructive]


@pytest_asyncio.fixture
async def seeded_refs(db_session: AsyncSession, test_user: User) -> dict:
    """One expense article + one financial center; parse caches reset."""
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()

    fc = FinancialCenter(user_id=test_user.id, name="Карта", is_active=True)
    db_session.add(fc)
    article = Article(
        user_id=test_user.id, parent_id=None, name="Кафе",
        type="expense", is_active=True,
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(fc)
    await db_session.refresh(article)
    yield {"fc": fc, "article": article}
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()


async def enable_ai(admin_client: AsyncClient) -> None:
    response = await admin_client.put(
        "/api/v1/ai/settings",
        json={"enabled": True, "model_text": "test-model", "confidence_threshold": 0.7},
    )
    assert response.status_code == 200


def mock_chat(monkeypatch, content: str) -> None:
    async def fake_chat(self, model, messages, response_format=None, max_tokens=1024, temperature=0.1):
        return content

    monkeypatch.setattr(AIProviderClient, "chat_completions", fake_chat)


async def test_status_reflects_settings(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
    seeded_refs,
):
    response = await authenticated_client.get("/api/v1/ai/status")
    assert response.status_code == 200
    assert response.json() == {
        "enabled": False, "text": False, "image": False, "voice": False,
    }

    await enable_ai(authenticated_admin_client)
    response = await authenticated_client.get("/api/v1/ai/status")
    data = response.json()
    assert data["enabled"] is True
    assert data["text"] is True
    assert data["voice"] is False


async def test_parse_disabled_returns_503(
    authenticated_client: AsyncClient, seeded_refs
):
    response = await authenticated_client.post(
        "/api/v1/ai/parse-transaction", json={"text": "кофе 350"}
    )
    assert response.status_code == 503


async def test_parse_happy_path(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
    seeded_refs,
    monkeypatch,
):
    await enable_ai(authenticated_admin_client)
    article_id = seeded_refs["article"].id
    fc_id = seeded_refs["fc"].id
    mock_chat(
        monkeypatch,
        f'{{"article_id": {article_id}, "amount": 350, "fact_date": "{date.today()}",'
        f' "description": "кофе", "financial_center_id": {fc_id}, "confidence": 0.95}}',
    )

    response = await authenticated_client.post(
        "/api/v1/ai/parse-transaction", json={"text": "кофе 350"}
    )
    assert response.status_code == 200
    draft = response.json()
    assert draft["article_id"] == article_id
    assert draft["article_path"] == "Кафе"
    assert draft["amount"] == 350
    assert draft["financial_center_id"] == fc_id
    assert draft["confidence"] == "high"
    assert draft["record_type"] == "fact"


async def test_parse_not_understood_is_422(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
    seeded_refs,
    monkeypatch,
):
    await enable_ai(authenticated_admin_client)
    mock_chat(monkeypatch, '{"error": "not_understood"}')

    response = await authenticated_client.post(
        "/api/v1/ai/parse-transaction", json={"text": "просто привет"}
    )
    assert response.status_code == 422


async def test_parse_garbage_json_is_422(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
    seeded_refs,
    monkeypatch,
):
    await enable_ai(authenticated_admin_client)
    mock_chat(monkeypatch, "конечно! вот ваша транзакция: кофе")

    response = await authenticated_client.post(
        "/api/v1/ai/parse-transaction", json={"text": "кофе 350"}
    )
    assert response.status_code == 422


async def test_parse_unknown_article_is_422(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
    seeded_refs,
    monkeypatch,
):
    await enable_ai(authenticated_admin_client)
    mock_chat(monkeypatch, '{"article_id": 999999, "amount": 100, "confidence": 0.9}')

    response = await authenticated_client.post(
        "/api/v1/ai/parse-transaction", json={"text": "что-то 100"}
    )
    assert response.status_code == 422


async def test_parse_low_confidence_flags_category(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
    seeded_refs,
    monkeypatch,
):
    await enable_ai(authenticated_admin_client)
    article_id = seeded_refs["article"].id
    mock_chat(
        monkeypatch,
        f'{{"article_id": {article_id}, "amount": 100, "confidence": 0.3}}',
    )

    response = await authenticated_client.post(
        "/api/v1/ai/parse-transaction", json={"text": "что-то 100"}
    )
    assert response.status_code == 200
    draft = response.json()
    assert draft["confidence"] == "low"
    assert "Проверь категорию" in draft["warnings"]


async def test_parse_future_date_clamped_to_today(
    authenticated_client: AsyncClient,
    authenticated_admin_client: AsyncClient,
    seeded_refs,
    monkeypatch,
):
    await enable_ai(authenticated_admin_client)
    article_id = seeded_refs["article"].id
    future = date.today() + timedelta(days=5)
    mock_chat(
        monkeypatch,
        f'{{"article_id": {article_id}, "amount": 100, "fact_date": "{future}", "confidence": 0.9}}',
    )

    response = await authenticated_client.post(
        "/api/v1/ai/parse-transaction", json={"text": "аванс 100"}
    )
    assert response.status_code == 200
    assert response.json()["fact_date"] == date.today().isoformat()
