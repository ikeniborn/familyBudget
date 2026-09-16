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
    get_cost_centers,
    get_financial_centers,
)

logger = logging.getLogger(__name__)

MAX_FILTER_ARTICLES = 20
BREAKDOWN_LIMIT = 15
# Tool intents (ai-analytics-chat-tool-intents): the scope model classifies
# the question, the backend computes the matching aggregate. Unknown values
# fall back to "totals" so existing questions keep working.
VALID_INTENTS = ("totals", "compare_periods", "trend_monthly", "plan_vs_fact")

# Deterministic scope fallback (analytics-chat-reasoning-budget): the qwen3
# thinking model intermittently returns an empty scope for whole-year /
# trend questions and hits the provider timeout, which used to surface as a
# 422. These keyword sets recover period + intent from the question text so
# the question is still answered; category filtering stays model-only (the
# fallback never guesses article_ids and answers budget-wide).
_TREND_MARKERS = ("динамик", "по месяц", "помесяч", "тренд", "как менял", "как измен")
_COMPARE_MARKERS = ("сравн", "по сравнен", "больше чем", "меньше чем", "разниц", "чем в прошл")
_PLAN_VS_FACT_MARKERS = ("уложил", "исполнен", "осталось от план", "сколько осталось", "в план", "по план")
_BUDGET_MARKERS = (
    "затрат", "расход", "доход", "трат", "потрат", "бюджет", "план",
    "сколько", "сумм", "категор", "продукт", "накопл", "остаток", "баланс",
)


def _build_extract_prompt(
    articles: list[dict[str, Any]],
    centers: list[dict[str, Any]],
    cost_centers: list[dict[str, Any]],
    today: date,
) -> str:
    # format_candidate_lines carries the family's own category descriptions
    # and frequency markers — the semantic layer name matching alone lacks.
    article_lines = format_candidate_lines(articles)
    center_block = ""
    if centers:
        center_lines = "\n".join(
            f"{c['id']}: {c['name']}"
            + (f" — {c['description']}" if c.get("description") else "")
            for c in centers
        )
        center_block = f"Счета (id: название — описание):\n{center_lines}\n\n"
    cost_center_block = ""
    if cost_centers:
        cc_lines = "\n".join(
            f"{c['id']}: {c['name']}"
            + (f" — {c['description']}" if c.get("description") else "")
            for c in cost_centers
        )
        cost_center_block = f"Места затрат (id: название — описание):\n{cc_lines}\n\n"
    return (
        "Ты — разборщик аналитических вопросов о семейном бюджете. "
        "Определи, за какой период и по каким категориям пользователь "
        "спрашивает.\n"
        f"Сегодня: {today.isoformat()}.\n\n"
        f"Категории (id: путь [тип] — описание):\n{article_lines}\n\n"
        f"{center_block}"
        f"{cost_center_block}"
        "Правила:\n"
        "- «текущий месяц» — с 1-го числа по сегодня; «прошлый месяц» — "
        "весь предыдущий календарный месяц; «за год» — с 1 января; период "
        "не назван — текущий месяц.\n"
        "- article_ids: id категорий, о которых спрашивают (включая "
        "подходящие по смыслу: «продукты» — категории про продукты и "
        "супермаркеты). Вопрос обо всём бюджете — null.\n"
        "- financial_center_id: id счёта, если пользователь спрашивает по "
        "конкретному счёту («по счёту дом», «на карте»); иначе null.\n"
        "- cost_center_id: id места затрат, если вопрос по конкретному МЗ "
        "(проект, поездка); иначе null.\n"
        "- record_type: \"plan\" если спрашивают о планах, иначе \"fact\".\n"
        "- intent: \"totals\" — суммы и топ категорий за один период "
        "(по умолчанию); \"compare_periods\" — сравнение с другим периодом "
        "(«больше, чем в прошлом месяце», «по сравнению с…») — заполни "
        "period2_start/period2_end вторым периодом; \"trend_monthly\" — "
        "динамика по месяцам («как менялись», «по месяцам»); "
        "\"plan_vs_fact\" — исполнение плана («уложились ли в план», "
        "«сколько осталось от плана»).\n\n"
        "Ответь ТОЛЬКО одним JSON-объектом, без пояснений и markdown:\n"
        "{\n"
        '  "intent": "<totals | compare_periods | trend_monthly | plan_vs_fact>",\n'
        '  "period_start": "<YYYY-MM-DD>",\n'
        '  "period_end": "<YYYY-MM-DD>",\n'
        '  "period2_start": "<YYYY-MM-DD>" или null (только для compare_periods),\n'
        '  "period2_end": "<YYYY-MM-DD>" или null (только для compare_periods),\n'
        '  "article_ids": [<int>, ...] или null,\n'
        '  "financial_center_id": <int> или null,\n'
        '  "cost_center_id": <int> или null,\n'
        '  "record_type": "<fact или plan>"\n'
        "}\n"
        'Если вопрос не про данные бюджета, ответь: {"error": "not_understood"}'
    )


