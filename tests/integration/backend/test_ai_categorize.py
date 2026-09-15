"""
Tests for POST /api/v1/ai/categorize-import (phase 4).

Provider mocked; verifies the endpoint is read-only (staging untouched),
suggestions are validated against real articles, and confidence maps to
high/low against the configured threshold.
"""
import json
from datetime import date

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.models.article import Article
from backend.app.models.import_staging import ImportStaging
from backend.app.models.user import User
from backend.app.schemas.ai import AISettingsUpdate
from backend.app.services import ai_settings_service, llm_parse_service
from backend.app.services.ai_provider_client import AIProviderClient

pytestmark = [pytest.mark.integration, pytest.mark.destructive]


@pytest_asyncio.fixture
async def staging_rows(db_session: AsyncSession, test_user: User) -> dict:
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()

    article = Article(
        user_id=test_user.id, parent_id=None, name="Продукты",
        type="expense", is_active=True,
    )
    db_session.add(article)
    rows = [
        ImportStaging(
            user_id=test_user.id,
            fact_date=date(2026, 9, 1),
            amount_string="350.00",
            description=text,
            csv_metadata={"category": csv_category} if csv_category else None,
        )
        for text, csv_category in (
            ("PYATEROCHKA 1234", "Супермаркеты"),
            ("UNKNOWN MERCHANT", None),
        )
    ]
    for row in rows:
        db_session.add(row)
    await db_session.commit()
    await db_session.refresh(article)
    for row in rows:
        await db_session.refresh(row)
    yield {"article": article, "rows": rows}
    llm_parse_service.invalidate_candidates_cache()
    ai_settings_service.invalidate_cache()


async def enable_text(db_session: AsyncSession, user_id: int) -> None:
    """Enable AI via the service directly.

    Note: authenticated_client and authenticated_admin_client share one
    underlying client object (one cookie jar), so requesting both fixtures
    would silently turn "user" requests into admin ones — and the staging
    query is user-scoped.
    """
    await ai_settings_service.update_settings(
        db_session,
        AISettingsUpdate(enabled=True, model_text="test-model", confidence_threshold=0.7),
        updated_by=user_id,
    )
    await db_session.commit()


async def test_categorize_disabled_returns_503(
    authenticated_client: AsyncClient, staging_rows
):
    response = await authenticated_client.post(
        "/api/v1/ai/categorize-import", json={"staging_ids": None}
    )
    assert response.status_code == 503


async def test_categorize_returns_validated_suggestions(
    authenticated_client: AsyncClient,
    staging_rows,
    monkeypatch,
    db_session: AsyncSession,
    test_user: User,
):
    await enable_text(db_session, test_user.id)
    article_id = staging_rows["article"].id
    row_high, row_low = staging_rows["rows"]
    seen_user_payloads: list[str] = []

    async def fake_chat(self, model, messages, response_format=None, max_tokens=1024, temperature=0.1):
        seen_user_payloads.append(messages[-1]["content"])
        return json.dumps(
            [
                {"id": row_high.id, "article_id": article_id, "confidence": 0.95},
                {"id": row_low.id, "article_id": article_id, "confidence": 0.2},
                {"id": 999999, "article_id": article_id, "confidence": 0.9},
                {"id": row_high.id, "article_id": 424242, "confidence": 0.9},
            ]
        )

    monkeypatch.setattr(AIProviderClient, "chat_completions", fake_chat)

    response = await authenticated_client.post(
        "/api/v1/ai/categorize-import", json={"staging_ids": None}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["processed"] == 2
    by_id = {s["staging_id"]: s for s in data["suggestions"]}
    assert by_id[row_high.id]["confidence"] == "high"
    assert by_id[row_low.id]["confidence"] == "low"
    assert by_id[row_high.id]["article_path"] == "Продукты"
    # Unknown staging id and unknown article id are dropped, not invented.
    assert set(by_id) == {row_high.id, row_low.id}

    # The bank's own CSV category reaches the model as an explicit signal.
    payload = "".join(seen_user_payloads)
    assert "категория банка: Супермаркеты" in payload
    assert "PYATEROCHKA 1234" in payload

    # Endpoint is read-only: staging rows keep article_id = NULL.
    refreshed = (
        await db_session.execute(
            select(ImportStaging).where(
                ImportStaging.id.in_([row_high.id, row_low.id])
            )
        )
    ).scalars().all()
    assert all(row.article_id is None for row in refreshed)
