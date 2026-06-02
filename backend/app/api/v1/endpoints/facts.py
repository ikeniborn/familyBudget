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

import html as _html
import logging
from datetime import date, datetime, timedelta, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from fastapi.responses import HTMLResponse
from sqlalchemy import desc, func
from sqlalchemy.exc import SQLAlchemyError
from sqlmodel import col, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import (
    CurrentUser,
    get_session,
    get_user_id_for_create,
)
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.recurring_plan import RecurringPlan
from backend.app.models.scheduled_reminder import ScheduledReminder
from backend.app.models.user import User
from backend.app.schemas import get_common_responses
from backend.app.schemas.fact import (
    FactCreate,
    FactListResponse,
    FactResponse,
    FactSummary,
    FactUpdate,
)
from backend.app.services.cache_service import CacheKey, CacheTTL, cache_service
from backend.app.services.id_generator import get_next_fact_id
from backend.app.services.write_behind_service import write_behind_service

# WebSocket broadcast functions (lazy import to avoid circular dependencies)
_budget_ws_module = None


def _get_budget_ws_broadcast():
    """Lazy import Budget WebSocket module to avoid circular dependencies."""
    global _budget_ws_module
    if _budget_ws_module is None:
        from backend.app.api.v1.endpoints import budget_ws
        _budget_ws_module = budget_ws
    return _budget_ws_module


# Far future datetime constant for SCD Type 2 valid_to field
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/facts", tags=["Facts"])


async def _get_fact_date(session: AsyncSession, fact_id: int) -> date | None:
    """Get fact_date by fact_id for partition pruning.

    The t_f_budget_fact table has 372+ monthly partitions.
    Without fact_date in WHERE, PostgreSQL plans against ALL partitions
    (Planning Time ~2.6s). With fact_date, partition pruning reduces it to ~35ms.
    """
    result = await session.execute(
        select(BudgetFact.fact_date).where(BudgetFact.id == fact_id)
    )
    return result.scalar_one_or_none()


async def _load_recurring_plan_data(
    session: AsyncSession, recurring_plan_id: int | None, fact_id: int
) -> dict | None:
    """Load recurring plan details with enriched data. Returns None if not linked or not found."""
    if not recurring_plan_id:
        return None

    try:
        plan_stmt = (
            select(RecurringPlan, Article, FinancialCenter, CostCenter)
            .select_from(RecurringPlan)
            .join(Article, RecurringPlan.article_id == Article.id)
            .outerjoin(FinancialCenter, RecurringPlan.financial_center_id == FinancialCenter.id)
            .outerjoin(CostCenter, RecurringPlan.cost_center_id == CostCenter.id)
            .where(RecurringPlan.id == recurring_plan_id)
        )
        plan_result = await session.execute(plan_stmt)
        plan_row = plan_result.one_or_none()

        if not plan_row:
            logger.warning(
                "[GET /facts/%s] Orphaned recurring_plan_id=%s (plan not found)", fact_id, recurring_plan_id
            )
            return None

        plan, plan_article, plan_fc, plan_cc = plan_row
        # Import inside function to avoid circular dependency with recurring_plan_service
        from backend.app.services.recurring_plan_service import get_frequency_display
        frequency_display = get_frequency_display(plan.frequency_type, plan.frequency_value)

        return {
            "id": plan.id, "user_id": plan.user_id,
            "article_id": plan.article_id,
            "article_name": plan_article.name if plan_article else None,
            "article_type": plan_article.type if plan_article else None,
            "financial_center_id": plan.financial_center_id,
            "financial_center_name": plan_fc.name if plan_fc else None,
            "cost_center_id": plan.cost_center_id,
            "cost_center_name": plan_cc.name if plan_cc else None,
            "frequency_type": plan.frequency_type, "frequency_value": plan.frequency_value,
            "frequency_display": frequency_display,
            "start_date": plan.start_date, "end_date": plan.end_date,
            "occurrences_count": plan.occurrences_count,
            "occurrences_generated": plan.occurrences_generated,
            "amount": plan.amount, "description": plan.description,
            "record_type": plan.record_type, "is_active": plan.is_active,
            "next_generation_date": plan.next_generation_date,
            "last_generated_date": plan.last_generated_date,
            "enable_reminder": plan.enable_reminder,
            "reminder_hour": plan.reminder_hour,
            "reminder_minute": plan.reminder_minute,
            "created_at": plan.created_at, "updated_at": plan.updated_at,
        }
    except (SQLAlchemyError, ValueError, AttributeError) as e:
        logger.error("[GET /facts/%s] Failed to load recurring plan for plan_id=%s: %s", fact_id, recurring_plan_id, e)
        return None


