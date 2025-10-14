"""
Analytics API endpoints.

Provides aggregated data for charts and dashboards.
"""

from datetime import date, datetime, timedelta
from typing import List

from fastapi import APIRouter, Depends, Query
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact as Fact

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
    today_query = select(
        Article.type.label("type"),
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.user_id == current_user.id,
        Fact.fact_date == today,
        Article.is_current == True  # noqa: E712
    ).group_by(Article.type)

    today_result = await session.execute(today_query)
    today_data = {row.type: float(row.total) for row in today_result.all()}

    # This month's stats
    month_query = select(
        Article.type.label("type"),
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.user_id == current_user.id,
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


@router.get("/plan-fact")
async def get_plan_fact_data(
    current_user: CurrentUser,
    period: str = Query("month", regex="^(week|month|year)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get plan vs fact comparison data for bar chart.

    Args:
        period: Time period (week, month, year)

    Returns:
        Dict with categories and plan/fact amounts for each period
    """
    today = date.today()

    # Calculate date range based on period
    if period == "week":
        start_date = today - timedelta(days=today.weekday())  # Monday
        periods_count = 7
        date_format = "%a"  # Mon, Tue, ...
    elif period == "month":
        start_date = date(today.year, today.month, 1)
        periods_count = (date(today.year, today.month + 1, 1) - start_date).days if today.month < 12 else 31
        date_format = "%d"  # 1, 2, 3, ...
    else:  # year
        start_date = date(today.year, 1, 1)
        periods_count = 12
        date_format = "%b"  # Jan, Feb, ...

    # Query facts grouped by date
    query = select(
        Fact.fact_date,
        func.sum(Fact.amount).label("total")
    ).where(
        Fact.user_id == current_user.id,
        Fact.fact_date >= start_date,
        Fact.fact_date <= today
    ).group_by(Fact.fact_date).order_by(Fact.fact_date)

    result = await session.execute(query)
    data_by_date = {row.fact_date: float(row.total) for row in result.all()}

    # Generate labels and data arrays
    labels = []
    fact_data = []

    current_date = start_date
    for _ in range(min(periods_count, (today - start_date).days + 1)):
        if period == "year":
            # For year, group by month
            month_total = sum(
                amount for d, amount in data_by_date.items()
                if d.year == current_date.year and d.month == current_date.month
            )
            labels.append(current_date.strftime(date_format))
            fact_data.append(month_total)
            # Move to next month
            if current_date.month == 12:
                current_date = date(current_date.year + 1, 1, 1)
            else:
                current_date = date(current_date.year, current_date.month + 1, 1)
        else:
            labels.append(current_date.strftime(date_format))
            fact_data.append(data_by_date.get(current_date, 0.0))
            current_date += timedelta(days=1)

    # For demo purposes, generate plan data as fact * 1.1 (user can customize later)
    plan_data = [fact * 1.1 for fact in fact_data]

    return {
        "labels": labels,
        "plan": plan_data,
        "fact": fact_data,
        "period": period
    }


@router.get("/trends")
async def get_trends_data(
    current_user: CurrentUser,
    days: int = Query(30, ge=7, le=365),
    session: AsyncSession = Depends(get_session)
):
    """
    Get spending trends over time for line chart.

    Args:
        days: Number of days to analyze (default: 30)

    Returns:
        Dict with dates, income, and expense arrays
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Query daily income and expense
    query = select(
        Fact.fact_date,
        Article.type,
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.user_id == current_user.id,
        Fact.fact_date >= start_date,
        Fact.fact_date <= end_date,
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
        "period_days": days
    }


@router.get("/category-breakdown")
async def get_category_breakdown(
    current_user: CurrentUser,
    type: str = Query("expense", regex="^(income|expense)$"),
    period: str = Query("month", regex="^(week|month|year|all)$"),
    session: AsyncSession = Depends(get_session)
):
    """
    Get category breakdown for pie chart.

    Args:
        type: Transaction type (income or expense)
        period: Time period (week, month, year, all)

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
    query = select(
        Article.name,
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.user_id == current_user.id,
        Article.type == type,
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
        "period": period
    }


@router.get("/waterfall")
async def get_waterfall_data(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Get cumulative flow data for waterfall chart.

    Shows monthly income, expense, and cumulative balance for current year.
    """
    today = date.today()
    year_start = date(today.year, 1, 1)

    # Query monthly totals
    query = select(
        func.extract("month", Fact.fact_date).label("month"),
        Article.type,
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.user_id == current_user.id,
        Fact.fact_date >= year_start,
        Fact.fact_date <= today,
        Article.is_current == True  # noqa: E712
    ).group_by(func.extract("month", Fact.fact_date), Article.type).order_by(func.extract("month", Fact.fact_date))

    result = await session.execute(query)
    rows = result.all()

    # Build data structure
    months_data = {}
    for row in rows:
        month = int(row.month)
        if month not in months_data:
            months_data[month] = {"income": 0.0, "expense": 0.0}
        months_data[month][row.type] = float(row.total)

    # Generate arrays
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    labels = []
    income_data = []
    expense_data = []
    balance_data = []

    cumulative_balance = 0.0
    for month in range(1, today.month + 1):
        month_info = months_data.get(month, {"income": 0.0, "expense": 0.0})
        income = month_info["income"]
        expense = month_info["expense"]
        month_balance = income - expense
        cumulative_balance += month_balance

        labels.append(month_names[month - 1])
        income_data.append(income)
        expense_data.append(expense)
        balance_data.append(cumulative_balance)

    return {
        "labels": labels,
        "income": income_data,
        "expense": expense_data,
        "balance": balance_data,
        "year": today.year
    }


@router.get("/heatmap")
async def get_heatmap_data(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session)
):
    """
    Get spending patterns data for heatmap.

    Shows expense amounts by day of week and hour of day (uses fact_date for day, assumes midday for hour).
    """
    # Get last 90 days
    end_date = date.today()
    start_date = end_date - timedelta(days=90)

    # Query all facts
    query = select(
        Fact.fact_date,
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.user_id == current_user.id,
        Article.type == "expense",
        Fact.fact_date >= start_date,
        Fact.fact_date <= end_date,
        Article.is_current == True  # noqa: E712
    ).group_by(Fact.fact_date)

    result = await session.execute(query)
    rows = result.all()

    # Build heatmap data (day of week × week of period)
    data_by_date = {row.fact_date: float(row.total) for row in rows}

    # Calculate weeks
    weeks = []
    week_start = start_date - timedelta(days=start_date.weekday())  # Start from Monday

    current_date = week_start
    while current_date <= end_date:
        week_data = []
        for day in range(7):  # Mon-Sun
            date_to_check = current_date + timedelta(days=day)
            amount = data_by_date.get(date_to_check, 0.0)
            week_data.append(amount)
        weeks.append(week_data)
        current_date += timedelta(days=7)

    # Limit to last 12 weeks for visualization
    weeks = weeks[-12:]

    return {
        "weeks": weeks,
        "day_labels": ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        "week_count": len(weeks),
        "period_days": 90
    }
