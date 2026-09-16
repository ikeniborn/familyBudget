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
from contextlib import asynccontextmanager
from datetime import date, timedelta

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.v1.endpoints import ai as ai_endpoint

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
        description="еда и супермаркеты",
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
    month_plan = BudgetFact(
        user_id=test_user.id, article_id=article.id,
        financial_center_id=fc.id, fact_date=today,
        amount=2000, record_type="plan",
    )
    db_session.add(inside)
    db_session.add(outside)
    db_session.add(month_plan)
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


def mock_chat_capture(monkeypatch, answers: list[str], calls: list[dict]) -> None:
    """Return the queued answers in order; record full call arguments."""

    async def fake_chat(self, model, messages, response_format=None, max_tokens=1024, temperature=0.1):
        calls.append({"messages": messages, "response_format": response_format})
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


async def test_scope_prompt_grounding(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """The scope call carries category descriptions and requests JSON mode;
    the answer call instructs the model about truncation and empty data."""
    await enable_text(db_session, test_user.id)
    article = seeded_facts["article"]
    today = date.today()
    calls: list[dict] = []
    scope = json.dumps(
        {
            "period_start": today.replace(day=1).isoformat(),
            "period_end": today.isoformat(),
            "article_ids": [article.id],
            "record_type": "fact",
        }
    )
    mock_chat_capture(monkeypatch, [scope, "Ответ."], calls)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Сколько ушло на продукты?"},
    )
    assert response.status_code == 200
    assert len(calls) == 2

    scope_system = calls[0]["messages"][0]["content"]
    # The family's own category description reaches the scope prompt.
    assert "еда и супермаркеты" in scope_system
    assert calls[0]["response_format"] == {"type": "json_object"}

    answer_system = calls[1]["messages"][0]["content"]
    assert "categories_truncated" in answer_system
    assert "данных нет" in answer_system


async def test_history_returns_logged_exchange(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """A successful exchange is persisted and readable via the history
    endpoint (newest first, only the current user's rows)."""
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
        monkeypatch, [scope, "За месяц на продукты 1 200 ₽."], seen
    )
    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Какие затраты по продуктам?"},
    )
    assert response.status_code == 200

    history = await authenticated_client.get(
        "/api/v1/ai/analytics-chat/history"
    )
    assert history.status_code == 200
    items = history.json()["items"]
    assert len(items) == 1
    entry = items[0]
    assert entry["question"] == "Какие затраты по продуктам?"
    assert entry["answer"] == "За месяц на продукты 1 200 ₽."
    assert entry["status"] == "ok"
    assert entry["scope"]["expense_total"] == 1200
    assert entry["scope"]["period_start"] == start.isoformat()
    assert entry["created_at"]