def _build_fact_response(
    fact: BudgetFact,
    article: Article,
    financial_center: FinancialCenter | None,
    cost_center: CostCenter | None,
    user: User | None,
    recurring_plan_data: dict | None,
) -> dict:
    """Build enriched fact response dict from query row components."""
    user_name = None
    if user:
        user_name = (
            user.first_name or user.username or user.last_name
            or (f"User {user.telegram_id}" if user.telegram_id else None)
            or f"Пользователь #{user.id}"
        )

    return {
        "id": fact.id, "user_id": fact.user_id, "user_name": user_name,
        "article_id": fact.article_id, "article_type": article.type, "article_name": article.name,
        "fact_date": fact.fact_date, "amount": fact.amount, "description": fact.description,
        "financial_center_id": fact.financial_center_id,
        "financial_center_name": financial_center.name if financial_center else None,
        "cost_center_id": fact.cost_center_id,
        "cost_center_name": cost_center.name if cost_center else None,
        "record_type": fact.record_type, "is_offline_sync": fact.is_offline_sync,
        "recurring_plan_id": fact.recurring_plan_id, "recurring_plan": recurring_plan_data,
        "created_at": fact.created_at, "updated_at": fact.updated_at,
    }


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
    x_tab_id: str | None = Header(default=None),
) -> BudgetFact:
    """
    Create a new budget fact (transaction) with offline sync deduplication.

    **User Isolation:**
    - Fact is created with current user as owner
    - Article must exist and be accessible (own or global)

    **Validation:**
    - article_id must exist
    - article must belong to user or be global
    - fact_date cannot be in future
    - amount must be > 0

    **Deduplication (Offline Sync):**
    - When is_offline_sync=true and sync_hash provided:
      - Checks if same sync_hash exists within last 24 hours
      - If found, returns existing record (idempotent operation)
      - Prevents duplicate creation from repeated sync button clicks
    - Same transaction next day = different sync_hash (legitimate duplicate)

    **Returns:**
    - 201 Created: Fact created successfully
    - 200 OK: Duplicate skipped, returns existing fact
    - 404 Not Found: Article not found
    - 403 Forbidden: Article not accessible
    """
    # ✅ DEDUPLICATION: Check for duplicate offline sync within 24 hours
    if fact_data.is_offline_sync and fact_data.sync_hash:
        duplicate_stmt = select(BudgetFact).where(
            BudgetFact.sync_hash == fact_data.sync_hash,
            BudgetFact.is_offline_sync,
            BudgetFact.created_at >= datetime.utcnow() - timedelta(days=1)
        ).order_by(desc(BudgetFact.created_at))

        duplicate_result = await session.execute(duplicate_stmt)
        existing_fact = duplicate_result.scalar_one_or_none()

        if existing_fact:
            logger.info(
                f"[DEDUP] Sync duplicate detected: sync_hash={fact_data.sync_hash}, "
                f"existing_fact_id={existing_fact.id}, user_id={current_user.id}, "
                f"skipping creation (idempotent)"
            )

            # Load article for response
            article_stmt = select(Article).where(Article.id == existing_fact.article_id)
            article_result = await session.execute(article_stmt)
            article = article_result.scalar_one()

            # Load financial center if present
            financial_center_name = None
            if existing_fact.financial_center_id:
                fc_stmt = select(FinancialCenter).where(
                    FinancialCenter.id == existing_fact.financial_center_id
                )
                fc_result = await session.execute(fc_stmt)
                fc = fc_result.scalar_one_or_none()
                financial_center_name = fc.name if fc else None

            # Load cost center if present
            cost_center_name = None
            if existing_fact.cost_center_id:
                cc_stmt = select(CostCenter).where(
                    CostCenter.id == existing_fact.cost_center_id
                )
                cc_result = await session.execute(cc_stmt)
                cc = cc_result.scalar_one_or_none()
                cost_center_name = cc.name if cc else None

            # Check if reminder exists for this fact
            reminder_stmt = select(ScheduledReminder).where(
                ScheduledReminder.fact_id == existing_fact.id,
                ScheduledReminder.status == "pending"
            )
            reminder_result = await session.execute(reminder_stmt)
            has_reminder = reminder_result.scalar_one_or_none() is not None

            # Return existing fact (idempotent response)
            return {
                "id": existing_fact.id,
                "user_id": existing_fact.user_id,
                "article_id": existing_fact.article_id,
                "article_type": article.type,
                "article_name": article.name,
                "fact_date": existing_fact.fact_date,
                "amount": existing_fact.amount,
                "description": existing_fact.description,
                "financial_center_id": existing_fact.financial_center_id,
                "financial_center_name": financial_center_name,
                "cost_center_id": existing_fact.cost_center_id,
                "cost_center_name": cost_center_name,
                "record_type": existing_fact.record_type,
                "is_offline_sync": existing_fact.is_offline_sync,
                "recurring_plan_id": existing_fact.recurring_plan_id,
                "has_reminder": has_reminder,
                "created_at": existing_fact.created_at,
                "updated_at": existing_fact.updated_at,
                "_duplicate_skipped": True,  # ✅ Indicates duplicate was skipped
            }

    # Log fact creation
    logger.info(
        f"[FACTS CREATE] Creating new fact: "
        f"record_type={fact_data.record_type}, "
        f"article_id={fact_data.article_id}, "
        f"amount={fact_data.amount}, "
        f"user_id={current_user.id}"
    )

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

    # Validate: Financial center must exist and be active (required field)
    fc_stmt = select(FinancialCenter).where(
        FinancialCenter.id == fact_data.financial_center_id
    )
    fc_result = await session.execute(fc_stmt)
    financial_center = fc_result.scalar_one_or_none()

    if not financial_center:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Счёт с id={fact_data.financial_center_id} не найден"
        )

    if not financial_center.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Счёт '{financial_center.name}' архивирован. Выберите активный счёт."
        )

    # Validate: Cost center exists and is active if provided (optional field)
    cost_center = None
    if fact_data.cost_center_id:
        cc_stmt = select(CostCenter).where(
            CostCenter.id == fact_data.cost_center_id
        )
        cc_result = await session.execute(cc_stmt)
        cost_center = cc_result.scalar_one_or_none()

        if not cost_center:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Место затрат с id={fact_data.cost_center_id} не найдено"
            )

        if not cost_center.is_active:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Место затрат '{cost_center.name}' архивировано"
            )

    # =========================================================================
    # WRITE-BEHIND: Async write to PostgreSQL via Redis queue
    # =========================================================================
    # Try Write-Behind if enabled. On success, return immediately with pre-generated ID.
    # If Write-Behind fails or is disabled, fall back to synchronous write below.
    if write_behind_service.is_enabled():
        try:
            # Pre-generate ID from PostgreSQL sequence
            fact_id = await get_next_fact_id(session)

            # Queue the write operation
            request_id = await write_behind_service.queue_fact_create(
                pre_generated_id=fact_id,
                user_id=get_user_id_for_create(current_user),
                article_id=fact_data.article_id,
                amount=abs(int(fact_data.amount)),
                fact_date=str(fact_data.fact_date),
                description=fact_data.description,
                financial_center_id=fact_data.financial_center_id,
                cost_center_id=fact_data.cost_center_id,
                record_type=fact_data.record_type,
                is_offline_sync=fact_data.is_offline_sync,
                sync_hash=fact_data.sync_hash,
                content_hash=fact_data.content_hash,
                changed_by_user_id=current_user.id,
            )

            if request_id:
                # Write-Behind successful - return immediately with pre-generated ID
                now = datetime.utcnow()

                # Load financial center name for response
                financial_center_name = financial_center.name if financial_center else None

                # Load cost center name for response
                cost_center_name = cost_center.name if cost_center else None

                response_data = {
                    "id": fact_id,
                    "user_id": get_user_id_for_create(current_user),
                    "article_id": fact_data.article_id,
                    "article_type": article.type,
                    "article_name": article.name,
                    "fact_date": fact_data.fact_date,
                    "amount": abs(fact_data.amount),
                    "description": fact_data.description,
                    "financial_center_id": fact_data.financial_center_id,
                    "financial_center_name": financial_center_name,
                    "cost_center_id": fact_data.cost_center_id,
                    "cost_center_name": cost_center_name,
                    "record_type": fact_data.record_type,
                    "is_offline_sync": fact_data.is_offline_sync,
                    "recurring_plan_id": None,  # Not set during creation
                    "has_reminder": False,  # New fact has no reminder yet
                    "created_at": now,
                    "updated_at": now,
                    "tab_origin_id": x_tab_id,
                    "_write_behind": True,  # Indicates async write
                    "_request_id": request_id,  # For tracking
                }

                logger.info(
                    f"[WRITE-BEHIND] Queued fact creation: "
                    f"fact_id={fact_id}, request_id={request_id}, "
                    f"user_id={current_user.id}"
                )

                return response_data

            # request_id is None means Write-Behind is enabled but queue failed
            # Fall through to sync write below
            logger.warning(
                "[WRITE-BEHIND] Queue returned None, falling back to sync write"
            )

        except Exception as e:
            # Write-Behind failed - fall back to synchronous write
            logger.warning(
                f"[WRITE-BEHIND] Failed to queue fact creation, "
                f"falling back to sync write: {e}"
            )
            # Continue with sync write below

    # =========================================================================
    # SYNC WRITE: Direct PostgreSQL write (fallback or Write-Behind disabled)
    # =========================================================================
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

    # SSE Broadcast: Notify connected clients about new fact
    response_data = {
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
        "is_offline_sync": fact.is_offline_sync,
        "recurring_plan_id": fact.recurring_plan_id,
        "has_reminder": False,  # New fact has no reminder yet
        "created_at": fact.created_at,
        "updated_at": fact.updated_at,
        "tab_origin_id": x_tab_id,
    }

    # WebSocket Broadcast: Notify all connected clients about new fact
    try:
        ws = _get_budget_ws_broadcast()
        if fact.record_type == "plan":
            await ws.broadcast_plan_created(response_data)
        else:
            await ws.broadcast_fact_created(response_data)
    except Exception as e:
        logger.warning("WebSocket broadcast failed for fact %s: %s", fact.id, e)
        # Don't fail the request if broadcast fails

    # AWAIT cache invalidation to ensure fresh data on subsequent requests
    # Performance: adds ~5-20ms latency, but prevents stale data display
    await cache_service.invalidate_dashboard()

    return response_data


