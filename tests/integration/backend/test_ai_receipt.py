"""
Tests for POST /api/v1/ai/parse-receipt (phase 5).

Provider mocked; verifies item validation against real articles (invented
article ids become null), honest 422 on non-receipts and bad uploads, and
that the endpoint never writes anything.
"""
import base64
import json

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.article import Article
from backend.app.models.user import User
from backend.app.schemas.ai import AISettingsUpdate
from backend.app.services import ai_settings_service, llm_parse_service
from backend.app.services.ai_provider_client import AIProviderClient

pytestmark = [pytest.mark.integration, pytest.mark.destructive]

PNG_1PX = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk"
    "YPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)


@pytest_asyncio.fixture
async def food_article(db_session: AsyncSession, test_user: User) -> Article:
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()
    article = Article(
        user_id=test_user.id, parent_id=None, name="Продукты",
        type="expense", is_active=True,
    )
    db_session.add(article)
    await db_session.commit()
    await db_session.refresh(article)
    yield article
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()


async def enable_image(db_session: AsyncSession, user_id: int) -> None:
    await ai_settings_service.update_settings(
        db_session,
        AISettingsUpdate(enabled=True, model_image="qwen-vl", confidence_threshold=0.7),
        updated_by=user_id,
    )
    await db_session.commit()


def mock_chat(monkeypatch, content: str) -> None:
    async def fake_chat(self, model, messages, response_format=None, max_tokens=1024, temperature=0.1):
        return content

    monkeypatch.setattr(AIProviderClient, "chat_completions", fake_chat)


def upload(png: bytes = PNG_1PX, mime: str = "image/png"):
    return {"file": ("receipt.png", png, mime)}


async def test_receipt_disabled_returns_503(
    authenticated_client: AsyncClient, food_article
):
    response = await authenticated_client.post(
        "/api/v1/ai/parse-receipt", files=upload()
    )
    assert response.status_code == 503


async def test_receipt_happy_path_validates_items(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    food_article,
    monkeypatch,
):
    await enable_image(db_session, test_user.id)
    mock_chat(
        monkeypatch,
        json.dumps(
            {
                "store": "Пятёрочка",
                "receipt_date": "2026-09-10",
                "items": [
                    {"name": "Молоко", "amount": 89,
                     "article_id": food_article.id, "confidence": 0.9},
                    {"name": "Хлеб", "amount": 45,
                     "article_id": 424242, "confidence": 0.9},
                    {"name": "", "amount": 10, "article_id": None, "confidence": 0.5},
                    {"name": "Отрицательное", "amount": -5,
                     "article_id": None, "confidence": 0.5},
                ],
            },
            ensure_ascii=False,
        ),
    )

    response = await authenticated_client.post(
        "/api/v1/ai/parse-receipt", files=upload()
    )
    assert response.status_code == 200
    draft = response.json()
    assert draft["store"] == "Пятёрочка"
    assert draft["receipt_date"] == "2026-09-10"
    # Blank name and non-positive amount dropped; invented article -> null.
    assert len(draft["items"]) == 2
    assert draft["items"][0]["article_id"] == food_article.id
    assert draft["items"][0]["confidence"] == "high"
    assert draft["items"][1]["article_id"] is None
    assert draft["items"][1]["confidence"] == "low"
    assert draft["total"] == 89 + 45


async def test_receipt_not_a_receipt_is_422(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    food_article,
    monkeypatch,
):
    await enable_image(db_session, test_user.id)
    mock_chat(monkeypatch, '{"error": "not_a_receipt"}')

    response = await authenticated_client.post(
        "/api/v1/ai/parse-receipt", files=upload()
    )
    assert response.status_code == 422


async def test_receipt_bad_mime_is_422(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    food_article,
):
    await enable_image(db_session, test_user.id)
    response = await authenticated_client.post(
        "/api/v1/ai/parse-receipt",
        files={"file": ("doc.pdf", b"%PDF-", "application/pdf")},
    )
    assert response.status_code == 422
