"""
Admin Export API endpoints.

Provides system-wide data export functionality for administrators.
Admins can export all users' facts with advanced filtering.
"""
from typing import Optional

from datetime import date

from fastapi import APIRouter, Depends, Query
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import get_current_admin, get_session
from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact as Fact
from backend.app.models.user import User
from backend.app.utils.export import (
    export_to_csv,
    generate_filename,
)

router = APIRouter(prefix="/admin/export", tags=["Admin Export"])


# ============================================================================
# Admin System-Wide Facts Export
# ============================================================================


@router.get("/all-facts/csv")
async def export_all_facts_csv(
    current_admin: User = Depends(get_current_admin),
    session: AsyncSession = Depends(get_session),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    article_id: Optional[int] = Query(None, description="Filter by article ID"),
    start_date: Optional[date] = Query(None, description="Start date for filtering"),
    end_date: Optional[date] = Query(None, description="End date for filtering"),
):
    """
    Export all users' facts (transactions) to CSV format.

    Admin-only endpoint. Supports filtering by user, article, and date range.
    """
    # Build query for all facts (no user_id filter by default)
    stmt = (
        select(
            Fact.id,
            Fact.fact_date,
            User.username.label("user_name"),
            User.first_name,
            User.last_name,
            Article.name.label("category"),
            Article.type,
            Fact.amount,
            Fact.description
        )
        .join(User, Fact.user_id == User.id)
        .join(Article, Fact.article_id == Article.id)
        .where(
            # noqa: E712
        )
        .order_by(Fact.fact_date.desc(), Fact.id.desc())
    )

    # Apply filters
    if user_id:
        stmt = stmt.where(Fact.user_id == user_id)
    if article_id:
        stmt = stmt.where(Fact.article_id == article_id)
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
        # Format user name
        user_display = row.user_name or f"{row.first_name or ''} {row.last_name or ''}".strip() or f"User #{row.user_name}"

        data.append({
            "ID": row.id,
            "Date": row.fact_date.isoformat(),
            "User": user_display,
            "Category": row.category,
            "Type": row.type,
            "Amount": float(row.amount),
            "Description": row.description or ""
        })

    # Generate filename
    filename = generate_filename("admin_all_facts", "csv")

    # Export to CSV
    return export_to_csv(
        data=data,
        filename=filename,
        columns=["ID", "Date", "User", "Category", "Type", "Amount", "Description"]
    )
