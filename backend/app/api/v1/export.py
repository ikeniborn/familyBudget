"""
Export API endpoints.

Provides data export functionality in CSV format.
"""

from datetime import date, timedelta

from fastapi import APIRouter, Depends, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact as Fact
from backend.app.utils.export import (
    export_to_csv,
    generate_filename,
)

router = APIRouter(prefix="/export", tags=["Export"])


# ============================================================================
# Facts Export
# ============================================================================


@router.get("/facts/csv")
async def export_facts_csv(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    start_date: date | None = Query(None, description="Start date for filtering"),
    end_date: date | None = Query(None, description="End date for filtering"),
):
    """
    Export user's facts (transactions) to CSV format.

    Includes date range filtering.
    """
    # Build query
    stmt = (
        select(
            Fact.id,
            Fact.fact_date,
            Article.name.label("category"),
            Article.type,
            Fact.amount,
            Fact.description
        )
        .join(Article, Fact.article_id == Article.id)
        .where(
            Fact.user_id == current_user.id,
        )
        .order_by(Fact.fact_date.desc(), Fact.id.desc())
    )

    # Apply date filters
    if start_date:
        stmt = stmt.where(Fact.fact_date >= start_date)
    if end_date:
        stmt = stmt.where(Fact.fact_date <= end_date)

    # Execute query
    result = await session.execute(stmt)
    rows = result.all()

    # Convert to list of dictionaries
    data = []
    for row in rows:
        data.append({
            "ID": row.id,
            "Date": row.fact_date.isoformat(),
            "Category": row.category,
            "Type": row.type,
            "Amount": float(row.amount),
            "Description": row.description or ""
        })

    # Generate filename
    filename = generate_filename("transactions", "csv")

    # Export to CSV
    return export_to_csv(
        data=data,
        filename=filename,
        columns=["ID", "Date", "Category", "Type", "Amount", "Description"]
    )


# ============================================================================
# Analytics Export
# ============================================================================


@router.get("/analytics/trends/csv")
async def export_trends_csv(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    days: int = Query(30, ge=7, le=365, description="Number of days")
):
    """
    Export income/expense trends to CSV format.
    """
    # Calculate date range
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Query trends data
    from sqlalchemy import func

    stmt = (
        select(
            Fact.fact_date,
            Article.type,
            func.sum(Fact.amount).label("total")
        )
        .join(Article, Fact.article_id == Article.id)
        .where(
            Fact.user_id == current_user.id,
            Fact.fact_date >= start_date,
            Fact.fact_date <= end_date,
        )
        .group_by(Fact.fact_date, Article.type)
        .order_by(Fact.fact_date)
    )

    result = await session.execute(stmt)
    rows = result.all()

    # Convert to daily structure
    data_by_date = {}
    for row in rows:
        date_str = row.fact_date.isoformat()
        if date_str not in data_by_date:
            data_by_date[date_str] = {
                "Date": date_str,
                "Income": 0.0,
                "Expense": 0.0
            }

        if row.type == "income":
            data_by_date[date_str]["Income"] = float(row.total)
        elif row.type == "expense":
            data_by_date[date_str]["Expense"] = float(row.total)

    # Calculate net
    data = []
    for date_str in sorted(data_by_date.keys()):
        row_data = data_by_date[date_str]
        row_data["Net"] = row_data["Income"] - row_data["Expense"]
        data.append(row_data)

    # Generate filename
    filename = generate_filename("trends", "csv")

    return export_to_csv(
        data=data,
        filename=filename,
        columns=["Date", "Income", "Expense", "Net"]
    )
