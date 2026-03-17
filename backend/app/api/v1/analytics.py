"""
Analytics API endpoints.

Provides aggregated data for charts and dashboards.
"""
import calendar as cal_module
import html
import logging
from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import case
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact as Fact
from backend.app.schemas.analytics import (
    FactHintsResponse,
    PlanHintsResponse,
    TransactionFilterEnum,
)
from backend.app.services.cache_service import CacheKey, CacheTTL, cache_service
from backend.app.utils.date_helpers import (
    get_current_calendar_month,
    get_current_calendar_quarter,
    get_current_calendar_year,
    get_iso_week_number,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ==================== Helper Functions for HTML Formatting ====================


def _format_money_mobile(amount: float) -> str:
    """Format money with abbreviations for mobile: 1k, 1M, etc."""
    abs_amount = abs(amount)
    sign = "-" if amount < 0 else ""
    if abs_amount >= 1_000_000:
        val = abs_amount / 1_000_000
        return f"{sign}{val:.1f}M".rstrip('0').rstrip('.')
    elif abs_amount >= 1_000:
        val = abs_amount / 1_000
        return f"{sign}{val:.1f}k".rstrip('0').rstrip('.')
    return f"{sign}{int(abs_amount)}"


def _format_money_desktop(amount: float) -> str:
    """Format money with thousand separators for desktop."""
    abs_amount = abs(amount)
    sign = "-" if amount < 0 else ""
    return f"{sign}{int(abs_amount):,}".replace(',', ' ')


def _format_pct(pct: float) -> str:
    return f"{pct:.1f}%"


def _get_pct_color(pct: float) -> str:
    if pct >= 95.0:
        return "text-success"
    elif pct >= 80.0:
        return "text-warning"
    return "text-error"


def _get_balance_color(balance: float) -> str:
    if balance > 0:
        return "text-success"
    elif balance < 0:
        return "text-error"
    return "text-base-content"


_VALID_STAT_CSS_CLASSES = frozenset({"text-success", "text-error", "text-info", "text-warning"})


def _render_stat_card(title: str, plan: float, fact: float, pct: float, fact_color: str) -> str:
    """Render one stat card HTML (income/expense/credit/debit)."""
    title = html.escape(title)
    if fact_color not in _VALID_STAT_CSS_CLASSES:
        fact_color = ""
    return f"""
        <div class="stat-card">
            <div class="stat-title">{title}</div>
            <div class="stat-rows">
                <div class="stat-row">
                    <span class="stat-label">План</span>
                    <span class="stat-value">
                        <span class="mobile-value">{_format_money_mobile(plan)}</span>
                        <span class="desktop-value">{_format_money_desktop(plan)}</span>
                    </span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Факт</span>
                    <span class="stat-value {fact_color}">
                        <span class="mobile-value">{_format_money_mobile(fact)}</span>
                        <span class="desktop-value">{_format_money_desktop(fact)}</span>
                    </span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">Исп.%</span>
                    <span class="stat-pct {_get_pct_color(pct)}">{_format_pct(pct)}</span>
                </div>
            </div>
        </div>"""


def _render_balance_card(bal: dict) -> str:
    """Render one balance card HTML for a financial center."""
    _name = html.escape(bal['name'])
    return f"""
        <div class="balance-card" data-movement="{bal['month_movement']:.2f}">
            <div class="balance-title" title="{_name}">{_name}</div>
            <div>
                <div class="balance-row">
                    <span class="balance-label">Начало</span>
                    <span class="balance-value {_get_balance_color(bal['opening_balance'])}">
                        <span class="mobile-value">{_format_money_mobile(bal['opening_balance'])}</span>
                        <span class="desktop-value">{_format_money_desktop(bal['opening_balance'])}</span>
                    </span>
                </div>
                <div class="balance-row balance-divider">
                    <span class="balance-label">Текущий</span>
                    <span class="balance-value font-bold {_get_balance_color(bal['current_balance'])}">
                        <span class="mobile-value">{_format_money_mobile(bal['current_balance'])}</span>
                        <span class="desktop-value">{_format_money_desktop(bal['current_balance'])}</span>
                    </span>
                </div>
            </div>
        </div>"""


async def _compute_month_movements(
    session: AsyncSession, month_start: date, today: date
) -> dict[int, float]:
    """Query net income-expense movements per financial center for the current month."""
    query = select(
        Fact.financial_center_id,
        (
            func.sum(case((Article.type.in_(["income", "credit"]), Fact.amount), else_=0)) -
            func.sum(case((Article.type.in_(["expense", "debit"]), Fact.amount), else_=0))
        ).label("balance")
    ).select_from(Fact).join(
        Article, Fact.article_id == Article.id
    ).where(
        Fact.fact_date >= month_start,
        Fact.fact_date <= today,
        Fact.record_type == "fact",
        Fact.financial_center_id.is_not(None)
    ).group_by(Fact.financial_center_id)

    result = await session.execute(query)
    return {row.financial_center_id: float(row.balance) for row in result.all()}


async def _query_account_balances(session: AsyncSession) -> list[dict]:
    """Query financial centers and compute opening/current balances.

    Note: imports inside function to avoid circular dependency with balance_aggregation_service.
    """
    from backend.app.models.financial_center import FinancialCenter
    from backend.app.services.balance_aggregation_service import get_opening_balances_bulk

    today = date.today()
    current_month_start = date(today.year, today.month, 1)

    # Step 1: Get all active Financial Centers
    fc_query = select(FinancialCenter).where(
        FinancialCenter.is_active
    ).order_by(FinancialCenter.name)

    fc_result = await session.execute(fc_query)
    financial_centers = fc_result.scalars().all()

    # Step 2: Calculate opening balance (ALL transactions BEFORE current month)
    fc_ids = [fc.id for fc in financial_centers]
    opening_balances_decimal = await get_opening_balances_bulk(
        session=session,
        year=today.year,
        month=today.month,
        financial_center_ids=fc_ids
    )
    opening_balances = {fc_id: float(balance) for fc_id, balance in opening_balances_decimal.items()}

    # Step 3: Calculate CURRENT month movements (from month start to today)
    month_movements = await _compute_month_movements(session, current_month_start, today)

    # Step 4: Combine results
    balances = []
    for fc in financial_centers:
        opening = opening_balances.get(fc.id, 0.0)
        movement = month_movements.get(fc.id, 0.0)
        current = opening + movement

        balances.append({
            "id": fc.id,
            "name": fc.name,
            "opening_balance": opening,
            "current_balance": current,
            "is_negative": current < 0,
            "month_movement": abs(current - opening)
        })

    return balances


# ==================== Helper Functions for Plan-Fact Analysis ====================


def distribute_plan_by_days(
    plan_by_date: dict[date, float],
    start_date: date,
    end_date: date
) -> list[float]:
    """
    Distribute monthly plans evenly across ACTUAL days in period (not full month).

    Algorithm:
        1. Group all plans by month (sum plans for same month)
        2. Count actual days in period for each month (start_date to end_date)
        3. Calculate average per day = total_plan_for_month / actual_days_in_period
        4. Return array with average for each day in range

    Example (current month):
        Plan: 10000₽ for Dec 2025
        Period: 2025-12-01 to 2025-12-01 (today is Dec 1)
        Actual days: 1
        Result: 10000₽ per day (10000 / 1)

    Example (past month):
        Plan: 30000₽ for Nov 2025
        Period: 2025-11-01 to 2025-11-30
        Actual days: 30
        Result: 1000₽ per day (30000 / 30)

    Args:
        plan_by_date: Dict mapping date → plan amount (from DB query)
        start_date: First date in range
        end_date: Last date in range (inclusive, usually today)

    Returns:
        List of plan amounts for each day in range (distributed evenly across actual days)
    """
    # 1. Group plans by month and sum
    month_plans: dict[tuple[int, int], dict[str, float]] = {}

    for plan_date, amount in plan_by_date.items():
        month_key = (plan_date.year, plan_date.month)

        if month_key not in month_plans:
            month_plans[month_key] = {
                'total': 0.0,
                'actual_days': 0,  # Will count actual days in period below
                'avg_per_day': 0.0
            }

        month_plans[month_key]['total'] += amount

    # 2. Count actual days for each month within the period (start_date to end_date)
    #    For current month: only days from start to today, NOT full month
    current_date = start_date
    while current_date <= end_date:
        month_key = (current_date.year, current_date.month)
        if month_key in month_plans:
            month_plans[month_key]['actual_days'] += 1
        current_date += timedelta(days=1)

    # 3. Calculate average per day for each month (using actual days, not full month)
    for month_key, plan_info in month_plans.items():
        actual_days = plan_info['actual_days']
        if actual_days > 0:
            plan_info['avg_per_day'] = plan_info['total'] / actual_days
        else:
            plan_info['avg_per_day'] = 0.0

    # 4. Generate array with average for each day
    result = []
    current_date = start_date

    while current_date <= end_date:
        month_key = (current_date.year, current_date.month)
        avg = month_plans.get(month_key, {}).get('avg_per_day', 0.0)
        result.append(avg)
        current_date += timedelta(days=1)

    return result


def distribute_plan_by_months(
    plan_by_date: dict[date, float],
    start_date: date,
    end_date: date
) -> dict[tuple[int, int], float]:
    """
    Group plans by month (for quarter/year periods).

    Algorithm:
        1. Group all plans by their actual month (from plan_date.month)
        2. Sum plans for each month separately
        3. Return dict mapping month_key → total plan amount for that month

    Example (year, today Dec 1):
        Plan: 10000₽ on Dec 1, 5000₽ on Jan 15
        Result: Jan = 5000₽, Feb-Nov = 0₽, Dec = 10000₽

    Example (quarter Q1):
        Plan: 30000₽ on Jan 1, 20000₽ on Feb 1
        Result: Jan = 30000₽, Feb = 20000₽, Mar = 0₽

    Args:
        plan_by_date: Dict mapping date → plan amount (from DB query)
        start_date: First date in range
        end_date: Last date in range (inclusive)

    Returns:
        Dict mapping (year, month) → total plan amount for that month
    """
    # 1. Group plans by their actual month
    month_plans: dict[tuple[int, int], float] = {}

    for plan_date, amount in plan_by_date.items():
        month_key = (plan_date.year, plan_date.month)
        if month_key not in month_plans:
            month_plans[month_key] = 0.0
        month_plans[month_key] += amount

    # 2. Create result dict for ALL months in range (fill 0 for months without plans)
    result: dict[tuple[int, int], float] = {}
    current_date = start_date

    while current_date <= end_date:
        month_key = (current_date.year, current_date.month)
        result[month_key] = month_plans.get(month_key, 0.0)

        # Move to next month
        if current_date.month == 12:
            current_date = date(current_date.year + 1, 1, 1)
        else:
            current_date = date(current_date.year, current_date.month + 1, 1)

    return result


def calculate_cumulative(data: list[float]) -> list[float]:
    """
    Calculate cumulative sum of array (running total).

    Example:
        Input:  [1000, 1500, 800, 1200]
        Output: [1000, 2500, 3300, 4500]

    Args:
        data: List of amounts

    Returns:
        List of cumulative sums
    """
    cumulative = []
    total = 0.0

    for value in data:
        total += value
        cumulative.append(total)

    return cumulative


def get_previous_period(start_date: date, end_date: date, period: str | None = None) -> tuple[date, date]:
    """
    Calculate previous period boundaries.

    For calendar periods (month, quarter, year): returns previous FULL calendar period.
    For custom ranges: shifts backwards by period length.

    Used for waterfall chart initial balance calculation.

    Examples:
        Calendar month:
            Input:  01.11.2025 - 30.11.2025, period='month'
            Output: 01.10.2025 - 31.10.2025 (full October)

        Custom range:
            Input:  15.10.2025 - 10.11.2025, period=None
            Output: 18.09.2025 - 14.10.2025 (27 days before)

    Args:
        start_date: Start of current period
        end_date: End of current period
        period: Period type ('month', 'quarter', 'year') or None for custom

    Returns:
        Tuple of (prev_start_date, prev_end_date)
    """
    if period == 'month':
        # Previous calendar month
        # Go back 1 month from start_date
        if start_date.month == 1:
            prev_year = start_date.year - 1
            prev_month = 12
        else:
            prev_year = start_date.year
            prev_month = start_date.month - 1

        prev_start = date(prev_year, prev_month, 1)
        _, last_day = cal_module.monthrange(prev_year, prev_month)
        prev_end = date(prev_year, prev_month, last_day)

        return prev_start, prev_end

    elif period == 'quarter':
        # Previous calendar quarter
        # Determine current quarter
        current_quarter = (start_date.month - 1) // 3 + 1

        # Previous quarter
        if current_quarter == 1:
            prev_quarter = 4
            prev_year = start_date.year - 1
        else:
            prev_quarter = current_quarter - 1
            prev_year = start_date.year

        # Quarter bounds
        first_month = (prev_quarter - 1) * 3 + 1
        last_month = first_month + 2

        prev_start = date(prev_year, first_month, 1)
        _, last_day = cal_module.monthrange(prev_year, last_month)
        prev_end = date(prev_year, last_month, last_day)

        return prev_start, prev_end

    elif period == 'year':
        # Previous calendar year
        prev_year = start_date.year - 1
        prev_start = date(prev_year, 1, 1)
        prev_end = date(prev_year, 12, 31)

        return prev_start, prev_end

    else:
        # Custom range: shift backwards by period length
        period_length = (end_date - start_date).days + 1
        prev_end = start_date - timedelta(days=1)
        prev_start = prev_end - timedelta(days=period_length - 1)
        return prev_start, prev_end


# ==================== Analytics Endpoints ====================


@router.get("/quick-stats")
async def get_quick_stats(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Get quick statistics for dashboard.

    Returns today's and current month's income/expense summary.
    """
    today = date.today()
    month_start = date(today.year, today.month, 1)

    # Today's stats
    # Shared family budget - NO user_id filter
    today_query = select(
        Article.type.label("type"),
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.fact_date == today
    ).group_by(Article.type)

    today_result = await session.execute(today_query)
    today_data = {row.type: float(row.total) for row in today_result.all()}

    # This month's stats
    # Shared family budget - NO user_id filter
    month_query = select(
        Article.type.label("type"),
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.fact_date >= month_start,
        Fact.fact_date <= today
    ).group_by(Article.type)

    month_result = await session.execute(month_query)
    month_data = {row.type: float(row.total) for row in month_result.all()}

    # Include credit (пополнение) as income, debit (списание) as expense
    today_income = today_data.get("income", 0.0) + today_data.get("credit", 0.0)
    today_expense = today_data.get("expense", 0.0) + today_data.get("debit", 0.0)

    month_income = month_data.get("income", 0.0) + month_data.get("credit", 0.0)
    month_expense = month_data.get("expense", 0.0) + month_data.get("debit", 0.0)

    return {
        "today": {
            "income": today_income,
            "expense": today_expense,
            "balance": today_income - today_expense
        },
        "month": {
            "income": month_income,
            "expense": month_expense,
            "balance": month_income - month_expense
        }
    }


async def _query_month_fact_plan_stats(
    session: AsyncSession, month_start: date, today: date
) -> tuple[dict[str, float], dict[str, float]]:
    """Query current month fact and plan totals grouped by article type."""
    month_query = select(
        Article.type.label("type"),
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.fact_date >= month_start,
        Fact.fact_date <= today,
        Fact.record_type == "fact"
    ).group_by(Article.type)

    month_result = await session.execute(month_query)
    month_data = {row.type: float(row.total) for row in month_result.all()}

    month_end = date(today.year, today.month, cal_module.monthrange(today.year, today.month)[1])
    month_plan_query = select(
        Article.type.label("type"),
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.fact_date >= month_start,
        Fact.fact_date <= month_end,
        Fact.record_type == "plan"
    ).group_by(Article.type)

    month_plan_result = await session.execute(month_plan_query)
    month_plan_data = {row.type: float(row.total) for row in month_plan_result.all()}

    return month_data, month_plan_data


def _calc_plan_execution(fact: float, plan: float) -> float:
    """Calculate plan execution percentage with division by zero protection."""
    return (fact / plan * 100.0) if plan > 0 else 0.0


def _build_quick_stat_cards(
    month_data: dict[str, float], month_plan_data: dict[str, float]
) -> str:
    """Build HTML stat cards for quick stats dashboard."""
    types = [
        ("income", "💰 Доходы", "text-success"),
        ("expense", "💸 Расходы", "text-error"),
        ("credit", "➕ Пополнение", "text-info"),
        ("debit", "➖ Списание", "text-warning"),
    ]
    cards = []
    for type_key, label, css_class in types:
        fact_val = month_data.get(type_key, 0.0)
        plan_val = month_plan_data.get(type_key, 0.0)
        pct = _calc_plan_execution(fact_val, plan_val)
        cards.append(_render_stat_card(label, plan_val, fact_val, pct, css_class))
    return "".join(cards)


def _get_quick_stats_css() -> str:
    """Return CSS for quick stats grid (5 breakpoints)."""
    return """
        /* === QUICK STATS: 5 Breakpoints Grid Layout === */
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
        }
        .stat-card {
            background: oklch(var(--b2));
            border-radius: 0.5rem;
            padding: 0.5rem 0.625rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid oklch(var(--b3));
        }
        .stat-title {
            font-weight: 600;
            font-size: 0.8125rem;
            margin-bottom: 0.25rem;
            display: flex;
            align-items: center;
            gap: 0.25rem;
        }
        .stat-rows {
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .stat-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.375rem;
            white-space: nowrap;
            height: 1.125rem;
        }
        .stat-label {
            font-size: 0.6875rem;
            opacity: 0.6;
            flex-shrink: 0;
        }
        .stat-value {
            font-size: 0.8125rem;
            font-weight: 600;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .stat-pct {
            font-size: 0.6875rem;
            font-weight: 700;
        }
        /* Mobile/Desktop value toggle */
        .mobile-value { display: inline; }
        .desktop-value { display: none; }

        /* Breakpoint: <375px (XS) - 1 column */
        @media (max-width: 374px) {
            .stats-grid {
                grid-template-columns: 1fr;
                gap: 0.375rem;
            }
            .stat-card { padding: 0.375rem 0.5rem; }
            .stat-title { font-size: 0.75rem; }
            .stat-label { font-size: 0.625rem; }
            .stat-value { font-size: 0.75rem; }
            .stat-pct { font-size: 0.625rem; }
        }

        /* Breakpoint: 375-479px (SM) - 2 columns */
        @media (min-width: 375px) and (max-width: 479px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
            }
        }

        /* Breakpoint: 480-767px (MD) - 2 columns, larger fonts */
        @media (min-width: 480px) and (max-width: 767px) {
            .stats-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
            }
            .stat-card { padding: 0.625rem 0.75rem; }
            .stat-title { font-size: 0.875rem; }
            .stat-label { font-size: 0.75rem; }
            .stat-value { font-size: 0.875rem; }
            .stat-pct { font-size: 0.75rem; }
        }

        /* Breakpoint: 768-1023px (LG) - 4 columns, desktop values */
        @media (min-width: 768px) and (max-width: 1023px) {
            .mobile-value { display: none; }
            .desktop-value { display: inline; }
            .stats-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 0.75rem;
            }
            .stat-card { padding: 0.625rem 0.75rem; }
            .stat-title { font-size: 0.9375rem; }
            .stat-label { font-size: 0.75rem; }
            .stat-value { font-size: 0.9375rem; }
            .stat-pct { font-size: 0.75rem; }
        }

        /* Breakpoint: >=1024px (XL) - 4 columns, full desktop */
        @media (min-width: 1024px) {
            .mobile-value { display: none; }
            .desktop-value { display: inline; }
            .stats-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
            }
            .stat-card { padding: 0.75rem 1rem; }
            .stat-title { font-size: 1rem; }
            .stat-label { font-size: 0.8125rem; }
            .stat-value { font-size: 1rem; }
            .stat-pct { font-size: 0.8125rem; }
        }
    """


@router.get("/quick-stats-html", response_class=HTMLResponse)
async def get_quick_stats_html(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
) -> str:
    """Get quick statistics for dashboard (HTML formatted). Caching: TTL 30s."""
    cache_key = str(CacheKey.quick_stats())
    cached_html = await cache_service.get(cache_key)
    if cached_html is not None:
        return cached_html

    today = date.today()
    month_start = date(today.year, today.month, 1)

    month_data, month_plan_data = await _query_month_fact_plan_stats(session, month_start, today)
    stat_cards = _build_quick_stat_cards(month_data, month_plan_data)

    result_html = f"""
    <style>{_get_quick_stats_css()}</style>
    <div class="stats-grid">
{stat_cards}
    </div>
    """

    await cache_service.set(cache_key, result_html, CacheTTL.DASHBOARD())
    return result_html


_BALANCES_EMPTY_HTML = """
<div class="alert alert-info">
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
    </svg>
    <span>Нет активных счетов</span>
