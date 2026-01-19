"""
Facts HTMX Partials Endpoints.

Server-side rendered UI fragments for facts table, stats, and pagination.
Part of Phase 2: Migration from client-side rendering to HTMX partials.

Endpoints:
    GET /facts/table - Render facts table (desktop + mobile)
    GET /facts/stats - Render facts statistics widget
    GET /facts/pagination - Render pagination controls
"""

import logging
from datetime import date
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import HTMLResponse
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentUser, get_session
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/facts", tags=["Facts Partials (HTMX)"])


@router.get("/table", response_class=HTMLResponse)
async def get_facts_table_partial(
    request: Request,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=1000)] = 50,
    offset: Annotated[int, Query(ge=0)] = 0,
    date_from: Annotated[Optional[date], Query()] = None,
    date_to: Annotated[Optional[date], Query()] = None,
    article_id: Annotated[Optional[int], Query()] = None,
    record_type: Annotated[Optional[str], Query(pattern="^(fact|plan)$")] = "fact",
    article_type: Annotated[Optional[str], Query(pattern="^(income|expense|debit|credit)$")] = None,
    search: Annotated[Optional[str], Query(max_length=200)] = None,
    financial_center_id: Annotated[Optional[int], Query(gt=0)] = None,
    cost_center_id: Annotated[Optional[int], Query(gt=0)] = None,
    user_id: Annotated[Optional[int], Query(gt=0)] = None,
) -> str:
    """
    Get facts table partial (HTMX).

    Renders server-side HTML table with facts matching filters.
    Supports desktop table and mobile list views.

    **Shared Family Budget:**
    - All users see all facts
    - Filter by user_id is optional

    **Parameters:**
    - limit: Page size (default: 50)
    - offset: Page offset (default: 0)
    - date_from/date_to: Date range filter
    - article_id: Filter by article
    - record_type: fact or plan (default: fact)
    - article_type: income, expense, debit, credit
    - search: Search in description
    - financial_center_id: Filter by financial center
    - cost_center_id: Filter by cost center
    - user_id: Filter by user (optional)

    **Returns:**
    - HTML partial with facts table
    """
    from backend.app.main import templates

    # Build query
    statement = select(BudgetFact)

    # Apply filters
    if record_type:
        statement = statement.where(BudgetFact.record_type == record_type)

    if date_from:
        statement = statement.where(BudgetFact.fact_date >= date_from)

    if date_to:
        statement = statement.where(BudgetFact.fact_date <= date_to)

    if article_id:
        statement = statement.where(BudgetFact.article_id == article_id)

    if financial_center_id:
        statement = statement.where(BudgetFact.financial_center_id == financial_center_id)

    if cost_center_id:
        statement = statement.where(BudgetFact.cost_center_id == cost_center_id)

    if user_id:
        statement = statement.where(BudgetFact.user_id == user_id)

    if search:
        statement = statement.where(BudgetFact.description.ilike(f"%{search}%"))

    # Join with Article to filter by article_type
    if article_type:
        statement = statement.join(Article, BudgetFact.article_id == Article.id)
        statement = statement.where(Article.type == article_type)

    # Order by fact_date descending (most recent first)
    statement = statement.order_by(BudgetFact.fact_date.desc(), BudgetFact.id.desc())

    # Apply pagination
    statement = statement.limit(limit).offset(offset)

    # Execute query
    result = await session.execute(statement)
    facts = result.scalars().all()

    # Load related data
    if facts:
        # Load articles
        article_ids = {fact.article_id for fact in facts}
        articles_stmt = select(Article).where(Article.id.in_(article_ids))
        articles_result = await session.execute(articles_stmt)
        articles = {a.id: a for a in articles_result.scalars().all()}

        # Load financial centers
        fc_ids = {fact.financial_center_id for fact in facts if fact.financial_center_id}
        if fc_ids:
            fcs_stmt = select(FinancialCenter).where(FinancialCenter.id.in_(fc_ids))
            fcs_result = await session.execute(fcs_stmt)
            financial_centers = {fc.id: fc for fc in fcs_result.scalars().all()}
        else:
            financial_centers = {}

        # Load cost centers
        cc_ids = {fact.cost_center_id for fact in facts if fact.cost_center_id}
        if cc_ids:
            ccs_stmt = select(CostCenter).where(CostCenter.id.in_(cc_ids))
            ccs_result = await session.execute(ccs_stmt)
            cost_centers = {cc.id: cc for cc in ccs_result.scalars().all()}
        else:
            cost_centers = {}

        # Load users
        user_ids = {fact.user_id for fact in facts if fact.user_id}
        if user_ids:
            users_stmt = select(User).where(User.id.in_(user_ids))
            users_result = await session.execute(users_stmt)
            users = {u.id: u for u in users_result.scalars().all()}
        else:
            users = {}
    else:
        articles = {}
        financial_centers = {}
        cost_centers = {}
        users = {}

    # Render partial
    return templates.TemplateResponse(
        "partials/facts/facts_table.html",
        {
            "request": request,
            "facts": facts,
            "articles": articles,
            "financial_centers": financial_centers,
            "cost_centers": cost_centers,
            "users": users,
        },
    )


@router.get("/stats", response_class=HTMLResponse)
async def get_facts_stats_partial(
    request: Request,
    _current_user: CurrentUser,  # Required for authentication but not used
    session: AsyncSession = Depends(get_session),
    total: Annotated[int, Query(ge=0)] = 0,
    page: Annotated[int, Query(ge=0)] = 0,
    page_size: Annotated[int, Query(ge=1)] = 50,
) -> str:
    """
    Get facts statistics partial (HTMX).

    Renders server-side HTML stats widget showing:
    - Total facts count
    - Current page range (start-end)

    **Parameters:**
    - total: Total facts count (from query parameter)
    - page: Current page number (0-indexed)
    - page_size: Page size (default: 50)

    **Returns:**
    - HTML partial with stats widget
    """
    from backend.app.main import templates

    # Calculate page range
    start = page * page_size + 1 if total > 0 else 0
    end = min((page + 1) * page_size, total)

    return templates.TemplateResponse(
        "partials/facts/facts_stats.html",
        {
            "request": request,
            "total": total,
            "start": start,
            "end": end,
        },
    )


@router.get("/pagination", response_class=HTMLResponse)
async def get_facts_pagination_partial(
    request: Request,
    _current_user: CurrentUser,  # Required for authentication but not used
    total: Annotated[int, Query(ge=0)] = 0,
    page: Annotated[int, Query(ge=0)] = 0,
    page_size: Annotated[int, Query(ge=1)] = 50,
) -> str:
    """
    Get facts pagination controls partial (HTMX).

    Renders server-side HTML pagination controls with:
    - Previous/Next buttons
    - Page numbers
    - Disabled states

    **Parameters:**
    - total: Total facts count
    - page: Current page number (0-indexed)
    - page_size: Page size (default: 50)

    **Returns:**
    - HTML partial with pagination controls
    """
    from backend.app.main import templates

    # Calculate pagination data
    total_pages = (total + page_size - 1) // page_size if total > 0 else 0
    has_previous = page > 0
    has_next = page < total_pages - 1

    return templates.TemplateResponse(
        "partials/facts/facts_pagination.html",
        {
            "request": request,
            "page": page,
            "total_pages": total_pages,
            "page_size": page_size,
            "has_previous": has_previous,
            "has_next": has_next,
        },
    )
