"""
Analytics API endpoints.

Provides aggregated data for charts and dashboards.
"""

import logging
from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
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
    get_iso_week_number,
    get_quarter_bounds,
    get_rolling_months,
    get_rolling_weeks,
    get_week_bounds,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Analytics"])


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
        Fact.fact_date == today,
        Article.is_current == True  # noqa: E712
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
        Fact.fact_date <= today,
        Article.is_current == True  # noqa: E712
    ).group_by(Article.type)

    month_result = await session.execute(month_query)
    month_data = {row.type: float(row.total) for row in month_result.all()}

    return {
        "today": {
            "income": today_data.get("income", 0.0),
            "expense": today_data.get("expense", 0.0),
            "balance": today_data.get("income", 0.0) - today_data.get("expense", 0.0)
        },
        "month": {
            "income": month_data.get("income", 0.0),
            "expense": month_data.get("expense", 0.0),
            "balance": month_data.get("income", 0.0) - month_data.get("expense", 0.0)
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
        Fact.fact_date == today,
        Article.is_current == True  # noqa: E712
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
        Fact.fact_date <= today,
        Article.is_current == True  # noqa: E712
    ).group_by(Article.type)

    month_result = await session.execute(month_query)
    month_data = {row.type: float(row.total) for row in month_result.all()}

    # Calculate stats
    today_income = today_data.get("income", 0.0)
    today_expense = today_data.get("expense", 0.0)
    today_balance = today_income - today_expense

    month_income = month_data.get("income", 0.0)
    month_expense = month_data.get("expense", 0.0)
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
    period: Optional[str] = Query(None, regex="^(week|month|quarter|year)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    article_type: str = Query("expense", regex="^(income|expense)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get plan vs fact comparison data for bar chart.

    Args:
        period: Time period (week, month, quarter, year) - rolling periods
            - week: last 7 days from today
            - month: last 28 days from today
            - quarter: current quarter (unchanged)
            - year: last 365 days from today
        date_from: Optional start date for custom range (overrides period)
        date_to: Optional end date for custom range (overrides period)
        article_type: Type of category (income or expense)

    Returns:
        Dict with categories and plan/fact amounts for each period
    """
    try:
        today = date.today()

        # Priority: custom date range > period parameter
        if date_from and date_to:
            start_date = date_from
            end_date = date_to
            # Auto-determine grouping based on days difference
            days_diff = (end_date - start_date).days + 1
            if days_diff <= 7:
                period = "week"  # Group by day
                periods_count = days_diff
                date_format = None  # Russian day names
            elif days_diff <= 31:
                period = "month"  # Group by day
                periods_count = days_diff
                date_format = "%d"
            elif days_diff <= 93:
                period = "quarter"  # Group by month
                periods_count = 3  # ~3 months
                date_format = None
            else:
                period = "year"  # Group by month
                periods_count = 12
                date_format = None
        elif period:
            # Calculate date range based on ROLLING period
            if period == "week":
                # Last 4 calendar weeks (incomplete current week included)
                rolling_weeks = get_rolling_weeks(4, today, include_incomplete=True)
                start_date = rolling_weeks[0][0]  # Monday of first week
                end_date = rolling_weeks[-1][1]  # End of last week (today)
                periods_count = 4  # 4 weeks
                date_format = "week"  # Special: ISO week labels
            elif period == "month":
                # Last 4 calendar weeks (same as week period for this endpoint)
                rolling_weeks = get_rolling_weeks(4, today, include_incomplete=True)
                start_date = rolling_weeks[0][0]
                end_date = rolling_weeks[-1][1]
                periods_count = 4  # 4 weeks
                date_format = "week"  # Special: ISO week labels
            elif period == "quarter":
                # Rolling 3 months (current + 2 months back)
                rolling_months = get_rolling_months(3, today, include_incomplete=True)
                start_date = rolling_months[0][0]  # First day of first month
                end_date = rolling_months[-1][1]  # End of last month (today)
                periods_count = 3  # 3 months
                date_format = "month"  # Special: month labels
            else:  # year
                # Rolling 12 months (current + 11 months back)
                rolling_months = get_rolling_months(12, today, include_incomplete=True)
                start_date = rolling_months[0][0]
                end_date = rolling_months[-1][1]
                periods_count = 12  # 12 months
                date_format = "month"  # Special: month labels
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
            Fact.record_type == "fact",
            Article.type == article_type,
            Article.is_current == True  # noqa: E712
        ).group_by(Fact.fact_date).order_by(Fact.fact_date)

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
            Fact.record_type == "plan",
            Article.type == article_type,
            Article.is_current == True  # noqa: E712
        ).group_by(Fact.fact_date).order_by(Fact.fact_date)

        plan_result = await session.execute(plan_query)
        plan_by_date = {row.fact_date: float(row.total) for row in plan_result.all()}

        # Generate labels and data arrays
        labels = []
        fact_data = []
        plan_data = []

        # Агрегация по неделям или месяцам в зависимости от date_format
        if date_format == "week":
            # Для week/month периодов: группировать по календарным неделям
            rolling_weeks_data = get_rolling_weeks(periods_count, end_date, include_incomplete=True)
            for week_start, week_end, iso_label in rolling_weeks_data:
                # Агрегировать факты за неделю
                week_fact = sum(
                    amount for d, amount in fact_by_date.items()
                    if week_start <= d <= week_end
                )
                # Агрегировать планы за неделю
                week_plan = sum(
                    amount for d, amount in plan_by_date.items()
                    if week_start <= d <= week_end
                )
                labels.append(iso_label)
                fact_data.append(week_fact)
                plan_data.append(week_plan)
        elif date_format == "month":
            # Для quarter/year периодов: группировать по месяцам
            rolling_months_data = get_rolling_months(periods_count, end_date, include_incomplete=True)
            for month_start, month_end, month_label in rolling_months_data:
                # Агрегировать факты за месяц
                month_fact = sum(
                    amount for d, amount in fact_by_date.items()
                    if month_start <= d <= month_end
                )
                # Агрегировать планы за месяц
                month_plan = sum(
                    amount for d, amount in plan_by_date.items()
                    if month_start <= d <= month_end
                )
                labels.append(month_label)
                fact_data.append(month_fact)
                plan_data.append(month_plan)
        else:
            # Для custom range или старой логики: группировать по дням
            current_date = start_date
            while current_date <= end_date:
                labels.append(current_date.strftime("%d.%m"))
                fact_data.append(fact_by_date.get(current_date, 0.0))
                plan_data.append(plan_by_date.get(current_date, 0.0))
                current_date += timedelta(days=1)

        return {
            "labels": labels,
            "plan": plan_data,
            "fact": fact_data,
            "period": period,
            "article_type": article_type
        }

    except Exception as e:
        logger.error(f"Error in /plan-fact: {str(e)}", exc_info=True)
        return {
            "labels": [],
            "plan": [],
            "fact": [],
            "period": period or "week",
            "article_type": article_type
        }


@router.get("/trends")
async def get_trends_data(
    current_user: CurrentUser,
    period: Optional[str] = Query(None, regex="^(week|month|quarter|year)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    record_type: str = Query("fact", regex="^(fact|plan)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get spending trends over time for line chart with rolling periods.

    Args:
        period: Time period (week, month, quarter, year) - rolling periods
            - week: last 4 calendar weeks
            - month: last 4 calendar weeks
            - quarter: rolling 3 months
            - year: rolling 12 months
        date_from: Optional start date for custom range (overrides period)
        date_to: Optional end date for custom range (overrides period)
        record_type: Type of records (fact or plan)

    Returns:
        Dict with labels, income, and expense arrays aggregated by period
    """
    try:
        today = date.today()

        # Priority: custom date range > period parameter
        if date_from and date_to:
            start_date = date_from
            end_date = date_to
            # Auto-determine grouping based on days difference
            days_diff = (end_date - start_date).days + 1
            if days_diff <= 7:
                period = "week"  # Group by day
            elif days_diff <= 31:
                period = "month"  # Group by day/week
            else:
                period = "year"  # Group by month
        elif period:
            # Calculate date range based on ROLLING period
            if period == "week":
                # Last 4 calendar weeks (incomplete current week included)
                rolling_weeks = get_rolling_weeks(4, today, include_incomplete=True)
                start_date = rolling_weeks[0][0]
                end_date = rolling_weeks[-1][1]
            elif period == "month":
                # Last 4 calendar weeks (same as week period)
                rolling_weeks = get_rolling_weeks(4, today, include_incomplete=True)
                start_date = rolling_weeks[0][0]
                end_date = rolling_weeks[-1][1]
            elif period == "quarter":
                # Rolling 3 months
                rolling_months = get_rolling_months(3, today, include_incomplete=True)
                start_date = rolling_months[0][0]
                end_date = rolling_months[-1][1]
            else:  # year
                # Rolling 12 months (current + 11 months back)
                rolling_months = get_rolling_months(12, today, include_incomplete=True)
                start_date = rolling_months[0][0]
                end_date = rolling_months[-1][1]
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
            Fact.record_type == record_type,
            Article.is_current == True  # noqa: E712
        ).group_by(Fact.fact_date, Article.type).order_by(Fact.fact_date)

        result = await session.execute(query)
        rows = result.all()

        # Build data structure by date
        data_by_date = {}
        for row in rows:
            if row.fact_date not in data_by_date:
                data_by_date[row.fact_date] = {"income": 0.0, "expense": 0.0}
            data_by_date[row.fact_date][row.type] = float(row.total)

        # Aggregate data by period and generate labels
        labels = []
        income_data = []
        expense_data = []

        if period in ["week", "month"]:
            # Для week/month: агрегация по 4 календарным неделям с ISO labels
            rolling_weeks_data = get_rolling_weeks(4, end_date, include_incomplete=True)
            for week_start, week_end, iso_label in rolling_weeks_data:
                # Aggregate week data
                week_income = sum(
                    data["income"] for d, data in data_by_date.items()
                    if week_start <= d <= week_end
                )
                week_expense = sum(
                    data["expense"] for d, data in data_by_date.items()
                    if week_start <= d <= week_end
                )

                labels.append(iso_label)
                income_data.append(week_income)
                expense_data.append(week_expense)

        elif period == "quarter":
            # Для quarter: агрегация по rolling 3 месяцам
            rolling_months_data = get_rolling_months(3, end_date, include_incomplete=True)
            for month_start, month_end, month_label in rolling_months_data:
                # Aggregate month data
                month_income = sum(
                    data["income"] for d, data in data_by_date.items()
                    if month_start <= d <= month_end
                )
                month_expense = sum(
                    data["expense"] for d, data in data_by_date.items()
                    if month_start <= d <= month_end
                )

                labels.append(month_label)
                income_data.append(month_income)
                expense_data.append(month_expense)

        else:  # year
            # Для year: агрегация по rolling 12 месяцам
            rolling_months_data = get_rolling_months(12, end_date, include_incomplete=True)
            for month_start, month_end, month_label in rolling_months_data:
                # Aggregate month data
                month_income = sum(
                    data["income"] for d, data in data_by_date.items()
                    if month_start <= d <= month_end
                )
                month_expense = sum(
                    data["expense"] for d, data in data_by_date.items()
                    if month_start <= d <= month_end
                )

                labels.append(month_label)
                income_data.append(month_income)
                expense_data.append(month_expense)

        return {
            "labels": labels,
            "income": income_data,
            "expense": expense_data,
            "period": period,
            "record_type": record_type
        }

    except Exception as e:
        logger.error(f"Error in /trends: {str(e)}", exc_info=True)
        return {
            "labels": [],
            "income": [],
            "expense": [],
            "period": period or "week",
            "record_type": record_type
        }


@router.get("/category-breakdown")
async def get_category_breakdown(
    current_user: CurrentUser,
    type: str = Query("expense", regex="^(income|expense)$"),
    period: Optional[str] = Query(None, regex="^(week|month|year|all)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    record_type: str = Query("fact", regex="^(fact|plan)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get category breakdown for pie chart.

    Args:
        type: Transaction type (income or expense)
        period: Time period (week, month, year, all) - rolling periods
            - week: last 7 days from today
            - month: last 28 days from today
            - year: last 365 days from today
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
            # Calculate start date based on ROLLING period
            if period == "week":
                # Last 4 calendar weeks
                rolling_weeks = get_rolling_weeks(4, today, include_incomplete=True)
                start_date = rolling_weeks[0][0]
            elif period == "month":
                # Last 4 calendar weeks (same as week)
                rolling_weeks = get_rolling_weeks(4, today, include_incomplete=True)
                start_date = rolling_weeks[0][0]
            elif period == "year":
                # Rolling 12 months
                rolling_months = get_rolling_months(12, today, include_incomplete=True)
                start_date = rolling_months[0][0]
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
            Article.type == type,
            Fact.record_type == record_type,
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date,
            Article.is_current == True  # noqa: E712
        ).group_by(Article.name).order_by(func.sum(Fact.amount).desc())

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
            "period": period or "week",
            "record_type": record_type
        }


@router.get("/waterfall")
async def get_waterfall_data(
    current_user: CurrentUser,
    period: Optional[str] = Query(None, regex="^(week|month|quarter|year)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    article_id: int | None = Query(None, description="Filter by specific article (for drill-down)"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get cumulative flow data for waterfall chart.

    Shows monthly income, expense, and cumulative balance.

    Args:
        period: Time aggregation (week, month, quarter, year) - rolling periods
            - week: last 4 calendar weeks
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
            # Auto-determine grouping based on days difference
            days_diff = (end_date - start_date).days + 1
            if days_diff <= 31:
                period = "month"  # Group by day
                group_by_expr = Fact.fact_date
                label_format = "%d"
            elif days_diff <= 93:
                period = "quarter"  # Group by week
                group_by_expr = func.extract("week", Fact.fact_date)
                label_format = "W%W"
            else:
                period = "year"  # Group by month
                group_by_expr = func.extract("month", Fact.fact_date)
                label_format = "month"
        elif period:
            # Calculate date range and grouping based on ROLLING period
            if period == "week":
                # Last 4 calendar weeks (same as month period)
                rolling_weeks = get_rolling_weeks(4, today, include_incomplete=True)
                start_date = rolling_weeks[0][0]
                end_date = rolling_weeks[-1][1]
                group_by_expr = Fact.fact_date
                label_format = "week"  # Use ISO week labels
            elif period == "month":
                # Last 4 calendar weeks
                rolling_weeks = get_rolling_weeks(4, today, include_incomplete=True)
                start_date = rolling_weeks[0][0]
                end_date = rolling_weeks[-1][1]
                group_by_expr = Fact.fact_date
                label_format = "week"  # Use ISO week labels
            elif period == "quarter":
                # Rolling 3 months
                rolling_months = get_rolling_months(3, today, include_incomplete=True)
                start_date = rolling_months[0][0]
                end_date = rolling_months[-1][1]
                group_by_expr = Fact.fact_date
                label_format = "month"  # Use month labels
            else:  # year
                # Rolling 12 months
                rolling_months = get_rolling_months(12, today, include_incomplete=True)
                start_date = rolling_months[0][0]
                end_date = rolling_months[-1][1]
                group_by_expr = Fact.fact_date
                label_format = "month"  # Use month labels
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
            Article.is_current == True  # noqa: E712
        )

        # Add article filter if specified (for drill-down)
        if article_id:
            query = query.where(Article.id == article_id)

        query = query.group_by(group_by_expr, Article.type, Article.id, Article.name).order_by(group_by_expr)

        result = await session.execute(query)
        rows = result.all()

        # Build data structure
        period_data = {}
        articles_info = {}  # Track articles for drill-down

        for row in rows:
            # Handle different period_key types based on period
            if isinstance(row.period_key, date):
                # For month period, period_key is a date object - extract day of month
                period_key = row.period_key.day
            elif row.period_key:
                # For quarter/year, period_key is an int (week or month number)
                period_key = int(row.period_key)
            else:
                period_key = 0

            if period_key not in period_data:
                period_data[period_key] = {"income": 0.0, "expense": 0.0, "articles": []}

            amount = float(row.total)
            period_data[period_key][row.type] += amount

            # Store article info for potential drill-down
            if not article_id:  # Only track articles when not in drill-down mode
                articles_info[row.article_id] = row.article_name
                period_data[period_key]["articles"].append({
                    "id": row.article_id,
                    "name": row.article_name,
                    "type": row.type,
                    "amount": amount
                })

        # Generate arrays based on period type
        labels = []
        income_data = []
        expense_data = []
        balance_data = []
        categories_data = []  # For drill-down links

        cumulative_balance = 0.0

        if label_format == "week":
            # Для month периода: агрегация по 4 календарным неделям
            rolling_weeks_data = get_rolling_weeks(4, end_date, include_incomplete=True)
            for week_start, week_end, iso_label in rolling_weeks_data:
                # Агрегировать данные за неделю из period_data (ключи - даты)
                week_income = 0.0
                week_expense = 0.0
                week_articles = []

                for day_date in period_data.keys():
                    if isinstance(day_date, date) and week_start <= day_date <= week_end:
                        week_income += period_data[day_date]["income"]
                        week_expense += period_data[day_date]["expense"]
                        week_articles.extend(period_data[day_date].get("articles", []))

                week_balance = week_income - week_expense
                cumulative_balance += week_balance

                labels.append(iso_label)
                income_data.append(week_income)
                expense_data.append(week_expense)
                balance_data.append(cumulative_balance)
                categories_data.append(week_articles)

        elif label_format == "month":
            # Для quarter/year: агрегация по месяцам
            if period == "quarter":
                periods_count = 3
            else:  # year
                periods_count = 12

            rolling_months_data = get_rolling_months(periods_count, end_date, include_incomplete=True)
            for month_start, month_end, month_label in rolling_months_data:
                # Агрегировать данные за месяц из period_data (ключи - даты)
                month_income = 0.0
                month_expense = 0.0
                month_articles = []

                for day_date in period_data.keys():
                    if isinstance(day_date, date) and month_start <= day_date <= month_end:
                        month_income += period_data[day_date]["income"]
                        month_expense += period_data[day_date]["expense"]
                        month_articles.extend(period_data[day_date].get("articles", []))

                month_balance = month_income - month_expense
                cumulative_balance += month_balance

                labels.append(month_label)
                income_data.append(month_income)
                expense_data.append(month_expense)
                balance_data.append(cumulative_balance)
                categories_data.append(month_articles)

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

            return {
                "labels": labels,
                "income": income_data,
                "expense": expense_data,
                "balance": balance_data,
                "categories": categories_data,  # For drill-down
                "period": period,
                "year": today.year,
                "article_id": article_id,
                "article_name": articles_info.get(article_id) if article_id else None
            }

    except Exception as e:
        logger.error(f"Error in /waterfall: {str(e)}", exc_info=True)
        return {
            "labels": [],
            "income": [],
            "expense": [],
            "balance": [],
            "categories": [],
            "period": period or "month",
            "year": date.today().year,
            "article_id": article_id,
            "article_name": None
        }


@router.get("/heatmap")
async def get_heatmap_data(
    current_user: CurrentUser,
    period: Optional[str] = Query(None, regex="^(week|month|quarter|year)$"),
    date_from: Optional[date] = Query(None, description="Start date for custom range (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="End date for custom range (YYYY-MM-DD)"),
    article_type: str = Query("expense", regex="^(income|expense)$"),
    record_type: str = Query("fact", regex="^(fact|plan)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get spending patterns data for heatmap with dynamic aggregation.

    Args:
        period: Time range (week, month, quarter, year) - rolling periods
            - week: last 7 days from today → aggregate by days
            - month: last 28 days from today → aggregate by weeks
            - quarter: current quarter → aggregate by weeks
            - year: last 365 days from today → aggregate by months
        date_from: Optional start date for custom range (overrides period)
        date_to: Optional end date for custom range (overrides period)
        article_type: Type of category (income or expense)
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
            # Auto-determine aggregation based on days difference
            days_diff = (end_date - start_date).days + 1
            if days_diff <= 7:
                aggregation = "day"
            elif days_diff <= 30:
                aggregation = "week"
            else:
                aggregation = "month"
        elif period:
            # Calculate date range and aggregation based on period
            if period == "week":
                # Current calendar week only → single week display
                week_start, week_end = get_week_bounds(today)
                start_date = week_start
                end_date = min(week_end, today)  # До сегодня (неполная неделя)
                aggregation = "single_week"
            elif period == "month":
                # Last 4 calendar weeks → aggregate by weeks
                rolling_weeks = get_rolling_weeks(4, today, include_incomplete=True)
                start_date = rolling_weeks[0][0]
                end_date = rolling_weeks[-1][1]
                aggregation = "week"
            elif period == "quarter":
                # Rolling 3 months → aggregate by months (not weeks)
                rolling_months = get_rolling_months(3, today, include_incomplete=True)
                start_date = rolling_months[0][0]
                end_date = rolling_months[-1][1]
                aggregation = "month"
            else:  # year
                # Rolling 12 months → aggregate by months
                rolling_months = get_rolling_months(12, today, include_incomplete=True)
                start_date = rolling_months[0][0]
                end_date = rolling_months[-1][1]
                aggregation = "month"
        else:
            raise HTTPException(400, "Укажите period или date_from/date_to")

        # Query all facts with article_type and record_type filters
        # Shared family budget - NO user_id filter
        query = select(
            Fact.fact_date,
            func.sum(Fact.amount).label("total")
        ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
            Article.type == article_type,
            Fact.record_type == record_type,
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date,
            Article.is_current == True  # noqa: E712
        ).group_by(Fact.fact_date)

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
            # Для периода "месяц": 4 недели × 7 дней grid
            # X-axis: дни недели (Пн-Вс)
            # Y-axis: ISO номера недель
            day_names = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
            xAxis = day_names
            yAxis = []
            data = []

            # Получить rolling weeks
            rolling_weeks_data = get_rolling_weeks(4, end_date, include_incomplete=True)

            for week_start, week_end, iso_label in rolling_weeks_data:
                yAxis.append(iso_label)

                # Генерация данных для недели
                week_data = []
                for day_offset in range(7):  # Mon-Sun
                    current_date = week_start + timedelta(days=day_offset)
                    if current_date <= week_end:
                        amount = data_by_date.get(current_date, 0.0)
                    else:
                        amount = 0.0  # Beyond week_end
                    week_data.append(amount)

                data.append(week_data)

        elif aggregation == "month":
            # Для периода "квартал/год": месяцы × недели grid
            # X-axis: недели в месяце (Н1-Н5)
            # Y-axis: месяцы с годом
            xAxis = ["Н1", "Н2", "Н3", "Н4", "Н5"]
            yAxis = []
            data = []

            # Определить количество месяцев
            if period == "quarter":
                periods_count = 3
            else:  # year
                periods_count = 12

            rolling_months_data = get_rolling_months(periods_count, end_date, include_incomplete=True)

            for month_start, month_end, month_label in rolling_months_data:
                yAxis.append(month_label)

                # Агрегировать по неделям внутри месяца
                month_data = [0.0] * 5  # До 5 недель в месяце

                # Найти все даты в месяце
                current_date = month_start
                while current_date <= month_end:
                    # Определить номер недели внутри месяца (0-4)
                    week_of_month = (current_date.day - 1) // 7
                    if week_of_month < 5:
                        month_data[week_of_month] += data_by_date.get(current_date, 0.0)
                    current_date += timedelta(days=1)

                data.append(month_data)

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

            return {
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

    except Exception as e:
        logger.error(f"Error in /heatmap: {str(e)}", exc_info=True)
        return {
            "data": [],
            "xAxis": [],
            "yAxis": [],
            "aggregation": "day",
            "period": period or "week",
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
    type: Optional[str] = Query(
        None,
        description="Optional transaction type filter: 'income' or 'expense' (omit for all types)"
    ),
    record_type: str = Query(
        "fact",
        description="Record type: 'fact' (actual transactions) or 'plan' (planned transactions)"
    ),
    period: str = Query(
        "quarter",
        description="Analysis period: 'week' (7d), 'month' (30d), 'quarter' (90d), 'year' (365d)"
    ),
):
    """
    Get recommended amounts for quick selection buttons in transaction forms.

    Algorithm:
        1. Check cache (t_recommended_amounts table) for pre-calculated values
        2. If not in cache or stale, calculate on-demand using K-means clustering
        3. Fallback to defaults if insufficient data (<20 transactions)

    Query Parameters:
        - article_id: Optional category filter (NULL = global recommendations)
        - type: Optional type filter ('income' | 'expense' | NULL = all)
        - record_type: 'fact' (actual transactions) or 'plan' (planned transactions)
        - period: Analysis period ('week' | 'month' | 'quarter' | 'year')

    Returns:
        - amounts: Array of 4 recommended amounts (rounded to nice numbers)
        - algorithm: 'k_means' (calculated) or 'default' (fallback)
        - metadata: Detailed calculation info (sample_size, min/max/avg, period_days)

    Examples:
        GET /api/v1/analytics/recommended-amounts?record_type=fact&type=expense
        GET /api/v1/analytics/recommended-amounts?article_id=5&record_type=fact
        GET /api/v1/analytics/recommended-amounts?record_type=plan&type=income

    Notes:
        - Pre-calculated values are cached for TOP-10 popular categories (updated nightly at 02:00 UTC)
        - On-demand calculation is used for rare categories
        - Fallback to defaults if sample size < 20 transactions
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
        {"article_id": article_id, "type": type, "record_type": record_type, "period": period}
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
                select(Article.name).where(Article.id == article_id, Article.is_current == True)
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

    # Step 2: Cache miss - calculate on-demand using PostgreSQL function
    calc_query = text("""
        SELECT * FROM calculate_recommended_amounts(
            :article_id,
            :type,
            :record_type,
            :period,
            20  -- min_sample_size
        )
    """)

    calc_result = await session.execute(
        calc_query,
        {"article_id": article_id, "type": type, "record_type": record_type, "period": period}
    )
    calc_row = calc_result.first()

    if calc_row and calc_row[0] is not None:
        # On-demand calculation successful
        amounts_array = calc_row[0]  # amounts
        sample_size = calc_row[1]
        min_amount = calc_row[2]
        max_amount = calc_row[3]
        avg_amount = calc_row[4]
        period_days = calc_row[5]

        # Get article name if article_id is provided
        article_name = None
        if article_id:
            article_result = await session.execute(
                select(Article.name).where(Article.id == article_id, Article.is_current == True)
            )
            article_row = article_result.first()
            if article_row:
                article_name = article_row[0]

        # IMPORTANT: Save on-demand calculation result to cache for future requests
        # This improves performance - subsequent users get cached result instead of recalculating
        try:
            metadata_json = {
                "source": "k_means",
                "sample_size": sample_size,
                "min_amount": float(min_amount) if min_amount else None,
                "max_amount": float(max_amount) if max_amount else None,
                "avg_amount": float(avg_amount) if avg_amount else None,
                "period_days": period_days,
                "algorithm_version": "1.0",
                "article_id": article_id,
                "article_name": article_name
            }

            insert_cache_query = text("""
                INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata, last_updated)
                VALUES (:article_id, :type, :record_type, :period, :amounts, :metadata::jsonb, NOW())
                ON CONFLICT (article_id, type, record_type, period)
                DO UPDATE SET
                    amounts = EXCLUDED.amounts,
                    metadata = EXCLUDED.metadata,
                    last_updated = NOW()
            """)

            import json
            await session.execute(
                insert_cache_query,
                {
                    "article_id": article_id,
                    "type": type,
                    "record_type": record_type,
                    "period": period,
                    "amounts": [float(amt) for amt in amounts_array],
                    "metadata": json.dumps(metadata_json)
                }
            )
            await session.commit()
        except Exception as e:
            # Cache save failed - log but don't fail the request
            # User still gets the calculated result
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to save on-demand calculation to cache: {e}")
            await session.rollback()

        return RecommendedAmountsResponse(
            amounts=[Decimal(str(amt)) for amt in amounts_array],
            algorithm="k_means",
            metadata=RecommendedAmountsMetadata(
                source="k_means",
                sample_size=sample_size,
                min_amount=Decimal(str(min_amount)) if min_amount else None,
                max_amount=Decimal(str(max_amount)) if max_amount else None,
                avg_amount=Decimal(str(avg_amount)) if avg_amount else None,
                period_days=period_days,
                algorithm_version="1.0",
                article_id=article_id,
                article_name=article_name
            )
        )

    # Step 3: Insufficient data - fallback to defaults
    # Determine default key based on record_type and type
    if type is None:
        # If type is not specified, default to expense for facts, income for plans
        default_type = "expense" if record_type == "fact" else "income"
    else:
        default_type = type

    default_key = (record_type, default_type)
    default_amounts = DEFAULT_AMOUNTS.get(default_key, DEFAULT_AMOUNTS[("fact", "expense")])

    # Get article name if article_id is provided
    article_name = None
    if article_id:
        article_result = await session.execute(
            select(Article.name).where(Article.id == article_id, Article.is_current == True)
        )
        article_row = article_result.first()
        if article_row:
            article_name = article_row[0]

    period_days_map = {"week": 7, "month": 30, "quarter": 90, "year": 365}

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
