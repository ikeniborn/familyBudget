"""
Analytics API endpoints.

Provides aggregated data for charts and dashboards.
"""

from datetime import date, datetime, timedelta
from decimal import Decimal
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
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
    period: str = Query("month", regex="^(week|month|quarter|year)$"),
    article_type: str = Query("expense", regex="^(income|expense)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get plan vs fact comparison data for bar chart.

    Args:
        period: Time period (week, month, quarter, year)
        article_type: Type of category (income or expense)

    Returns:
        Dict with categories and plan/fact amounts for each period
    """
    today = date.today()

    # Calculate date range based on period
    if period == "week":
        start_date = today - timedelta(days=today.weekday())  # Monday
        periods_count = 7
        date_format = None  # Will use Russian day names mapping
    elif period == "month":
        start_date = date(today.year, today.month, 1)
        periods_count = (date(today.year, today.month + 1, 1) - start_date).days if today.month < 12 else 31
        date_format = "%d"  # 1, 2, 3, ...
    elif period == "quarter":
        # Current quarter (Q1: Jan-Mar, Q2: Apr-Jun, Q3: Jul-Sep, Q4: Oct-Dec)
        current_quarter = (today.month - 1) // 3
        quarter_start_month = current_quarter * 3 + 1
        start_date = date(today.year, quarter_start_month, 1)
        periods_count = 3  # 3 months in quarter
        date_format = "%b"  # Jan, Feb, Mar
    else:  # year
        start_date = date(today.year, 1, 1)
        periods_count = 12
        date_format = "%b"  # Jan, Feb, ...

    # Query FACTS grouped by date with article type filter
    # Shared family budget - NO user_id filter
    fact_query = select(
        Fact.fact_date,
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.fact_date >= start_date,
        Fact.fact_date <= today,
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
        Fact.fact_date <= today,
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

    current_date = start_date
    # For week period, show full 7 days (for plan-vs-fact comparison)
    # For quarter/year, show full periods for planning
    # For month, show only days up to today
    if period in ["week", "quarter", "year"]:
        loop_count = periods_count  # Full period for planning
    else:
        loop_count = min(periods_count, (today - start_date).days + 1)

    for _ in range(loop_count):
        if period in ["quarter", "year"]:
            # For year, group by month
            month_fact = sum(
                amount for d, amount in fact_by_date.items()
                if d.year == current_date.year and d.month == current_date.month
            )
            month_plan = sum(
                amount for d, amount in plan_by_date.items()
                if d.year == current_date.year and d.month == current_date.month
            )
            labels.append(current_date.strftime(date_format))
            fact_data.append(month_fact)
            plan_data.append(month_plan)
            # Move to next month
            if current_date.month == 12:
                current_date = date(current_date.year + 1, 1, 1)
            else:
                current_date = date(current_date.year, current_date.month + 1, 1)
        else:
            # For week period, use Russian day names
            if period == "week":
                day_names_ru = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
                labels.append(day_names_ru[current_date.weekday()])
            else:
                labels.append(current_date.strftime(date_format))
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


@router.get("/trends")
async def get_trends_data(
    current_user: CurrentUser,
    days: int = Query(30, ge=7, le=365),
    record_type: str = Query("fact", regex="^(fact|plan)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get spending trends over time for line chart.

    Args:
        days: Number of days to analyze (default: 30)
        record_type: Type of records (fact or plan)

    Returns:
        Dict with dates, income, and expense arrays
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

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

    # Build data structure
    data_by_date = {}
    for row in rows:
        if row.fact_date not in data_by_date:
            data_by_date[row.fact_date] = {"income": 0.0, "expense": 0.0}
        data_by_date[row.fact_date][row.type] = float(row.total)

    # Generate arrays for all dates in range
    dates = []
    income_data = []
    expense_data = []

    current_date = start_date
    while current_date <= end_date:
        dates.append(current_date.isoformat())
        day_data = data_by_date.get(current_date, {"income": 0.0, "expense": 0.0})
        income_data.append(day_data["income"])
        expense_data.append(day_data["expense"])
        current_date += timedelta(days=1)

    return {
        "dates": dates,
        "income": income_data,
        "expense": expense_data,
        "period_days": days,
        "record_type": record_type
    }


@router.get("/category-breakdown")
async def get_category_breakdown(
    current_user: CurrentUser,
    type: str = Query("expense", regex="^(income|expense)$"),
    period: str = Query("month", regex="^(week|month|year|all)$"),
    record_type: str = Query("fact", regex="^(fact|plan)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get category breakdown for pie chart.

    Args:
        type: Transaction type (income or expense)
        period: Time period (week, month, year, all)
        record_type: Record type (fact or plan)

    Returns:
        Dict with category names and amounts
    """
    today = date.today()

    # Calculate start date
    if period == "week":
        start_date = today - timedelta(days=today.weekday())
    elif period == "month":
        start_date = date(today.year, today.month, 1)
    elif period == "year":
        start_date = date(today.year, 1, 1)
    else:  # all
        start_date = date(2000, 1, 1)  # Far past

    # Query category breakdown
    # Shared family budget - NO user_id filter
    query = select(
        Article.name,
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Article.type == type,
        Fact.record_type == record_type,
        Fact.fact_date >= start_date,
        Fact.fact_date <= today,
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


@router.get("/waterfall")
async def get_waterfall_data(
    current_user: CurrentUser,
    period: str = Query("year", regex="^(month|quarter|year)$"),
    article_id: int | None = Query(None, description="Filter by specific article (for drill-down)"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get cumulative flow data for waterfall chart.

    Shows monthly income, expense, and cumulative balance for current year.

    Args:
        period: Time aggregation (month, quarter, year)
        article_id: Optional article filter for drill-down

    Returns:
        Dict with labels, income/expense data, balance, and metadata
    """
    today = date.today()

    # Calculate date range and grouping based on period
    if period == "month":
        start_date = date(today.year, today.month, 1)
        group_by_expr = Fact.fact_date
        label_format = "%d"  # Day of month
    elif period == "quarter":
        current_quarter = (today.month - 1) // 3
        quarter_start_month = current_quarter * 3 + 1
        start_date = date(today.year, quarter_start_month, 1)
        group_by_expr = func.extract("week", Fact.fact_date)
        label_format = "W%W"  # Week number
    else:  # year
        start_date = date(today.year, 1, 1)
        group_by_expr = func.extract("month", Fact.fact_date)
        label_format = "month"

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
        Fact.fact_date <= today,
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

    if period == "month":
        # Days in current month
        month_days = (date(today.year, today.month + 1, 1) - start_date).days if today.month < 12 else 31
        for day in range(1, min(month_days, today.day) + 1):
            period_info = period_data.get(day, {"income": 0.0, "expense": 0.0, "articles": []})
            income = period_info["income"]
            expense = period_info["expense"]
            day_balance = income - expense
            cumulative_balance += day_balance

            labels.append(f"Day {day}")
            income_data.append(income)
            expense_data.append(expense)
            balance_data.append(cumulative_balance)
            categories_data.append(period_info.get("articles", []))

    elif period == "quarter":
        # Weeks in current quarter
        current_date = start_date
        week_num = 1
        while current_date <= today:
            week_key = current_date.isocalendar()[1]  # ISO week number
            period_info = period_data.get(week_key, {"income": 0.0, "expense": 0.0, "articles": []})
            income = period_info["income"]
            expense = period_info["expense"]
            week_balance = income - expense
            cumulative_balance += week_balance

            labels.append(f"W{week_num}")
            income_data.append(income)
            expense_data.append(expense)
            balance_data.append(cumulative_balance)
            categories_data.append(period_info.get("articles", []))

            current_date += timedelta(days=7)
            week_num += 1

    else:  # year
        month_names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"]
        # Show all 12 months for planning/forecasting purposes
        for month in range(1, 13):
            period_info = period_data.get(month, {"income": 0.0, "expense": 0.0, "articles": []})
            income = period_info["income"]
            expense = period_info["expense"]
            month_balance = income - expense
            cumulative_balance += month_balance

            labels.append(month_names[month - 1])
            income_data.append(income)
            expense_data.append(expense)
            balance_data.append(cumulative_balance)
            categories_data.append(period_info.get("articles", []))

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


@router.get("/heatmap")
async def get_heatmap_data(
    current_user: CurrentUser,
    period: str = Query("quarter", regex="^(month|quarter|year)$"),
    article_type: str = Query("expense", regex="^(income|expense)$"),
    record_type: str = Query("fact", regex="^(fact|plan)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get spending patterns data for heatmap.

    Args:
        period: Time range (month, quarter, year)
        article_type: Type of category (income or expense)
        record_type: Type of records (fact or plan)

    Returns:
        Heatmap data showing expense patterns by day of week over time
    """
    today = date.today()

    # Calculate date range based on period
    if period == "month":
        start_date = date(today.year, today.month, 1)
        end_date = today  # Show only up to today for month
        weeks_to_show = 4
    elif period == "quarter":
        current_quarter = (today.month - 1) // 3
        quarter_start_month = current_quarter * 3 + 1
        quarter_end_month = quarter_start_month + 2
        start_date = date(today.year, quarter_start_month, 1)
        # End date is last day of quarter (for planning purposes)
        if quarter_end_month == 12:
            end_date = date(today.year, 12, 31)
        else:
            end_date = date(today.year, quarter_end_month + 1, 1) - timedelta(days=1)
        weeks_to_show = 13  # ~13 weeks in a quarter
    else:  # year
        start_date = date(today.year, 1, 1)
        end_date = date(today.year, 12, 31)  # Full year for planning
        weeks_to_show = 52

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

    # Build heatmap data (day of week × week of period)
    data_by_date = {row.fact_date: float(row.total) for row in rows}

    # Calculate weeks as simple 2D array: weeks[weekIndex][dayIndex]
    weeks_data = []
    week_start = start_date - timedelta(days=start_date.weekday())  # Start from Monday

    current_date = week_start
    while current_date <= end_date:
        week_days = []
        for day in range(7):  # Mon-Sun
            date_to_check = current_date + timedelta(days=day)
            if date_to_check > end_date or date_to_check < start_date:
                # Future or past dates outside period - use 0 instead of None for heatmap
                amount = 0.0
            else:
                amount = data_by_date.get(date_to_check, 0.0)
            week_days.append(amount)

        weeks_data.append(week_days)
        current_date += timedelta(days=7)

    # Limit weeks based on period
    weeks_data = weeks_data[-weeks_to_show:]

    period_days = (end_date - start_date).days

    return {
        "weeks": weeks_data,  # Now a simple 2D array: [[Mon, Tue, ..., Sun], ...]
        "day_labels": ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"],
        "week_count": len(weeks_data),
        "period_days": period_days,
        "period": period,
        "article_type": article_type,
        "record_type": record_type,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat()
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
