"""
LLM parsing service: free text -> transaction draft (FactCreate-shaped).

Builds the candidate lists (article hierarchy paths, financial centers),
prompts the configured text model for strict JSON, validates the answer
against the real dictionaries, and returns a draft the user must confirm.
An unparseable or invalid answer is an honest AIParseError ("не понял"),
never a silently wrong draft. The LLM never writes to the database.

Shared by phase 2 (single text/voice input) and phase 4 (import
categorization batches).
"""
import json
import logging
import time
from datetime import date, timedelta
from typing import Any

from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.ai_settings import AISettings
from backend.app.models.article import Article, ArticleUsageStats
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.schemas.ai import TransactionDraft
from backend.app.services.ai_provider_client import AIProviderClient

logger = logging.getLogger(__name__)

CANDIDATES_CACHE_TTL = 300  # article paths change rarely

_articles_cache: list[dict[str, Any]] | None = None
_articles_cache_at: float = 0.0


class AIParseError(Exception):
    """The model could not produce a valid draft from the input text."""


def invalidate_candidates_cache() -> None:
    global _articles_cache, _articles_cache_at
    _articles_cache = None
    _articles_cache_at = 0.0


async def get_article_candidates(session: AsyncSession) -> list[dict[str, Any]]:
    """Active articles as {id, path, type, description, usage_count}.

    Description carries the family's own semantics for the category, and
    usage_count (daily-precomputed t_article_usage_stats) orders candidates
    so the model sees the frequently used ones first.
    """
    global _articles_cache, _articles_cache_at
    if (
        _articles_cache is not None
        and (time.monotonic() - _articles_cache_at) < CANDIDATES_CACHE_TTL
    ):
        return _articles_cache

    rows = (
        await session.execute(
            select(
                Article.id,
                Article.name,
                Article.type,
                Article.parent_id,
                Article.description,
                func.coalesce(ArticleUsageStats.usage_count, 0).label("usage_count"),
            )
            .outerjoin(ArticleUsageStats, Article.id == ArticleUsageStats.article_id)
            .where(Article.is_active == True)  # noqa: E712
        )
    ).all()
    by_id = {row.id: row for row in rows}

    def build_path(article_id: int) -> str:
        parts: list[str] = []
        current = by_id.get(article_id)
        # Depth guard against accidental cycles in parent links.
        for _ in range(20):
            if current is None:
                break
            parts.append(current.name)
            current = by_id.get(current.parent_id) if current.parent_id else None
        return " > ".join(reversed(parts))

    candidates = [
        {
            "id": row.id,
            "path": build_path(row.id),
            "type": row.type,
            "description": (row.description or "").strip(),
            "usage_count": row.usage_count,
        }
        for row in rows
    ]
    candidates.sort(key=lambda c: c["usage_count"], reverse=True)
    _articles_cache = candidates
    _articles_cache_at = time.monotonic()
    return _articles_cache


def format_candidate_lines(articles: list[dict[str, Any]]) -> str:
    """One prompt line per category: id, full path, type, own description,
    and a frequency marker for commonly used ones."""
    lines = []
    for a in articles:
        line = f"{a['id']}: {a['path']} [{a['type']}]"
        if a.get("description"):
            line += f" — {a['description']}"
        if a.get("usage_count", 0) >= 10:
            line += " (часто используется)"
        lines.append(line)
    return "\n".join(lines)


async def get_financial_centers(session: AsyncSession) -> list[dict[str, Any]]:
    """Active accounts ordered by 90-day usage; first one is the default
    when the phrase names no account."""
    usage = (
        select(
            BudgetFact.financial_center_id.label("fc_id"),
            func.count().label("cnt"),
        )
        .where(BudgetFact.fact_date >= date.today() - timedelta(days=90))
        .group_by(BudgetFact.financial_center_id)
        .subquery()
    )
    rows = (
        await session.execute(
            select(
                FinancialCenter.id,
                FinancialCenter.name,
                FinancialCenter.description,
                func.coalesce(usage.c.cnt, 0).label("usage_count"),
            )
            .outerjoin(usage, usage.c.fc_id == FinancialCenter.id)
            .where(FinancialCenter.is_active == True)  # noqa: E712
            .order_by(func.coalesce(usage.c.cnt, 0).desc())
        )
    ).all()
    return [
        {
            "id": row.id,
            "name": row.name,
            "description": (row.description or "").strip(),
            "usage_count": row.usage_count,
        }
        for row in rows
    ]


