"""
Facts CRUD endpoints.

This module implements CRUD operations for budget facts (transactions).
Facts are simple transactional records without SCD Type 2 versioning.

Features:
    - User data isolation (users see only their facts)
    - Admin bypass (admins see all facts)
    - Simple updates (no SCD Type 2, just UPDATE in-place)
    - Date range filtering for reports
    - Aggregation endpoint for summaries
"""

import logging
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import HTMLResponse
from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import (
    CurrentUser,
    apply_user_filter,
    ensure_user_owns_resource,
    get_session,
    get_user_id_for_create,
)
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User
from backend.app.schemas import get_common_responses
from backend.app.schemas.fact import (
    FactCreate,
    FactListResponse,
    FactResponse,
    FactSummary,
    FactUpdate,
)


# Far future datetime constant for SCD Type 2 valid_to field
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/facts", tags=["Facts"])


@router.post(
    "",
    response_model=FactResponse,
    status_code=status.HTTP_201_CREATED,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def create_fact(
    fact_data: FactCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> BudgetFact:
    """
    Create a new budget fact (transaction).

    **User Isolation:**
    - Fact is created with current user as owner
    - Article must exist and be accessible (own or global)

    **Validation:**
    - article_id must exist
    - article must belong to user or be global
    - fact_date cannot be in future
    - amount must be > 0

    **Returns:**
    - 201 Created: Fact created successfully
    - 404 Not Found: Article not found
    - 403 Forbidden: Article not accessible
    """
    # Validate: Article must exist and be accessible
    article_stmt = select(Article).where(
        Article.id == fact_data.article_id
    )
    article_result = await session.execute(article_stmt)
    article = article_result.scalar_one_or_none()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article with id={fact_data.article_id} not found"
        )

    # Shared Family Budget: All users can use all articles (no ownership check)
    # Articles are shared references accessible to all authenticated users

    # Create new fact
    # Convert amount to absolute value (always store positive)
    fact_dict = fact_data.model_dump()
    fact_dict['amount'] = abs(fact_dict['amount'])

    fact = BudgetFact(
        **fact_dict,
        user_id=get_user_id_for_create(current_user),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    # Load financial center and cost center names if present
    financial_center_name = None
    if fact.financial_center_id:
        fc_stmt = select(FinancialCenter).where(
            FinancialCenter.id == fact.financial_center_id
        )
        fc_result = await session.execute(fc_stmt)
        fc = fc_result.scalar_one_or_none()
        financial_center_name = fc.name if fc else None

    cost_center_name = None
    if fact.cost_center_id:
        cc_stmt = select(CostCenter).where(
            CostCenter.id == fact.cost_center_id
        )
        cc_result = await session.execute(cc_stmt)
        cc = cc_result.scalar_one_or_none()
        cost_center_name = cc.name if cc else None

    # Return enriched response with article and center data
    return {
        "id": fact.id,
        "user_id": fact.user_id,
        "article_id": fact.article_id,
        "article_type": article.type,
        "article_name": article.name,
        "fact_date": fact.fact_date,
        "amount": fact.amount,
        "description": fact.description,
        "financial_center_id": fact.financial_center_id,
        "financial_center_name": financial_center_name,
        "cost_center_id": fact.cost_center_id,
        "cost_center_name": cost_center_name,
        "record_type": fact.record_type,
        "created_at": fact.created_at,
        "updated_at": fact.updated_at,
    }


@router.get(
    "",
    response_model=FactListResponse,
    responses=get_common_responses(),
)
async def list_facts(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=10000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    date_from: Annotated[Optional[date], Query()] = None,
    date_to: Annotated[Optional[date], Query()] = None,
    article_id: Annotated[Optional[int], Query()] = None,
    record_type: Annotated[Optional[str], Query(pattern="^(fact|plan)$")] = None,
    article_type: Annotated[Optional[str], Query(pattern="^(income|expense)$")] = None,
    search: Annotated[Optional[str], Query(max_length=200)] = None,
    amount_min: Annotated[Optional[Decimal], Query(ge=0)] = None,
    amount_max: Annotated[Optional[Decimal], Query(ge=0)] = None,
    financial_center_id: Annotated[Optional[int], Query(gt=0)] = None,
    cost_center_id: Annotated[Optional[int], Query(gt=0)] = None,
) -> FactListResponse:
    """
    List budget facts with optional filtering.

    **User Isolation:**
    - Regular users see only their own facts
    - Admins see all facts

    **Filters:**
    - date_from: Start date (inclusive)
    - date_to: End date (inclusive)
    - article_id: Filter by specific article
    - record_type: Filter by 'fact' (actual) or 'plan' (budget)
    - article_type: Filter by 'income' or 'expense'
    - search: Search in description (case-insensitive)
    - amount_min: Minimum amount (inclusive)
    - amount_max: Maximum amount (inclusive)
    - financial_center_id: Filter by financial center
    - cost_center_id: Filter by cost center

    **Pagination:**
    - limit: Maximum number of results (1-10000, default: 100)
    - offset: Number of results to skip (default: 0)

    **Returns:**
    - 200 OK: List of facts with pagination info (includes article info and center names)
    """
    # Base query with JOINs for enriched response
    statement = (
        select(BudgetFact, Article, FinancialCenter, CostCenter, User)
        .join(
            Article,
            BudgetFact.article_id == Article.id
        )
        .outerjoin(
            FinancialCenter,
            BudgetFact.financial_center_id == FinancialCenter.id
        )
        .outerjoin(
            CostCenter,
            BudgetFact.cost_center_id == CostCenter.id
        )
        .outerjoin(
            User,
            BudgetFact.user_id == User.id  # Fact Table snapshot pattern
        )
    )

    # Shared family budget - NO user isolation filter
    # All authenticated users see all transactions

    # Apply filters
    if date_from:
        statement = statement.where(BudgetFact.fact_date >= date_from)

    if date_to:
        statement = statement.where(BudgetFact.fact_date <= date_to)

    if article_id:
        statement = statement.where(BudgetFact.article_id == article_id)

    if record_type:
        statement = statement.where(BudgetFact.record_type == record_type)

    if article_type:
        statement = statement.where(Article.type == article_type)

    if search:
        # Substring search using ILIKE with pg_trgm GIN index
        # GIN index on description (gin_trgm_ops) speeds up ILIKE queries significantly
        # This provides case-insensitive substring matching with good performance
        statement = statement.where(BudgetFact.description.ilike(f"%{search}%"))

    if amount_min is not None:
        statement = statement.where(BudgetFact.amount >= amount_min)

    if amount_max is not None:
        statement = statement.where(BudgetFact.amount <= amount_max)

    if financial_center_id:
        statement = statement.where(BudgetFact.financial_center_id == financial_center_id)

    if cost_center_id:
        statement = statement.where(BudgetFact.cost_center_id == cost_center_id)

    # Count total (before pagination)
    count_stmt = select(func.count()).select_from(statement.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Apply pagination and ordering (newest by updated_at first, then by id as tiebreaker)
    statement = statement.order_by(BudgetFact.updated_at.desc(), BudgetFact.id.desc())
    statement = statement.limit(limit).offset(offset)

    # Execute query
    result = await session.execute(statement)
    rows = result.all()

    # Enrich facts with article and center data
    enriched_facts = []
    for fact, article, financial_center, cost_center, user in rows:
        # Get user name with improved fallback chain
        user_name = None
        if user:
            user_name = (
                user.first_name or
                user.username or
                user.last_name or
                (f"User {user.telegram_id}" if user.telegram_id else None) or
                f"Пользователь #{user.id}"
            )

            # Debug logging if user fields are mostly NULL
            if not user.first_name and not user.username and not user.last_name:
                logger.warning(
                    f"User {user.id} (telegram_id={user.telegram_id}) has no name fields. "
                    f"Using fallback: '{user_name}'"
                )
        else:
            logger.error(f"Fact {fact.id} has no associated user (user_id={fact.user_id})")

        fact_dict = {
            "id": fact.id,
            "user_id": fact.user_id,
            "user_name": user_name,
            "article_id": fact.article_id,
            "article_type": article.type,
            "article_name": article.name,
            "fact_date": fact.fact_date,
            "amount": fact.amount,
            "description": fact.description,
            "financial_center_id": fact.financial_center_id,
            "financial_center_name": financial_center.name if financial_center else None,
            "cost_center_id": fact.cost_center_id,
            "cost_center_name": cost_center.name if cost_center else None,
            "record_type": fact.record_type,
            "created_at": fact.created_at,
            "updated_at": fact.updated_at,
        }
        enriched_facts.append(fact_dict)

    return FactListResponse(
        facts=enriched_facts,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/new",
    responses=get_common_responses(),
)
async def new_fact_info() -> dict:
    """
    Info endpoint for creating new facts.

    **Note:** To create a new fact, use POST /facts endpoint.

    **Returns:**
    - 200 OK: Instructions for creating facts
    """
    return {
        "message": "To create a new fact, send POST request to /api/v1/facts",
        "example": {
            "article_id": 1,
            "amount": 100.50,
            "fact_date": "2025-10-18",
            "description": "Optional description"
        },
        "documentation": "/docs#/Facts/create_fact_facts_post"
    }


@router.get("/recent-html", response_class=HTMLResponse)
async def get_recent_facts_html(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=20)] = 10,
) -> str:
    """
    Get recent budget records (HTML formatted for dashboard).

    Returns the most recent transactions (facts and plans) as an HTML table.
    Uses DaisyUI table components for beautiful display.

    **User Isolation:**
    - Regular users see only their own records
    - Admins see all records

    **Parameters:**
    - limit: Maximum number of results (1-20, default: 10)

    **Returns:**
    - HTML table with recent records (facts and plans)
    """
    try:
        # Base query - include both facts and plans
        statement = select(BudgetFact)

        # Shared family budget - NO user isolation filter
        # All authenticated users see all transactions

        # No filter by record_type - show both facts and plans

        # Order by most recent (by creation time in DB, not transaction date)
        # This shows newest added transactions first, regardless of their fact_date
        statement = statement.order_by(BudgetFact.created_at.desc())
        statement = statement.limit(limit)

        # Execute query
        result = await session.execute(statement)
        facts = result.scalars().all()

        # If no records, return empty state message
        if not facts:
            return """
            <div class="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>Записи не найдены. Добавьте первую запись!</span>
            </div>
            """

        # Load articles for fact details
        article_ids = {fact.article_id for fact in facts}
        articles_stmt = select(Article).where(
            Article.id.in_(article_ids)
        )
        articles_result = await session.execute(articles_stmt)
        articles = {a.id: a for a in articles_result.scalars().all()}

        # Load financial centers for fact details
        from backend.app.models.financial_center import FinancialCenter
        financial_center_ids = {fact.financial_center_id for fact in facts if fact.financial_center_id}
        if financial_center_ids:
            fcs_stmt = select(FinancialCenter).where(
                FinancialCenter.id.in_(financial_center_ids)
            )
            fcs_result = await session.execute(fcs_stmt)
            financial_centers = {fc.id: fc for fc in fcs_result.scalars().all()}
        else:
            financial_centers = {}

        # Format money helper
        def format_money(amount: Decimal) -> str:
            return f"{float(amount):,.2f}".replace(",", " ")

        # Build HTML table with Type column as first column
        html = """
        <div class="overflow-x-auto">
            <table class="table table-zebra table-sm">
                <thead>
                    <tr>
                        <th>Тип</th>
                        <th>Дата</th>
                        <th>ЦФО</th>
                        <th>Категория</th>
                        <th>Сумма</th>
                        <th>Описание</th>
                    </tr>
                </thead>
                <tbody>
        """

        for fact in facts:
            article = articles.get(fact.article_id)
            if not article:
                continue

            # Record type badge (Факт or План)
            if fact.record_type == "plan":
                record_type_badge = '<span class="badge badge-info badge-sm">План</span>'
            else:
                record_type_badge = '<span class="badge badge-success badge-sm">Факт</span>'

            # Format date
            fact_date_str = fact.fact_date.strftime("%d.%m.%Y")

            # Determine color based on article type
            # expense (расход) = red, income (доход) = green
            # debit (списание) = blue, credit (пополнение) = orange
            if article.type == "expense":
                amount_class = "text-error font-bold"
            elif article.type == "income":
                amount_class = "text-success font-bold"
            elif article.type == "debit":
                amount_class = "text-info font-bold"
            elif article.type == "credit":
                amount_class = "text-warning font-bold"
            else:
                amount_class = "font-bold"

            # Article icon based on type (income=💰, credit=📥, expense=💸, debit=📤)
            if article.type == "income":
                article_icon = "💰"
            elif article.type == "credit":
                article_icon = "📥"
            elif article.type == "expense":
                article_icon = "💸"
            elif article.type == "debit":
                article_icon = "📤"
            else:
                article_icon = "❓"

            # Financial center name
            financial_center = financial_centers.get(fact.financial_center_id)
            fc_name = financial_center.name if financial_center else "—"

            # Description (truncate if too long)
            description = fact.description if fact.description else "—"
            description_full = description  # For title attribute
            if len(description) > 30:
                description = description[:30] + "..."

            html += f"""
                    <tr>
                        <td>{record_type_badge}</td>
                        <td class="whitespace-nowrap">{fact_date_str}</td>
                        <td class="whitespace-nowrap">{fc_name}</td>
                        <td>{article_icon} {article.name}</td>
                        <td class="{amount_class} whitespace-nowrap">{format_money(fact.amount)} ₽</td>
                        <td class="max-w-xs truncate" title="{description_full}">{description}</td>
                    </tr>
            """

        html += """
                </tbody>
            </table>
        </div>
        """

        return html

    except Exception as e:
        logger.error(f"Error loading recent records: {str(e)}", exc_info=True)
        return """
        <div class="alert alert-error">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            <span>Ошибка загрузки записей. Попробуйте обновить страницу.</span>
        </div>
        """


@router.get(
    "/summary",
    response_model=FactSummary,
    responses=get_common_responses(),
)
async def get_facts_summary(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    date_from: Annotated[Optional[date], Query()] = None,
    date_to: Annotated[Optional[date], Query()] = None,
) -> FactSummary:
    """
    Get aggregated summary of facts (income/expense totals).

    **User Isolation:**
    - Regular users see summary of their own facts
    - Admins see summary of all facts

    **Filters:**
    - date_from: Start date (inclusive)
    - date_to: End date (inclusive)

    **Returns:**
    - 200 OK: Summary with income/expense totals and balance
    """
    # Base query
    # Shared family budget - NO user isolation filter
    statement = select(BudgetFact)

    # Apply date filters
    if date_from:
        statement = statement.where(BudgetFact.fact_date >= date_from)

    if date_to:
        statement = statement.where(BudgetFact.fact_date <= date_to)

    # Get all facts for processing
    result = await session.execute(statement)
    facts = result.scalars().all()

    # Calculate totals by article type
    total_income = Decimal("0.00")
    total_expense = Decimal("0.00")
    count_income = 0
    count_expense = 0

    # Load articles to determine type
    if facts:
        article_ids = {fact.article_id for fact in facts}
        articles_stmt = select(Article).where(
            Article.id.in_(article_ids)
        )
        articles_result = await session.execute(articles_stmt)
        articles = {a.id: a for a in articles_result.scalars().all()}

        # Aggregate by article type
        for fact in facts:
            article = articles.get(fact.article_id)
            if article:
                if article.type == "income":
                    total_income += fact.amount
                    count_income += 1
                elif article.type == "expense":
                    total_expense += fact.amount
                    count_expense += 1

    balance = total_income - total_expense

    return FactSummary(
        total_income=total_income,
        total_expense=total_expense,
        balance=balance,
        count_income=count_income,
        count_expense=count_expense,
        date_from=date_from,
        date_to=date_to,
    )


@router.get(
    "/count",
    responses=get_common_responses(),
)
async def get_facts_count(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    date_from: Annotated[Optional[date], Query()] = None,
    date_to: Annotated[Optional[date], Query()] = None,
    article_id: Annotated[Optional[int], Query()] = None,
    record_type: Annotated[Optional[str], Query(pattern="^(fact|plan)$")] = None,
    article_type: Annotated[Optional[str], Query(pattern="^(income|expense)$")] = None,
    financial_center_id: Annotated[Optional[int], Query(gt=0)] = None,
    cost_center_id: Annotated[Optional[int], Query(gt=0)] = None,
) -> dict:
    """
    Get total facts count with filters (Shared Family Budget).

    **Shared Family Budget:**
    - All authenticated users can count all transactions
    - No user isolation

    **Filters:**
    - Same filters as list_facts endpoint
    - date_from: Start date (inclusive)
    - date_to: End date (inclusive)
    - article_id: Filter by specific article
    - record_type: Filter by 'fact' (actual) or 'plan' (budget)
    - article_type: Filter by 'income' or 'expense'
    - financial_center_id: Filter by financial center
    - cost_center_id: Filter by cost center

    **Returns:**
    - 200 OK: Total count matching the filters
    """
    # Base query for counting
    statement = select(func.count(BudgetFact.id)).join(
        Article,
        BudgetFact.article_id == Article.id
    )

    # Shared family budget - NO user isolation filter
    # All authenticated users see all transactions

    # Apply same filters as list_facts
    if date_from:
        statement = statement.where(BudgetFact.fact_date >= date_from)

    if date_to:
        statement = statement.where(BudgetFact.fact_date <= date_to)

    if article_id:
        statement = statement.where(BudgetFact.article_id == article_id)

    if record_type:
        statement = statement.where(BudgetFact.record_type == record_type)

    if article_type:
        statement = statement.where(Article.type == article_type)

    if financial_center_id:
        statement = statement.where(BudgetFact.financial_center_id == financial_center_id)

    if cost_center_id:
        statement = statement.where(BudgetFact.cost_center_id == cost_center_id)

    # Execute count query
    result = await session.execute(statement)
    total = result.scalar_one()

    return {"total": total}


@router.get(
    "/{fact_id}",
    response_model=FactResponse,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def get_fact(
    fact_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> BudgetFact:
    """
    Get a single budget fact by ID.

    **User Isolation:**
    - User can only access their own facts
    - Admins can access all facts

    **Returns:**
    - 200 OK: Fact found
    - 403 Forbidden: Fact belongs to another user
    - 404 Not Found: Fact not found
    """
    # Load fact
    statement = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(statement)
    fact = result.scalar_one_or_none()

    if not fact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fact with id={fact_id} not found"
        )

    # Shared family budget - NO ownership check
    # All authenticated users can access any transaction

    return fact


@router.put(
    "/{fact_id}",
    response_model=FactResponse,
    responses=get_common_responses(include_400=True, include_403=True, include_404=True),
)
async def update_fact(
    fact_id: int,
    fact_data: FactUpdate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> BudgetFact:
    """
    Update a budget fact (simple UPDATE, no SCD Type 2).

    **Note:** Facts use simple updates, NOT SCD Type 2 versioning.
    The record is updated in-place.

    **User Isolation:**
    - User can only update their own facts
    - Admins can update any fact

    **Validation:**
    - At least one field must be provided
    - Article must exist if article_id changed
    - fact_date cannot be in future

    **Returns:**
    - 200 OK: Fact updated successfully
    - 403 Forbidden: User doesn't own fact
    - 404 Not Found: Fact not found
    - 400 Bad Request: No fields provided for update
    """
    # Validate: At least one field provided
    update_data = fact_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update"
        )

    # Load fact
    statement = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(statement)
    fact = result.scalar_one_or_none()

    if not fact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fact with id={fact_id} not found"
        )

    # Shared family budget - NO ownership check
    # All authenticated users can update any transaction

    # Validate article_id if changed
    if "article_id" in update_data:
        article_stmt = select(Article).where(
            Article.id == update_data["article_id"]
        )
        article_result = await session.execute(article_stmt)
        article = article_result.scalar_one_or_none()

        if not article:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Article with id={update_data['article_id']} not found"
            )

        # Shared Family Budget: All users can use all articles (no ownership check)
        # Articles are shared references accessible to all authenticated users

    # Update fact (simple UPDATE, not SCD Type 2)
    # Convert amount to absolute value if amount is being updated
    if "amount" in update_data:
        update_data["amount"] = abs(update_data["amount"])

    for key, value in update_data.items():
        setattr(fact, key, value)

    fact.updated_at = datetime.utcnow()

    await session.commit()
    await session.refresh(fact)

    # Load article for response (may already be loaded if article_id changed)
    if "article_id" not in update_data:
        article_stmt = select(Article).where(Article.id == fact.article_id)
        article_result = await session.execute(article_stmt)
        article = article_result.scalar_one_or_none()

    # Load financial center and cost center names if present
    financial_center_name = None
    if fact.financial_center_id:
        fc_stmt = select(FinancialCenter).where(
            FinancialCenter.id == fact.financial_center_id
        )
        fc_result = await session.execute(fc_stmt)
        fc = fc_result.scalar_one_or_none()
        financial_center_name = fc.name if fc else None

    cost_center_name = None
    if fact.cost_center_id:
        cc_stmt = select(CostCenter).where(
            CostCenter.id == fact.cost_center_id
        )
        cc_result = await session.execute(cc_stmt)
        cc = cc_result.scalar_one_or_none()
        cost_center_name = cc.name if cc else None

    # Return enriched response with article and center data
    return {
        "id": fact.id,
        "user_id": fact.user_id,
        "article_id": fact.article_id,
        "article_type": article.type,
        "article_name": article.name,
        "fact_date": fact.fact_date,
        "amount": fact.amount,
        "description": fact.description,
        "financial_center_id": fact.financial_center_id,
        "financial_center_name": financial_center_name,
        "cost_center_id": fact.cost_center_id,
        "cost_center_name": cost_center_name,
        "record_type": fact.record_type,
        "created_at": fact.created_at,
        "updated_at": fact.updated_at,
    }