def _rule_based_scope(question: str, today: date) -> dict[str, Any] | None:
    """Derive a scope from the question text alone, for when the model returns
    an empty/invalid one. Returns None when the text carries neither a period
    marker nor budget vocabulary — the fallback must not answer non-budget
    questions (those still get an honest 422).

    Only period + intent + record_type are recovered; article_ids stays null
    (semantic category matching needs the model), so the answer is budget-wide.
    """
    q = question.lower()

    has_trend = any(m in q for m in _TREND_MARKERS)
    has_compare = any(m in q for m in _COMPARE_MARKERS)
    has_plan_vs_fact = any(m in q for m in _PLAN_VS_FACT_MARKERS)
    has_budget = any(m in q for m in _BUDGET_MARKERS)

    # Period detection.
    period_start: date | None = None
    period_end = today
    if "последн" in q and ("год" in q or "12 месяц" in q):
        # Rolling 12 months, e.g. "динамика за последний год".
        period_start = date(today.year - 1, today.month, today.day)
    elif "прошл" in q and "месяц" in q:
        first_this = today.replace(day=1)
        prev_end = first_this - timedelta(days=1)
        period_start = prev_end.replace(day=1)
        period_end = prev_end
    elif "год" in q:
        # Calendar year to date, per the model prompt's "за год" rule.
        period_start = date(today.year, 1, 1)
    elif "текущий месяц" in q or "этом месяц" in q or "за месяц" in q:
        period_start = today.replace(day=1)

    has_period = period_start is not None

    # Nothing budget-shaped in the text -> do not fabricate a scope.
    if not (has_trend or has_compare or has_plan_vs_fact or has_budget or has_period):
        return None

    if period_start is None:
        period_start = today.replace(day=1)

    if has_plan_vs_fact:
        intent = "plan_vs_fact"
    elif has_trend:
        intent = "trend_monthly"
    elif has_compare:
        intent = "compare_periods"
    else:
        intent = "totals"

    record_type = "plan" if (intent == "plan_vs_fact" or "план" in q) else "fact"

    return {
        "intent": intent,
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "period2_start": None,
        "period2_end": None,
        "article_ids": None,
        "record_type": record_type,
    }


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
    "Поле record_type показывает природу сумм: \"fact\" — ФАКТИЧЕСКИЕ "
    "(реально совершённые) операции, \"plan\" — ПЛАНОВЫЕ (запланированные, "
    "ещё не факт). В ответе ОБЯЗАТЕЛЬНО назови это явно («фактические "
    "расходы», «плановые расходы») и НИКОГДА не складывай и не смешивай "
    "плановые суммы с фактическими — это разные величины. "
    "Если есть поле center_filter — данные УЖЕ отфильтрованы по этому счёту "
    "(account) и/или месту затрат (cost_center); отвечай уверенно «по счёту "
    "X …», НЕ говори, что разбивки по счетам нет. "
    "Поле intent описывает форму данных: compare_periods — period1/period2 "
    "и change: назови оба периода и изменение в рублях и процентах; "
    "trend_monthly — ряд months: перечисли месяцы с суммами и отметь "
    "направление; plan_vs_fact — plan/fact и execution_pct по категориям: "
    "оцени исполнение, помня, что факт учтён только по дату fact_through, "
    "а план — на весь период. "
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
    financial_center_id: int | None = None,
    cost_center_id: int | None = None,
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
            # income/expense only (like /trends): otherwise debit/credit
            # categories enter the breakdown without entering the totals
            # and the listed sums stop reconciling with the answer.
            Article.type.in_(("income", "expense")),
        )
        .group_by(Article.id, Article.name, Article.type)
    )
    if article_ids:
        query = query.where(Article.id.in_(article_ids))
    if financial_center_id:
        query = query.where(BudgetFact.financial_center_id == financial_center_id)
    if cost_center_id:
        query = query.where(BudgetFact.cost_center_id == cost_center_id)
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


def _month_start(day: date) -> date:
    return day.replace(day=1)


def _month_end(day: date) -> date:
    next_month = (day.replace(day=1) + timedelta(days=45)).replace(day=1)
    return next_month - timedelta(days=1)


def _change(current: float, previous: float) -> dict[str, Any]:
    delta = round(current - previous, 2)
    return {"abs": delta, "pct": round(delta / previous * 100) if previous else None}


