"""
Export API endpoints.

Provides data export functionality in CSV, Excel, and PDF formats.
"""

from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_current_user, get_session
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact as Fact
from backend.app.utils.export import (
    export_to_csv,
    export_to_excel,
    export_to_pdf,
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
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
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
            Article.is_current == True  # noqa: E712
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


@router.get("/facts/excel")
async def export_facts_excel(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
):
    """
    Export user's facts (transactions) to Excel format.

    Includes date range filtering.
    """
    # Build query (same as CSV)
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
            Article.is_current == True  # noqa: E712
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
    filename = generate_filename("transactions", "xlsx")

    # Export to Excel
    return export_to_excel(
        data=data,
        filename=filename,
        sheet_name="Transactions",
        columns=["ID", "Date", "Category", "Type", "Amount", "Description"],
        column_widths={
            "ID": 8,
            "Date": 12,
            "Category": 25,
            "Type": 10,
            "Amount": 12,
            "Description": 40
        }
    )


@router.get("/facts/pdf")
async def export_facts_pdf(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
):
    """
    Export user's facts (transactions) to PDF format.

    Includes date range filtering.
    """
    # Build query (same as CSV)
    stmt = (
        select(
            Fact.fact_date,
            Article.name.label("category"),
            Article.type,
            Fact.amount,
            Fact.description
        )
        .join(Article, Fact.article_id == Article.id)
        .where(
            Fact.user_id == current_user.id,
            Article.is_current == True  # noqa: E712
        )
        .order_by(Fact.fact_date.desc())
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
            "date": row.fact_date,
            "category": row.category,
            "type": row.type.capitalize(),
            "amount": float(row.amount),
            "description": row.description or "-"
        })

    # Generate title
    title = "Transactions Report"
    if start_date or end_date:
        date_range = []
        if start_date:
            date_range.append(f"from {start_date.isoformat()}")
        if end_date:
            date_range.append(f"to {end_date.isoformat()}")
        title += f" ({' '.join(date_range)})"

    # Generate filename
    filename = generate_filename("transactions_report", "pdf")

    # Export to PDF
    return export_to_pdf(
        title=title,
        data=data,
        filename=filename,
        columns=["date", "category", "type", "amount", "description"],
        column_labels={
            "date": "Date",
            "category": "Category",
            "type": "Type",
            "amount": "Amount (₽)",
            "description": "Description"
        },
        orientation="landscape"
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
            Article.is_current == True  # noqa: E712
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


@router.get("/analytics/trends/excel")
async def export_trends_excel(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    days: int = Query(30, ge=7, le=365, description="Number of days")
):
    """
    Export income/expense trends to Excel format.
    """
    # Calculate date range
    end_date = date.today()
    start_date = end_date - timedelta(days=days)

    # Query trends data (same as CSV)
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
            Article.is_current == True  # noqa: E712
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
    filename = generate_filename("trends", "xlsx")

    return export_to_excel(
        data=data,
        filename=filename,
        sheet_name="Trends",
        columns=["Date", "Income", "Expense", "Net"],
        column_widths={
            "Date": 12,
            "Income": 15,
            "Expense": 15,
            "Net": 15
        }
    )
