"""
Tests for POST /api/v1/ai/parse-list (ai-assist-plan-lists).

Provider mocked at AIProviderClient.chat_completions — no network. Pins:

1. Disabled AI -> honest 503, no provider call.
2. Valid model JSON array -> validated ListDraft with real group mapping.
3. Invented group_id -> null group + low confidence (manual choice).
4. not_understood / garbage -> honest 422, never a draft.
5. Units outside the allowed set and string numbers are normalized.
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.product_group import ProductGroup
from backend.app.models.store import Store
from backend.app.models.user import User
from backend.app.schemas.ai import AISettingsUpdate
from backend.app.services import ai_settings_service
from backend.app.services.ai_provider_client import AIProviderClient

pytestmark = [pytest.mark.integration, pytest.mark.destructive]


@pytest_asyncio.fixture
async def seeded_groups(db_session: AsyncSession, test_user: User) -> dict:
    ai_settings_service.invalidate_cache()

    root = ProductGroup(creator_id=test_user.id, name="Продукты", is_active=True)
    db_session.add(root)
    await db_session.commit()
    await db_session.refresh(root)
    child = ProductGroup(
        creator_id=test_user.id, name="Молочные", parent_id=root.id, is_active=True
    )
    store = Store(creator_id=test_user.id, name="Пятёрочка", is_active=True)
    db_session.add(child)
    db_session.add(store)
    await db_session.commit()
    await db_session.refresh(child)
    await db_session.refresh(store)
    yield {"root": root, "child": child, "store": store}
    ai_settings_service.invalidate_cache()


async def enable_text(db_session: AsyncSession, user_id: int) -> None:
    """Enable AI via the service directly (shared cookie-jar fixture trap)."""
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


async def test_disabled_returns_503(
    authenticated_client: AsyncClient, seeded_groups
):
    response = await authenticated_client.post(
        "/api/v1/ai/parse-list", json={"text": "молоко, хлеб"}
    )
    assert response.status_code == 503


async def test_valid_answer_maps_groups(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_groups,
    monkeypatch,
):
    await enable_text(db_session, test_user.id)
    child = seeded_groups["child"]
    store = seeded_groups["store"]
    mock_chat(
        monkeypatch,
        '[{"name": "Молоко", "quantity": "2", "unit": "л", '
        f'"group_id": {child.id}, "store_id": {store.id}, "confidence": 0.9}},'
        '{"name": "Хлеб", "quantity": null, "unit": "буханка", '
        '"group_id": 99999, "store_id": 88888, "confidence": 0.9}]',
    )

    response = await authenticated_client.post(
        "/api/v1/ai/parse-list", json={"text": "молоко 2 л и хлеб из пятёрочки"}
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data["items"]) == 2

    milk = data["items"][0]
    assert milk["product_name"] == "Молоко"
    assert milk["quantity"] == 2  # string number coerced
    assert milk["unit"] == "л"
    assert milk["product_group_id"] == child.id
    assert milk["product_group_path"] == "Продукты > Молочные"
    # Store mention mapped onto the real dictionary row.
    assert milk["store_id"] == store.id
    assert milk["store_name"] == "Пятёрочка"
    assert milk["confidence"] == "high"

    bread = data["items"][1]
    # Invented group/store ids -> null for manual choice, low confidence flag.
    assert bread["product_group_id"] is None
    assert bread["store_id"] is None
    assert bread["confidence"] == "low"
    assert bread["unit"] is None  # "буханка" is outside the allowed set
    assert data["warnings"]  # low-confidence warning present


async def test_not_understood_returns_422(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_groups,
    monkeypatch,
):
    await enable_text(db_session, test_user.id)
    mock_chat(monkeypatch, '{"error": "not_understood"}')

    response = await authenticated_client.post(
        "/api/v1/ai/parse-list", json={"text": "привет как дела"}
    )
    assert response.status_code == 422


async def test_garbage_returns_422(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_groups,
    monkeypatch,
):
    await enable_text(db_session, test_user.id)
    mock_chat(monkeypatch, "sorry, I can not help with that")

    response = await authenticated_client.post(
        "/api/v1/ai/parse-list", json={"text": "молоко"}
    )
    assert response.status_code == 422