@router.get(
    "",
    response_model=FactListResponse,
    responses=get_common_responses(),
)
async def list_facts(
    current_user: CurrentUser,
    response: Response,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=10000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    article_id: Annotated[int | None, Query()] = None,
    record_type: Annotated[str | None, Query(pattern="^(fact|plan)$")] = None,
    article_type: Annotated[str | None, Query(pattern="^(income|expense|debit|credit)$")] = None,
    search: Annotated[str | None, Query(max_length=200)] = None,
    amount_min: Annotated[int | None, Query(ge=0)] = None,
    amount_max: Annotated[int | None, Query(ge=0)] = None,
    financial_center_id: Annotated[int | None, Query(gt=0)] = None,
    cost_center_id: Annotated[int | None, Query(gt=0)] = None,
    has_recurring_plan: Annotated[bool | None, Query(description="Filter by recurring plan (True = with recurring plan, False = without)")] = None,
    has_reminder: Annotated[bool | None, Query(description="Filter by reminder (True = with reminder, False = without)")] = None,
    user_id: Annotated[int | None, Query(gt=0, description="Optional filter by author user_id (shared budget remains: omit param = all users)")] = None,
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
    - article_type: Filter by 'income', 'expense', 'debit', or 'credit'
    - search: Search in description (case-insensitive)
    - amount_min: Minimum amount (inclusive)
    - amount_max: Maximum amount (inclusive)
    - financial_center_id: Filter by financial center
    - cost_center_id: Filter by cost center
    - has_recurring_plan: Filter by recurring plan (True = with, False = without)
    - has_reminder: Filter by scheduled reminder (True = with, False = without)

    **Pagination:**
    - limit: Maximum number of results (1-10000, default: 100)
    - offset: Number of results to skip (default: 0)

    **Returns:**
    - 200 OK: List of facts with pagination info (includes article info and center names)
    """
    # Set HTTP cache headers to prevent stale data display
    # Always revalidate with server to ensure fresh data after mutations
    response.headers["Cache-Control"] = "private, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"  # HTTP/1.0 compatibility
    response.headers["Vary"] = "Cookie"  # Cache varies by user (JWT auth)

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
        statement = statement.where(col(BudgetFact.description).ilike(f"%{search}%"))

    if amount_min is not None:
        statement = statement.where(BudgetFact.amount >= amount_min)

    if amount_max is not None:
        statement = statement.where(BudgetFact.amount <= amount_max)

    if financial_center_id:
        statement = statement.where(BudgetFact.financial_center_id == financial_center_id)

    if cost_center_id:
        statement = statement.where(BudgetFact.cost_center_id == cost_center_id)

    if user_id is not None:
        statement = statement.where(BudgetFact.user_id == user_id)

    # Filter by recurring plan presence
    if has_recurring_plan is not None:
        if has_recurring_plan:
            statement = statement.where(col(BudgetFact.recurring_plan_id).isnot(None))
        else:
            statement = statement.where(col(BudgetFact.recurring_plan_id).is_(None))

    # Filter by reminder presence (requires EXISTS subquery)
    if has_reminder is not None:
        from sqlalchemy import exists

        from backend.app.models.scheduled_reminder import ScheduledReminder

        reminder_exists = exists().where(
            ScheduledReminder.fact_id == BudgetFact.id
        )

        if has_reminder:
            statement = statement.where(reminder_exists)
        else:
            statement = statement.where(~reminder_exists)

    # Count total (before pagination)
    count_stmt = select(func.count()).select_from(statement.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Apply pagination and ordering (newest by updated_at first, then by id as tiebreaker)
    statement = statement.order_by(desc(BudgetFact.updated_at), desc(BudgetFact.id))
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
            logger.error("Fact %s has no associated user (user_id=%s)", fact.id, fact.user_id)

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
            "is_offline_sync": fact.is_offline_sync,
            "recurring_plan_id": fact.recurring_plan_id,
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


@router.get("/recent", response_model=list[FactResponse])
async def get_recent_facts(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
) -> list[FactResponse]:
    """
    Get recent budget facts (JSON endpoint for TypeScript client).

    Returns latest facts ordered by creation time DESC.

    **User Isolation:**
    - Regular users see only their own records
    - Admins see all records

    **Parameters:**
    - limit: Maximum number of results (1-50, default: 10)

    **Returns:**
    - JSON array of FactResponse objects

    Caching: TTL 10s, invalidated on any fact CRUD.
    """
    # Check cache first
    cache_key = f"recent_facts:{current_user.id}:{limit}"
    cached = await cache_service.get(cache_key)
    if cached is not None:
        return cached

    try:
        # Base query with JOINs for enriched response (same as list_facts)
        statement = (
            select(BudgetFact, Article, FinancialCenter, CostCenter, User)
            .join(Article, BudgetFact.article_id == Article.id)
            .outerjoin(FinancialCenter, BudgetFact.financial_center_id == FinancialCenter.id)
            .outerjoin(CostCenter, BudgetFact.cost_center_id == CostCenter.id)
            .outerjoin(User, BudgetFact.user_id == User.id)
        )

        # OPTIMIZATION: Filter by fact_date to enable partition pruning
        cutoff_date = date.today() - timedelta(days=90)
        statement = statement.where(BudgetFact.fact_date >= cutoff_date)

        # Order by most recent (by creation time)
        statement = statement.order_by(desc(BudgetFact.created_at))
        statement = statement.limit(limit)

        # Execute query
        result = await session.execute(statement)
        rows = result.all()

        # Load scheduled reminders in batch (one query for all facts)
        fact_ids = [fact.id for fact, *_ in rows]
        reminders: dict[int, bool] = {}
        if fact_ids:
            reminders_stmt = select(ScheduledReminder.fact_id).where(
                col(ScheduledReminder.fact_id).in_(fact_ids),
                ScheduledReminder.status == "pending",
            )
            reminders_result = await session.execute(reminders_stmt)
            reminders = {fid: True for fid in reminders_result.scalars().all()}

        # Enrich facts with article and center data
        enriched_facts = []
        for fact, article, financial_center, cost_center, user in rows:
            # Get user name with fallback chain
            user_name = None
            if user:
                user_name = (
                    user.first_name or
                    user.username or
                    user.last_name or
                    (f"User {user.telegram_id}" if user.telegram_id else None) or
                    f"Пользователь #{user.id}"
                )

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
                "is_offline_sync": fact.is_offline_sync,
                "recurring_plan_id": fact.recurring_plan_id,
                "recurring_plan": None,  # Not loaded for performance (list endpoint)
                "has_reminder": reminders.get(fact.id, False),
                "created_at": fact.created_at,
                "updated_at": fact.updated_at,
            }
            enriched_facts.append(fact_dict)

        # Cache result (TTL 10s)
        await cache_service.set(cache_key, enriched_facts, CacheTTL.SHORT())

        return enriched_facts

    except (SQLAlchemyError, ValueError, AttributeError) as e:
        logger.error("Error loading recent facts: %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to load recent facts"
        )


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

    Caching: TTL 10s, invalidated on any fact CRUD.
    """
    # Check cache first
    cache_key = str(CacheKey.recent_html(limit))
    cached_html = await cache_service.get(cache_key)
    if cached_html is not None:
        return cached_html

    try:
        # Base query - include both facts and plans
        statement = select(BudgetFact)

        # Shared family budget - NO user isolation filter
        # All authenticated users see all transactions

        # No filter by record_type - show both facts and plans

        # OPTIMIZATION: Filter by fact_date to enable partition pruning
        # Without this filter, PostgreSQL locks ALL 96 partitions (2023-01 to 2030-12)
        # causing "out of shared memory" errors during concurrent requests.
        # Filtering to last 90 days reduces locks from 96 to ~3 partitions.
        cutoff_date = date.today() - timedelta(days=90)
        statement = statement.where(BudgetFact.fact_date >= cutoff_date)

        # Order by most recent (by creation time in DB, not transaction date)
        # This shows newest added transactions first, regardless of their fact_date
        statement = statement.order_by(desc(BudgetFact.created_at))
        statement = statement.limit(limit)

        # Execute query
        result = await session.execute(statement)
        facts = result.scalars().all()

        # If no records, return empty state message
        if not facts:
            empty_html = """
            <div class="alert alert-info">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" class="stroke-current shrink-0 w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                <span>Записи не найдены. Добавьте первую запись!</span>
            </div>
            """
            # Cache empty state (TTL 10s)
            await cache_service.set(cache_key, empty_html, CacheTTL.SHORT())
            return empty_html

        # Load articles for fact details
        article_ids = {fact.article_id for fact in facts}
        articles_stmt = select(Article).where(
            col(Article.id).in_(article_ids)
        )
        articles_result = await session.execute(articles_stmt)
        articles = {a.id: a for a in articles_result.scalars().all()}

        # Load financial centers for fact details
        from backend.app.models.financial_center import FinancialCenter
        financial_center_ids = {fact.financial_center_id for fact in facts if fact.financial_center_id}
        if financial_center_ids:
            fcs_stmt = select(FinancialCenter).where(
                col(FinancialCenter.id).in_(financial_center_ids)
            )
            fcs_result = await session.execute(fcs_stmt)
            financial_centers = {fc.id: fc for fc in fcs_result.scalars().all()}
        else:
            financial_centers = {}

        # Load scheduled reminders for facts
        from backend.app.models.scheduled_reminder import ScheduledReminder
        fact_ids = [fact.id for fact in facts]
        reminders_stmt = select(ScheduledReminder).where(
            col(ScheduledReminder.fact_id).in_(fact_ids),
            col(ScheduledReminder.status).in_(["pending", "sent"])  # Only show active reminders
        )
        reminders_result = await session.execute(reminders_stmt)
        reminders = {r.fact_id: r for r in reminders_result.scalars().all()}

        # Format money helper (without decimals and currency, with +/- sign)
        def format_money(amount: int, article_type: str) -> str:
            value = int(amount)
            formatted = f"{value:,}".replace(",", " ")
            if article_type in ("expense", "debit"):
                return f"-{formatted}"
            elif article_type in ("income", "credit"):
                return f"+{formatted}"
            return formatted

        # Build HTML: desktop table + mobile list
        # Desktop table (hidden on mobile, shown on tablet and up)
        table_html = """
        <div class="hidden md:block overflow-x-auto">
            <table class="table table-zebra table-sm">
                <thead>
                    <tr>
                        <th>Тип</th>
                        <th>Дата</th>
                        <th>Счёт</th>
                        <th>Категория</th>
                        <th>Сумма</th>
                        <th>Описание</th>
                        <th title="Напоминание">🔔</th>
                        <th title="Регламентный платеж">🔄</th>
                        <th title="Создано offline">☁️</th>
                        <th class="w-8"></th>
                        <th class="w-8"></th>
                    </tr>
                </thead>
                <tbody>
        """

        # Mobile list (hidden on desktop)
        mobile_html = """
        <div class="block md:hidden divide-y divide-base-200">
        """

        for fact in facts:
            article = articles.get(fact.article_id)
            if not article:
                continue

            # Record type badge (Факт or План)
            if fact.record_type == "plan":
                record_type_badge = '<span class="badge badge-info badge-xs">План</span>'
                record_type_badge_sm = '<span class="badge badge-info badge-sm">План</span>'
            else:
                record_type_badge = '<span class="badge badge-success badge-xs">Факт</span>'
                record_type_badge_sm = '<span class="badge badge-success badge-sm">Факт</span>'

            # Format date (full for desktop, short for mobile)
            fact_date_full = fact.fact_date.strftime("%d.%m.%Y")
            fact_date_short = fact.fact_date.strftime("%d.%m")

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

            # Financial center name
            financial_center = financial_centers.get(fact.financial_center_id)
            fc_name = financial_center.name if financial_center else "—"

            # Description
            description = fact.description if fact.description else "—"
            description_full = description  # For title attribute
            if len(description) > 30:
                description_truncated = description[:30] + "..."
            else:
                description_truncated = description

            # Offline sync indicator
            offline_icon = "☁️" if fact.is_offline_sync else ""
            offline_title = "Создано offline" if fact.is_offline_sync else ""

            # Recurring plan indicator
            recurring_icon = "🔄" if fact.recurring_plan_id else ""
            recurring_title = "Регламентный платеж" if fact.recurring_plan_id else ""

            # Reminder indicator
            reminder = reminders.get(fact.id)
            reminder_icon = "🔔" if reminder else ""
            if reminder:
                if reminder.status == "pending":
                    reminder_title = f"Напоминание: {reminder.reminder_datetime.strftime('%d.%m.%Y %H:%M')}"
                else:  # sent
                    reminder_title = f"Отправлено: {reminder.sent_at.strftime('%d.%m.%Y %H:%M') if reminder.sent_at else 'н/д'}"
            else:
                reminder_title = ""

            # Desktop table row with edit and delete buttons (at the end, after ☁️)
            edit_button = f'''<button class="btn btn-xs btn-primary gap-1" onclick="openEditFromDashboard({fact.id})">✏️</button>'''
            delete_button = f'''<button class="btn btn-xs btn-error gap-1" onclick="event.stopPropagation(); deleteFactFromDashboard({fact.id}, {1 if fact.recurring_plan_id else 0})">🗑️</button>'''
            table_html += f"""
                    <tr>
                        <td>{record_type_badge_sm}</td>
                        <td class="whitespace-nowrap">{fact_date_full}</td>
                        <td class="whitespace-nowrap">{fc_name}</td>
                        <td>{article.name}</td>
                        <td class="{amount_class} whitespace-nowrap">{format_money(fact.amount, article.type)}</td>
                        <td class="max-w-xs truncate" title="{description_full}">{description_truncated}</td>
                        <td class="text-center" title="{reminder_title}">{reminder_icon}</td>
                        <td class="text-center" title="{recurring_title}">{recurring_icon}</td>
                        <td class="text-center" title="{offline_title}">{offline_icon}</td>
                        <td class="text-center">{edit_button}</td>
                        <td class="text-center">{delete_button}</td>
                    </tr>
            """

            # Mobile list item - tap entire row to open edit modal (no buttons)
            # Line 2 parts: date, account, description (joined with •)
            line2_parts = [fact_date_short]
            if fc_name != "—":
                line2_parts.append(fc_name)
            if description != "—":
                line2_parts.append(description)
            line2_text = " • ".join(line2_parts)

            # Offline icon for mobile (next to category name)
            offline_span = f'<span class="text-xs" title="{offline_title}">{offline_icon}</span>' if offline_icon else ""
            # Recurring icon for mobile
            recurring_span = f'<span class="text-secondary text-xs" title="{recurring_title}">{recurring_icon}</span>' if recurring_icon else ""
            # Reminder icon for mobile
            reminder_span = f'<span class="text-warning text-xs" title="{reminder_title}">{reminder_icon}</span>' if reminder_icon else ""

            mobile_html += f"""
            <div class="py-2 cursor-pointer hover:bg-base-200 transition-colors rounded-lg px-2 -mx-2"
                 onclick="openEditFromDashboard({fact.id})">
                <div class="flex items-center gap-2">
                    {record_type_badge}
                    <span class="flex-1 font-medium truncate">{article.name}</span>
                    {reminder_span}
                    {recurring_span}
                    {offline_span}
                    <span class="{amount_class} whitespace-nowrap">{format_money(fact.amount, article.type)}</span>
                </div>
                <div class="text-xs text-base-content/60 mt-1 truncate">
                    {line2_text}
                </div>
            </div>
            """

        table_html += """
                </tbody>
            </table>
        </div>
        """

        mobile_html += """
        </div>
        """

        # Cache the generated HTML (TTL 10s)
        result_html = table_html + mobile_html
        await cache_service.set(cache_key, result_html, CacheTTL.SHORT())

        return result_html

    except Exception as e:
        logger.error("Error loading recent records: %s", e, exc_info=True)
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
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    user_id: Annotated[int | None, Query(gt=0, description="Optional filter by author user_id")] = None,
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

    if user_id is not None:
        statement = statement.where(BudgetFact.user_id == user_id)

    # Get all facts for processing
    result = await session.execute(statement)
    facts = result.scalars().all()

    # Calculate totals by article type
    total_income = 0
    total_expense = 0
    count_income = 0
    count_expense = 0

    # Load articles to determine type
    if facts:
        article_ids = {fact.article_id for fact in facts}
        articles_stmt = select(Article).where(
            col(Article.id).in_(article_ids)
        )
        articles_result = await session.execute(articles_stmt)
        articles = {a.id: a for a in articles_result.scalars().all()}

        # Aggregate by article type
        for fact in facts:
            article = articles.get(fact.article_id)
            if article:
                if article.type in ("income", "credit"):
                    total_income += fact.amount
                    count_income += 1
                elif article.type in ("expense", "debit"):
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
    date_from: Annotated[date | None, Query()] = None,
    date_to: Annotated[date | None, Query()] = None,
    article_id: Annotated[int | None, Query()] = None,
    record_type: Annotated[str | None, Query(pattern="^(fact|plan)$")] = None,
    article_type: Annotated[str | None, Query(pattern="^(income|expense|debit|credit)$")] = None,
    financial_center_id: Annotated[int | None, Query(gt=0)] = None,
    cost_center_id: Annotated[int | None, Query(gt=0)] = None,
    has_recurring_plan: Annotated[bool | None, Query(description="Filter by recurring plan (True = with recurring plan, False = without)")] = None,
    has_reminder: Annotated[bool | None, Query(description="Filter by reminder (True = with reminder, False = without)")] = None,
    user_id: Annotated[int | None, Query(gt=0, description="Optional filter by author user_id")] = None,
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
    - article_type: Filter by 'income', 'expense', 'debit', or 'credit'
    - financial_center_id: Filter by financial center
    - cost_center_id: Filter by cost center
    - has_recurring_plan: Filter by recurring plan (True = with, False = without)
    - has_reminder: Filter by scheduled reminder (True = with, False = without)

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

    if user_id is not None:
        statement = statement.where(BudgetFact.user_id == user_id)

    # Filter by recurring plan presence
    if has_recurring_plan is not None:
        if has_recurring_plan:
            statement = statement.where(col(BudgetFact.recurring_plan_id).isnot(None))
        else:
            statement = statement.where(col(BudgetFact.recurring_plan_id).is_(None))

    # Filter by reminder presence (requires EXISTS subquery)
    if has_reminder is not None:
        from sqlalchemy import exists

        from backend.app.models.scheduled_reminder import ScheduledReminder

        reminder_exists = exists().where(
            ScheduledReminder.fact_id == BudgetFact.id
        )

        if has_reminder:
            statement = statement.where(reminder_exists)
        else:
            statement = statement.where(~reminder_exists)

    # Execute count query
    result = await session.execute(statement)
    total = result.scalar_one()

    return {"total": total}


def _format_updated_at(value) -> str:
    if value is None:
        return "—"
    try:
        return value.strftime("%d.%m.%Y %H:%M")
    except AttributeError:
        return "—"


@router.get("/{fact_id}/row-html", response_class=HTMLResponse)
async def get_fact_row_html(
    fact_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    record_type: Annotated[str, Query(pattern="^(fact|plan)$")] = "fact",
) -> str:
    """
    Return HTML for a single fact/plan row (desktop tr + mobile li).

    Used by incremental table updates after CRUD operations and WebSocket events
    to refresh only the affected row without reloading the entire table.

    **Parameters:**
    - fact_id: ID of the fact/plan record
    - record_type: 'fact' or 'plan' (affects badge styling)

    **Returns:**
    - HTML fragment: desktop <tr> + mobile <div> wrapped in a container
    - 404 if fact not found
    """
    statement = (
        select(BudgetFact, Article, FinancialCenter, CostCenter, User, ScheduledReminder)
        .join(Article, BudgetFact.article_id == Article.id)
        .outerjoin(FinancialCenter, BudgetFact.financial_center_id == FinancialCenter.id)
        .outerjoin(CostCenter, BudgetFact.cost_center_id == CostCenter.id)
        .outerjoin(User, BudgetFact.user_id == User.id)
        .outerjoin(
            ScheduledReminder,
            (ScheduledReminder.fact_id == BudgetFact.id)
            & col(ScheduledReminder.status).in_(["pending", "sent"]),
        )
        .where(BudgetFact.id == fact_id)
    )
    result = await session.execute(statement)
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fact with id={fact_id} not found"
        )

    fact, article, financial_center, cost_center, user, reminder = row

    def _format_amount(amount: int, art_type: str) -> str:
        value = int(amount)
        formatted = f"{abs(value):,}".replace(",", " ")
        if art_type in ("expense", "debit"):
            return f"-{formatted}"
        elif art_type in ("income", "credit"):
            return f"+{formatted}"
        return formatted

    # Determine CSS class for amount/article
    type_class_map = {
        "expense": "text-error",
        "income": "text-success",
        "debit": "text-info",
        "credit": "text-warning",
    }
    article_color_class = type_class_map.get(article.type, "")

    fc_name = _html.escape(financial_center.name if financial_center else "—")
    cc_name = _html.escape(cost_center.name if cost_center else "—")
    article_name = _html.escape(article.name)
    description = _html.escape(fact.description or "—")
    description_truncated = (description[:30] + "...") if len(description) > 30 else description

    user_name = "—"
    if user:
        user_name = _html.escape(
            user.first_name or user.username or user.last_name
            or (f"User {user.telegram_id}" if user.telegram_id else None)
            or f"#{user.id}"
        )

    formatted_date = fact.fact_date.strftime("%d.%m.%Y")
    short_date = fact.fact_date.strftime("%d.%m")
    formatted_amount = _format_amount(fact.amount, article.type)

    updated_at_formatted = _format_updated_at(fact.updated_at)

    # Reminder icon
    reminder_icon = '<span class="text-info" title="Напоминание установлено">🔔</span>' if reminder is not None else ""

    # Recurring icon
    recurring_icon = (
        '<span class="text-secondary" title="Регламентный платеж">🔄</span>'
        if fact.recurring_plan_id else ""
    )

    # Offline icon
    offline_icon = '<span class="text-xs" title="Создано offline">☁️</span>' if fact.is_offline_sync else ""

    # Data attribute and onclick handlers differ by record_type:
    # - fact: data-id + window.FactsManager namespace (facts page)
    # - plan: data-plan-id + global functions (plan page)
    if record_type == "fact":
        data_attr = f'data-id="{fact.id}"'
        edit_onclick = f"window.FactsManager?.showEditModal?.({fact.id})"
        delete_onclick = f"event.stopPropagation(); window.FactsManager?.deleteFact?.({fact.id})"
        mobile_onclick = f"window.FactsManager?.showEditModal?.({fact.id})"
        badge_html = '<span class="badge badge-primary badge-xs shrink-0">Факт</span>'

        desktop_row = f"""
<tr {data_attr}>
  <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" data-fact-id="{fact.id}"></td>
  <td class="text-base-content/50 text-xs">{fact.id}</td>
  <td>{formatted_date}</td>
  <td class="max-w-xs truncate" title="{fc_name}">{fc_name}</td>
  <td class="max-w-xs truncate" title="{cc_name}">{cc_name}</td>
  <td>{article_name}</td>
  <td class="{article_color_class} font-bold">{formatted_amount}</td>
  <td class="max-w-xs truncate" title="{description}">{description_truncated}</td>
  <td class="text-xs whitespace-nowrap">{user_name}</td>
  <td class="text-xs text-base-content/50 whitespace-nowrap">{updated_at_formatted}</td>
  <td>
    <div class="flex gap-1">
      <button class="btn btn-xs btn-primary gap-1" onclick="{edit_onclick}">✏️</button>
      <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" onclick="{delete_onclick}" title="Удалить">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </td>
</tr>"""

        mobile_row = f"""
<div class="transaction-item py-2" {data_attr} onclick="{mobile_onclick}">
  <div class="flex items-center gap-2">
    {badge_html}
    <span class="flex-1 font-medium truncate">{article_name}</span>
    <span class="{article_color_class} font-bold whitespace-nowrap">{formatted_amount}</span>
  </div>
  <div class="text-xs text-base-content/60 mt-1 truncate">
    {short_date} • {fc_name} • {description}
  </div>
</div>"""
    else:
        # Plan branch — aligned with TypeScript renderFactsTable (14 columns).
        data_attr = f'data-plan-id="{fact.id}"'
        edit_onclick = f"showEditModal({fact.id})"
        delete_onclick = f"event.stopPropagation(); deleteFact({fact.id})"
        mobile_onclick = f"showEditModal({fact.id})"
        badge_html = '<span class="badge badge-info badge-xs shrink-0">План</span>'
        checkbox_onchange = "window.PlanApp.FactsTable.updateBatchDeleteButton()"

        desktop_row = f"""
<tr {data_attr}>
  <td><input type="checkbox" class="checkbox checkbox-sm fact-checkbox" value="{fact.id}" onchange="{checkbox_onchange}"></td>
  <td class="text-base-content/50 text-xs">{fact.id}</td>
  <td>{formatted_date}</td>
  <td class="max-w-xs truncate" title="{fc_name}">{fc_name}</td>
  <td class="max-w-xs truncate" title="{cc_name}">{cc_name}</td>
  <td>{article_name}</td>
  <td class="{article_color_class} font-bold">{formatted_amount}</td>
  <td class="max-w-xs truncate" title="{description}">{description_truncated}</td>
  <td>{user_name}</td>
  <td class="text-xs text-base-content/60">{updated_at_formatted}</td>
  <td class="text-center">{reminder_icon}</td>
  <td class="text-center">{recurring_icon}</td>
  <td class="text-center">{offline_icon}</td>
  <td>
    <div class="flex gap-1">
      <button class="btn btn-xs btn-primary gap-1" onclick="{edit_onclick}">✏️</button>
      <button class="btn btn-xs btn-error btn-square hidden md:inline-flex" data-fact-id="{fact.id}" onclick="{delete_onclick}" title="Удалить">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </td>
</tr>"""

        mobile_icons = " ".join(filter(None, [recurring_icon, reminder_icon, offline_icon]))
        mobile_row = f"""
<div class="transaction-item py-2" {data_attr} onclick="{mobile_onclick}">
  <div class="flex items-center gap-2">
    {badge_html}
    <span class="flex-1 font-medium truncate">{article_name}</span>
    <span class="{article_color_class} font-bold whitespace-nowrap">{formatted_amount}</span>
    {mobile_icons}
  </div>
  <div class="text-xs text-base-content/60 mt-1 truncate">
    {short_date} • {fc_name} • {description}
  </div>
</div>"""

    return f'<template data-plan-row="{fact.id}">{desktop_row}|||{mobile_row}</template>'


