"""
Unit tests for the deterministic scope fallback in ai_analytics_service.

The reasoning text model (qwen3 thinking) intermittently returns an empty
scope for the trend_monthly / whole-year class of questions (prod, 2026-09-16),
which previously produced a 422. _rule_based_scope() derives period + intent
from the question text so those questions still get answered.
"""
from datetime import date

import pytest

from backend.app.services.ai_analytics_service import _rule_based_scope

pytestmark = pytest.mark.unit

TODAY = date(2026, 9, 16)


def test_year_trend_question_resolves_to_trend_monthly():
    scope = _rule_based_scope("Динамика расходов по месяцам за последний год", TODAY)
    assert scope is not None
    assert scope["intent"] == "trend_monthly"
    # "последний год" -> trailing 12 months, inclusive of today.
    assert scope["period_start"] == "2025-09-16"
    assert scope["period_end"] == "2026-09-16"
    assert scope["record_type"] == "fact"


def test_calendar_year_resolves_from_january():
    scope = _rule_based_scope("Сколько потратили за год?", TODAY)
    assert scope is not None
    assert scope["period_start"] == "2026-01-01"
    assert scope["period_end"] == "2026-09-16"


def test_compare_keyword_resolves_to_compare_periods():
    scope = _rule_based_scope("Затраты на продукты в этом месяце. Сравни с прошлым.", TODAY)
    assert scope is not None
    assert scope["intent"] == "compare_periods"


def test_plan_keyword_resolves_to_plan_vs_fact():
    scope = _rule_based_scope("Уложились ли в план по продуктам в этом месяце?", TODAY)
    assert scope is not None
    assert scope["intent"] == "plan_vs_fact"


def test_previous_month_period():
    scope = _rule_based_scope("Сколько потратили в прошлом месяце?", TODAY)
    assert scope is not None
    assert scope["period_start"] == "2026-08-01"
    assert scope["period_end"] == "2026-08-31"


def test_default_period_is_current_month():
    scope = _rule_based_scope("Какие расходы?", TODAY)
    assert scope is not None
    assert scope["intent"] == "totals"
    assert scope["period_start"] == "2026-09-01"
    assert scope["period_end"] == "2026-09-16"


def test_non_budget_question_returns_none():
    # No period marker, no budget vocabulary -> the fallback must NOT guess.
    assert _rule_based_scope("как дела?", TODAY) is None
    assert _rule_based_scope("привет, что делаешь?", TODAY) is None


def test_article_ids_are_never_guessed():
    # Category matching needs the model's semantics; the fallback stays
    # budget-wide (null) rather than inventing filters.
    scope = _rule_based_scope("Динамика по месяцам за год", TODAY)
    assert scope is not None
    assert scope.get("article_ids") is None


def test_extract_prompt_lists_centers_and_cost_centers():
    from backend.app.services.ai_analytics_service import _build_extract_prompt

    articles = [{"id": 1, "path": "Продукты", "type": "expense", "description": "", "usage_count": 0}]
    centers = [{"id": 5, "name": "Дом", "description": "домашний счёт", "usage_count": 3}]
    cost_centers = [{"id": 9, "name": "Отпуск", "description": "поездка", "usage_count": 1}]
    prompt = _build_extract_prompt(articles, centers, cost_centers, TODAY)

    assert "Счета (id:" in prompt
    assert "5: Дом" in prompt
    assert "Места затрат (id:" in prompt
    assert "9: Отпуск" in prompt
    assert '"financial_center_id"' in prompt
    assert '"cost_center_id"' in prompt


def test_extract_prompt_omits_empty_center_blocks():
    from backend.app.services.ai_analytics_service import _build_extract_prompt

    articles = [{"id": 1, "path": "Продукты", "type": "expense", "description": "", "usage_count": 0}]
    prompt = _build_extract_prompt(articles, [], [], TODAY)
    assert "Счета (id:" not in prompt
    assert "Места затрат (id:" not in prompt