async def _trend_monthly(
    session: AsyncSession,
    period_start: date,
    period_end: date,
    article_ids: list[int] | None,
    financial_center_id: int | None = None,
    cost_center_id: int | None = None,
) -> dict[str, Any]:
    """Per-month income/expense series over the range (facts only)."""
    month = func.date_trunc("month", BudgetFact.fact_date).label("month")
    query = (
        select(month, Article.type, func.sum(BudgetFact.amount).label("total"))
        .select_from(BudgetFact)
        .join(Article, BudgetFact.article_id == Article.id)
        .where(
            BudgetFact.fact_date >= period_start,
            BudgetFact.fact_date <= period_end,
            BudgetFact.record_type == "fact",
            Article.type.in_(("income", "expense")),
        )
        .group_by(month, Article.type)
        .order_by(month)
    )
    if article_ids:
        query = query.where(Article.id.in_(article_ids))
    if financial_center_id:
        query = query.where(BudgetFact.financial_center_id == financial_center_id)
    if cost_center_id:
        query = query.where(BudgetFact.cost_center_id == cost_center_id)
    rows = (await session.execute(query)).all()

    months: dict[str, dict[str, float]] = {}
    for row in rows:
        bucket = months.setdefault(
            row.month.strftime("%Y-%m"), {"income": 0.0, "expense": 0.0}
        )
        bucket[row.type] = round(float(row.total or 0), 2)
    series = [{"month": key, **totals} for key, totals in sorted(months.items())]
    return {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "record_type": "fact",
        "months": series,
        "expense_total": round(sum(m["expense"] for m in series), 2),
        "income_total": round(sum(m["income"] for m in series), 2),
    }


