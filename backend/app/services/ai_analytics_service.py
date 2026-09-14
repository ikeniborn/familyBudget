"""
AI analytics chat: a natural-language question -> an analytical answer
grounded in real budget aggregates (ai-analytics-chat).

Two-step pipeline, both read-only:

1. The text model extracts a structured scope from the question (period,
   optional category filter, record type) against the real article list.
2. The backend computes the aggregates itself (totals + per-article
   breakdown) — the LLM never queries the database and never sees raw
   transactions, only the aggregated numbers it must answer from.

An unanswerable question or a provider failure is an honest error; the
model is instructed to say when the data does not cover the question.
"""
import json
import logging
from datetime import date, timedelta
from typing import Any

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.ai_settings import AISettings
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.services.ai_provider_client import AIProviderClient
from backend.app.services.llm_parse_service import (
    AIParseError,
    _coerce_int,
    _extract_json,
    format_candidate_lines,
    get_article_candidates,
)

logger = logging.getLogger(__name__)

MAX_FILTER_ARTICLES = 20
BREAKDOWN_LIMIT = 15


def _build_extract_prompt(articles: list[dict[str, Any]], today: date) -> str:
    # format_candidate_lines carries the family's own category descriptions
    # and frequency markers — the semantic layer name matching alone lacks.
    article_lines = format_candidate_lines(articles)
    return (
        "Ты — разборщик аналитических вопросов о семейном бюджете. "
        "Определи, за какой период и по каким категориям пользователь "
        "спрашивает.\n"
        f"Сегодня: {today.isoformat()}.\n\n"
        f"Категории (id: путь [тип] — описание):\n{article_lines}\n\n"
        "Правила:\n"
        "- «текущий месяц» — с 1-го числа по сегодня; «прошлый месяц» — "
        "весь предыдущий календарный месяц; «за год» — с 1 января; период "
        "не назван — текущий месяц.\n"
        "- article_ids: id категорий, о которых спрашивают (включая "
        "подходящие по смыслу: «продукты» — категории про продукты и "
        "супермаркеты). Вопрос обо всём бюджете — null.\n"
        "- record_type: \"plan\" если спрашивают о планах, иначе \"fact\".\n\n"
        "Ответь ТОЛЬКО одним JSON-объектом, без пояснений и markdown:\n"
        "{\n"
        '  "period_start": "<YYYY-MM-DD>",\n'
        '  "period_end": "<YYYY-MM-DD>",\n'
        '  "article_ids": [<int>, ...] или null,\n'
        '  "record_type": "<fact или plan>"\n'
        "}\n"
        'Если вопрос не про данные бюджета, ответь: {"error": "not_understood"}'
    )


_ANSWER_SYSTEM_PROMPT = (
    "Ты — финансовый аналитик семейного бюджета. Отвечай на вопрос "
    "пользователя ТОЛЬКО по переданным агрегированным данным: не выдумывай "
    "цифры и категории, не делай предположений о данных, которых нет. "
    "Если данные не покрывают вопрос — скажи это прямо. "
    "Если итоги нулевые и список categories пуст — скажи прямо, что за "
    "этот период данных нет; ничего не оценивай и не предполагай. "
    "Если categories_truncated: true — перечислены только крупнейшие "
    "категории; обязательно скажи, что показаны топ-категории и что "
    "сумма перечисленного может быть меньше итога. "
    "Отвечай на русском, кратко и структурно: сначала главная "
    "цифра/вывод, затем детализация по категориям, если уместна. Суммы — "
    "в рублях, с разделителями тысяч (например 12 350 ₽). Проценты "
    "округляй до целых."
)