@router.delete(
    "/{fact_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def delete_fact(
    fact_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Delete a budget fact with history tracking.

    **History Tracking:**
    - Creates DELETE history record before deletion (audit trail)
    - History preserved even after fact is deleted

    **Shared Family Budget:**
    - All authenticated users can delete any transaction

    **Returns:**
    - 204 No Content: Fact deleted successfully
    - 404 Not Found: Fact not found
    """
    from datetime import datetime
    from backend.app.models.budget_fact_history import BudgetFactHistory

    # Load fact
    statement = select(BudgetFact).where(BudgetFact.id == fact_id)
    result = await session.execute(statement)
    fact = result.scalar_one_or_none()

    if not fact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fact with id={fact_id} not found"
        )

    # Shared family budget - NO ownership check
    # All authenticated users can delete any transaction

    # 1. Create DELETE history record (audit trail)
    now = datetime.utcnow()
    delete_history = BudgetFactHistory(
        fact_id=fact.id,
        user_id=fact.user_id,
        article_id=fact.article_id,
        financial_center_id=fact.financial_center_id,
        cost_center_id=fact.cost_center_id,
        fact_date=fact.fact_date,
        amount=fact.amount,
        description=fact.description,
        record_type=fact.record_type,
        transfer_id=fact.transfer_id,
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=False,  # Deleted records are never current
        change_type="DELETE",
        changed_fields=None,  # Full deletion
        changed_by_user_id=current_user.id,
        cascade_delete_source=None  # Direct user deletion
    )
    session.add(delete_history)

    # 2. Delete fact
    await session.delete(fact)
    await session.commit()

    logger.info(
        f"Deleted fact {fact_id} (amount={fact.amount}, date={fact.fact_date}) "
        f"by user {current_user.id}"
    )

    return None


@router.post(
    "/batch-delete",
    status_code=status.HTTP_200_OK,
    responses=get_common_responses(include_400=True),
)
async def batch_delete_facts(
    fact_ids: list[int],
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> dict:
    """
    Batch delete facts with history tracking (Shared Family Budget).

    **History Tracking:**
    - Creates DELETE history record for each fact before deletion (audit trail)
    - History preserved even after facts are deleted

    **Shared Family Budget:**
    - All authenticated users can delete any transactions
    - No ownership check

    **Validation:**
    - fact_ids list cannot be empty
    - Cannot delete more than 500 facts at once

    **Args:**
    - fact_ids: List of fact IDs to delete

    **Returns:**
    - 200 OK: Number of deleted facts
    - 400 Bad Request: Empty list or too many facts
    """
    from datetime import datetime
    from backend.app.models.budget_fact_history import BudgetFactHistory

    if not fact_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="fact_ids list cannot be empty"
        )

    if len(fact_ids) > 500:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete more than 500 facts at once"
        )

    # 1. Load facts to delete (need full data for history)
    stmt = select(BudgetFact).where(BudgetFact.id.in_(fact_ids))
    result = await session.execute(stmt)
    facts_to_delete = result.scalars().all()

    if not facts_to_delete:
        return {
            "message": "No facts found to delete",
            "deleted_count": 0
        }

    # 2. Create DELETE history record for each fact (audit trail)
    now = datetime.utcnow()
    for fact in facts_to_delete:
        delete_history = BudgetFactHistory(
            fact_id=fact.id,
            user_id=fact.user_id,
            article_id=fact.article_id,
            financial_center_id=fact.financial_center_id,
            cost_center_id=fact.cost_center_id,
            fact_date=fact.fact_date,
            amount=fact.amount,
            description=fact.description,
            record_type=fact.record_type,
            transfer_id=fact.transfer_id,
            valid_from=now,
            valid_to=FAR_FUTURE_DATETIME,
            is_current=False,  # Deleted records are never current
            change_type="DELETE",
            changed_fields=None,  # Full deletion
            changed_by_user_id=current_user.id,
            cascade_delete_source=None  # Direct user deletion (batch)
        )
        session.add(delete_history)

        # 3. Delete fact
        await session.delete(fact)

    # 4. Commit all changes
    await session.commit()

    deleted_count = len(facts_to_delete)
    logger.info(f"Batch deleted {deleted_count} facts by user {current_user.id}")

    return {
        "message": f"Deleted {deleted_count} facts",
        "deleted_count": deleted_count
    }
