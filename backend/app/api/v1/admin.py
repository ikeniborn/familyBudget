"""
Admin API endpoints.

Provides administrative functionality for managing users, articles, and facts.
All endpoints require admin privileges (is_admin=True).
"""

import logging
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentAdmin, get_session
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact as Fact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User
from backend.app.schemas.user import UserCreate
from backend.app.services.telegram_auth import validate_telegram_user

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)


# ============================================================================
# Request/Response Models
# ============================================================================

class UserResponse(BaseModel):
    """User response model for admin."""
    id: int
    telegram_id: int
    username: str | None
    first_name: str | None
    last_name: str | None
    is_admin: bool
    is_current: bool
    valid_from: str
    valid_to: str | None

    class Config:
        from_attributes = True


class UserUpdateRequest(BaseModel):
    """User update request model."""
    is_admin: bool | None = None


class UserStatsResponse(BaseModel):
    """User statistics response."""
    user_id: int
    username: str | None
    first_name: str | None
    total_facts: int
    total_articles: int
    last_fact_date: str | None


class ArticleResponse(BaseModel):
    """Article response model for admin."""
    id: int
    user_id: int
    parent_id: int | None
    name: str
    type: str
    is_current: bool
    valid_from: str
    valid_to: str | None
    user_name: str | None = None

    class Config:
        from_attributes = True


class ArticleCreateRequest(BaseModel):
    """Article create request model."""
    parent_id: int | None = None
    name: str
    type: str  # "income" or "expense"


class ArticleUpdateRequest(BaseModel):
    """Article update request model."""
    name: str | None = None
    parent_id: int | None = None


# ============================================================================
# Users Management Endpoints
# ============================================================================

@router.get("/users", response_model=List[UserResponse])
async def get_all_users(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    is_current: bool = Query(True, description="Filter by current users only")
):
    """
    Get all users (admin only).

    Returns list of all registered users with their current status.
    Can filter by is_current flag to see only active users or all historical records.

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session
        is_current: Whether to show only current (active) users

    Returns:
        List[UserResponse]: List of users
    """
    query = select(User)

    if is_current:
        query = query.where(User.is_current == True)  # noqa: E712

    query = query.order_by(User.telegram_id, User.valid_from.desc())

    result = await session.execute(query)
    users = result.scalars().all()

    return [
        UserResponse(
            id=user.id,
            telegram_id=user.telegram_id,
            username=user.username,
            first_name=user.first_name,
            last_name=user.last_name,
            is_admin=user.is_admin,
            is_current=user.is_current,
            valid_from=user.valid_from.isoformat(),
            valid_to=user.valid_to.isoformat() if user.valid_to else None
        )
        for user in users
    ]


