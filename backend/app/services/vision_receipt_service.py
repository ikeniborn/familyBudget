"""
Vision receipt service: receipt photo -> itemized expense draft (VLM).

One chat call to the configured image model extracts line items and matches
each to a budget article from the same candidate list the text parser uses.
The answer is validated against real dictionaries; items whose article the
model invented keep article_id=null for manual choice. Nothing is written —
the client creates facts through the normal POST /facts after the user
edits and confirms the table. Images are processed in memory and discarded.
"""
import base64
import json
import logging
from datetime import date
from typing import Any

from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.ai_settings import AISettings
from backend.app.schemas.ai import ReceiptDraft, ReceiptItemDraft
from backend.app.services.ai_provider_client import AIProviderClient
from backend.app.services.llm_parse_service import (
    AIParseError,
    get_article_candidates,
)

logger = logging.getLogger(__name__)

MAX_IMAGE_BYTES = 10 * 1024 * 1024
ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp"}
MAX_ITEMS = 100


def _build_prompt(articles: list[dict[str, Any]], today: date) -> str:
    article_lines = "\n".join(
        f"{a['id']}: {a['path']} [{a['type']}]" for a in articles
    )
    return (
        "Ты — распознаватель кассовых чеков для семейного бюджета. "
        "Извлеки позиции чека и подбери каждой категорию из списка.\n"
        f"Сегодня: {today.isoformat()}.\n\n"
        f"Категории (id: путь [тип]):\n{article_lines}\n\n"
        "Ответь ТОЛЬКО одним JSON-объектом без пояснений и без markdown:\n"
        "{\n"
        '  "store": "<название магазина или null>",\n'
        '  "receipt_date": "<YYYY-MM-DD или null, если не видно>",\n'
        '  "items": [\n'
        '    {"name": "<название позиции>", "amount": <int, рубли, округляй>, '
        '"article_id": <int id категории или null>, "confidence": <float 0..1>}\n'
        "  ]\n"
        "}\n"
        'Если на фото не чек, ответь: {"error": "not_a_receipt"}'
    )


def _extract_json(content: str) -> dict[str, Any]:
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


async def parse_receipt(
    session: AsyncSession,
    settings: AISettings,
    image_bytes: bytes,
    mime_type: str,
) -> ReceiptDraft:
    """Extract an editable expense draft from one receipt photo."""
    if not image_bytes:
        raise AIParseError("Empty image")
    if len(image_bytes) > MAX_IMAGE_BYTES:
        raise AIParseError("Фото слишком большое (лимит 10 МБ)")
    if mime_type not in ALLOWED_MIME:
        raise AIParseError("Поддерживаются только JPEG, PNG и WebP")

    articles = await get_article_candidates(session)
    if not articles:
        raise AIParseError("No active articles to match against")
    articles_by_id = {a["id"]: a for a in articles}
    today = date.today()

    encoded = base64.standard_b64encode(image_bytes).decode("ascii")
    client = AIProviderClient(settings.endpoint_url, settings.api_token)
    content = await client.chat_completions(
        model=settings.model_image or "",
        messages=[
            {"role": "system", "content": _build_prompt(articles, today)},
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Распознай этот чек."},
                    {
                        "type": "image_url",
                        "image_url": {"url": f"data:{mime_type};base64,{encoded}"},
                    },
                ],
            },
        ],
        max_tokens=4096,
    )

    payload = _extract_json(content)
    if payload.get("error"):
        raise AIParseError("Model reported not_a_receipt")

    raw_items = payload.get("items")
    if not isinstance(raw_items, list) or not raw_items:
        raise AIParseError("No items recognized")

    receipt_date: date | None = None
    raw_date = payload.get("receipt_date")
    if raw_date:
        try:
            receipt_date = date.fromisoformat(str(raw_date))
            if receipt_date > today:
                receipt_date = None
        except ValueError:
            receipt_date = None

    items: list[ReceiptItemDraft] = []
    for raw in raw_items[:MAX_ITEMS]:
        if not isinstance(raw, dict):
            continue
        name = str(raw.get("name") or "").strip()[:255]
        amount = raw.get("amount")
        if not name or not isinstance(amount, int) or isinstance(amount, bool) or amount <= 0:
            continue
        article = articles_by_id.get(raw.get("article_id"))
        raw_confidence = raw.get("confidence")
        confidence_value = (
            float(raw_confidence)
            if isinstance(raw_confidence, (int, float))
            and not isinstance(raw_confidence, bool)
            else 0.0
        )
        items.append(
            ReceiptItemDraft(
                name=name,
                amount=amount,
                article_id=article["id"] if article else None,
                article_path=article["path"] if article else None,
                confidence=(
                    "high"
                    if article and confidence_value >= settings.confidence_threshold
                    else "low"
                ),
            )
        )

    if not items:
        raise AIParseError("No valid items after validation")

    store = payload.get("store")
    return ReceiptDraft(
        store=str(store).strip()[:255] if store else None,
        receipt_date=receipt_date,
        items=items,
        total=sum(item.amount for item in items),
    )
