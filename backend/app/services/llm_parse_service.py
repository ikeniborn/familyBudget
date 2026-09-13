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
from datetime import date
from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.ai_settings import AISettings
from backend.app.models.article import Article
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
    """Active articles as {id, path, type}, path built from parent chain."""
    global _articles_cache, _articles_cache_at
    if (
        _articles_cache is not None
        and (time.monotonic() - _articles_cache_at) < CANDIDATES_CACHE_TTL
    ):
        return _articles_cache

    rows = (
        await session.execute(
            select(Article.id, Article.name, Article.type, Article.parent_id).where(
                Article.is_active == True  # noqa: E712
            )
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

    _articles_cache = [
        {"id": row.id, "path": build_path(row.id), "type": row.type} for row in rows
    ]
    _articles_cache_at = time.monotonic()
    return _articles_cache


async def get_financial_centers(session: AsyncSession) -> list[dict[str, Any]]:
    rows = (
        await session.execute(
            select(FinancialCenter.id, FinancialCenter.name).where(
                FinancialCenter.is_active == True  # noqa: E712
            )
        )
    ).all()
    return [{"id": row.id, "name": row.name} for row in rows]


def _build_prompt(
    articles: list[dict[str, Any]],
    centers: list[dict[str, Any]],
    today: date,
) -> str:
    article_lines = "\n".join(
        f"{a['id']}: {a['path']} [{a['type']}]" for a in articles
    )
    center_lines = "\n".join(f"{c['id']}: {c['name']}" for c in centers)
    return (
        "Ты — парсер финансовых записей семейного бюджета. "
        "Разбери фразу пользователя (обычно на русском) в JSON-транзакцию.\n"
        f"Сегодня: {today.isoformat()}.\n\n"
        f"Категории (id: путь [тип]):\n{article_lines}\n\n"
        f"Счета (id: название):\n{center_lines}\n\n"
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
        max_tokens=512,
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
        if len(centers) == 1:
            fc_id = centers[0]["id"]
        else:
            warnings.append("Счёт не распознан — выберите вручную")

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