@router.get("/users/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Get specific user by ID (admin only).

    Args:
        user_id: User ID to retrieve
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserResponse: User details

    Raises:
        HTTPException: 404 if user not found
    """
    query = select(User).where(User.id == user_id)
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    return UserResponse(
        id=user.id,
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=user.is_admin,
        is_current=user.is_current,
        valid_from=user.valid_from.isoformat(),
        valid_to=user.valid_to.isoformat() if user.valid_to else None
    )


@router.get("/users/check-duplicate", response_model=bool)
async def check_duplicate_user(
    current_admin: CurrentAdmin,
    telegram_id: int = Query(..., gt=0, description="Telegram ID to check"),
    session: AsyncSession = Depends(get_session)
) -> bool:
    """
    Check if user with given telegram_id already exists (admin only).

    Used by admin panel to prevent duplicate user creation.
    Only checks among current (active) users (is_current=True).

    Args:
        telegram_id: Telegram ID to check for duplicates
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        bool: True if user exists, False otherwise

    Example:
        GET /api/v1/admin/users/check-duplicate?telegram_id=123456789
        Response: false
    """
    query = select(User).where(
        User.telegram_id == telegram_id,
        User.is_current == True  # noqa: E712
    )
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    return user is not None


@router.post("/users", response_model=UserResponse, status_code=201)
async def create_user(
    create_data: UserCreate,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Create new user (admin only).

    Creates a new user record with SCD Type 2 fields.
    Validates telegram_id uniqueness and existence via Telegram Bot API.

    Args:
        create_data: User creation data (telegram_id, username, etc.)
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserResponse: Created user record

    Raises:
        HTTPException: 400 if telegram_id already exists (duplicate)
        HTTPException: 400 if telegram_id is invalid (not found in Telegram)
        HTTPException: 500 for database or API errors

    Example:
        POST /api/v1/admin/users
        Body: {
            "telegram_id": 123456789,
            "username": "johndoe",
            "first_name": "John",
            "last_name": "Doe",
            "is_admin": false
        }
    """
    # Validation #1: Check uniqueness in database
    # Only check among current (active) users
    existing_user_query = select(User).where(
        User.telegram_id == create_data.telegram_id,
        User.is_current == True  # noqa: E712
    )
    existing_user_result = await session.execute(existing_user_query)
    existing_user = existing_user_result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=400,
            detail=f"User with telegram_id {create_data.telegram_id} already exists"
        )

    # Validation #2: Check if telegram_id exists in Telegram via Bot API
    # This ensures we're creating valid users only
    is_valid_telegram_user = await validate_telegram_user(create_data.telegram_id)

    if not is_valid_telegram_user:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid telegram_id {create_data.telegram_id}. "
                   "User not found in Telegram or bot hasn't interacted with this user. "
                   "Please ensure the user has started a conversation with the bot."
        )

    # Create new user with SCD Type 2 fields
    new_user = User(
        telegram_id=create_data.telegram_id,
        username=create_data.username,
        first_name=create_data.first_name,
        last_name=create_data.last_name,
        is_admin=create_data.is_admin,
        valid_from=datetime.utcnow(),
        valid_to=None,
        is_current=True
    )

    session.add(new_user)

    try:
        await session.commit()
        await session.refresh(new_user)
    except Exception as e:
        await session.rollback()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to create user: {str(e)}"
        )

    return UserResponse(
        id=new_user.id,
        telegram_id=new_user.telegram_id,
        username=new_user.username,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        is_admin=new_user.is_admin,
        is_current=new_user.is_current,
        valid_from=new_user.valid_from.isoformat(),
        valid_to=new_user.valid_to.isoformat() if new_user.valid_to else None
    )


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    update_data: UserUpdateRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Update user (admin only).

    Currently supports updating:
    - is_admin: Grant or revoke admin privileges

    Note: Uses SCD Type 2 - creates new record with valid_from=NOW() and closes old one.

    Args:
        user_id: User ID to update
        update_data: Update request data
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserResponse: Updated user

    Raises:
        HTTPException: 404 if user not found
        HTTPException: 400 if trying to demote last admin
    """
    # Get current user version
    query = select(User).where(
        User.id == user_id,
        User.is_current == True  # noqa: E712
    )
    result = await session.execute(query)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Prevent demoting the last admin
    if update_data.is_admin is not None and not update_data.is_admin:
        # Check if this is the last admin
        admin_count_query = select(func.count(User.id)).where(
            User.is_admin == True,  # noqa: E712
            User.is_current == True,  # noqa: E712
            User.id != user_id
        )
        admin_count_result = await session.execute(admin_count_query)
        remaining_admins = admin_count_result.scalar()

        if remaining_admins == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot demote the last admin. Promote another user to admin first."
            )

    # Apply SCD Type 2 update
    from datetime import datetime

    # Close old record
    user.valid_to = datetime.utcnow()
    user.is_current = False
    session.add(user)

    # Create new record
    new_user = User(
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=update_data.is_admin if update_data.is_admin is not None else user.is_admin,
        valid_from=datetime.utcnow(),
        valid_to=None,
        is_current=True
    )
    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)

    return UserResponse(
        id=new_user.id,
        telegram_id=new_user.telegram_id,
        username=new_user.username,
        first_name=new_user.first_name,
        last_name=new_user.last_name,
        is_admin=new_user.is_admin,
        is_current=new_user.is_current,
        valid_from=new_user.valid_from.isoformat(),
        valid_to=new_user.valid_to.isoformat() if new_user.valid_to else None
    )


@router.get("/users/stats/summary", response_model=List[UserStatsResponse])
async def get_users_stats(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Get statistics for all users (admin only).

    Returns aggregated stats for each user:
    - Total number of facts
    - Total number of articles
    - Last fact date

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        List[UserStatsResponse]: List of user statistics
    """
    # Get all current users
    users_query = select(User).where(User.is_current == True)  # noqa: E712
    users_result = await session.execute(users_query)
    users = users_result.scalars().all()

    stats = []

    for user in users:
        # Count facts
        facts_count_query = select(func.count(Fact.id)).where(Fact.user_id == user.id)
        facts_count_result = await session.execute(facts_count_query)
        total_facts = facts_count_result.scalar() or 0

        # Count articles
        articles_count_query = select(func.count(Article.id)).where(
            Article.user_id == user.id,
            Article.is_current == True  # noqa: E712
        )
        articles_count_result = await session.execute(articles_count_query)
        total_articles = articles_count_result.scalar() or 0

        # Get last fact date
        last_fact_query = select(func.max(Fact.fact_date)).where(Fact.user_id == user.id)
        last_fact_result = await session.execute(last_fact_query)
        last_fact_date = last_fact_result.scalar()

        stats.append(UserStatsResponse(
            user_id=user.id,
            username=user.username,
            first_name=user.first_name,
            total_facts=total_facts,
            total_articles=total_articles,
            last_fact_date=last_fact_date.isoformat() if last_fact_date else None
        ))

    return stats