</div>
"""


def _get_balances_css() -> str:
    """Return CSS for balances grid (5 breakpoints)."""
    return """
        /* === BALANCES: 5 Breakpoints Grid Layout (fixed like quick-stats) === */
        .balances-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 0.5rem;
        }
        .balance-card {
            background: oklch(var(--b2));
            border-radius: 0.5rem;
            padding: 0.5rem 0.625rem;
            box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            border: 1px solid oklch(var(--b3));
        }
        .balance-title {
            font-weight: 600;
            font-size: 0.75rem;
            margin-bottom: 0.25rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .balance-row {
            display: flex;
            justify-content: space-between;
            align-items: baseline;
            gap: 0.25rem;
            white-space: nowrap;
            line-height: 1.2;
        }
        .balance-label {
            font-size: 0.625rem;
            opacity: 0.6;
            flex-shrink: 0;
        }
        .balance-value {
            font-size: 0.75rem;
            font-weight: 600;
        }
        .balance-divider {
            border-top: 1px solid oklch(var(--b3));
            margin-top: 0.25rem;
            padding-top: 0.25rem;
        }
        /* Mobile/Desktop value toggle */
        .mobile-value { display: inline; }
        .desktop-value { display: none; }

        /* Breakpoint: <375px (XS) - 1 column */
        @media (max-width: 374px) {
            .balances-grid {
                grid-template-columns: 1fr;
                gap: 0.375rem;
            }
            .balance-card { padding: 0.375rem 0.5rem; }
            .balance-title { font-size: 0.6875rem; }
            .balance-label { font-size: 0.5625rem; }
            .balance-value { font-size: 0.6875rem; }
        }

        /* Breakpoint: 375-479px (SM) - 2 columns */
        @media (min-width: 375px) and (max-width: 479px) {
            .balances-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.5rem;
            }
        }

        /* Breakpoint: 480-767px (MD) - 2 columns */
        @media (min-width: 480px) and (max-width: 767px) {
            .balances-grid {
                grid-template-columns: repeat(2, 1fr);
                gap: 0.75rem;
            }
            .balance-card { padding: 0.625rem 0.75rem; }
            .balance-title { font-size: 0.8125rem; }
            .balance-label { font-size: 0.6875rem; }
            .balance-value { font-size: 0.8125rem; }
        }

        /* Breakpoint: 768-1023px (LG) - 4 columns, desktop values */
        @media (min-width: 768px) and (max-width: 1023px) {
            .mobile-value { display: none; }
            .desktop-value { display: inline; }
            .balances-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 0.75rem;
            }
            .balance-card { padding: 0.625rem 0.75rem; }
            .balance-title { font-size: 0.875rem; }
            .balance-label { font-size: 0.75rem; }
            .balance-value { font-size: 0.875rem; }
        }

        /* Breakpoint: >=1024px (XL) - 4 columns, full desktop */
        @media (min-width: 1024px) {
            .mobile-value { display: none; }
            .desktop-value { display: inline; }
            .balances-grid {
                grid-template-columns: repeat(4, 1fr);
                gap: 1rem;
            }
            .balance-card { padding: 0.75rem 1rem; }
            .balance-title { font-size: 0.9375rem; }
            .balance-label { font-size: 0.75rem; }
            .balance-value { font-size: 0.9375rem; }
        }
    """


@router.get("/account-balances-html", response_class=HTMLResponse)
async def get_account_balances_html(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
) -> str:
    """Get account balances for all Financial Centers (HTML). Caching: TTL 30s."""
    cache_key = str(CacheKey.account_balances())
    cached_html = await cache_service.get(cache_key)
    if cached_html is not None:
        return cached_html

    balances = await _query_account_balances(session)

    if not balances:
        await cache_service.set(cache_key, _BALANCES_EMPTY_HTML, CacheTTL.DASHBOARD())
        return _BALANCES_EMPTY_HTML

    balance_cards = "".join(_render_balance_card(bal) for bal in balances)

    result_html = f"""
    <style>{_get_balances_css()}</style>
    <div class="balances-grid">
{balance_cards}
    </div>
    """

    await cache_service.set(cache_key, result_html, CacheTTL.DASHBOARD())
    return result_html


@router.get("/plan-fact")
async def get_plan_fact_data(
    current_user: CurrentUser,
    period: str | None = Query(None, pattern="^(month|quarter|year)$"),
    date_from: date | None = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    article_type: str = Query("expense", pattern="^(income|expense|debit|credit|all)$"),
    chart_mode: str = Query("cumulative", pattern="^(normal|cumulative)$"),
    cfo_id: int | None = Query(None, description="Filter by Financial Center ID"),
    article_ids: list[int] | None = Query(None, description="Filter by category IDs (multiple selection)"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get plan vs fact comparison data for bar chart with plan distribution and cumulative mode.

    Plan Distribution Logic:
        Plans are distributed evenly across the period to avoid showing plan only on fixation date:
        - For 'month' period: Plan amount divided by days_in_month (avg per day)
          Example: Plan 30000₽ on Nov 1 → 1000₽ per day for all Nov days (30 days)
        - For 'quarter'/'year' periods: Plan amount divided by months in period
          Example: Plan 90000₽ for Q1 → 30000₽ per month (Jan, Feb, Mar)

    Chart Modes:
        - 'normal': Regular bars (period-by-period values)
        - 'cumulative': Cumulative bars (running total from period start)

    Args:
        period: Time period (month, quarter, year) - calendar periods from 1st day to today
            - month: current calendar month (from 1st day to today)
            - quarter: current calendar quarter (from Q start to today)
            - year: current calendar year (from Jan 1 to today)
        date_from: Optional start date for custom range (overrides period)
        date_to: Optional end date for custom range (overrides period)
        article_type: Type of category (income or expense)
        chart_mode: Display mode ('normal' or 'cumulative', default: 'cumulative')

    Returns:
        Dict with labels, plan/fact arrays, period, article_type, and chart_mode
        - plan: Array of plan amounts (distributed + cumulative if mode=cumulative)
        - fact: Array of fact amounts (cumulative if mode=cumulative)
        - plan_period: List of original period amounts (for tooltip)
        - fact_period: List of original period amounts (for tooltip)
    """
    try:
        today = date.today()

        # Priority: custom date range > period parameter
        if date_from and date_to:
            start_date = date_from
            end_date = date_to
            # Auto-determine grouping based on days difference (v5.1.3 fix)
            days_diff = (end_date - start_date).days + 1

            if days_diff <= 31:
                # <= 31 days: Group by calendar dates (daily)
                period = "month"
                date_format = "%d" if days_diff > 7 else None  # Russian day names for <= 7 days
            elif days_diff <= 91:
                # > 31 and <= 91 days: Group by calendar weeks (weekly)
                period = "quarter"
                (days_diff + 6) // 7  # Number of weeks (rounded up)
                date_format = "week"
            else:
                # > 91 days: Group by calendar months (monthly)
                period = "year"
                # Calculate actual number of months in the range
                (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month) + 1
                date_format = "month"
        elif period:
            # Calculate date range based on CALENDAR period (from 1st day to today)
            if period == "month":
                # Current calendar month (from 1st day to today)
                start_date, end_date = get_current_calendar_month(today)
                (end_date - start_date).days + 1  # Days in current month
                date_format = "day"  # Show by days
            elif period == "quarter":
                # Current calendar quarter (from Q start to today)
                start_date, end_date = get_current_calendar_quarter(today)
                # Count weeks from quarter start to current date
                days_diff = (end_date - start_date).days + 1
                (days_diff + 6) // 7  # Number of weeks (rounded up)
                date_format = "week"  # Show by weeks with ISO numbers
            else:  # year
                # Current calendar year (from Jan 1 to today)
                start_date, end_date = get_current_calendar_year(today)
                date_format = "month"  # Show by months
        else:
            raise HTTPException(400, "Укажите period или date_from/date_to")

        # Query FACTS grouped by date with article type filter
        # Shared family budget - NO user_id filter
        fact_query = select(
            Fact.fact_date,
            func.sum(Fact.amount).label("total")
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date,
            Fact.record_type == "fact"
        )

        # Apply article type filter if not 'all' (v5.1.4)
        if article_type != 'all':
            fact_query = fact_query.where(Article.type == article_type)

        # Apply CFO filter if specified (v5.1.3)
        if cfo_id is not None:
            fact_query = fact_query.where(Fact.financial_center_id == cfo_id)

        # Apply category filter if specified (v5.1.3)
        if article_ids:
            fact_query = fact_query.where(Fact.article_id.in_(article_ids))

        fact_query = fact_query.group_by(Fact.fact_date).order_by(Fact.fact_date)

        fact_result = await session.execute(fact_query)
        fact_by_date = {row.fact_date: float(row.total) for row in fact_result.all()}

        # Query PLANS grouped by date with article type filter
        # Shared family budget - NO user_id filter
        plan_query = select(
            Fact.fact_date,
            func.sum(Fact.amount).label("total")
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date,
            Fact.record_type == "plan"
        )

        # Apply article type filter if not 'all' (v5.1.4)
        if article_type != 'all':
            plan_query = plan_query.where(Article.type == article_type)

        # Apply CFO filter if specified (v5.1.3)
        if cfo_id is not None:
            plan_query = plan_query.where(Fact.financial_center_id == cfo_id)

        # Apply category filter if specified (v5.1.3)
        if article_ids:
            plan_query = plan_query.where(Fact.article_id.in_(article_ids))

        plan_query = plan_query.group_by(Fact.fact_date).order_by(Fact.fact_date)

        plan_result = await session.execute(plan_query)
        plan_by_date = {row.fact_date: float(row.total) for row in plan_result.all()}

        # === PLAN DISTRIBUTION: Distribute plan evenly across period ===
        # For month: distribute by days, for quarter/year: distribute by months
        if date_format == "day":
            # Month period: distribute plan evenly across all days in month
            plan_distributed_list = distribute_plan_by_days(plan_by_date, start_date, end_date)
            # Convert list to dict for compatibility with existing code
            plan_distributed = {}
            current_date = start_date
            idx = 0
            while current_date <= end_date:
                plan_distributed[current_date] = plan_distributed_list[idx]
                current_date += timedelta(days=1)
                idx += 1
        elif date_format == "month":
            # Quarter/year periods: distribute plan evenly across months
            plan_distributed_by_month = distribute_plan_by_months(plan_by_date, start_date, end_date)
            # Will be used in month aggregation loop below
        else:
            # For other formats (week, custom): use original plan_by_date
            plan_distributed = plan_by_date

        # Generate labels and data arrays
        labels = []
        fact_data = []
        plan_data = []
        fact_period = []  # Original period values for tooltip
        plan_period = []  # Original period values for tooltip

        # Агрегация по неделям или месяцам в зависимости от date_format
        if date_format == "day":
            # Для периода месяц: показывать числа месяца (1-31)
            current_date = start_date
            while current_date <= end_date:
                # Число месяца (1-31)
                day_label = str(current_date.day)

                fact_amount = fact_by_date.get(current_date, 0.0)
                plan_amount = plan_distributed.get(current_date, 0.0)

                labels.append(day_label)
                fact_data.append(fact_amount)
                plan_data.append(plan_amount)
                fact_period.append(fact_amount)  # For day period, same as fact_data
                plan_period.append(plan_amount)  # Distributed plan
                current_date += timedelta(days=1)
        elif date_format == "week":
            # Для period='quarter': группировать по календарным неделям (ISO week numbers)
            # Note: For week aggregation, plan distribution is done at day level first
            # then aggregated by week
            plan_distributed_list = distribute_plan_by_days(plan_by_date, start_date, end_date)
            plan_distributed_dict = {}
            current_date = start_date
            idx = 0
            while current_date <= end_date:
                plan_distributed_dict[current_date] = plan_distributed_list[idx]
                current_date += timedelta(days=1)
                idx += 1

            # Generate weeks within quarter boundaries (from start_date to end_date)
            # Find Monday of the week containing start_date
            week_start = start_date - timedelta(days=start_date.weekday())

            while week_start <= end_date:
                week_end = week_start + timedelta(days=6)
                # Don't go beyond the quarter range
                actual_week_end = min(week_end, end_date)
                actual_week_start = max(week_start, start_date)

                # Get ISO week number for this week
                iso_label = get_iso_week_number(week_start)

                # Aggregate facts for this week (within quarter bounds)
                week_fact = sum(
                    amount for d, amount in fact_by_date.items()
                    if actual_week_start <= d <= actual_week_end
                )
                # Aggregate distributed plans for this week (within quarter bounds)
                week_plan = sum(
                    amount for d, amount in plan_distributed_dict.items()
                    if actual_week_start <= d <= actual_week_end
                )

                labels.append(iso_label)
                fact_data.append(week_fact)
                plan_data.append(week_plan)
                fact_period.append(week_fact)
                plan_period.append(week_plan)

                # Move to next week
                week_start += timedelta(days=7)
        elif date_format == "month":
            # Для quarter/year периодов: группировать по календарным месяцам
            # Plan distribution: use distributed plan by month (avg per month)
            month_names_ru = [
                "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
                "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
            ]
            current_date = start_date
            while current_date <= end_date:
                # Первый и последний день текущего месяца
                month_start = date(current_date.year, current_date.month, 1)
                _, last_day = cal_module.monthrange(current_date.year, current_date.month)
                month_end = date(current_date.year, current_date.month, last_day)
                # Обрезать до end_date если месяц неполный
                month_end = min(month_end, end_date)

                # Агрегировать факты за месяц
                month_fact = sum(
                    amount for d, amount in fact_by_date.items()
                    if month_start <= d <= month_end
                )
                # Получить ПОЛНЫЙ план для месяца
                # НЕ делим на дни - просто берем полную сумму плана на месяц
                month_key = (current_date.year, current_date.month)
                month_plan = plan_distributed_by_month.get(month_key, 0.0)

                # Label: "Янв 2025"
                month_label = f"{month_names_ru[current_date.month - 1]} {current_date.year}"
                labels.append(month_label)
                fact_data.append(month_fact)
                plan_data.append(month_plan)
                fact_period.append(month_fact)
                plan_period.append(month_plan)

                # Переход к следующему месяцу
                if current_date.month == 12:
                    current_date = date(current_date.year + 1, 1, 1)
                else:
                    current_date = date(current_date.year, current_date.month + 1, 1)
        else:
            # Для custom range или старой логики: группировать по дням
            # Apply plan distribution for custom ranges too
            plan_distributed_list = distribute_plan_by_days(plan_by_date, start_date, end_date)
            current_date = start_date
            idx = 0
            while current_date <= end_date:
                fact_amount = fact_by_date.get(current_date, 0.0)
                plan_amount = plan_distributed_list[idx] if idx < len(plan_distributed_list) else 0.0

                labels.append(current_date.strftime("%d.%m"))
                fact_data.append(fact_amount)
                plan_data.append(plan_amount)
                fact_period.append(fact_amount)
                plan_period.append(plan_amount)
                current_date += timedelta(days=1)
                idx += 1

        # === CUMULATIVE MODE: Calculate running totals if requested ===
        if chart_mode == "cumulative":
            # Save original period values for tooltip (already saved above)
            # Calculate cumulative sums
            plan_cumulative = calculate_cumulative(plan_data)
            fact_cumulative = calculate_cumulative(fact_data)
            # Replace data arrays with cumulative
            plan_data = plan_cumulative
            fact_data = fact_cumulative

        return {
            "labels": labels,
            "plan": plan_data,
            "fact": fact_data,
            "plan_period": plan_period,  # Original period amounts for tooltip
            "fact_period": fact_period,  # Original period amounts for tooltip
            "period": period,
            "article_type": article_type,
            "chart_mode": chart_mode
        }

    except Exception as e:
        logger.error(f"Error in /plan-fact: {str(e)}", exc_info=True)
        return {
            "labels": [],
            "plan": [],
            "fact": [],
            "plan_period": [],
            "fact_period": [],
            "period": period or "month",
            "article_type": article_type,
            "chart_mode": chart_mode
        }