def _build_prompt(
    articles: list[dict[str, Any]],
    centers: list[dict[str, Any]],
    today: date,
) -> str:
    article_lines = format_candidate_lines(articles)
    center_lines = "\n".join(
        f"{c['id']}: {c['name']}"
        + (f" — {c['description']}" if c.get("description") else "")
        + (" (основной)" if i == 0 else "")
        for i, c in enumerate(centers)
    )
    return (
        "Ты — парсер финансовых записей семейного бюджета. "
        "Разбери фразу пользователя (обычно на русском) в JSON-транзакцию.\n"
        f"Сегодня: {today.isoformat()}.\n\n"
        f"Категории (id: путь [тип] — описание):\n{article_lines}\n\n"
        f"Счета (id: название — описание):\n{center_lines}\n\n"
        "Правила выбора категории:\n"
        "- Выбирай по СМЫСЛУ покупки (что именно куплено/получено), а не по "
        "поверхностному совпадению букв в названии категории.\n"
        "- Примеры смысла: кофе, капучино, обед, бизнес-ланч — еда вне дома / "
        "кафе; аспирин, лекарства, витамины — аптека/здоровье; бензин, АЗС — "
        "транспорт/авто; зарплата, аванс — доход.\n"
        "- Путь категории читай целиком (родитель > потомок) и предпочитай "
        "наиболее специфичную подходящую категорию.\n"
        "- Пометка «(часто используется)» — подсказка о типичных категориях "
        "этой семьи, при прочих равных предпочитай их.\n"
        "- Если уверенности в категории нет, всё равно выбери ближайшую по "
        "смыслу, но укажи низкий confidence (< 0.5).\n"
        "- Счёт: если в фразе счёт не назван (карта, наличные и т.п.) — "
        "выбери счёт с пометкой (основной).\n\n"
        "Ответь ТОЛЬКО одним JSON-объектом без пояснений и без markdown:\n"
        "{\n"
        '  "article_id": <int, id категории из списка>,\n'
        '  "amount": <int, сумма в рублях, > 0>,\n'
        '  "fact_date": "<YYYY-MM-DD, дата операции; сегодня, если не указана>",\n'
        '  "description": "<краткое описание или null>",\n'
        '  "financial_center_id": <int, id счёта из списка, или null если не понятно>,\n'
        '  "confidence": <float 0..1, уверенность в выборе категории>\n'
        "}\n"
        'Если фраза не описывает транзакцию или сумма не ясна, ответь: {"error": "not_understood"}'
    )


def _extract_json(content: str) -> dict[str, Any]:
    """Parse the model answer; tolerate a fenced code block around the JSON."""
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AIParseError("Model returned non-JSON output") from exc
    if not isinstance(payload, dict):
        raise AIParseError("Model returned non-object JSON")
    return payload


CATEGORIZE_CHUNK_SIZE = 20


def _build_categorize_prompt(articles: list[dict[str, Any]]) -> str:
    article_lines = format_candidate_lines(articles)
    return (
        "Ты — классификатор банковских операций семейного бюджета. "
        "Для каждой строки подбери категорию из списка.\n\n"
        f"Категории (id: путь [тип] — описание):\n{article_lines}\n\n"
        "Правила: выбирай по смыслу покупки (название магазина/мерчанта "
        "подсказывает, что куплено: PYATEROCHKA/MAGNIT — продукты, APTEKA — "
        "аптека, AZS/LUKOIL — топливо, кафе/рестораны — еда вне дома); "
        "пометка «(часто используется)» — типичные категории этой семьи; "
        "не уверен — ставь ближайшую по смыслу с confidence < 0.5, "
        "совсем не понятно — article_id: null.\n\n"
        "На вход подаётся JSON-массив строк вида {\"id\": ..., \"text\": ...}. "
        "Ответь ТОЛЬКО JSON-массивом без пояснений и без markdown:\n"
        '[{"id": <id строки>, "article_id": <int id категории или null>, '
        '"confidence": <float 0..1>}]'
    )