# ============================================================================
# Articles Management Endpoints
# ============================================================================

@router.get("/articles", response_model=List[ArticleResponse])
async def get_all_articles(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    is_current: bool = Query(True, description="Filter by current articles only")
):
    """
    Get all articles (admin only).

    Returns list of all articles.
    Can filter by is_current flag.

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session
        is_current: Whether to show only current (active) articles

    Returns:
        List[ArticleResponse]: List of articles
    """
    query = select(Article, User).outerjoin(User, Article.user_id == User.id)

    if is_current:
        query = query.where(Article.is_current == True)  # noqa: E712

    query = query.order_by(Article.type, Article.name)

    result = await session.execute(query)
    rows = result.all()

    return [
        ArticleResponse(
            id=article.id,
            user_id=article.user_id,
            parent_id=article.parent_id,
            name=article.name,
            type=article.type,
            is_current=article.is_current,
            valid_from=article.valid_from.isoformat(),
            valid_to=article.valid_to.isoformat() if article.valid_to else None,
            user_name=user.username if user else None
        )
        for article, user in rows
    ]


@router.post("/articles", response_model=ArticleResponse, status_code=201)
async def create_article(
    create_data: ArticleCreateRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Create new article (admin only).

    Creates a new article (category). Shared references: available to all users.

    Args:
        create_data: Article creation data
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        ArticleResponse: Created article

    Raises:
        HTTPException: 400 if parent_id invalid or type mismatch
    """
    from datetime import datetime

    # Validate parent_id if provided
    if create_data.parent_id is not None:
        parent_query = select(Article).where(
            Article.id == create_data.parent_id,
            Article.is_current == True  # noqa: E712
        )
        parent_result = await session.execute(parent_query)
        parent = parent_result.scalar_one_or_none()

        if not parent:
            raise HTTPException(status_code=400, detail="Parent article not found")

        # Parent and child must have same type
        if parent.type != create_data.type:
            raise HTTPException(
                status_code=400,
                detail=f"Parent type ({parent.type}) must match child type ({create_data.type})"
            )

    # Create new article
    new_article = Article(
        user_id=current_admin.id,
        parent_id=create_data.parent_id,
        name=create_data.name,
        type=create_data.type,
        valid_from=datetime.utcnow(),
        valid_to=None,
        is_current=True
    )
    session.add(new_article)
    await session.commit()
    await session.refresh(new_article)

    return ArticleResponse(
        id=new_article.id,
        user_id=new_article.user_id,
        parent_id=new_article.parent_id,
        name=new_article.name,
        type=new_article.type,
        is_current=new_article.is_current,
        valid_from=new_article.valid_from.isoformat(),
        valid_to=new_article.valid_to.isoformat() if new_article.valid_to else None,
        user_name=None
    )


@router.put("/articles/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: int,
    update_data: ArticleUpdateRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Update article (admin only).

    Uses SCD Type 2: closes old record and creates new one with updated data.

    Args:
        article_id: Article ID to update
        update_data: Update request data
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        ArticleResponse: Updated article

    Raises:
        HTTPException: 404 if article not found
        HTTPException: 400 if parent_id invalid or creates circular reference
    """
    from backend.app.services.scd2_service import create_new_version, has_changes

    # Get current article version
    query = select(Article).where(
        Article.id == article_id,
        Article.is_current == True  # noqa: E712
    )
    result = await session.execute(query)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Prepare update data
    updates = {}
    if update_data.name is not None:
        updates["name"] = update_data.name
    if update_data.parent_id is not None:
        updates["parent_id"] = update_data.parent_id

    # Validate parent_id if changing
    if "parent_id" in updates and updates["parent_id"] != article.parent_id:
        # Check parent exists
        parent_query = select(Article).where(
            Article.id == updates["parent_id"],
            Article.is_current == True  # noqa: E712
        )
        parent_result = await session.execute(parent_query)
        parent = parent_result.scalar_one_or_none()

        if not parent:
            raise HTTPException(status_code=400, detail="Parent article not found")

        # Cannot set self as parent
        if updates["parent_id"] == article_id:
            raise HTTPException(status_code=400, detail="Cannot set article as its own parent")

    # Check if anything changed
    changed, changed_fields = has_changes(article, updates)
    if not changed:
        # No changes, return existing article
        return ArticleResponse(
            id=article.id,
            user_id=article.user_id,
            parent_id=article.parent_id,
            name=article.name,
            type=article.type,
            valid_from=article.valid_from,
            valid_to=article.valid_to,
            is_current=article.is_current
        )

    # Use SCD2Service to create new version (includes automatic child redirection)
    new_article = await create_new_version(
        session=session,
        old_instance=article,
        updates=updates,
        changed_fields=changed_fields
    )

    return ArticleResponse(
        id=new_article.id,
        user_id=new_article.user_id,
        parent_id=new_article.parent_id,
        name=new_article.name,
        type=new_article.type,
        is_current=new_article.is_current,
        valid_from=new_article.valid_from.isoformat(),
        valid_to=new_article.valid_to.isoformat() if new_article.valid_to else None,
        user_name=None
    )


@router.delete("/articles/{article_id}")
async def deactivate_article(
    article_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Deactivate article (admin only).

    Soft delete: sets valid_to=NOW() and is_current=False (SCD Type 2).
    Does not physically delete the record.

    Args:
        article_id: Article ID to deactivate
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        dict: Success message

    Raises:
        HTTPException: 404 if article not found
        HTTPException: 400 if article has active children
    """
    from datetime import datetime

    # Get current article version
    query = select(Article).where(
        Article.id == article_id,
        Article.is_current == True  # noqa: E712
    )
    result = await session.execute(query)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Check for active children
    children_query = select(func.count(Article.id)).where(
        Article.parent_id == article_id,
        Article.is_current == True  # noqa: E712
    )
    children_result = await session.execute(children_query)
    children_count = children_result.scalar()

    if children_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot deactivate article with {children_count} active children. Deactivate children first."
        )

    # Deactivate article
    article.valid_to = datetime.utcnow()
    article.is_current = False
    session.add(article)
    await session.commit()

    return {"message": "Article deactivated successfully", "article_id": article_id}


# ============================================================================
# Facts Management Endpoints
# ============================================================================

class FactResponse(BaseModel):
    """Fact response model for admin."""
    id: int
    user_id: int
    article_id: int
    amount: float
    fact_date: str
    description: str | None
    record_type: str
    financial_center_id: int | None = None
    cost_center_id: int | None = None
    user_name: str | None = None
    article_name: str | None = None
    article_type: str | None = None  # Added for color logic (income/expense)
    financial_center_name: str | None = None
    cost_center_name: str | None = None

    class Config:
        from_attributes = True


class FactUpdateRequest(BaseModel):
    """Fact update request model."""
    amount: float | None = None
    fact_date: str | None = None  # ISO date string
    description: str | None = None
    article_id: int | None = None


@router.get("/facts", response_model=List[FactResponse])
async def get_all_facts(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    user_id: int | None = Query(None, description="Filter by user ID"),
    article_id: int | None = Query(None, description="Filter by article ID"),
    date_from: str | None = Query(None, description="Filter by date from (ISO format)"),
    date_to: str | None = Query(None, description="Filter by date to (ISO format)"),
    record_type: str | None = Query(None, description="Filter by record type (fact or plan)"),
    financial_center_id: int | None = Query(None, description="Filter by financial center ID"),
    cost_center_id: int | None = Query(None, description="Filter by cost center ID"),
    limit: int = Query(50, ge=1, le=500, description="Results per page"),
    offset: int = Query(0, ge=0, description="Pagination offset")
):
    """
    Get all facts (admin only).

    Returns paginated list of all facts with filtering options.

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session
        user_id: Filter by specific user
        article_id: Filter by specific article
        date_from: Filter by start date
        date_to: Filter by end date
        record_type: Filter by record type (fact or plan)
        financial_center_id: Filter by financial center
        cost_center_id: Filter by cost center
        limit: Number of results per page (max 500)
        offset: Pagination offset

    Returns:
        List[FactResponse]: List of facts
    """
    from datetime import date

    # Build query with joins (including FinancialCenter and CostCenter)
    query = (
        select(Fact, User, Article, FinancialCenter, CostCenter)
        .join(User, Fact.user_id == User.id)
        .join(Article, Fact.article_id == Article.id)
        .outerjoin(FinancialCenter, Fact.financial_center_id == FinancialCenter.id)
        .outerjoin(CostCenter, Fact.cost_center_id == CostCenter.id)
    )

    # Apply filters
    if user_id is not None:
        query = query.where(Fact.user_id == user_id)

    if article_id is not None:
        query = query.where(Fact.article_id == article_id)

    if record_type is not None:
        query = query.where(Fact.record_type == record_type)

    if financial_center_id is not None:
        query = query.where(Fact.financial_center_id == financial_center_id)

    if cost_center_id is not None:
        query = query.where(Fact.cost_center_id == cost_center_id)

    if date_from is not None:
        try:
            start_date = date.fromisoformat(date_from)
            query = query.where(Fact.fact_date >= start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format. Use ISO format (YYYY-MM-DD)")

    if date_to is not None:
        try:
            end_date = date.fromisoformat(date_to)
            query = query.where(Fact.fact_date <= end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format. Use ISO format (YYYY-MM-DD)")

    # Order and paginate
    query = query.order_by(Fact.fact_date.desc(), Fact.id.desc()).limit(limit).offset(offset)

    result = await session.execute(query)
    rows = result.all()

    return [
        FactResponse(
            id=fact.id,
            user_id=fact.user_id,
            article_id=fact.article_id,
            amount=float(fact.amount),
            fact_date=fact.fact_date.isoformat(),
            description=fact.description,
            record_type=fact.record_type,
            financial_center_id=fact.financial_center_id,
            cost_center_id=fact.cost_center_id,
            user_name=user.username if user else None,
            article_name=article.name if article else None,
            article_type=article.type if article else None,  # For color logic
            financial_center_name=financial_center.name if financial_center else None,
            cost_center_name=cost_center.name if cost_center else None
        )
        for fact, user, article, financial_center, cost_center in rows
    ]


@router.get("/facts/count")
async def get_facts_count(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    user_id: int | None = Query(None, description="Filter by user ID"),
    article_id: int | None = Query(None, description="Filter by article ID"),
    date_from: str | None = Query(None, description="Filter by date from (ISO format)"),
    date_to: str | None = Query(None, description="Filter by date to (ISO format)"),
    record_type: str | None = Query(None, description="Filter by record type (fact or plan)"),
    financial_center_id: int | None = Query(None, description="Filter by financial center ID"),
    cost_center_id: int | None = Query(None, description="Filter by cost center ID")
):
    """
    Get total facts count with filters (admin only).

    Useful for pagination - returns total count matching the filters.

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session
        user_id: Filter by specific user
        article_id: Filter by specific article
        date_from: Filter by start date
        date_to: Filter by end date
        record_type: Filter by record type (fact or plan)
        financial_center_id: Filter by financial center
        cost_center_id: Filter by cost center

    Returns:
        dict: Total count
    """
    from datetime import date

    query = select(func.count(Fact.id))

    # Apply same filters as get_all_facts
    if user_id is not None:
        query = query.where(Fact.user_id == user_id)

    if article_id is not None:
        query = query.where(Fact.article_id == article_id)

    if record_type is not None:
        query = query.where(Fact.record_type == record_type)

    if financial_center_id is not None:
        query = query.where(Fact.financial_center_id == financial_center_id)

    if cost_center_id is not None:
        query = query.where(Fact.cost_center_id == cost_center_id)

    if date_from is not None:
        try:
            start_date = date.fromisoformat(date_from)
            query = query.where(Fact.fact_date >= start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_from format. Use ISO format (YYYY-MM-DD)")

    if date_to is not None:
        try:
            end_date = date.fromisoformat(date_to)
            query = query.where(Fact.fact_date <= end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date_to format. Use ISO format (YYYY-MM-DD)")

    result = await session.execute(query)
    total = result.scalar()

    return {"total": total}


@router.put("/facts/{fact_id}", response_model=FactResponse)
async def update_fact(
    fact_id: int,
    update_data: FactUpdateRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Update fact (admin only).

    Allows admin to update any fact (amount, date, description, article).

    Args:
        fact_id: Fact ID to update
        update_data: Update request data
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        FactResponse: Updated fact

    Raises:
        HTTPException: 404 if fact not found
        HTTPException: 400 if article_id invalid
    """
    from datetime import date as date_type

    # Get fact
    query = select(Fact).where(Fact.id == fact_id)
    result = await session.execute(query)
    fact = result.scalar_one_or_none()

    if not fact:
        raise HTTPException(status_code=404, detail="Fact not found")

    # Validate article_id if changing
    if update_data.article_id is not None and update_data.article_id != fact.article_id:
        article_query = select(Article).where(
            Article.id == update_data.article_id,
            Article.is_current == True  # noqa: E712
        )
        article_result = await session.execute(article_query)
        article = article_result.scalar_one_or_none()

        if not article:
            raise HTTPException(status_code=400, detail="Article not found")

    # Update fields
    if update_data.amount is not None:
        fact.amount = update_data.amount

    if update_data.fact_date is not None:
        try:
            fact.fact_date = date_type.fromisoformat(update_data.fact_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use ISO format (YYYY-MM-DD)")

    if update_data.description is not None:
        fact.description = update_data.description

    if update_data.article_id is not None:
        fact.article_id = update_data.article_id

    session.add(fact)
    await session.commit()
    await session.refresh(fact)

    # Get user, article, financial center, and cost center for response
    user_query = select(User).where(User.id == fact.user_id)
    user_result = await session.execute(user_query)
    user = user_result.scalar_one_or_none()

    article_query = select(Article).where(Article.id == fact.article_id)
    article_result = await session.execute(article_query)
    article = article_result.scalar_one_or_none()

    financial_center = None
    if fact.financial_center_id:
        fc_query = select(FinancialCenter).where(FinancialCenter.id == fact.financial_center_id)
        fc_result = await session.execute(fc_query)
        financial_center = fc_result.scalar_one_or_none()

    cost_center = None
    if fact.cost_center_id:
        cc_query = select(CostCenter).where(CostCenter.id == fact.cost_center_id)
        cc_result = await session.execute(cc_query)
        cost_center = cc_result.scalar_one_or_none()

    return FactResponse(
        id=fact.id,
        user_id=fact.user_id,
        article_id=fact.article_id,
        amount=float(fact.amount),
        fact_date=fact.fact_date.isoformat(),
        description=fact.description,
        record_type=fact.record_type,
        financial_center_id=fact.financial_center_id,
        cost_center_id=fact.cost_center_id,
        user_name=user.username if user else None,
        article_name=article.name if article else None,
        financial_center_name=financial_center.name if financial_center else None,
        cost_center_name=cost_center.name if cost_center else None
    )


@router.delete("/facts/{fact_id}")
async def delete_fact(
    fact_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete fact (admin only).

    Physical delete (not soft delete like articles/users).
    Idempotent - returns 200 OK even if fact is already deleted.

    Args:
        fact_id: Fact ID to delete
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        dict: Success message with fact_id and status

    Raises:
        Never raises 404 for missing facts (idempotent DELETE)
    """
    # Get fact
    query = select(Fact).where(Fact.id == fact_id)
    result = await session.execute(query)
    fact = result.scalar_one_or_none()

    if not fact:
        # Idempotent DELETE - return 200 OK for already deleted fact
        # Log WARNING for debugging race conditions in production
        logger.warning(
            f"DELETE attempt on non-existent fact_id={fact_id} by admin_id={current_admin.id}. "
            f"Fact may have been already deleted (race condition or duplicate request)."
        )
        return {
            "message": "Fact already deleted or never existed",
            "fact_id": fact_id,
            "status": "already_deleted"
        }

    # Delete
    await session.delete(fact)
    await session.commit()

    logger.info(f"Fact {fact_id} deleted successfully by admin {current_admin.id}")

    return {
        "message": "Fact deleted successfully",
        "fact_id": fact_id,
        "status": "deleted"
    }


@router.post("/facts/batch-delete")
async def batch_delete_facts(
    fact_ids: List[int],
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Batch delete facts (admin only).

    Deletes multiple facts in one request.

    Args:
        fact_ids: List of fact IDs to delete
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        dict: Number of deleted facts

    Raises:
        HTTPException: 400 if fact_ids list is empty or too large
    """
    if not fact_ids:
        raise HTTPException(status_code=400, detail="fact_ids list cannot be empty")

    if len(fact_ids) > 500:
        raise HTTPException(status_code=400, detail="Cannot delete more than 500 facts at once")

    # Delete facts
    from sqlmodel import delete

    stmt = delete(Fact).where(Fact.id.in_(fact_ids))
    result = await session.execute(stmt)
    await session.commit()

    return {"message": f"Deleted {result.rowcount} facts", "deleted_count": result.rowcount}
