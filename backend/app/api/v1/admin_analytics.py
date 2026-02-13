"""
Admin Analytics API endpoints.

Provides system-wide analytics and insights for administrators.
Admin users can see aggregated data across ALL users.

Endpoints:
    GET /admin/analytics/overview - System-wide statistics
    GET /admin/analytics/users-growth - User registration trends
    GET /admin/analytics/transactions-trends - Transaction volume trends
    GET /admin/analytics/top-users - Most active users
    GET /admin/analytics/categories-breakdown - Popular categories
    GET /admin/analytics/centers-usage - ЦФО/МВЗ usage statistics
"""

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentAdmin, get_session
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact as Fact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User

router = APIRouter(prefix="/admin/analytics", tags=["Admin Analytics"])


@router.get("/overview")
async def get_system_overview(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Get system-wide overview statistics.

    Returns:
        - Total users (active and inactive)
        - Total transactions (facts)
        - Total articles (categories)
        - Total ЦФО and МВЗ
        - Recent activity summary
    """
    # Total users
    users_stmt = select(func.count(func.distinct(User.telegram_id))).where()
    users_result = await session.execute(users_stmt)
    total_users = users_result.scalar_one()

    # Total transactions
    facts_stmt = select(func.count(Fact.id))
    facts_result = await session.execute(facts_stmt)
    total_facts = facts_result.scalar_one()

    # Total articles
    articles_stmt = select(func.count(Article.id)).where(
    )
    articles_result = await session.execute(articles_stmt)
    total_articles = articles_result.scalar_one()

    # Total ЦФО
    fc_stmt = select(func.count(FinancialCenter.id)).where(
    )
    fc_result = await session.execute(fc_stmt)
    total_fcs = fc_result.scalar_one()

    # Total МВЗ
    cc_stmt = select(func.count(CostCenter.id)).where(
    )
    cc_result = await session.execute(cc_stmt)
    total_ccs = cc_result.scalar_one()

    # Recent activity (last 30 days)
    thirty_days_ago = date.today() - timedelta(days=30)
    recent_facts_stmt = select(func.count(Fact.id)).where(
        Fact.fact_date >= thirty_days_ago
    )
    recent_facts_result = await session.execute(recent_facts_stmt)
    recent_facts = recent_facts_result.scalar_one()

    # Recent users (last 30 days)
    recent_users_stmt = select(func.count(func.distinct(User.telegram_id))).where(
        # noqa: E712
        User.created_at >= datetime.utcnow() - timedelta(days=30)
    )
    recent_users_result = await session.execute(recent_users_stmt)
    recent_users = recent_users_result.scalar_one()

    # Total income and expense
    income_expense_stmt = select(
        Article.type,
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
    ).group_by(Article.type)

    income_expense_result = await session.execute(income_expense_stmt)
    income_expense_data = {row.type: float(row.total) for row in income_expense_result.all()}

    return {
        "total_users": total_users,
        "total_transactions": total_facts,
        "total_articles": total_articles,
        "total_financial_centers": total_fcs,
        "total_cost_centers": total_ccs,
        "recent_activity": {
            "new_users_30d": recent_users,
            "transactions_30d": recent_facts
        },
        "financial_summary": {
            "total_income": income_expense_data.get("income", 0.0),
            "total_expense": income_expense_data.get("expense", 0.0),
            "balance": income_expense_data.get("income", 0.0) - income_expense_data.get("expense", 0.0)
        },
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/users-growth")
async def get_users_growth(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    days: int = Query(90, ge=7, le=365, description="Number of days to analyze")
):
    """
    Get user registration growth trends.

    Returns daily/weekly user registration counts over the specified period.
    """
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)

    # Get user registrations grouped by date
    # Note: We use distinct telegram_id and get count per day
    from sqlalchemy import text

    stmt = text("""
        SELECT
            DATE_TRUNC('day', created_at) AS registration_date,
            COUNT(DISTINCT telegram_id) AS count
        FROM t_d_user
        WHERE created_at >= :start_date
          AND is_current = true
        GROUP BY DATE_TRUNC('day', created_at)
        ORDER BY registration_date
    """)

    result = await session.execute(stmt, {"start_date": start_date})
    rows = result.all()

    # Build data structure
    data = []
    for row in rows:
        data.append({
            "date": row.registration_date.date().isoformat() if row.registration_date else None,
            "count": row.count
        })

    # Calculate cumulative total
    cumulative = 0
    for item in data:
        cumulative += item["count"]
        item["cumulative"] = cumulative

    return {
        "period_days": days,
        "start_date": start_date.date().isoformat(),
        "end_date": end_date.date().isoformat(),
        "total_registrations": cumulative if data else 0,
        "data": data
    }


@router.get("/transactions-trends")
async def get_transactions_trends(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    days: int = Query(90, ge=7, le=365, description="Number of days to analyze")
):
    """
    Get transaction volume trends over time.

    Returns daily transaction counts and amounts (income/expense) over the specified period.
    """
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Get transactions grouped by date and type
    stmt = select(
        Fact.fact_date,
        Article.type,
        func.count(Fact.id).label("count"),
        func.sum(Fact.amount).label("total")
    ).select_from(Fact).join(Article, Fact.article_id == Article.id).where(
        Fact.fact_date >= start_date,
        Fact.fact_date <= end_date,
    ).group_by(
        Fact.fact_date,
        Article.type
    ).order_by(Fact.fact_date)

    result = await session.execute(stmt)
    rows = result.all()

    # Build data structure
    data_by_date = {}
    for row in rows:
        date_str = row.fact_date.isoformat()
        if date_str not in data_by_date:
            data_by_date[date_str] = {
                "date": date_str,
                "income_count": 0,
                "expense_count": 0,
                "income_amount": 0.0,
                "expense_amount": 0.0
            }

        if row.type == "income":
            data_by_date[date_str]["income_count"] = row.count
            data_by_date[date_str]["income_amount"] = float(row.total)
        elif row.type == "expense":
            data_by_date[date_str]["expense_count"] = row.count
            data_by_date[date_str]["expense_amount"] = float(row.total)

    data = list(data_by_date.values())

    # Calculate totals
    total_income = sum(item["income_amount"] for item in data)
    total_expense = sum(item["expense_amount"] for item in data)
    total_transactions = sum(item["income_count"] + item["expense_count"] for item in data)

    return {
        "period_days": days,
        "start_date": start_date.isoformat(),
        "end_date": end_date.isoformat(),
        "total_transactions": total_transactions,
        "total_income": total_income,
        "total_expense": total_expense,
        "data": data
    }


@router.get("/top-users")
async def get_top_users(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    limit: int = Query(10, ge=5, le=50, description="Number of top users to return"),
    metric: str = Query("transactions", pattern="^(transactions|amount)$", description="Sort by transactions count or total amount")
):
    """
    Get top users by activity.

    Returns users ranked by transaction count or total transaction amount.
    """
    # Build query based on metric
    if metric == "transactions":
        sort_expr = func.count(Fact.id).label("value")
    else:  # amount
        sort_expr = func.sum(Fact.amount).label("value")

    stmt = select(
        User.id,
        User.username,
        User.first_name,
        User.last_name,
        func.count(Fact.id).label("transaction_count"),
        func.sum(Fact.amount).label("total_amount")
    ).select_from(User).join(Fact, User.id == Fact.user_id).where().group_by(
        User.id,
        User.username,
        User.first_name,
        User.last_name
    ).order_by(
        sort_expr.desc()
    ).limit(limit)

    result = await session.execute(stmt)
    rows = result.all()

    data = []
    for row in rows:
        data.append({
            "user_id": row.id,
            "username": row.username or "N/A",
            "first_name": row.first_name,
            "last_name": row.last_name,
            "transaction_count": row.transaction_count,
            "total_amount": float(row.total_amount)
        })

    return {
        "metric": metric,
        "limit": limit,
        "data": data
    }


@router.get("/categories-breakdown")
async def get_categories_breakdown(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    type: str = Query("expense", pattern="^(income|expense)$", description="Article type"),
    limit: int = Query(15, ge=5, le=50, description="Number of categories to return")
):
    """
    Get popular categories breakdown.

    Returns most used categories (articles) by transaction count and total amount.
    """
    stmt = select(
        Article.id,
        Article.name,
        Article.type,
        func.count(Fact.id).label("transaction_count"),
        func.sum(Fact.amount).label("total_amount")
    ).select_from(Article).join(Fact, Article.id == Fact.article_id).where(
        Article.type == type,
    ).group_by(
        Article.id,
        Article.name,
        Article.type
    ).order_by(
        func.sum(Fact.amount).desc()
    ).limit(limit)

    result = await session.execute(stmt)
    rows = result.all()

    # Calculate total for percentages
    total_amount = sum(float(row.total_amount) for row in rows)

    data = []
    for row in rows:
        amount = float(row.total_amount)
        percentage = round((amount / total_amount * 100) if total_amount > 0 else 0, 2)

        data.append({
            "article_id": row.id,
            "name": row.name,
            "transaction_count": row.transaction_count,
            "total_amount": amount,
            "percentage": percentage
        })

    return {
        "type": type,
        "limit": limit,
        "total_amount": total_amount,
        "data": data
    }


@router.get("/centers-usage")
async def get_centers_usage(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Get ЦФО and МВЗ usage statistics.

    Returns usage counts and amounts for all financial centers and cost centers.
    """
    # Financial Centers usage
    fc_stmt = select(
        FinancialCenter.id,
        FinancialCenter.code,
        FinancialCenter.name,
        func.count(Fact.id).label("transaction_count"),
        func.sum(Fact.amount).label("total_amount")
    ).select_from(FinancialCenter).join(
        Fact,
        FinancialCenter.id == Fact.financial_center_id
    ).where(
    ).group_by(
        FinancialCenter.id,
        FinancialCenter.code,
        FinancialCenter.name
    ).order_by(
        func.count(Fact.id).desc()
    )

    fc_result = await session.execute(fc_stmt)
    fc_rows = fc_result.all()

    financial_centers = []
    for row in fc_rows:
        financial_centers.append({
            "id": row.id,
            "code": row.code,
            "name": row.name,
            "transaction_count": row.transaction_count,
            "total_amount": float(row.total_amount)
        })

    # Cost Centers usage
    cc_stmt = select(
        CostCenter.id,
        CostCenter.code,
        CostCenter.name,
        func.count(Fact.id).label("transaction_count"),
        func.sum(Fact.amount).label("total_amount")
    ).select_from(CostCenter).join(
        Fact,
        CostCenter.id == Fact.cost_center_id
    ).where(
    ).group_by(
        CostCenter.id,
        CostCenter.code,
        CostCenter.name
    ).order_by(
        func.count(Fact.id).desc()
    )

    cc_result = await session.execute(cc_stmt)
    cc_rows = cc_result.all()

    cost_centers = []
    for row in cc_rows:
        cost_centers.append({
            "id": row.id,
            "code": row.code,
            "name": row.name,
            "transaction_count": row.transaction_count,
            "total_amount": float(row.total_amount)
        })

    return {
        "financial_centers": financial_centers,
        "cost_centers": cost_centers,
        "timestamp": datetime.utcnow().isoformat()
    }


@router.post("/refresh-balance-aggregates")
async def refresh_balance_aggregates(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    year: int = Query(None, ge=2000, le=2100, description="Specific year to refresh (optional)"),
    month: int = Query(None, ge=1, le=12, description="Specific month to refresh (requires year)"),
    financial_center_id: int = Query(None, description="Specific financial center ID to refresh (optional)")
):
    """
    Manually refresh monthly balance aggregates.

    This endpoint triggers calculation and storage of monthly closing balances
    for financial centers in the aggregate table (t_agg_financial_center_balance_monthly).

    Admin-only operation - requires admin privileges.

    Query Parameters:
        - year (optional): Specific year to refresh (e.g., 2025). If not provided, refresh all historical data.
        - month (optional): Specific month to refresh (1-12). Requires year parameter.
        - financial_center_id (optional): Specific financial center to refresh. If not provided, refresh all FCs.

    Returns:
        - updated_count: Number of aggregate records created/updated
        - financial_centers: Number of financial centers processed
        - months_processed: Number of unique months processed
        - execution_time_seconds: How long the operation took

    Examples:
        - POST /admin/analytics/refresh-balance-aggregates
          → Refresh all aggregates for all financial centers and all time

        - POST /admin/analytics/refresh-balance-aggregates?year=2025&month=11
          → Refresh only November 2025 aggregates

        - POST /admin/analytics/refresh-balance-aggregates?financial_center_id=1
          → Refresh all aggregates for specific financial center

    Notes:
        - This is a heavy operation for full refresh (scans all transactions)
        - Consider running during off-peak hours for production systems
        - Safe to call multiple times (uses UPSERT for idempotency)
        - After refresh, analytics queries will use optimized aggregates
    """
    from backend.app.services.balance_aggregation_service import refresh_monthly_balances

    # Validate: if month is provided, year must also be provided
    if month is not None and year is None:
        from fastapi import HTTPException
        raise HTTPException(
            status_code=400,
            detail="Parameter 'month' requires 'year' to be specified"
        )

    # Record start time
    start_time = datetime.utcnow()

    # Call service function
    result = await refresh_monthly_balances(
        session=session,
        year=year,
        month=month,
        financial_center_id=financial_center_id
    )

    # Calculate execution time
    end_time = datetime.utcnow()
    execution_time = (end_time - start_time).total_seconds()

    return {
        "success": True,
        "message": "Balance aggregates refreshed successfully",
        "updated_count": result["updated_count"],
        "financial_centers": result["financial_centers"],
        "months_processed": result["months_processed"],
        "execution_time_seconds": round(execution_time, 2),
        "timestamp": end_time.isoformat(),
        "parameters": {
            "year": year,
            "month": month,
            "financial_center_id": financial_center_id
        }
    }
