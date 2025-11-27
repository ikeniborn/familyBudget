"""
Analytics API endpoints.

Provides aggregated data for charts and dashboards.
"""

import calendar as cal_module
import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from sqlalchemy import case
from sqlmodel import func, select, text
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact as Fact
from backend.app.schemas.analytics import (
    RecommendedAmountsMetadata,
    RecommendedAmountsResponse,
)
from backend.app.utils.date_helpers import (
    get_current_calendar_month,
    get_current_calendar_quarter,
    get_current_calendar_year,
    get_iso_week_number,
    get_quarter_bounds,
    get_rolling_months,
    get_rolling_weeks,
    get_week_bounds,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


# ==================== Helper Functions for Plan-Fact Analysis ====================


def distribute_plan_by_days(
    plan_by_date: Dict[date, float],
    start_date: date,
    end_date: date
) -> List[float]:
    """
    Distribute monthly plans evenly across all days.

    Algorithm:
        1. Group all plans by month (sum plans for same month)
        2. Calculate average per day = total_plan_for_month / days_in_month
        3. Return array with average for each day in range

    Example:
        Plan: 30000₽ on 2025-11-01
        Result: 1000₽ per day for all days in November (30 days)

    Args:
        plan_by_date: Dict mapping date → plan amount (from DB query)
        start_date: First date in range
        end_date: Last date in range (inclusive)

    Returns:
        List of plan amounts for each day in range (distributed evenly)
    """
    # 1. Group plans by month and sum
    month_plans: Dict[Tuple[int, int], Dict[str, float]] = {}

    for plan_date, amount in plan_by_date.items():
        month_key = (plan_date.year, plan_date.month)

        if month_key not in month_plans:
            days_in_month = cal_module.monthrange(plan_date.year, plan_date.month)[1]
            month_plans[month_key] = {
                'total': 0.0,
                'days': days_in_month,
                'avg_per_day': 0.0
            }

        month_plans[month_key]['total'] += amount

    # 2. Calculate average per day for each month
    for month_key, plan_info in month_plans.items():
        plan_info['avg_per_day'] = plan_info['total'] / plan_info['days']

    # 3. Generate array with average for each day
    result = []
    current_date = start_date

    while current_date <= end_date:
        month_key = (current_date.year, current_date.month)
        avg = month_plans.get(month_key, {}).get('avg_per_day', 0.0)
        result.append(avg)
        current_date += timedelta(days=1)

    return result


def distribute_plan_by_months(
    plan_by_date: Dict[date, float],
    start_date: date,
    end_date: date
) -> Dict[Tuple[int, int], float]:
    """
    Distribute plans evenly across months (for quarter/year periods).

    Algorithm:
        1. Group all plans by quarter or year
        2. Calculate number of months in period
        3. Calculate average per month = total_plan_for_period / num_months
        4. Return dict mapping month_key → average amount

    Example (quarter):
        Plan: 90000₽ for Q1 2025
        Result: 30000₽ per month (Jan, Feb, Mar)

    Example (year):
        Plan: 360000₽ for 2025
        Result: 30000₽ per month (Jan-Dec)

    Args:
        plan_by_date: Dict mapping date → plan amount (from DB query)
        start_date: First date in range
        end_date: Last date in range (inclusive)

    Returns:
        Dict mapping (year, month) → average plan amount
    """
    # 1. Calculate number of months in the period
    num_months = (end_date.year - start_date.year) * 12 + end_date.month - start_date.month + 1

    # 2. Sum all plans in the period
    total_plan = sum(plan_by_date.values())

    # 3. Calculate average per month
    avg_per_month = total_plan / num_months if num_months > 0 else 0.0

    # 4. Create dict for each month in range
    result: Dict[Tuple[int, int], float] = {}
    current_date = start_date

    while current_date <= end_date:
        month_key = (current_date.year, current_date.month)
        result[month_key] = avg_per_month

        # Move to next month
        if current_date.month == 12:
            current_date = date(current_date.year + 1, 1, 1)
        else:
            current_date = date(current_date.year, current_date.month + 1, 1)

    return result


def calculate_cumulative(data: List[float]) -> List[float]:
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


def get_previous_period(start_date: date, end_date: date) -> Tuple[date, date]:
    """
    Calculate previous period boundaries by shifting backwards by period length.

    Used for waterfall chart initial balance calculation.

    Example:
        Input:  15.10.2025 - 10.11.2025 (27 days)
        Output: 18.09.2025 - 14.10.2025 (27 days before)

    Args:
        start_date: Start of current period
        end_date: End of current period

    Returns:
        Tuple of (prev_start_date, prev_end_date)
    """
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


@router.get("/quick-stats-html", response_class=HTMLResponse)
async def get_quick_stats_html(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
) -> str:
    """
    Get quick statistics for dashboard (HTML formatted).

    Returns today's and current month's income/expense summary as HTML.
    Uses DaisyUI stats components for beautiful display.
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

    # Calculate stats (include credit as income, debit as expense)
    today_income = today_data.get("income", 0.0) + today_data.get("credit", 0.0)
    today_expense = today_data.get("expense", 0.0) + today_data.get("debit", 0.0)
    today_balance = today_income - today_expense

    month_income = month_data.get("income", 0.0) + month_data.get("credit", 0.0)
    month_expense = month_data.get("expense", 0.0) + month_data.get("debit", 0.0)
    month_balance = month_income - month_expense

    # Format numbers with thousands separator
    def format_money(amount: float) -> str:
        return f"{amount:,.2f}".replace(",", " ")

    # Generate HTML using DaisyUI stats components
    html = f"""
    <div class="stats stats-vertical lg:stats-horizontal shadow w-full">
        <div class="stat">
            <div class="stat-figure text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <div class="stat-title">Сегодня</div>
            <div class="stat-value text-sm lg:text-2xl">
                <span class="text-success">+{format_money(today_income)}</span> /
                <span class="text-error">-{format_money(today_expense)}</span>
            </div>
            <div class="stat-desc">
                Баланс: <span class="font-bold {'text-success' if today_balance >= 0 else 'text-error'}">{format_money(abs(today_balance))} ₽</span>
            </div>
        </div>

        <div class="stat">
            <div class="stat-figure text-secondary">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="inline-block w-8 h-8 stroke-current"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4"></path></svg>
            </div>
            <div class="stat-title">Текущий месяц</div>
            <div class="stat-value text-sm lg:text-2xl">
                <span class="text-success">+{format_money(month_income)}</span> /
                <span class="text-error">-{format_money(month_expense)}</span>
            </div>
            <div class="stat-desc">
                Баланс: <span class="font-bold {'text-success' if month_balance >= 0 else 'text-error'}">{format_money(abs(month_balance))} ₽</span>
            </div>
        </div>
    </div>
    """

    return html


@router.get("/plan-fact")
async def get_plan_fact_data(
    current_user: CurrentUser,
    period: Optional[str] = Query(None, pattern="^(month|quarter|year)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    article_type: str = Query("expense", pattern="^(income|expense|debit|credit|all)$"),
    chart_mode: str = Query("cumulative", pattern="^(normal|cumulative)$"),
    cfo_id: Optional[int] = Query(None, description="Filter by Financial Center ID"),
    article_ids: Optional[List[int]] = Query(None, description="Filter by category IDs (multiple selection)"),
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
                periods_count = days_diff
                date_format = "%d" if days_diff > 7 else None  # Russian day names for <= 7 days
            elif days_diff <= 91:
                # > 31 and <= 91 days: Group by calendar weeks (weekly)
                period = "quarter"
                periods_count = (days_diff + 6) // 7  # Number of weeks (rounded up)
                date_format = "week"
            else:
                # > 91 days: Group by calendar months (monthly)
                period = "year"
                # Calculate actual number of months in the range
                months_diff = (end_date.year - start_date.year) * 12 + (end_date.month - start_date.month) + 1
                periods_count = months_diff
                date_format = "month"
        elif period:
            # Calculate date range based on CALENDAR period (from 1st day to today)
            if period == "month":
                # Current calendar month (from 1st day to today)
                start_date, end_date = get_current_calendar_month(today)
                periods_count = (end_date - start_date).days + 1  # Days in current month
                date_format = "day"  # Show by days
            elif period == "quarter":
                # Current calendar quarter (from Q start to today)
                start_date, end_date = get_current_calendar_quarter(today)
                # Count months from quarter start to current month
                periods_count = (end_date.year - start_date.year) * 12 + end_date.month - start_date.month + 1
                date_format = "month"  # Show by months
            else:  # year
                # Current calendar year (from Jan 1 to today)
                start_date, end_date = get_current_calendar_year(today)
                periods_count = end_date.month  # Months from Jan to current
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
            # Для period='month': группировать по календарным неделям
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

            rolling_weeks_data = get_rolling_weeks(periods_count, end_date, include_incomplete=True)
            for week_start, week_end, iso_label in rolling_weeks_data:
                # Агрегировать факты за неделю
                week_fact = sum(
                    amount for d, amount in fact_by_date.items()
                    if week_start <= d <= week_end
                )
                # Агрегировать РАСПРЕДЕЛЕННЫЕ планы за неделю
                week_plan = sum(
                    amount for d, amount in plan_distributed_dict.items()
                    if week_start <= d <= week_end
                )
                labels.append(iso_label)
                fact_data.append(week_fact)
                plan_data.append(week_plan)
                fact_period.append(week_fact)
                plan_period.append(week_plan)
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
                # Использовать РАСПРЕДЕЛЕННЫЙ план (среднее на месяц)
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
    period: Optional[str] = Query(None, pattern="^(month|quarter|year)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    record_type: str = Query("fact", pattern="^(fact|plan)$"),
    cfo_id: Optional[int] = Query(None, description="Filter by Financial Center ID"),
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
            # Для period='quarter' (>31 и ≤91 дней): агрегация по календарным неделям (weekly) (v5.1.3 fix)
            # Iterate through weeks from start_date to end_date
            current_date = start_date
            # Find the Monday of the week containing start_date
            week_start = current_date - timedelta(days=current_date.weekday())

            while week_start <= end_date:
                week_end = week_start + timedelta(days=6)
                # Don't go beyond the overall range
                actual_week_end = min(week_end, end_date)
                actual_week_start = max(week_start, start_date)

                # Aggregate week data
                week_income = sum(
                    data["income"] for d, data in data_by_date.items()
                    if actual_week_start <= d <= actual_week_end
                )
                week_expense = sum(
                    data["expense"] for d, data in data_by_date.items()
                    if actual_week_start <= d <= actual_week_end
                )

                # Label: "Нед дд.мм-дд.мм"
                week_label = f"Нед {actual_week_start.strftime('%d.%m')}-{actual_week_end.strftime('%d.%m')}"
                labels.append(week_label)
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
    period: Optional[str] = Query(None, pattern="^(month|quarter|year|all)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    record_type: str = Query("fact", pattern="^(fact|plan)$"),
    cfo_id: Optional[int] = Query(None, description="Filter by Financial Center ID"),
    article_ids: Optional[List[int]] = Query(None, description="Filter by category IDs (multiple selection)"),
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
    period: Optional[str] = Query(None, pattern="^(month|quarter|year)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    article_id: int | None = Query(None, description="Filter by specific article (for drill-down)"),
    cfo_id: Optional[int] = Query(None, description="Filter by Financial Center ID"),
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
                group_by_expr = Fact.fact_date
                label_format = "month"  # Group by months
            else:  # year
                # Current calendar year (from Jan 1 to today)
                start_date, end_date = get_current_calendar_year(today)
                group_by_expr = Fact.fact_date
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
        prev_start, prev_end = get_previous_period(start_date, end_date)

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
            # Для custom range >31 и ≤91 дней: агрегация по календарным неделям (v5.1.3 fix)
            # Generate ALL weeks in range, even if no data exists
            # Find Monday of the week containing start_date
            week_start = start_date - timedelta(days=start_date.weekday())

            while week_start <= end_date:
                # Find the Monday from date_trunc result (if exists in period_data)
                # period_data keys are week start dates (Mondays) from date_trunc('week')
                week_data = period_data.get(week_start, {"income": 0.0, "expense": 0.0, "articles": []})

                week_income = week_data["income"]
                week_expense = week_data["expense"]
                week_balance = week_income - week_expense
                cumulative_balance += week_balance

                # Format label as "Нед дд.мм-дд.мм"
                week_end = week_start + timedelta(days=6)
                # Don't go beyond the overall range
                actual_week_end = min(week_end, end_date)
                actual_week_start = max(week_start, start_date)

                week_label = f"Нед {actual_week_start.strftime('%d.%m')}-{actual_week_end.strftime('%d.%m')}"

                labels.append(week_label)
                income_data.append(week_income)
                expense_data.append(week_expense)
                balance_data.append(cumulative_balance)
                categories_data.append(week_data.get("articles", []))

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
    period: Optional[str] = Query(None, pattern="^(month|quarter|year)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    article_type: str = Query("expense", pattern="^(income|expense|debit|credit|all)$"),
    record_type: str = Query("fact", pattern="^(fact|plan)$"),
    cfo_id: Optional[int] = Query(None, description="Filter by Financial Center ID"),
    article_ids: Optional[List[int]] = Query(None, description="Filter by category IDs (multiple selection)"),
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
            func.sum(Fact.amount).label("total")
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Fact.record_type == record_type,
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date
        )

        # Apply article type filter if not 'all' (v5.1.4)
        if article_type != 'all':
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

        # Build data by date
        data_by_date = {row.fact_date: float(row.total) for row in rows}

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
                date_mapping[week_idx] = {}

                for day_offset in range(7):  # Mon-Sun
                    current_date = week_start + timedelta(days=day_offset)
                    # Only include data if within the actual range
                    if start_date <= current_date <= end_date:
                        amount = data_by_date.get(current_date, 0.0)
                        date_mapping[week_idx][day_offset] = current_date.strftime("%d.%m.%Y")
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
        logger.error(f"Error in /heatmap: {str(e)}", exc_info=True)
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


@router.get("/recommended-amounts", response_model=RecommendedAmountsResponse)
async def get_recommended_amounts(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    article_id: Optional[int] = Query(
        None,
        gt=0,
        description="Optional category ID filter (omit for global recommendations)"
    ),
    article_type: Optional[str] = Query(
        None,
        pattern="^(income|expense)$",
        description="Optional transaction type filter: 'income' or 'expense' (omit for all types)"
    ),
    record_type: str = Query(
        "fact",
        pattern="^(fact|plan)$",
        description="Record type: 'fact' (actual transactions) or 'plan' (planned transactions)"
    ),
    period: str = Query(
        "quarter",
        pattern="^(month|quarter|year)$",
        description="Analysis period: 'month' (30d), 'quarter' (90d), 'year' (365d)"
    ),
):
    """
    Get recommended amounts for quick selection buttons in transaction forms.

    Algorithm:
        1. Check cache (t_recommended_amounts table) for pre-calculated values
        2. If not in cache or stale, fallback to default amounts

    Query Parameters:
        - article_id: Optional category filter (NULL = global recommendations)
        - article_type: Optional type filter ('income' | 'expense' | NULL = all)
        - record_type: 'fact' (actual transactions) or 'plan' (planned transactions)
        - period: Analysis period ('month' | 'quarter' | 'year')

    Returns:
        - amounts: Array of 4 recommended amounts (rounded to nice numbers)
        - algorithm: 'k_means' (pre-calculated) or 'default' (fallback)
        - metadata: Detailed calculation info (sample_size, min/max/avg, period_days)

    Examples:
        GET /api/v1/analytics/recommended-amounts?record_type=fact&article_type=expense
        GET /api/v1/analytics/recommended-amounts?article_id=5&record_type=fact
        GET /api/v1/analytics/recommended-amounts?record_type=plan&article_type=income

    Notes:
        - Pre-calculated values are populated by nightly scheduler (recalculate_recommended_amounts)
        - Updated nightly at 02:00 UTC for all leaf categories (adaptive period: 90/180/270/360 days)
        - Fallback to defaults if not in cache
        - Shared family budget model: all authenticated users see same recommendations
    """
    # Default fallback values
    DEFAULT_AMOUNTS = {
        ("fact", "expense"): [Decimal("100.00"), Decimal("500.00"), Decimal("1000.00"), Decimal("5000.00")],
        ("fact", "income"): [Decimal("10000.00"), Decimal("20000.00"), Decimal("50000.00"), Decimal("100000.00")],
        ("plan", "expense"): [Decimal("5000.00"), Decimal("10000.00"), Decimal("20000.00"), Decimal("50000.00")],
        ("plan", "income"): [Decimal("20000.00"), Decimal("50000.00"), Decimal("100000.00"), Decimal("200000.00")],
    }

    # Step 1: Try to get from cache (t_recommended_amounts)
    cache_query = text("""
        SELECT amounts, metadata
        FROM t_recommended_amounts
        WHERE (article_id IS NOT DISTINCT FROM :article_id)
          AND (type IS NOT DISTINCT FROM :type)
          AND record_type = :record_type
          AND period = :period
          AND last_updated >= NOW() - INTERVAL '24 hours'
        LIMIT 1
    """)

    result = await session.execute(
        cache_query,
        {"article_id": article_id, "type": article_type, "record_type": record_type, "period": period}
    )
    row = result.first()

    if row:
        # Cache hit - use pre-calculated values
        amounts_array = row[0]  # PostgreSQL ARRAY
        metadata_json = row[1]  # JSONB

        # Get article name if article_id is provided
        article_name = None
        if article_id:
            article_result = await session.execute(
                select(Article.name).where(Article.id == article_id)
            )
            article_row = article_result.first()
            if article_row:
                article_name = article_row[0]

        metadata_json["article_name"] = article_name

        return RecommendedAmountsResponse(
            amounts=[Decimal(str(amt)) for amt in amounts_array],
            algorithm="k_means" if metadata_json.get("source") == "k_means" else "default",
            metadata=RecommendedAmountsMetadata(**metadata_json)
        )

    # Step 2: Cache miss - fallback to defaults
    # Note: On-demand calculation via PostgreSQL function removed
    # Pre-calculated values are populated by nightly scheduler (recalculate_recommended_amounts)
    # Determine default key based on record_type and article_type
    if article_type is None:
        # If article_type is not specified, default to expense for facts, income for plans
        default_type = "expense" if record_type == "fact" else "income"
    else:
        default_type = article_type

    default_key = (record_type, default_type)
    default_amounts = DEFAULT_AMOUNTS.get(default_key, DEFAULT_AMOUNTS[("fact", "expense")])

    # Get article name if article_id is provided
    article_name = None
    if article_id:
        article_result = await session.execute(
            select(Article.name).where(Article.id == article_id)
        )
        article_row = article_result.first()
        if article_row:
            article_name = article_row[0]

    period_days_map = {"month": 30, "quarter": 90, "year": 365}

    return RecommendedAmountsResponse(
        amounts=default_amounts,
        algorithm="default",
        metadata=RecommendedAmountsMetadata(
            source="default",
            sample_size=0,
            min_amount=None,
            max_amount=None,
            avg_amount=None,
            period_days=period_days_map.get(period, 90),
            algorithm_version=None,
            article_id=article_id,
            article_name=article_name
        )
    )