async def test_compare_periods_intent(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """Comparison questions ground the answer in two backend aggregates."""
    await enable_text(db_session, test_user.id)
    today = date.today()
    prev_anchor = today - timedelta(days=90)
    prev_start = prev_anchor.replace(day=1)
    prev_end = (prev_start + timedelta(days=45)).replace(day=1) - timedelta(days=1)
    seen: list[str] = []
    scope = json.dumps(
        {
            "intent": "compare_periods",
            "period_start": today.replace(day=1).isoformat(),
            "period_end": today.isoformat(),
            "period2_start": prev_start.isoformat(),
            "period2_end": prev_end.isoformat(),
            "article_ids": None,
            "record_type": "fact",
        }
    )
    mock_chat_sequence(monkeypatch, [scope, "Сравнение готово."], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Потратили больше, чем три месяца назад?"},
    )
    assert response.status_code == 200
    data = response.json()
    # Badge carries the asked (current) period totals.
    assert data["expense_total"] == 1200
    assert data["period_start"] == today.replace(day=1).isoformat()

    payload = seen[1]
    assert '"intent": "compare_periods"' in payload
    assert '"expense_total": 1200' in payload
    assert '"expense_total": 5000' in payload
    assert '"change"' in payload


async def test_trend_monthly_intent(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """Trend questions ground the answer in a per-month series."""
    await enable_text(db_session, test_user.id)
    today = date.today()
    range_start = (today - timedelta(days=90)).replace(day=1)
    seen: list[str] = []
    scope = json.dumps(
        {
            "intent": "trend_monthly",
            "period_start": range_start.isoformat(),
            "period_end": today.isoformat(),
            "article_ids": None,
            "record_type": "fact",
        }
    )
    mock_chat_sequence(monkeypatch, [scope, "Динамика готова."], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Как менялись расходы по месяцам?"},
    )
    assert response.status_code == 200
    # Badge totals cover the whole asked range.
    assert response.json()["expense_total"] == 6200

    payload = seen[1]
    assert '"intent": "trend_monthly"' in payload
    assert '"months"' in payload
    assert f'"{today.strftime("%Y-%m")}"' in payload
    assert f'"{(today - timedelta(days=90)).strftime("%Y-%m")}"' in payload
    assert '"expense": 5000' in payload
    assert '"expense": 1200' in payload


async def test_plan_vs_fact_intent(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """Plan questions ground the answer in month-snapped plan and fact
    aggregates with per-category execution."""
    await enable_text(db_session, test_user.id)
    today = date.today()
    month_start = today.replace(day=1)
    seen: list[str] = []
    scope = json.dumps(
        {
            "intent": "plan_vs_fact",
            "period_start": month_start.isoformat(),
            "period_end": today.isoformat(),
            "article_ids": None,
            "record_type": "fact",
        }
    )
    mock_chat_sequence(monkeypatch, [scope, "Исполнение плана готово."], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Уложились ли в план по продуктам?"},
    )
    assert response.status_code == 200
    data = response.json()
    # Badge: fact totals; the period is snapped to full calendar months.
    assert data["expense_total"] == 1200
    next_month = (month_start + timedelta(days=45)).replace(day=1)
    assert data["period_end"] == (next_month - timedelta(days=1)).isoformat()

    payload = seen[1]
    assert '"intent": "plan_vs_fact"' in payload
    assert '"plan"' in payload and '"fact"' in payload
    assert '"expense_total": 2000' in payload
    assert '"expense_total": 1200' in payload
    assert '"execution_pct": 60' in payload
    assert '"fact_through"' in payload


async def test_unknown_intent_falls_back_to_totals(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    await enable_text(db_session, test_user.id)
    today = date.today()
    seen: list[str] = []
    scope = json.dumps(
        {
            "intent": "drop_table",
            "period_start": today.replace(day=1).isoformat(),
            "period_end": today.isoformat(),
            "article_ids": None,
            "record_type": "fact",
        }
    )
    mock_chat_sequence(monkeypatch, [scope, "Итоги готовы."], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat", json={"question": "Сколько потратили?"}
    )
    assert response.status_code == 200
    assert response.json()["expense_total"] == 1200
    assert '"intent": "totals"' in seen[1]


async def test_failed_exchange_is_logged(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """A scope-extraction failure is persisted with status parse_error.

    Production writes the failure row through get_session_context (the
    request transaction rolls back on the raised error); here that factory
    is redirected into the test session so the row stays visible inside
    the test transaction.
    """
    await enable_text(db_session, test_user.id)
    mock_chat_sequence(monkeypatch, ["cannot help with that"], [])

    @asynccontextmanager
    async def fake_session_context():
        yield db_session

    monkeypatch.setattr(ai_endpoint, "get_session_context", fake_session_context)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat", json={"question": "как дела?"}
    )
    assert response.status_code == 422

    history = await authenticated_client.get(
        "/api/v1/ai/analytics-chat/history"
    )
    assert history.status_code == 200
    items = history.json()["items"]
    assert len(items) == 1
    entry = items[0]
    assert entry["question"] == "как дела?"
    assert entry["status"] == "parse_error"
    assert entry["answer"] is None
    assert entry["scope"] is None
    assert entry["created_at"]


async def test_log_write_failure_never_masks_chat_error(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """A broken log store must not turn a 422 into a 500 — the failure
    logging is best-effort by contract."""
    await enable_text(db_session, test_user.id)
    mock_chat_sequence(monkeypatch, ["cannot help with that"], [])

    @asynccontextmanager
    async def broken_session_context():
        raise RuntimeError("log store down")
        yield  # pragma: no cover

    monkeypatch.setattr(ai_endpoint, "get_session_context", broken_session_context)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat", json={"question": "как дела?"}
    )
    assert response.status_code == 422


async def test_empty_scope_falls_back_for_year_trend(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """When the reasoning model returns an empty scope, a whole-year trend
    question is still answered via the deterministic fallback (was a 422)."""
    await enable_text(db_session, test_user.id)
    seen: list[str] = []
    # First call (scope) returns "" — the observed prod failure; second call
    # (answer) returns the prose answer over the backend-computed trend.
    mock_chat_sequence(monkeypatch, ["", "Динамика по месяцам готова."], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Динамика расходов по месяцам за последний год"},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["answer"].startswith("Динамика")
    # Rolling 12 months covers both facts (1200 today + 5000 at -90d).
    assert data["expense_total"] == 6200

    # The answer call received a trend_monthly aggregate, not a 422.
    assert len(seen) == 2
    assert '"intent": "trend_monthly"' in seen[1]
    assert '"months"' in seen[1]


async def test_empty_scope_still_422_for_non_budget_question(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """A non-budget question with an empty model scope must still 422 — the
    fallback must not fabricate a scope for 'как дела?'."""
    await enable_text(db_session, test_user.id)
    seen: list[str] = []
    mock_chat_sequence(monkeypatch, [""], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat", json={"question": "как дела?"}
    )
    assert response.status_code == 422


async def test_totals_data_labels_record_type_for_the_model(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """The aggregate handed to the answering model must carry record_type so
    the answer states whether the sums are actual (fact) or planned — without
    it users read fact and plan totals as one, appearing double-counted."""
    await enable_text(db_session, test_user.id)
    today = date.today()
    seen: list[str] = []
    scope = json.dumps(
        {
            "intent": "totals",
            "period_start": today.replace(day=1).isoformat(),
            "period_end": today.isoformat(),
            "article_ids": None,
            "record_type": "plan",
        }
    )
    mock_chat_sequence(monkeypatch, [scope, "Плановые расходы за месяц."], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Сколько запланировано на этот месяц?"},
    )
    assert response.status_code == 200
    payload = seen[1]
    assert '"record_type": "plan"' in payload
    # The plan fact (2000) is aggregated, not the actual ones.
    assert '"expense_total": 2000' in payload


async def test_compare_periods_data_labels_record_type(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """compare_periods data also carries record_type for the answer."""
    await enable_text(db_session, test_user.id)
    today = date.today()
    seen: list[str] = []
    scope = json.dumps(
        {
            "intent": "compare_periods",
            "period_start": today.replace(day=1).isoformat(),
            "period_end": today.isoformat(),
            "period2_start": (today - timedelta(days=90)).replace(day=1).isoformat(),
            "period2_end": today.replace(day=1).isoformat(),
            "article_ids": None,
            "record_type": "fact",
        }
    )
    mock_chat_sequence(monkeypatch, [scope, "Сравнение фактических расходов."], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Сравни расходы с прошлым периодом"},
    )
    assert response.status_code == 200
    assert '"record_type": "fact"' in seen[1]


async def test_totals_filters_by_financial_center(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """A question scoped to one account aggregates only that account's facts,
    not the whole budget (the «по счёту дом» prod complaint)."""
    await enable_text(db_session, test_user.id)
    article = seeded_facts["article"]
    default_fc = seeded_facts["fc"]
    today = date.today()

    # Second account with its own fact in the current month.
    other_fc = FinancialCenter(user_id=test_user.id, name="Дом", is_active=True)
    db_session.add(other_fc)
    await db_session.commit()
    await db_session.refresh(other_fc)
    db_session.add(
        BudgetFact(
            user_id=test_user.id, article_id=article.id,
            financial_center_id=other_fc.id, fact_date=today,
            amount=777, record_type="fact",
        )
    )
    await db_session.commit()
    llm_parse_service.invalidate_candidates_cache()

    seen: list[str] = []
    scope = json.dumps(
        {
            "intent": "totals",
            "period_start": today.replace(day=1).isoformat(),
            "period_end": today.isoformat(),
            "article_ids": None,
            "financial_center_id": other_fc.id,
            "record_type": "fact",
        }
    )
    mock_chat_sequence(monkeypatch, [scope, "Расходы по счёту Дом."], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Затраты по счёту Дом за этот месяц?"},
    )
    assert response.status_code == 200
    data = response.json()
    # Only the "Дом" account fact (777), NOT the default-account fact (1200).
    assert data["expense_total"] == 777


async def test_invalid_financial_center_falls_back_to_whole_budget(
    authenticated_client: AsyncClient,
    db_session: AsyncSession,
    test_user: User,
    seeded_facts,
    monkeypatch,
):
    """A hallucinated account id must not silently narrow to nothing — it is
    dropped and the whole budget is aggregated."""
    await enable_text(db_session, test_user.id)
    today = date.today()
    seen: list[str] = []
    scope = json.dumps(
        {
            "intent": "totals",
            "period_start": today.replace(day=1).isoformat(),
            "period_end": today.isoformat(),
            "article_ids": None,
            "financial_center_id": 999999,
            "record_type": "fact",
        }
    )
    mock_chat_sequence(monkeypatch, [scope, "Расходы за месяц."], seen)

    response = await authenticated_client.post(
        "/api/v1/ai/analytics-chat",
        json={"question": "Затраты за этот месяц?"},
    )
    assert response.status_code == 200
    # The default-account fact (1200) is aggregated, not zero.
    assert response.json()["expense_total"] == 1200