async def _aggregate(
    session: AsyncSession,
    period_start: date,
    period_end: date,
    article_ids: list[int] | None,
    record_type: str,
) -> dict[str, Any]:
    """Totals + per-article sums for the scope; the only data the LLM sees."""
    query = (
        select(
            Article.id,
            Article.name,
            Article.type,
            func.sum(BudgetFact.amount).label("total"),
            func.count().label("tx_count"),
        )
        .select_from(BudgetFact)
        .join(Article, BudgetFact.article_id == Article.id)
        .where(
            BudgetFact.fact_date >= period_start,
            BudgetFact.fact_date <= period_end,
            BudgetFact.record_type == record_type,
        )
        .group_by(Article.id, Article.name, Article.type)
    )
    if article_ids:
        query = query.where(Article.id.in_(article_ids))
    rows = (await session.execute(query)).all()

    articles = await get_article_candidates(session)
    paths_by_id = {a["id"]: a["path"] for a in articles}

    expense_total = 0.0
    income_total = 0.0
    breakdown: list[dict[str, Any]] = []
    for row in rows:
        total = float(row.total or 0)
        if row.type == "expense":
            expense_total += total
        elif row.type == "income":
            income_total += total
        breakdown.append(
            {
                "category": paths_by_id.get(row.id, row.name),
                "type": row.type,
                "total": round(total, 2),
                "transactions": row.tx_count,
            }
        )
    breakdown.sort(key=lambda b: b["total"], reverse=True)

    return {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "record_type": record_type,
        "category_filter": (
            [paths_by_id.get(a, str(a)) for a in article_ids] if article_ids else None
        ),
        "expense_total": round(expense_total, 2),
        "income_total": round(income_total, 2),
        "categories": breakdown[:BREAKDOWN_LIMIT],
        "categories_truncated": len(breakdown) > BREAKDOWN_LIMIT,
    }


async def answer_question(
    session: AsyncSession,
    settings: AISettings,
    question: str,
) -> dict[str, Any]:
    """Question -> {answer, period_start, period_end, ...aggregates}."""
    articles = await get_article_candidates(session)
    if not articles:
        raise AIParseError("No active articles")
    valid_ids = {a["id"] for a in articles}
    today = date.today()
    client = AIProviderClient(settings.endpoint_url, settings.api_token)

    # Step 1: question -> scope.
    scope_content = await client.chat_completions(
        model=settings.model_text or "",
        messages=[
            {"role": "system", "content": _build_extract_prompt(articles, today)},
            {"role": "user", "content": question},
        ],
        response_format={"type": "json_object"},
        max_tokens=1536,
    )
    try:
        scope = _extract_json(scope_content)
    except AIParseError:
        logger.warning(
            "AI analytics: non-JSON scope output (len=%d): %.200s",
            len(scope_content),
            scope_content,
        )
        raise
    if scope.get("error"):
        raise AIParseError("Model reported not_understood")

    def parse_scope_date(key: str, fallback: date) -> date:
        try:
            return date.fromisoformat(str(scope.get(key) or ""))
        except ValueError:
            return fallback

    period_start = parse_scope_date("period_start", today.replace(day=1))
    period_end = parse_scope_date("period_end", today)
    if period_end < period_start:
        period_start, period_end = period_end, period_start
    # Guard against runaway ranges the model may invent.
    if (period_end - period_start) > timedelta(days=1100):
        period_start = period_end - timedelta(days=1100)

    raw_ids = scope.get("article_ids")
    article_ids: list[int] | None = None
    if isinstance(raw_ids, list):
        article_ids = [
            coerced
            for a in raw_ids[:MAX_FILTER_ARTICLES]
            if (coerced := _coerce_int(a)) in valid_ids
        ] or None
    record_type = "plan" if scope.get("record_type") == "plan" else "fact"

    # Step 2: aggregates computed by the backend, never by the model.
    data = await _aggregate(session, period_start, period_end, article_ids, record_type)

    # Step 3: grounded answer.
    answer = await client.chat_completions(
        model=settings.model_text or "",
        messages=[
            {"role": "system", "content": _ANSWER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": (
                    f"Данные:\n{json.dumps(data, ensure_ascii=False)}\n\n"
                    f"Вопрос: {question}"
                ),
            },
        ],
        max_tokens=2048,
    )
    answer = answer.strip()
    if not answer:
        raise AIParseError("Model returned an empty answer")

    return {
        "answer": answer,
        "period_start": data["period_start"],
        "period_end": data["period_end"],
        "record_type": record_type,
        "expense_total": data["expense_total"],
        "income_total": data["income_total"],
    }