async def _plan_vs_fact(
    session: AsyncSession,
    period_start: date,
    period_end: date,
    article_ids: list[int] | None,
    today: date,
    financial_center_id: int | None = None,
    cost_center_id: int | None = None,
) -> dict[str, Any]:
    """Plan and fact aggregates over calendar-month-snapped bounds.

    Plans are recorded at one date but mean the whole month, while facts
    accumulate day by day — snapping to full months keeps the comparison
    honest, and fact_through tells the model how far the facts reach.
    """
    period_start = _month_start(period_start)
    period_end = _month_end(period_end)
    fact = await _aggregate(
        session, period_start, period_end, article_ids, "fact",
        financial_center_id, cost_center_id,
    )
    plan = await _aggregate(
        session, period_start, period_end, article_ids, "plan",
        financial_center_id, cost_center_id,
    )

    plan_by_cat = {c["category"]: c for c in plan["categories"]}
    fact_by_cat = {c["category"]: c for c in fact["categories"]}
    categories = []
    for name in plan_by_cat.keys() | fact_by_cat.keys():
        plan_total = plan_by_cat.get(name, {}).get("total", 0.0)
        fact_total = fact_by_cat.get(name, {}).get("total", 0.0)
        categories.append(
            {
                "category": name,
                "type": (plan_by_cat.get(name) or fact_by_cat[name])["type"],
                "plan": plan_total,
                "fact": fact_total,
                "execution_pct": (
                    round(fact_total / plan_total * 100) if plan_total else None
                ),
            }
        )
    categories.sort(key=lambda c: max(c["plan"], c["fact"]), reverse=True)
    return {
        "period_start": period_start.isoformat(),
        "period_end": period_end.isoformat(),
        "period_snapped_to_months": True,
        "fact_through": min(period_end, today).isoformat(),
        "category_filter": fact["category_filter"],
        "plan": {
            "expense_total": plan["expense_total"],
            "income_total": plan["income_total"],
        },
        "fact": {
            "expense_total": fact["expense_total"],
            "income_total": fact["income_total"],
        },
        "categories": categories[:BREAKDOWN_LIMIT],
        "categories_truncated": len(categories) > BREAKDOWN_LIMIT,
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
    centers = await get_financial_centers(session)
    cost_centers = await get_cost_centers(session)
    valid_center_ids = {c["id"] for c in centers}
    valid_cost_center_ids = {c["id"] for c in cost_centers}
    today = date.today()
    client = AIProviderClient(settings.endpoint_url, settings.api_token)

    # Step 1: question -> scope.
    scope_content = await client.chat_completions(
        model=settings.model_text or "",
        messages=[
            {
                "role": "system",
                "content": _build_extract_prompt(articles, centers, cost_centers, today),
            },
            {"role": "user", "content": question},
        ],
        response_format={"type": "json_object"},
        # Reasoning models (qwen3 thinking) spend a large token budget inside
        # <think> before emitting the JSON scope; 1536 was exhausted mid-think,
        # leaving an unclosed block that _strip_think reduced to "" -> a 422
        # "не понял" on every real question (prod, 2026-09-16). 4096 matches the
        # batch-parse budget that reliably lands JSON on the same model.
        max_tokens=4096,
    )
    try:
        scope = _extract_json(scope_content)
        if scope.get("error"):
            raise AIParseError("Model reported not_understood")
    except AIParseError:
        # The reasoning model exhausted its budget inside <think> (empty
        # reply) or refused: recover a scope from the question text so
        # whole-year / trend questions still get answered instead of a 422.
        fallback = _rule_based_scope(question, today)
        if fallback is None:
            logger.warning(
                "AI analytics: non-JSON scope output (len=%d) and no rule-based "
                "fallback: %.200s",
                len(scope_content),
                scope_content,
            )
            raise
        logger.info(
            "AI analytics: model scope failed (len=%d), using rule-based "
            "fallback intent=%s",
            len(scope_content),
            fallback["intent"],
        )
        scope = fallback

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
    intent = scope.get("intent")
    if intent not in VALID_INTENTS:
        intent = "totals"

    # Account / cost-center filters: only real ids pass, otherwise the whole
    # budget is aggregated (an invented id must not silently narrow to nothing).
    fc_id = _coerce_int(scope.get("financial_center_id"))
    if fc_id not in valid_center_ids:
        fc_id = None
    cc_id = _coerce_int(scope.get("cost_center_id"))
    if cc_id not in valid_cost_center_ids:
        cc_id = None

    # Step 2: aggregates computed by the backend, never by the model.
    # `badge` feeds the response's resolved period/totals for the UI.
    if intent == "compare_periods":
        span = period_end - period_start
        period2_end = parse_scope_date("period2_end", period_start - timedelta(days=1))
        period2_start = parse_scope_date("period2_start", period2_end - span)
        if period2_end < period2_start:
            period2_start, period2_end = period2_end, period2_start
        if (period2_end - period2_start) > timedelta(days=1100):
            period2_start = period2_end - timedelta(days=1100)
        # Sequential on purpose: one AsyncSession is not concurrency-safe.
        current = await _aggregate(
            session, period_start, period_end, article_ids, record_type, fc_id, cc_id
        )
        previous = await _aggregate(
            session, period2_start, period2_end, article_ids, record_type, fc_id, cc_id
        )
        data = {
            "intent": intent,
            "record_type": record_type,
            "period1": current,
            "period2": previous,
            "change": {
                "expense": _change(
                    current["expense_total"], previous["expense_total"]
                ),
                "income": _change(current["income_total"], previous["income_total"]),
            },
        }
        badge = current
    elif intent == "trend_monthly":
        data = {
            "intent": intent,
            **await _trend_monthly(
                session, period_start, period_end, article_ids, fc_id, cc_id
            ),
        }
        badge = data
        record_type = "fact"
    elif intent == "plan_vs_fact":
        data = {
            "intent": intent,
            **await _plan_vs_fact(
                session, period_start, period_end, article_ids, today, fc_id, cc_id
            ),
        }
        badge = {
            "period_start": data["period_start"],
            "period_end": data["period_end"],
            "expense_total": data["fact"]["expense_total"],
            "income_total": data["fact"]["income_total"],
        }
        record_type = "fact"
    else:
        data = {
            "intent": "totals",
            "record_type": record_type,
            **await _aggregate(
                session, period_start, period_end, article_ids, record_type,
                fc_id, cc_id,
            ),
        }
        badge = data

    # Tell the model the data is already scoped to an account / cost center,
    # so it answers «по счёту X: …» confidently instead of complaining the
    # data has no per-account breakdown (the sums are already filtered).
    if fc_id is not None or cc_id is not None:
        center_names = {c["id"]: c["name"] for c in centers}
        cost_center_names = {c["id"]: c["name"] for c in cost_centers}
        center_filter: dict[str, str] = {}
        if fc_id is not None:
            center_filter["account"] = center_names.get(fc_id, str(fc_id))
        if cc_id is not None:
            center_filter["cost_center"] = cost_center_names.get(cc_id, str(cc_id))
        data["center_filter"] = center_filter

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
        # Same reasoning-model headroom as the scope call: a thinking model can
        # exhaust a tight budget before the prose answer and return "".
        max_tokens=4096,
    )
    answer = answer.strip()
    if not answer:
        raise AIParseError("Model returned an empty answer")

    return {
        "answer": answer,
        "intent": intent,
        "period_start": badge["period_start"],
        "period_end": badge["period_end"],
        "record_type": record_type,
        "expense_total": badge["expense_total"],
        "income_total": badge["income_total"],
    }