async def categorize_texts(
    session: AsyncSession,
    settings: AISettings,
    rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Suggest an article for each {id, text} row; invalid answers -> skipped.

    Returns [{id, article_id, article_path, confidence_value}] for rows the
    model matched to a real article; unmatched rows are simply absent.
    """
    articles = await get_article_candidates(session)
    if not articles or not rows:
        return []
    articles_by_id = {a["id"]: a for a in articles}
    prompt = _build_categorize_prompt(articles)
    client = AIProviderClient(settings.endpoint_url, settings.api_token)

    suggestions: list[dict[str, Any]] = []
    for start in range(0, len(rows), CATEGORIZE_CHUNK_SIZE):
        chunk = rows[start : start + CATEGORIZE_CHUNK_SIZE]
        content = await client.chat_completions(
            model=settings.model_text or "",
            messages=[
                {"role": "system", "content": prompt},
                {"role": "user", "content": json.dumps(chunk, ensure_ascii=False)},
            ],
            max_tokens=2048,
        )
        try:
            payload = _extract_json_array(content)
        except AIParseError:
            logger.warning("Categorize chunk returned unparseable output; skipped")
            continue

        chunk_ids = {row["id"] for row in chunk}
        for item in payload:
            if not isinstance(item, dict):
                continue
            row_id = item.get("id")
            article = articles_by_id.get(item.get("article_id"))
            if row_id not in chunk_ids or article is None:
                continue
            raw_confidence = item.get("confidence")
            confidence_value = (
                float(raw_confidence)
                if isinstance(raw_confidence, (int, float))
                and not isinstance(raw_confidence, bool)
                else 0.0
            )
            suggestions.append(
                {
                    "id": row_id,
                    "article_id": article["id"],
                    "article_path": article["path"],
                    "confidence_value": confidence_value,
                }
            )
    return suggestions


def _extract_json_array(content: str) -> list[Any]:
    text = content.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if text.startswith("json"):
            text = text[4:]
        text = text.strip()
    try:
        payload = json.loads(text)
    except json.JSONDecodeError as exc:
        raise AIParseError("Model returned non-JSON output") from exc
    if not isinstance(payload, list):
        raise AIParseError("Model returned non-array JSON")
    return payload


async def parse_transaction_text(
    session: AsyncSession,
    settings: AISettings,
    text: str,
) -> TransactionDraft:
    """Parse one free-text phrase into a validated TransactionDraft."""
    articles = await get_article_candidates(session)
    centers = await get_financial_centers(session)
    if not articles or not centers:
        raise AIParseError("No active articles or financial centers to match against")

    today = date.today()
    client = AIProviderClient(settings.endpoint_url, settings.api_token)
    content = await client.chat_completions(
        model=settings.model_text or "",
        messages=[
            {"role": "system", "content": _build_prompt(articles, centers, today)},
            {"role": "user", "content": text},
        ],
        # Reasoning models think before answering; leave room for the JSON.
        max_tokens=1536,
    )

    payload = _extract_json(content)
    if payload.get("error"):
        raise AIParseError("Model reported not_understood")

    articles_by_id = {a["id"]: a for a in articles}
    centers_by_id = {c["id"]: c for c in centers}

    article = articles_by_id.get(payload.get("article_id"))
    if article is None:
        raise AIParseError(f"Unknown article_id: {payload.get('article_id')!r}")

    amount = payload.get("amount")
    if not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
        raise AIParseError(f"Invalid amount: {amount!r}")

    try:
        fact_date = date.fromisoformat(str(payload.get("fact_date") or today))
    except ValueError as exc:
        raise AIParseError(f"Invalid fact_date: {payload.get('fact_date')!r}") from exc
    warnings: list[str] = []
    if fact_date > today:
        fact_date = today
        warnings.append("Дата была в будущем — заменена на сегодня")

    fc_id = payload.get("financial_center_id")
    if fc_id is not None and fc_id not in centers_by_id:
        fc_id = None
    if fc_id is None:
        # Centers are ordered by 90-day usage: fall back to the family's
        # main account instead of leaving the form blocked (categories are
        # filtered by account), and say so honestly.
        fc_id = centers[0]["id"]
        if len(centers) > 1:
            warnings.append(
                f"Счёт не назван — подставлен основной ({centers[0]['name']}), проверьте"
            )

    raw_confidence = payload.get("confidence")
    confidence_value = (
        float(raw_confidence)
        if isinstance(raw_confidence, (int, float)) and not isinstance(raw_confidence, bool)
        else 0.0
    )
    confidence = (
        "high" if confidence_value >= settings.confidence_threshold else "low"
    )
    if confidence == "low":
        warnings.append("Проверь категорию")

    description = payload.get("description")
    if description is not None:
        description = str(description).strip()[:1000] or None

    return TransactionDraft(
        article_id=article["id"],
        article_path=article["path"],
        article_type=article["type"],
        amount=amount,
        fact_date=fact_date,
        description=description,
        financial_center_id=fc_id,
        financial_center_name=centers_by_id[fc_id]["name"] if fc_id else None,
        record_type="fact",
        confidence=confidence,
        warnings=warnings,
    )