@router.get("/trends")
async def get_trends_data(
    current_user: CurrentUser,
    period: str | None = Query(None, pattern="^(month|quarter|year)$"),
    date_from: date | None = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    record_type: str = Query("fact", pattern="^(fact|plan)$"),
    cfo_id: int | None = Query(None, description="Filter by Financial Center ID"),
    chart_mode: str = Query("normal", pattern="^(normal|cumulative)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get spending trends over time for line chart with rolling periods.

    Args:
        period: Time period (month, quarter, year) - rolling periods
            - month: last 4 calendar weeks
            - quarter: rolling 3 months
            - year: rolling 12 months
        date_from: Optional start date for custom range (overrides period)
        date_to: Optional end date for custom range (overrides period)
        record_type: Type of records (fact or plan)
        chart_mode: Display mode (normal or cumulative)

    Returns:
        Dict with labels, income, and expense arrays aggregated by period
        - income_period: Original period values (only in cumulative mode)
        - expense_period: Original period values (only in cumulative mode)
        - chart_mode: The chart mode used
    """
    try:
        today = date.today()

        # Priority: custom date range > period parameter
        if date_from and date_to:
            start_date = date_from
            end_date = date_to
            # Auto-determine grouping based on days difference (v5.1.3 fix)
            days_diff = (end_date - start_date).days + 1
            if days_diff <= 31:
                # <= 31 days: Group by calendar dates (daily)
                period = "month"
            elif days_diff <= 91:
                # > 31 and <= 91 days: Group by calendar weeks (weekly)
                period = "quarter"
            else:
                # > 91 days: Group by calendar months (monthly)
                period = "year"
        elif period:
            # Calculate date range based on CALENDAR period (from 1st day to today)
            if period == "month":
                # Current calendar month (from 1st day to today)
                start_date, end_date = get_current_calendar_month(today)
            elif period == "quarter":
                # Current calendar quarter (from Q start to today)
                start_date, end_date = get_current_calendar_quarter(today)
            else:  # year
                # Current calendar year (from Jan 1 to today)
                start_date, end_date = get_current_calendar_year(today)
        else:
            raise HTTPException(400, "Укажите period или date_from/date_to")

        # Query daily income and expense with record_type filter
        # Shared family budget - NO user_id filter
        query = select(
            Fact.fact_date,
            Article.type,
            func.sum(Fact.amount).label("total")
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date,
            Fact.record_type == record_type
        )

        # Apply CFO filter if specified (v5.1.3)
        if cfo_id is not None:
            query = query.where(Fact.financial_center_id == cfo_id)

        query = query.group_by(Fact.fact_date, Article.type).order_by(Fact.fact_date)

        result = await session.execute(query)
        rows = result.all()

        # Build data structure by date (map credit→income, debit→expense)
        data_by_date = {}
        for row in rows:
            if row.fact_date not in data_by_date:
                data_by_date[row.fact_date] = {"income": 0.0, "expense": 0.0}

            # Map article types to income/expense categories
            if row.type in ["income", "credit"]:
                data_by_date[row.fact_date]["income"] += float(row.total)
            elif row.type in ["expense", "debit"]:
                data_by_date[row.fact_date]["expense"] += float(row.total)

        # Aggregate data by period and generate labels
        labels = []
        income_data = []
        expense_data = []

        if period == "month":
            # Для period='month' (≤31 дней): агрегация по календарным датам (daily)
            month_names_short = [
                "янв", "фев", "мар", "апр", "май", "июн",
                "июл", "авг", "сен", "окт", "ноя", "дек"
            ]

            # Check if period crosses month boundary (v5.1.3: show month if crosses)
            crosses_month = start_date.month != end_date.month or start_date.year != end_date.year

            current_date = start_date
            while current_date <= end_date:
                # Show month name if period crosses month boundary
                if crosses_month:
                    day_label = f"{current_date.day} {month_names_short[current_date.month - 1]}"
                else:
                    day_label = str(current_date.day)

                day_data = data_by_date.get(current_date, {"income": 0.0, "expense": 0.0})
                labels.append(day_label)
                income_data.append(day_data["income"])
                expense_data.append(day_data["expense"])
                current_date += timedelta(days=1)

        elif period == "quarter":
            # Для period='quarter': агрегация по календарным неделям с ISO номерами
            # Find the Monday of the week containing start_date
            week_start = start_date - timedelta(days=start_date.weekday())

            while week_start <= end_date:
                week_end = week_start + timedelta(days=6)
                # Don't go beyond the quarter range
                actual_week_end = min(week_end, end_date)
                actual_week_start = max(week_start, start_date)

                # Aggregate week data (only within quarter boundaries)
                week_income = sum(
                    data["income"] for d, data in data_by_date.items()
                    if actual_week_start <= d <= actual_week_end
                )
                week_expense = sum(
                    data["expense"] for d, data in data_by_date.items()
                    if actual_week_start <= d <= actual_week_end
                )

                # Get ISO week number for label
                iso_label = get_iso_week_number(week_start)

                labels.append(iso_label)
                income_data.append(week_income)
                expense_data.append(week_expense)

                # Move to next week
                week_start += timedelta(days=7)

        elif period == "year":
            # Для period='year' (>91 дней): агрегация по календарным месяцам (monthly)
            month_names_ru = [
                "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
                "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
            ]
            current_date = start_date
            while current_date <= end_date:
                # Первый и последний день текущего месяца
                month_start = date(current_date.year, current_date.month, 1)
                import calendar as cal_module
                _, last_day = cal_module.monthrange(current_date.year, current_date.month)
                month_end = date(current_date.year, current_date.month, last_day)
                # Обрезать до end_date если месяц неполный
                month_end = min(month_end, end_date)

                # Aggregate month data
                month_income = sum(
                    data["income"] for d, data in data_by_date.items()
                    if month_start <= d <= month_end
                )
                month_expense = sum(
                    data["expense"] for d, data in data_by_date.items()
                    if month_start <= d <= month_end
                )

                # Label: "Янв 2025"
                month_label = f"{month_names_ru[current_date.month - 1]} {current_date.year}"
                labels.append(month_label)
                income_data.append(month_income)
                expense_data.append(month_expense)

                # Переход к следующему месяцу
                if current_date.month == 12:
                    current_date = date(current_date.year + 1, 1, 1)
                else:
                    current_date = date(current_date.year, current_date.month + 1, 1)

        # Calculate cumulative sums if cumulative mode
        income_cumulative = []
        expense_cumulative = []
        income_period = []  # Original values for tooltip
        expense_period = []  # Original values for tooltip

        if chart_mode == "cumulative":
            # Save original period values
            income_period = income_data.copy()
            expense_period = expense_data.copy()

            # Calculate cumulative sums
            income_sum = 0.0
            expense_sum = 0.0
            for i in range(len(income_data)):
                income_sum += income_data[i]
                expense_sum += expense_data[i]
                income_cumulative.append(income_sum)
                expense_cumulative.append(expense_sum)

            # Replace data with cumulative
            income_data = income_cumulative
            expense_data = expense_cumulative

        return {
            "labels": labels,
            "income": income_data,
            "expense": expense_data,
            "income_period": income_period if chart_mode == "cumulative" else None,
            "expense_period": expense_period if chart_mode == "cumulative" else None,
            "period": period,
            "record_type": record_type,
            "chart_mode": chart_mode
        }

    except Exception as e:
        logger.error(f"Error in /trends: {str(e)}", exc_info=True)
        return {
            "labels": [],
            "income": [],
            "expense": [],
            "income_period": None,
            "expense_period": None,
            "period": period or "month",
            "record_type": record_type,
            "chart_mode": chart_mode
        }


@router.get("/category-breakdown")
async def get_category_breakdown(
    current_user: CurrentUser,
    type: str = Query("expense", pattern="^(income|expense|debit|credit|all)$"),
    period: str | None = Query(None, pattern="^(month|quarter|year|all)$"),
    date_from: date | None = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    record_type: str = Query("fact", pattern="^(fact|plan)$"),
    cfo_id: int | None = Query(None, description="Filter by Financial Center ID"),
    article_ids: list[int] | None = Query(None, description="Filter by category IDs (multiple selection)"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get category breakdown for pie chart.

    Args:
        type: Transaction type (income or expense)
        period: Time period (month, quarter, year, all) - rolling periods
            - month: last 4 calendar weeks
            - quarter: rolling 3 months
            - year: rolling 12 months
            - all: all available data
        date_from: Optional start date for custom range (overrides period)
        date_to: Optional end date for custom range (overrides period)
        record_type: Record type (fact or plan)

    Returns:
        Dict with category names and amounts
    """
    try:
        today = date.today()

        # Priority: custom date range > period parameter
        if date_from and date_to:
            start_date = date_from
            end_date = date_to
            period = "custom"  # Mark as custom range
        elif period:
            # Calculate start date based on CALENDAR period (from 1st day to today)
            if period == "month":
                # Current calendar month (from 1st day to today)
                start_date, end_date = get_current_calendar_month(today)
            elif period == "quarter":
                # Current calendar quarter (from Q start to today)
                start_date, end_date = get_current_calendar_quarter(today)
            elif period == "year":
                # Current calendar year (from Jan 1 to today)
                start_date, end_date = get_current_calendar_year(today)
            else:  # all
                start_date = date(2000, 1, 1)  # Far past
                end_date = today
        else:
            raise HTTPException(400, "Укажите period или date_from/date_to")

        # Query category breakdown
        # Shared family budget - NO user_id filter
        query = select(
            Article.name,
            func.sum(Fact.amount).label("total")
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Fact.record_type == record_type,
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date
        )

        # Apply article type filter if not 'all' (v5.1.4)
        if type != 'all':
            query = query.where(Article.type == type)

        # Apply CFO filter if specified (v5.1.3)
        if cfo_id is not None:
            query = query.where(Fact.financial_center_id == cfo_id)

        # Apply category filter if specified (v5.1.3)
        if article_ids:
            query = query.where(Fact.article_id.in_(article_ids))

        query = query.group_by(Article.name).order_by(func.sum(Fact.amount).desc())

        result = await session.execute(query)
        rows = result.all()

        # Calculate total for percentages
        total = sum(float(row.total) for row in rows)

        categories = []
        amounts = []
        percentages = []

        for row in rows:
            amount = float(row.total)
            categories.append(row.name)
            amounts.append(amount)
            percentages.append(round((amount / total * 100) if total > 0 else 0, 1))

        # Return after processing all categories
        return {
            "categories": categories,
            "amounts": amounts,
            "percentages": percentages,
            "total": total,
            "type": type,
            "period": period,
            "record_type": record_type
        }

    except Exception as e:
        logger.error(f"Error in /category-breakdown: {str(e)}", exc_info=True)
        return {
            "categories": [],
            "amounts": [],
            "percentages": [],
            "total": 0,
            "type": type,
            "period": period or "month",
            "record_type": record_type
        }


@router.get("/waterfall")
async def get_waterfall_data(
    current_user: CurrentUser,
    period: str | None = Query(None, pattern="^(month|quarter|year)$"),
    date_from: date | None = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    article_id: int | None = Query(None, description="Filter by specific article (for drill-down)"),
    cfo_id: int | None = Query(None, description="Filter by Financial Center ID"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get cumulative flow data for waterfall chart.

    Shows monthly income, expense, and cumulative balance.

    Args:
        period: Time aggregation (month, quarter, year) - rolling periods
            - month: last 4 calendar weeks
            - quarter: rolling 3 months
            - year: rolling 12 months
        date_from: Optional start date for custom range (overrides period)
        date_to: Optional end date for custom range (overrides period)
        article_id: Optional article filter for drill-down

    Returns:
        Dict with labels, income/expense data, balance, and metadata
    """
    try:
        today = date.today()

        # Priority: custom date range > period parameter
        if date_from and date_to:
            start_date = date_from
            end_date = date_to
            # Auto-determine grouping based on days difference (v5.1.3 fix)
            days_diff = (end_date - start_date).days + 1
            if days_diff <= 31:
                # <= 31 days: Group by calendar dates (daily)
                period = "month"
                group_by_expr = Fact.fact_date  # v5.1.3: use fact_date directly for DATE field
                label_format = "day"
            elif days_diff <= 91:
                # > 31 and <= 91 days: Group by calendar weeks (weekly)
                period = "quarter"
                group_by_expr = func.date_trunc("week", Fact.fact_date)
                label_format = "week"
            else:
                # > 91 days: Group by calendar months (monthly)
                period = "year"
                group_by_expr = func.date_trunc("month", Fact.fact_date)
                label_format = "month"
        elif period:
            # Calculate date range and grouping based on CALENDAR period (from 1st day to today)
            if period == "month":
                # Current calendar month (from 1st day to today)
                start_date, end_date = get_current_calendar_month(today)
                group_by_expr = Fact.fact_date
                label_format = "day"  # Group by days
            elif period == "quarter":
                # Current calendar quarter (from Q start to today)
                start_date, end_date = get_current_calendar_quarter(today)
                group_by_expr = func.date_trunc("week", Fact.fact_date)
                label_format = "week"  # Group by weeks with ISO numbers
            else:  # year
                # Current calendar year (from Jan 1 to today)
                start_date, end_date = get_current_calendar_year(today)
                group_by_expr = func.date_trunc("month", Fact.fact_date)
                label_format = "month"  # Group by months
        else:
            raise HTTPException(400, "Укажите period или date_from/date_to")

        # Build base query
        # Shared family budget - NO user_id filter
        query = select(
            group_by_expr.label("period_key"),
            Article.type,
            Article.id.label("article_id"),
            Article.name.label("article_name"),
            func.sum(Fact.amount).label("total")
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date,
            Fact.record_type == "fact"  # Only actual transactions, not plans
        )

        # Add article filter if specified (for drill-down)
        if article_id:
            query = query.where(Article.id == article_id)

        # Apply CFO filter if specified (v5.1.3)
        if cfo_id is not None:
            query = query.where(Fact.financial_center_id == cfo_id)

        query = query.group_by(group_by_expr, Article.type, Article.id, Article.name).order_by(group_by_expr)

        result = await session.execute(query)
        rows = result.all()

        # Build data structure
        period_data = {}
        articles_info = {}  # Track articles for drill-down

        for row in rows:
            # Convert period_key to date object (v5.1.3 critical fix for date_trunc)
            # date_trunc returns timestamp/datetime, we need date for period_data keys
            period_key_raw = row.period_key if row.period_key else 0

            if period_key_raw == 0:
                period_key = 0
            elif isinstance(period_key_raw, date) and not isinstance(period_key_raw, datetime):
                # Already a date object
                period_key = period_key_raw
            else:
                # datetime or timestamp - convert to date
                period_key = period_key_raw.date() if hasattr(period_key_raw, 'date') else period_key_raw

            if period_key not in period_data:
                period_data[period_key] = {"income": 0.0, "expense": 0.0, "articles": []}

            amount = float(row.total)

            # Map transfer types to income/expense for aggregation
            type_mapping = {
                'income': 'income',
                'expense': 'expense',
                'credit': 'income',   # Пополнение = доход
                'debit': 'expense'    # Списание = расход
            }
            mapped_type = type_mapping.get(row.type, 'expense')
            period_data[period_key][mapped_type] += amount

            # Store article info for potential drill-down
            if not article_id:  # Only track articles when not in drill-down mode
                articles_info[row.article_id] = row.article_name
                period_data[period_key]["articles"].append({
                    "id": row.article_id,
                    "name": row.article_name,
                    "type": row.type,
                    "amount": amount
                })

        # Calculate initial balance from previous period
        # Pass period parameter to get correct calendar period (month/quarter/year)
        prev_start, prev_end = get_previous_period(start_date, end_date, period)

        initial_balance_query = select(
            func.sum(
                case(
                    (Article.type.in_(["income", "credit"]), Fact.amount),
                    else_=0
                )
            ) -
            func.sum(
                case(
                    (Article.type.in_(["expense", "debit"]), Fact.amount),
                    else_=0
                )
            )
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Fact.fact_date >= prev_start,
            Fact.fact_date <= prev_end,
            Fact.record_type == "fact"  # Only actual transactions, not plans
        )

        # Add article filter if specified (for drill-down)
        if article_id:
            initial_balance_query = initial_balance_query.where(Article.id == article_id)

        # Apply CFO filter if specified (v5.1.3)
        if cfo_id is not None:
            initial_balance_query = initial_balance_query.where(Fact.financial_center_id == cfo_id)

        initial_balance_result = await session.execute(initial_balance_query)
        initial_balance = initial_balance_result.scalar()
        initial_balance = float(initial_balance) if initial_balance is not None else 0.0

        # Generate arrays based on period type
        labels = []
        income_data = []
        expense_data = []
        balance_data = []
        categories_data = []  # For drill-down links

        cumulative_balance = initial_balance

        if label_format == "day":
            # Для периода ≤31 день: показывать дни (v5.1.3: с месяцем если пересекает границу)
            month_names_short = [
                "янв", "фев", "мар", "апр", "май", "июн",
                "июл", "авг", "сен", "окт", "ноя", "дек"
            ]

            # Check if period crosses month boundary
            crosses_month = start_date.month != end_date.month or start_date.year != end_date.year

            current_date = start_date
            while current_date <= end_date:
                # Show month name if period crosses month boundary
                if crosses_month:
                    day_label = f"{current_date.day} {month_names_short[current_date.month - 1]}"
                else:
                    day_label = str(current_date.day)

                day_info = period_data.get(current_date, {"income": 0.0, "expense": 0.0, "articles": []})
                income = day_info["income"]
                expense = day_info["expense"]
                day_balance = income - expense
                cumulative_balance += day_balance

                labels.append(day_label)
                income_data.append(income)
                expense_data.append(expense)
                balance_data.append(cumulative_balance)
                categories_data.append(day_info.get("articles", []))

                current_date += timedelta(days=1)

        elif label_format == "week":
            # Для period='quarter': агрегация по календарным неделям с ISO номерами
            # With date_trunc("week"), period_data keys are Mondays (week start dates)
            # SQL already aggregated data by week, so we just look up by week_start
            # Generate ALL weeks in quarter range, even if no data exists
            # Find Monday of the week containing start_date
            week_start = start_date - timedelta(days=start_date.weekday())

            while week_start <= end_date:
                # With date_trunc("week"), data is already aggregated by week in SQL
                # period_data keys are Mondays (week start dates)
                week_data = period_data.get(week_start, {"income": 0.0, "expense": 0.0, "articles": []})
                week_income = week_data["income"]
                week_expense = week_data["expense"]
                week_articles = week_data.get("articles", [])

                week_balance = week_income - week_expense
                cumulative_balance += week_balance

                # Get ISO week number for label
                iso_label = get_iso_week_number(week_start)

                labels.append(iso_label)
                income_data.append(week_income)
                expense_data.append(week_expense)
                balance_data.append(cumulative_balance)
                categories_data.append(week_articles)

                # Move to next week
                week_start += timedelta(days=7)

        elif label_format == "month":
            # Для custom range >91 дней: агрегация по календарным месяцам (v5.1.3 fix)
            month_names_ru = [
                "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
                "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
            ]

            # Generate ALL months in range, even if no data exists
            current_date = date(start_date.year, start_date.month, 1)  # First day of start month

            while current_date <= end_date:
                # Find month start from date_trunc result (if exists in period_data)
                # period_data keys are month start dates (1st of month) from date_trunc('month')
                month_data = period_data.get(current_date, {"income": 0.0, "expense": 0.0, "articles": []})

                month_income = month_data["income"]
                month_expense = month_data["expense"]
                month_balance = month_income - month_expense
                cumulative_balance += month_balance

                # Label: "Янв 2025"
                month_label = f"{month_names_ru[current_date.month - 1]} {current_date.year}"
                labels.append(month_label)
                income_data.append(month_income)
                expense_data.append(month_expense)
                balance_data.append(cumulative_balance)
                categories_data.append(month_data.get("articles", []))

                # Move to next month
                if current_date.month == 12:
                    current_date = date(current_date.year + 1, 1, 1)
                else:
                    current_date = date(current_date.year, current_date.month + 1, 1)

        else:
            # Custom range или старая логика: group by day
            current_date = start_date
            while current_date <= end_date:
                period_info = period_data.get(current_date, {"income": 0.0, "expense": 0.0, "articles": []})
                income = period_info["income"]
                expense = period_info["expense"]
                day_balance = income - expense
                cumulative_balance += day_balance

                labels.append(current_date.strftime("%d.%m"))
                income_data.append(income)
                expense_data.append(expense)
                balance_data.append(cumulative_balance)
                categories_data.append(period_info.get("articles", []))

                current_date += timedelta(days=1)

        # Return data for all branches (week, month, else)
        result = {
            "labels": labels,
            "income": income_data,
            "expense": expense_data,
            "balance": balance_data,
            "categories": categories_data,  # For drill-down
            "initial_balance": initial_balance,  # Starting balance from previous period
            "period": period,
            "year": today.year,
            "article_id": article_id,
            "article_name": articles_info.get(article_id) if article_id else None
        }

        return result

    except Exception as e:
        logger.error(f"Error in /waterfall: {str(e)}", exc_info=True)
        return {
            "labels": [],
            "income": [],
            "expense": [],
            "balance": [],
            "categories": [],
            "initial_balance": 0.0,  # CRITICAL: Must be present for frontend
            "period": period or "month",
            "year": date.today().year,
            "article_id": article_id,
            "article_name": None
        }


@router.get("/heatmap")
async def get_heatmap_data(
    current_user: CurrentUser,
    period: str | None = Query(None, pattern="^(month|quarter|year)$"),
    date_from: date | None = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: date | None = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    transaction_filter: TransactionFilterEnum | None = Query(None, description="Filter by transaction type (debit/credit/all) - takes priority over article_type"),
    article_type: str = Query("expense", pattern="^(income|expense|debit|credit|all)$"),
    record_type: str = Query("fact", pattern="^(fact|plan)$"),
    cfo_id: int | None = Query(None, description="Filter by Financial Center ID"),
    article_ids: list[int] | None = Query(None, description="Filter by category IDs (multiple selection)"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get spending patterns data for heatmap with dynamic aggregation.

    Args:
        period: Time range (month, quarter, year) - rolling periods
            - month: last 28 days from today → aggregate by weeks
            - quarter: current quarter → aggregate by weeks
            - year: last 365 days from today → aggregate by months
        date_from: Optional start date for custom range (overrides period)
        date_to: Optional end date for custom range (overrides period)
        article_type: Type of category (income, expense, debit, credit or all)
        record_type: Type of records (fact or plan)

    Returns:
        Heatmap data with dynamic aggregation:
        - ≤7 days: aggregate by days (horizontal)
        - 7-30 days: aggregate by weeks (days × weeks)
        - >30 days: aggregate by months (weeks × months)
    """
    try:
        today = date.today()
        date_mapping = {}  # Initialize early for all aggregation types

        # Priority: custom date range > period parameter
        if date_from and date_to:
            start_date = date_from
            end_date = date_to
            # Auto-determine aggregation based on days difference (v5.1.3 fix)
            days_diff = (end_date - start_date).days + 1
            if days_diff <= 31:
                # <= 31 days: aggregate by calendar weeks with ISO week number
                aggregation = "week"
            elif days_diff <= 91:
                # > 31 and <= 91 days: aggregate by calendar weeks with ISO week number
                aggregation = "week"
            else:
                # > 91 days: aggregate by calendar months (monthly)
                aggregation = "month"
        elif period:
            # Calculate date range and aggregation based on CALENDAR period (from 1st day to today)
            if period == "month":
                # Current calendar month → aggregate by weeks (weeks × weekdays grid)
                start_date, end_date = get_current_calendar_month(today)
                aggregation = "week"
            elif period == "quarter":
                # Current calendar quarter → aggregate by months
                start_date, end_date = get_current_calendar_quarter(today)
                aggregation = "month"
            else:  # year
                # Current calendar year → aggregate by months
                start_date, end_date = get_current_calendar_year(today)
                aggregation = "month"
        else:
            raise HTTPException(400, "Укажите period или date_from/date_to")

        # Query all facts with article_type and record_type filters
        # Shared family budget - NO user_id filter
        query = select(
            Fact.fact_date,
            func.coalesce(func.sum(Fact.amount), 0).label("total")
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Fact.record_type == record_type,
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date
        )

        # Apply transaction_filter (takes priority over article_type)
        # transaction_filter is validated by TransactionFilterEnum (only debit/credit/all allowed)
        if transaction_filter is not None:
            # transaction_filter takes priority over legacy article_type parameter
            effective_filter = transaction_filter.value  # debit, credit, or all
            if effective_filter != 'all':
                query = query.where(Article.type == effective_filter)
        elif article_type != 'all':
            # Fallback to article_type if transaction_filter not provided (backward compatibility)
            query = query.where(Article.type == article_type)

        # Apply CFO filter if specified (v5.1.3)
        if cfo_id is not None:
            query = query.where(Fact.financial_center_id == cfo_id)

        # Apply category filter if specified (v5.1.3)
        if article_ids:
            query = query.where(Fact.article_id.in_(article_ids))

        query = query.group_by(Fact.fact_date)

        result = await session.execute(query)
        rows = result.all()
        logger.debug(f"[HEATMAP] Query returned {len(rows)} rows for {start_date} to {end_date}")

        # Build data by date (guard against None values)
        data_by_date = {row.fact_date: float(row.total) if row.total is not None else 0.0 for row in rows}

        # Generate heatmap data based on aggregation type
        if aggregation == "single_week":
            # Для периода "неделя": одна строка с 7 дня Hopefully (Пн-Вс)
            # X-axis: дни недели (Пн-Вс)
            # Y-axis: ISO номер недели
            day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
            xAxis = day_names
            iso_week_label = get_iso_week_number(today)
            yAxis = [iso_week_label]

            # Генерация данных для недели
            week_data = []
            current_date = start_date
            while current_date <= end_date:
                amount = data_by_date.get(current_date, 0.0)
                week_data.append(amount)
                current_date += timedelta(days=1)

            # Дополнить нулями до 7 дней (если неполная неделя)
            while len(week_data) < 7:
                week_data.append(0.0)

            data = [week_data]  # Single row

        elif aggregation == "week":
            # Для custom range ≤91 дней: недели × 7 дней grid (v5.1.4)
            # X-axis: дни недели (Пн-Вс)
            # Y-axis: недели (ISO номер недели в году)
            day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
            xAxis = day_names
            yAxis = []
            data = []

            # Build date_mapping for tooltip display
            # Format: {yIndex: {xIndex: "DD.MM.YYYY"}}
            date_mapping = {}

            # Generate ALL weeks in custom range (not just last 4)
            # Find Monday of the week containing start_date
            week_start = start_date - timedelta(days=start_date.weekday())

            week_idx = 0
            while week_start <= end_date:
                week_end = week_start + timedelta(days=6)
                # Don't go beyond the overall range
                actual_week_end = min(week_end, end_date)
                actual_week_start = max(week_start, start_date)

                # Label: ISO week number only
                # Use Monday of the week for ISO week calculation
                iso_week = get_iso_week_number(week_start)
                week_label = str(iso_week)
                yAxis.append(week_label)

                # Генерация данных для недели
                week_data = []
                date_mapping[str(week_idx)] = {}

                for day_offset in range(7):  # Mon-Sun
                    current_date = week_start + timedelta(days=day_offset)
                    # Only include data if within the actual range
                    if start_date <= current_date <= end_date:
                        amount = data_by_date.get(current_date, 0.0)
                        date_mapping[str(week_idx)][str(day_offset)] = current_date.strftime("%d.%m.%Y")
                    else:
                        amount = 0.0  # Outside range
                    week_data.append(amount)

                data.append(week_data)

                # Move to next week
                week_start += timedelta(days=7)
                week_idx += 1

        elif aggregation == "month":
            # Для периода "квартал/год": месяцы × недели grid
            # X-axis: 4 недели в месяце (Н1-Н4)
            # Y-axis: месяцы с годом (сверху вниз от старых к новым)
            xAxis = ["Н1", "Н2", "Н3", "Н4"]
            yAxis = []
            data = []

            # Итерация по календарным месяцам от start_date до end_date
            month_names_ru = [
                "Янв", "Фев", "Мар", "Апр", "Май", "Июн",
                "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"
            ]

            current_date = start_date
            while current_date <= end_date:
                # Первый и последний день текущего месяца
                month_start = date(current_date.year, current_date.month, 1)
                import calendar as cal_module
                _, last_day = cal_module.monthrange(current_date.year, current_date.month)
                month_end = date(current_date.year, current_date.month, last_day)
                # Обрезать до end_date если месяц неполный
                month_end = min(month_end, end_date)

                # Label: "Янв 2025"
                month_label = f"{month_names_ru[current_date.month - 1]} {current_date.year}"
                yAxis.append(month_label)

                # Агрегировать по 4 неделям внутри месяца
                # Н1 = дни 1-7, Н2 = дни 8-14, Н3 = дни 15-21, Н4 = дни 22-31
                month_data = [0.0] * 4

                # Найти все даты в месяце
                iter_date = month_start
                while iter_date <= month_end:
                    # Определить номер недели внутри месяца (0-3)
                    day_of_month = iter_date.day
                    if day_of_month <= 7:
                        week_of_month = 0  # Н1
                    elif day_of_month <= 14:
                        week_of_month = 1  # Н2
                    elif day_of_month <= 21:
                        week_of_month = 2  # Н3
                    else:
                        week_of_month = 3  # Н4 (дни 22-31)

                    month_data[week_of_month] += data_by_date.get(iter_date, 0.0)
                    iter_date += timedelta(days=1)

                data.append(month_data)

                # Переход к следующему месяцу
                if current_date.month == 12:
                    current_date = date(current_date.year + 1, 1, 1)
                else:
                    current_date = date(current_date.year, current_date.month + 1, 1)

            # Развернуть порядок для отображения сверху вниз (Янв вверху, Дек внизу)
            yAxis.reverse()
            data.reverse()

        else:
            # Custom range или старая логика: по дням
            data = []
            xAxis = []
            current_date = start_date
            while current_date <= end_date:
                amount = data_by_date.get(current_date, 0.0)
                data.append([amount])
                xAxis.append(current_date.strftime("%d.%m"))
                current_date += timedelta(days=1)
            yAxis = [""]

        # Return data for all branches (single_week, week, month, else)
        result = {
            "data": data,  # 2D array: [row][col] where row=yAxis, col=xAxis
            "xAxis": xAxis,  # Labels for X-axis (horizontal)
            "yAxis": yAxis,  # Labels for Y-axis (vertical)
            "aggregation": aggregation,  # "day", "week", or "month"
            "period": period,
            "article_type": article_type,
            "record_type": record_type,
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat()
        }

        # Add date_mapping for week aggregation (month period)
        if aggregation == "week" and 'date_mapping' in locals():
            result["date_mapping"] = date_mapping

        return result

    except Exception as e:
        logger.error(
            f"[HEATMAP] Error: {str(e)}. "
            f"Params: period={period}, article_type={article_type}, "
            f"record_type={record_type}, cfo_id={cfo_id}, article_ids={article_ids}",
            exc_info=True
        )
        return {
            "data": [],
            "xAxis": [],
            "yAxis": [],
            "aggregation": "day",
            "period": period or "month",
            "article_type": article_type,
            "record_type": record_type,
            "start_date": date.today().isoformat(),
            "end_date": date.today().isoformat()
        }


# ==================== Plan Analytics Endpoints ====================


@router.get("/plans/monthly-comparison")
async def get_plans_monthly_comparison(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    planning_month: str | None = Query(
        None,
        description="Planning month in YYYY-MM format (defaults to current month)",
        regex=r"^\d{4}-(0[1-9]|1[0-2])$"
    ),
    financial_center_id: int | None = Query(
        None,
        description="Filter by financial center ID (omit for all centers)"
    ),
    article_type: str | None = Query(
        None,
        description="Filter by article type: expense, income, debit, credit"
    ),
    article_id: int | None = Query(
        None,
        description="Filter by specific article/category ID"
    )
):
    """
    Get plan analytics with comparison between current and previous months.

    Provides data for planning analytics:
    - Totals by operation type (expense, income, debit, credit)
    - Breakdown by categories with current vs previous month
    - Month-over-month comparison

    Used for plan.html analytics section with 2 charts:
    1. Bar chart: Operation types with current vs previous month columns
    2. Bar chart: Categories with current vs previous month columns

    **Previous month data logic:**
    - If selected month is current calendar month → previous month shows FACT data
    - If selected month is a future month → previous month shows PLAN data

    Args:
        planning_month: Target month in YYYY-MM format (defaults to current month)
        financial_center_id: Optional filter by ЦФО
        article_type: Optional filter by article type
        article_id: Optional filter by specific category

    Returns:
        JSON with by_type totals, categories_comparison, and month data
    """
    # Determine current planning month
    if planning_month:
        try:
            year, month = map(int, planning_month.split("-"))
            current_month_date = date(year, month, 1)
        except ValueError:
            raise HTTPException(
                status_code=400,
                detail="Invalid planning_month format. Use YYYY-MM."
            )
    else:
        today = date.today()
        current_month_date = date(today.year, today.month, 1)

    # Calculate previous month
    if current_month_date.month == 1:
        previous_month_date = date(current_month_date.year - 1, 12, 1)
    else:
        previous_month_date = date(current_month_date.year, current_month_date.month - 1, 1)

    # Determine record_type for previous month based on selected month
    # If selected month is current calendar month → previous shows fact data
    # If selected month is future → previous shows plan data
    today = date.today()
    actual_current_month = date(today.year, today.month, 1)
    is_current_or_past_month = current_month_date <= actual_current_month
    previous_month_record_type = "fact" if is_current_or_past_month else "plan"

    async def get_month_data(month_date: date, record_type: str = "plan") -> dict:
        """Get data for a specific month with specified record_type."""
        # Calculate month end date for range comparison
        # Using date range instead of date_trunc for PostgreSQL type compatibility
        _, last_day = cal_module.monthrange(month_date.year, month_date.month)
        month_end = date(month_date.year, month_date.month, last_day)

        # Base conditions (without article filters for type totals)
        # Shared family budget - NO user_id filter (consistent with quick-stats-html)
        base_conditions = [
            Fact.record_type == record_type,
            Fact.fact_date >= month_date,
            Fact.fact_date <= month_end
        ]

        if financial_center_id is not None:
            base_conditions.append(Fact.financial_center_id == financial_center_id)

        # Query for totals by article type (always all 4 types, no article filter)
        totals_stmt = (
            select(
                Article.type,
                func.coalesce(func.sum(Fact.amount), 0).label("total")
            )
            .select_from(Fact)
            .join(Article, Fact.article_id == Article.id)
            .where(*base_conditions)
            .group_by(Article.type)
        )

        totals_result = await session.execute(totals_stmt)
        totals_by_type = {row.type: float(row.total) for row in totals_result.all()}

        # Ensure all 4 types present
        by_type = {
            "expense": totals_by_type.get("expense", 0.0),
            "income": totals_by_type.get("income", 0.0),
            "debit": totals_by_type.get("debit", 0.0),
            "credit": totals_by_type.get("credit", 0.0)
        }

        # Add article filters for category breakdown
        category_conditions = list(base_conditions)
        if article_type is not None:
            category_conditions.append(Article.type == article_type)
        if article_id is not None:
            category_conditions.append(Fact.article_id == article_id)

        # Query for breakdown by category
        categories_stmt = (
            select(
                Article.id.label("category_id"),
                Article.name.label("category_name"),
                Article.type.label("category_type"),
                func.coalesce(func.sum(Fact.amount), 0).label("amount")
            )
            .select_from(Fact)
            .join(Article, Fact.article_id == Article.id)
            .where(*category_conditions)
            .group_by(Article.id, Article.name, Article.type)
            .order_by(func.sum(Fact.amount).desc())
        )

        categories_result = await session.execute(categories_stmt)
        by_category = [
            {
                "category_id": row.category_id,
                "category_name": row.category_name,
                "category_type": row.category_type,
                "amount": float(row.amount)
            }
            for row in categories_result.all()
        ]

        # Count total records
        count_stmt = (
            select(func.count(Fact.id))
            .select_from(Fact)
            .join(Article, Fact.article_id == Article.id)
            .where(*category_conditions)
        )
        count_result = await session.execute(count_stmt)
        total_records = count_result.scalar_one()

        # Generate month name with data type prefix for legend
        base_month_name = get_russian_month_name(month_date.month, month_date.year)
        data_type_label = "Факт" if record_type == "fact" else "План"

        return {
            "month": month_date.strftime("%Y-%m"),
            "month_name": f"{data_type_label} {base_month_name}",
            "record_type": record_type,
            "by_type": by_type,
            "total": sum(by_type.values()),
            "total_records": total_records,
            "by_category": by_category
        }

    # Get data for both months
    # Current month always shows plan data
    # Previous month shows fact data for current/past months, plan data for future months
    current_data = await get_month_data(current_month_date, record_type="plan")
    previous_data = await get_month_data(previous_month_date, record_type=previous_month_record_type)

    # Merge categories from both months for comparison chart
    all_categories = {}
    for cat in current_data["by_category"]:
        all_categories[cat["category_id"]] = {
            "category_id": cat["category_id"],
            "category_name": cat["category_name"],
            "category_type": cat["category_type"],
            "current": cat["amount"],
            "previous": 0.0
        }
    for cat in previous_data["by_category"]:
        if cat["category_id"] in all_categories:
            all_categories[cat["category_id"]]["previous"] = cat["amount"]
        else:
            all_categories[cat["category_id"]] = {
                "category_id": cat["category_id"],
                "category_name": cat["category_name"],
                "category_type": cat["category_type"],
                "current": 0.0,
                "previous": cat["amount"]
            }

    # Sort by max amount (current or previous)
    categories_comparison = sorted(
        all_categories.values(),
        key=lambda x: max(x["current"], x["previous"]),
        reverse=True
    )

    # Calculate comparison metrics for each type
    def calc_change(current: float, previous: float) -> dict:
        change = current - previous
        if previous > 0:
            change_percent = round((change / previous) * 100, 1)
        elif current > 0:
            change_percent = 100.0
        else:
            change_percent = 0.0
        return {"change": change, "change_percent": change_percent}

    comparison_by_type = {}
    for op_type in ["expense", "income", "debit", "credit"]:
        comp = calc_change(
            current_data["by_type"][op_type],
            previous_data["by_type"][op_type]
        )
        comparison_by_type[op_type] = comp

    return {
        "current_month": current_data,
        "previous_month": previous_data,
        "previous_month_data_type": previous_month_record_type,
        "categories_comparison": categories_comparison,
        "comparison_by_type": comparison_by_type,
        "filters": {
            "planning_month": current_month_date.strftime("%Y-%m"),
            "financial_center_id": financial_center_id,
            "article_type": article_type,
            "article_id": article_id
        }
    }


def get_russian_month_name(month: int, year: int) -> str:
    """Get Russian month name with year."""
    month_names = {
        1: "Январь", 2: "Февраль", 3: "Март",
        4: "Апрель", 5: "Май", 6: "Июнь",
        7: "Июль", 8: "Август", 9: "Сентябрь",
        10: "Октябрь", 11: "Ноябрь", 12: "Декабрь"
    }
    return f"{month_names.get(month, '')} {year}"


# ==================== Fact Hints for Modals ====================


@router.get("/fact-hints", response_model=FactHintsResponse)
async def get_fact_hints(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    article_id: int | None = Query(None, gt=0, description="Category ID"),
    fact_date: date = Query(..., description="Transaction date (YYYY-MM-DD)"),
    article_type: str = Query(
        "expense",
        pattern="^(income|expense|debit|credit)$",
        description="Article type: expense, income, debit, or credit"
    ),
    financial_center_id: int | None = Query(
        None,
        gt=0,
        description="Financial center ID filter"
    ),
):
    """
    Get fact hints for the fact creation modal.

    Returns sum of plans and facts for the CURRENT month (based on fact_date).
    Used to display hints in fact creation modal (display-only, not clickable).

    Logic:
        - fact_date=2025-12-15 → period = December 2025
        - Returns: sum of plans + sum of facts for that month

    NOTE: Shared Family Budget - NO user_id filter (all users see all data)

    Args:
        article_id: Optional category ID filter
        fact_date: Transaction date (determines the month)
        article_type: Type of article (expense, income, debit, credit)
        financial_center_id: Optional financial center filter

    Returns:
        FactHintsResponse with period_plan_sum, period_fact_sum, and metadata
    """
    # Calculate month boundaries from fact_date
    month_start = date(fact_date.year, fact_date.month, 1)
    _, last_day = cal_module.monthrange(fact_date.year, fact_date.month)
    month_end = date(fact_date.year, fact_date.month, last_day)
    period_str = f"{fact_date.year}-{fact_date.month:02d}"

    # Get article name if provided
    article_name = None
    if article_id:
        result = await session.execute(
            select(Article.name).where(Article.id == article_id)
        )
        row = result.first()
        if row:
            article_name = row[0]

    # Map article_type to filter (debit→expense, credit→income for aggregation)
    type_filter = article_type
    if article_type == "debit":
        type_filter = "expense"
    elif article_type == "credit":
        type_filter = "income"

    # Base query conditions (Shared Family Budget - NO user_id filter!)
    base_conditions = [
        Fact.fact_date >= month_start,
        Fact.fact_date <= month_end,
    ]

    # Query PLANS for the month
    plan_query = (
        select(func.sum(Fact.amount).label("total"))
        .select_from(Fact)
        .join(Article, Fact.article_id == Article.id)
        .where(
            *base_conditions,
            Fact.record_type == "plan",
            Article.type.in_([article_type, type_filter])
        )
    )
    if article_id:
        plan_query = plan_query.where(Fact.article_id == article_id)
    if financial_center_id:
        plan_query = plan_query.where(Fact.financial_center_id == financial_center_id)

    plan_result = await session.execute(plan_query)
    period_plan_sum = plan_result.scalar_one_or_none()

    # Query FACTS for the month
    fact_query = (
        select(func.sum(Fact.amount).label("total"))
        .select_from(Fact)
        .join(Article, Fact.article_id == Article.id)
        .where(
            *base_conditions,
            Fact.record_type == "fact",
            Article.type.in_([article_type, type_filter])
        )
    )
    if article_id:
        fact_query = fact_query.where(Fact.article_id == article_id)
    if financial_center_id:
        fact_query = fact_query.where(Fact.financial_center_id == financial_center_id)

    fact_result = await session.execute(fact_query)
    period_fact_sum = fact_result.scalar_one_or_none()

    return FactHintsResponse(
        period_plan_sum=period_plan_sum,
        period_fact_sum=period_fact_sum,
        period=period_str,
        article_id=article_id,
        article_name=article_name,
        article_type=article_type
    )


# ==================== Plan Hints for Plan Modal ====================


@router.get("/plan-hints", response_model=PlanHintsResponse)
async def get_plan_hints(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    period: str = Query(
        ...,
        pattern=r"^\d{4}-\d{2}$",
        description="Period in YYYY-MM format"
    ),
    article_type: str = Query(
        "expense",
        pattern="^(income|expense|debit|credit)$",
        description="Article type: expense, income, debit, or credit"
    ),
    article_id: int | None = Query(None, gt=0, description="Category ID"),
    financial_center_id: int | None = Query(
        None,
        gt=0,
        description="Financial center ID filter"
    ),
):
    """
    Get plan hints for plan creation modal.

    Returns sum of plans and facts for the PREVIOUS month (relative to period).
    Used to populate clickable hint buttons in plan modal.

    Example:
        period=2025-12 → prev_period = November 2025 → returns Nov sums

    Logic:
        - period=2025-12 → previous month = 2025-11
        - Returns: sum of plans + sum of facts for November 2025

    NOTE: Shared Family Budget - NO user_id filter (all users see all data)

    Args:
        period: Month for which to get hints (YYYY-MM format)
        article_type: Type of article (expense, income, debit, credit)
        article_id: Optional category ID filter
        financial_center_id: Optional financial center filter

    Returns:
        PlanHintsResponse with prev_period_plan_sum, prev_period_fact_sum, and metadata
    """
    # Parse period and calculate previous month
    year, month = map(int, period.split('-'))
    if month == 1:
        prev_year, prev_month = year - 1, 12
    else:
        prev_year, prev_month = year, month - 1

    prev_period_str = f"{prev_year}-{prev_month:02d}"

    # Calculate month boundaries for previous month
    _, last_day = cal_module.monthrange(prev_year, prev_month)
    month_start = date(prev_year, prev_month, 1)
    month_end = date(prev_year, prev_month, last_day)

    # Get article name if provided
    article_name = None
    if article_id:
        result = await session.execute(
            select(Article.name).where(Article.id == article_id)
        )
        row = result.first()
        if row:
            article_name = row[0]

    # Map article_type to filter (debit→expense, credit→income for aggregation)
    type_filter = article_type
    if article_type == "debit":
        type_filter = "expense"
    elif article_type == "credit":
        type_filter = "income"

    # Base query conditions (Shared Family Budget - NO user_id filter!)
    base_conditions = [
        Fact.fact_date >= month_start,
        Fact.fact_date <= month_end,
    ]

    # Query PLANS for the previous month
    plan_query = (
        select(func.sum(Fact.amount).label("total"))
        .select_from(Fact)
        .join(Article, Fact.article_id == Article.id)
        .where(
            *base_conditions,
            Fact.record_type == "plan",
            Article.type.in_([article_type, type_filter])
        )
    )
    if article_id:
        plan_query = plan_query.where(Fact.article_id == article_id)
    if financial_center_id:
        plan_query = plan_query.where(Fact.financial_center_id == financial_center_id)

    plan_result = await session.execute(plan_query)
    prev_period_plan_sum = plan_result.scalar_one_or_none()

    # Query FACTS for the previous month
    fact_query = (
        select(func.sum(Fact.amount).label("total"))
        .select_from(Fact)
        .join(Article, Fact.article_id == Article.id)
        .where(
            *base_conditions,
            Fact.record_type == "fact",
            Article.type.in_([article_type, type_filter])
        )
    )
    if article_id:
        fact_query = fact_query.where(Fact.article_id == article_id)
    if financial_center_id:
        fact_query = fact_query.where(Fact.financial_center_id == financial_center_id)

    fact_result = await session.execute(fact_query)
    prev_period_fact_sum = fact_result.scalar_one_or_none()

    return PlanHintsResponse(
        prev_period_plan_sum=prev_period_plan_sum,
        prev_period_fact_sum=prev_period_fact_sum,
        prev_period=prev_period_str,
        article_id=article_id,
        article_name=article_name,
        article_type=article_type
    )