@router.get(
    "/{fact_id}",
    response_model=FactResponse,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def get_fact(
    fact_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> dict:
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
    # Two-phase query for partition pruning (372 partitions → Planning Time 2.6s → 35ms)
    fact_date = await _get_fact_date(session, fact_id)
    if fact_date is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fact with id={fact_id} not found"
        )

    # Full query with JOINs + fact_date filter for partition pruning
    statement = (
        select(BudgetFact, Article, FinancialCenter, CostCenter, User)
        .join(Article, BudgetFact.article_id == Article.id)
        .outerjoin(FinancialCenter, BudgetFact.financial_center_id == FinancialCenter.id)
        .outerjoin(CostCenter, BudgetFact.cost_center_id == CostCenter.id)
        .outerjoin(User, BudgetFact.user_id == User.id)
        .where(BudgetFact.id == fact_id, BudgetFact.fact_date == fact_date)
    )
    result = await session.execute(statement)
    row = result.one_or_none()

    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fact with id={fact_id} not found"
        )

    fact, article, financial_center, cost_center, user = row

    recurring_plan_data = await _load_recurring_plan_data(session, fact.recurring_plan_id, fact_id)

    return _build_fact_response(fact, article, financial_center, cost_center, user, recurring_plan_data)


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

    # Two-phase query for partition pruning (372 partitions)
    fact_date_val = await _get_fact_date(session, fact_id)
    if fact_date_val is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fact with id={fact_id} not found"
        )

    statement = select(BudgetFact).where(
        BudgetFact.id == fact_id, BudgetFact.fact_date == fact_date_val
    )
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
    article = None
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

    # Log what fields were updated
    changed_fields = list(update_data.keys())
    logger.info(
        f"[FACTS UPDATE] Updating fact_id={fact_id}: "
        f"record_type={fact.record_type}, "
        f"changed_fields={changed_fields}, "
        f"user_id={current_user.id}"
    )

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

    # SSE Broadcast: Notify connected clients about updated fact
    response_data = {
        "id": fact.id,
        "user_id": fact.user_id,
        "article_id": fact.article_id,
        "article_type": article.type if article else None,
        "article_name": article.name if article else None,
        "fact_date": fact.fact_date,
        "amount": fact.amount,
        "description": fact.description,
        "financial_center_id": fact.financial_center_id,
        "financial_center_name": financial_center_name,
        "cost_center_id": fact.cost_center_id,
        "cost_center_name": cost_center_name,
        "record_type": fact.record_type,
        "is_offline_sync": fact.is_offline_sync,
        "recurring_plan_id": fact.recurring_plan_id,
        "created_at": fact.created_at,
        "updated_at": fact.updated_at,
    }

    # WebSocket Broadcast: Notify all connected clients about updated fact
    try:
        ws = _get_budget_ws_broadcast()
        if fact.record_type == "plan":
            await ws.broadcast_plan_updated(response_data)
        else:
            await ws.broadcast_fact_updated(response_data)
    except Exception as e:
        logger.warning("WebSocket broadcast failed for updated fact %s: %s", fact.id, e)
        # Don't fail the request if broadcast fails

    # AWAIT cache invalidation to ensure fresh data on subsequent requests
    # Performance: adds ~5-20ms latency, but prevents stale data display
    await cache_service.invalidate_dashboard()

    return response_data


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

    # Two-phase query for partition pruning (372 partitions)
    fact_date_val = await _get_fact_date(session, fact_id)
    if fact_date_val is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fact with id={fact_id} not found"
        )

    statement = select(BudgetFact).where(
        BudgetFact.id == fact_id, BudgetFact.fact_date == fact_date_val
    )
    result = await session.execute(statement)
    fact = result.scalar_one_or_none()

    if not fact:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Fact with id={fact_id} not found"
        )

    # Shared family budget - NO ownership check
    # All authenticated users can delete any transaction

    # Check if this fact is part of a transfer (has paired fact)
    paired_fact = None
    if fact.transfer_id is not None:
        paired_stmt = select(BudgetFact).where(
            BudgetFact.transfer_id == fact.transfer_id,
            BudgetFact.id != fact_id,
        )
        paired_result = await session.execute(paired_stmt)
        paired_fact = paired_result.scalar_one_or_none()

    # 1. Create DELETE history record(s) (audit trail)
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
        is_offline_sync=fact.is_offline_sync,
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=False,  # Deleted records are never current
        change_type="DELETE",
        changed_fields=None,  # Full deletion
        changed_by_user_id=current_user.id,
        cascade_delete_source=None  # Direct user deletion
    )
    session.add(delete_history)

    if paired_fact is not None:
        paired_history = BudgetFactHistory(
            fact_id=paired_fact.id,
            user_id=paired_fact.user_id,
            article_id=paired_fact.article_id,
            financial_center_id=paired_fact.financial_center_id,
            cost_center_id=paired_fact.cost_center_id,
            fact_date=paired_fact.fact_date,
            amount=paired_fact.amount,
            description=paired_fact.description,
            record_type=paired_fact.record_type,
            transfer_id=paired_fact.transfer_id,
            is_offline_sync=paired_fact.is_offline_sync,
            valid_from=now,
            valid_to=FAR_FUTURE_DATETIME,
            is_current=False,
            change_type="DELETE",
            changed_fields=None,
            changed_by_user_id=current_user.id,
            cascade_delete_source=str(fact_id)  # Deleted as cascade from paired fact
        )
        session.add(paired_history)

    # Save record_type before deletion for broadcast
    fact_record_type = fact.record_type
    fact_transfer_id = fact.transfer_id

    # 2. Cascade delete ScheduledReminder rows (no FK due to partitioned t_f_budget_fact)
    reminder_fact_ids = [fact.id]
    if paired_fact is not None:
        reminder_fact_ids.append(paired_fact.id)
    reminders_stmt = select(ScheduledReminder).where(
        col(ScheduledReminder.fact_id).in_(reminder_fact_ids)
    )
    reminders_result = await session.execute(reminders_stmt)
    deleted_reminders = 0
    for reminder in reminders_result.scalars().all():
        await session.delete(reminder)
        deleted_reminders += 1
    if deleted_reminders:
        logger.info(
            "Cascade-deleted %s ScheduledReminder rows for fact_ids=%s",
            deleted_reminders, reminder_fact_ids
        )

    # 3. Delete fact (and paired fact if transfer)
    await session.delete(fact)
    if paired_fact is not None:
        await session.delete(paired_fact)
    await session.commit()

    if paired_fact is not None:
        logger.info(
            f"Deleted transfer fact {fact_id} and paired fact {paired_fact.id} "
            f"(transfer_id={fact_transfer_id}) by user {current_user.id}"
        )
    else:
        logger.info(
            f"Deleted fact {fact_id} (amount={fact.amount}, date={fact.fact_date}) "
            f"by user {current_user.id}"
        )

    # Invalidate cache BEFORE WebSocket broadcast so that when the client's
    # debounced refresh fires (~300ms after the WS event), Redis already
    # serves fresh data instead of the stale cached quick-stats HTML.
    await cache_service.invalidate_dashboard()

    # WebSocket Broadcast: Notify connected clients about deleted fact
    try:
        ws = _get_budget_ws_broadcast()
        if fact_transfer_id is not None:
            # Broadcast as transfer_deleted so both UI legs are cleaned up
            await ws.broadcast_transfer_deleted(fact_transfer_id)
        elif fact_record_type == "plan":
            await ws.broadcast_plan_deleted(fact_id)
        else:
            await ws.broadcast_fact_deleted(fact_id)
    except Exception as e:
        logger.warning("WebSocket broadcast failed for deleted fact %s: %s", fact_id, e)
        # Don't fail the request if broadcast fails

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
    stmt = select(BudgetFact).where(col(BudgetFact.id).in_(fact_ids))
    result = await session.execute(stmt)
    facts_to_delete = result.scalars().all()

    if not facts_to_delete:
        return {
            "message": "No facts found to delete",
            "deleted_count": 0
        }

    # 2a. Cascade delete ScheduledReminder rows (no FK due to partitioned t_f_budget_fact)
    loaded_fact_ids = [f.id for f in facts_to_delete]
    reminders_stmt = select(ScheduledReminder).where(
        col(ScheduledReminder.fact_id).in_(loaded_fact_ids)
    )
    reminders_result = await session.execute(reminders_stmt)
    deleted_reminders = 0
    for reminder in reminders_result.scalars().all():
        await session.delete(reminder)
        deleted_reminders += 1
    if deleted_reminders:
        logger.info(
            "[BULK_DELETE] Cascade-deleted %s ScheduledReminder rows for %s facts",
            deleted_reminders, len(loaded_fact_ids)
        )

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
            is_offline_sync=fact.is_offline_sync,
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
    logger.info("[BULK_DELETE] Batch deleted %s facts by user %s", deleted_count, current_user.id)

    # Invalidate cache BEFORE WebSocket broadcast (same race-condition fix as single delete).
    await cache_service.invalidate_dashboard()

    # 5. WebSocket broadcast: SINGLE summary event (NEW PATTERN)
    # Replaces individual fact_deleted/plan_deleted events to eliminate toast spam
    try:
        ws = _get_budget_ws_broadcast()

        fact_ids_list = [fact.id for fact in facts_to_delete]
        record_types = set(f.record_type for f in facts_to_delete)
        record_type = record_types.pop() if len(record_types) == 1 else None

        await ws.broadcast_facts_batch_deleted(fact_ids_list, deleted_count, record_type)
        logger.info("[BULK_DELETE] Broadcasted summary event: type=%s, count=%s", record_type, deleted_count)
    except Exception as e:
        logger.warning("[BULK_DELETE] WebSocket broadcast failed: %s", e)
        # Don't fail the request if broadcast fails

    return {
        "message": f"Deleted {deleted_count} facts",
        "deleted_count": deleted_count
    }
