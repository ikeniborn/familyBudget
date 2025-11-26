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
from sqlalchemy import text, update as sa_update
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentAdmin, get_session
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact as Fact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User
from backend.app.schemas.admin import SystemStatsResponse
from backend.app.schemas.article import ArticleUpdate
from backend.app.schemas.user import (
    UserCreate,
    UserDetailResponse,
    UserListResponse,
    UserUpdate,
    TelegramUserInfo,
    UserHistoryListResponse,
)
from backend.app.services.telegram_auth import (
    validate_telegram_user,
    fetch_telegram_user_info
)
from backend.app.services.user_service import (
    update_user_profile,
    create_initial_history
)

router = APIRouter(prefix="/admin", tags=["Admin"])
logger = logging.getLogger(__name__)


# ============================================================================
# Request/Response Models
# ============================================================================

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
    code: str | None = None
    is_active: bool
    created_at: str | None = None
    updated_at: str | None = None
    usage_count: int | None = None
    hierarchy: dict | None = None
    user_name: str | None = None

    class Config:
        from_attributes = True


class ArticleCreateRequest(BaseModel):
    """Article create request model."""
    parent_id: int | None = None
    name: str
    type: str  # "income" or "expense"
    is_active: bool = True  # Default to active


class ArticleUpdateRequest(BaseModel):
    """Article update request model."""
    name: str | None = None
    type: str | None = None  # "income" or "expense"
    parent_id: int | None = None
    is_active: bool | None = None


# ============================================================================
# Users Management Endpoints
# ============================================================================

@router.get("/users", response_model=UserListResponse)
async def get_all_users(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of users returned"),
    offset: int = Query(0, ge=0, description="Number of users skipped"),
    is_active: bool | None = Query(None, description="Filter by activation status (None=all, True=active, False=inactive)"),
) -> UserListResponse:
    """
    Get all users (admin only).

    Returns list of all registered users with pagination.

    **Supports filtering by is_active status.**

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session
        limit: Maximum number of results (1-1000, default: 100)
        offset: Number of results to skip (default: 0)
        is_active: Filter by activation status (None=all, True=active, False=inactive)

    Returns:
        UserListResponse: List of users with pagination info
    """
    # Base query: select all users (User table = SCD Type 1, no is_current filter needed)
    statement = select(User)

    # Filter by is_active if provided
    if is_active is not None:
        statement = statement.where(User.is_active == is_active)

    # Count total (before pagination)
    count_stmt = select(func.count()).select_from(statement.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Apply pagination and ordering (newest first)
    statement = statement.order_by(User.created_at.desc())
    statement = statement.limit(limit).offset(offset)

    # Execute query
    result = await session.execute(statement)
    users = result.scalars().all()

    return UserListResponse(
        users=users,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/users/telegram-info/{telegram_id}", response_model=TelegramUserInfo)
async def get_telegram_user_info(
    telegram_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> TelegramUserInfo:
    """
    Fetch user information from Telegram Bot API (admin only).

    Retrieves username and first_name from Telegram for auto-filling
    the user creation form. Also checks if user already exists in database.

    Комбинированный подход:
    - Сначала пытаемся получить данные из Telegram Bot API
    - При ошибке возвращаем 404 с детальным сообщением
    - Frontend может разрешить ручной ввод

    Args:
        telegram_id: Telegram ID to fetch info for
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        TelegramUserInfo: User data from Telegram + exists_in_db flag

    Raises:
        HTTPException: 404 if user not found in Telegram or Bot API error

    Example:
        GET /api/v1/admin/users/telegram-info/123456789
        Response: {
            "telegram_id": 123456789,
            "username": "johndoe",
            "first_name": "John",
            "exists_in_db": false
        }
    """
    # Fetch user data from Telegram Bot API
    user_info = await fetch_telegram_user_info(telegram_id)

    if user_info is None:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Не удалось получить информацию о пользователе {telegram_id} из Telegram. "
                "Возможные причины: пользователь не существует, бот не запущен, "
                "или пользователь не писал боту. "
                "Вы можете ввести данные вручную."
            )
        )

    # Check if user exists in our database
    query = select(User).where(User.telegram_id == telegram_id)
    result = await session.execute(query)
    existing_user = result.scalar_one_or_none()

    # Return TelegramUserInfo with exists_in_db flag
    return TelegramUserInfo(
        telegram_id=user_info["telegram_id"],
        username=user_info.get("username"),
        first_name=user_info.get("first_name"),
        exists_in_db=(existing_user is not None)
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
    # Get all users (User table = SCD Type 1, no versioning)
    users_query = select(User)
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



@router.get("/users/stats/system", response_model=SystemStatsResponse)
async def get_system_stats(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Get system-wide statistics (admin only).

    Follows Shared Family Budget Model principles:
    - All metrics are GLOBAL (not filtered by user_id)
    - Reflects the entire family budget system
    - No per-user isolation for facts and articles

    Returns aggregated stats for the entire system:
    - Total number of users
    - Total number of active users (who created at least one transaction)
    - Total number of facts (Shared Family Budget)
    - Total number of articles (Shared References)
    - Last fact date (most recent transaction in the system)

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        SystemStatsResponse: System-wide statistics

    See:
        CLAUDE.md - Shared Family Budget Model documentation
    """
    # Total users (User table = SCD Type 1, no versioning)
    users_count_query = select(func.count(User.id))
    users_count_result = await session.execute(users_count_query)
    total_users = users_count_result.scalar() or 0

    # Total facts (Shared Family Budget - NO user_id filter!)
    facts_count_query = select(func.count(Fact.id))
    facts_count_result = await session.execute(facts_count_query)
    total_facts = facts_count_result.scalar() or 0

    # Active users (users with is_active=True)
    active_users_query = select(func.count(User.id)).where(
        User.is_active == True  # noqa: E712
    )
    active_users_result = await session.execute(active_users_query)
    total_active_users = active_users_result.scalar() or 0

    # Total articles (Shared References - NO user_id filter!)
    articles_count_query = select(func.count(Article.id)).where(
    )
    articles_count_result = await session.execute(articles_count_query)
    total_articles = articles_count_result.scalar() or 0

    # Last fact date (most recent transaction in the system)
    last_fact_query = select(func.max(Fact.fact_date))
    last_fact_result = await session.execute(last_fact_query)
    last_fact_date = last_fact_result.scalar()

    return SystemStatsResponse(
        total_users=total_users,
        total_active_users=total_active_users,
        total_facts=total_facts,
        total_articles=total_articles,
        last_fact_date=last_fact_date.isoformat() if last_fact_date else None
    )


# ============================================================================
# Articles Management Endpoints
# ============================================================================


@router.get("/users/{user_id}", response_model=UserDetailResponse)
async def get_user_by_id(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Get specific user by ID (admin only).

    Returns user details (User table = SCD Type 1, current data only).

    Args:
        user_id: User ID to retrieve
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: User details

    Raises:
        HTTPException: 404 if user not found
    """
    # Load user (User table = SCD Type 1, no versioning)
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail=f"User with id={user_id} not found")

    return user


@router.get("/users/{user_id}/history", response_model=UserHistoryListResponse)
async def get_user_history(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> UserHistoryListResponse:
    """
    Get user change history (admin only).

    Returns full change history for a user from t_d_user_history table.
    All versions are returned ordered by valid_from DESC (newest first).

    Each history record contains:
    - Full snapshot of user data at that time
    - Change metadata (change_type, changed_fields, changed_by_user_id)
    - Temporal validity (valid_from, valid_to, is_current)

    Args:
        user_id: User ID to get history for
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserHistoryListResponse: List of historical versions

    Raises:
        HTTPException: 404 if user not found

    Example:
        GET /api/v1/admin/users/1/history

        Response:
        {
          "history": [
            {
              "history_id": 3,
              "user_id": 1,
              "username": "john_updated",
              "is_admin": true,
              "is_current": true,
              "change_type": "ROLE_CHANGE",
              "changed_fields": ["is_admin"],
              "changed_by_user_id": 2,
              "valid_from": "2025-11-26T12:00:00Z",
              "valid_to": "9999-12-31T23:59:59Z"
            },
            {
              "history_id": 2,
              "user_id": 1,
              "username": "johndoe",
              "is_admin": false,
              "is_current": false,
              "change_type": "CREATE",
              "changed_fields": null,
              "valid_from": "2025-11-26T10:00:00Z",
              "valid_to": "2025-11-26T12:00:00Z"
            }
          ],
          "total": 2
        }
    """
    # Verify user exists
    user_query = select(User).where(User.id == user_id)
    user_result = await session.execute(user_query)
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User with id={user_id} not found"
        )

    # Get user history from UserHistory table
    from backend.app.services.user_service import get_user_history as get_history
    history = await get_history(session=session, user_id=user_id)

    return UserHistoryListResponse(
        history=history,
        total=len(history)
    )


@router.post("/users", response_model=UserDetailResponse, status_code=201)
async def create_user(
    user_data: UserCreate,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Create new user (admin only).

    Creates a new user record with SCD Type 2 fields.
    Validates telegram_id uniqueness in database.

    **SCD Type 2 Behavior:**
    - Creates initial version with is_current=True
    - valid_from=now(), valid_to=9999-12-31

    Args:
        user_data: User creation data (telegram_id, username, etc.)
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: Created user record with SCD Type 2 fields

    Raises:
        HTTPException: 409 if telegram_id already exists (duplicate)

    Example:
        POST /api/v1/admin/users
        Body: {
            "telegram_id": 123456789,
            "username": "johndoe",
            "first_name": "John",
            "is_admin": false
        }
    """
    # Check if user with this telegram_id already exists
    statement = select(User).where(User.telegram_id == user_data.telegram_id)
    result = await session.execute(statement)
    existing_user = result.scalar_one_or_none()

    if existing_user:
        raise HTTPException(
            status_code=409,
            detail=(
                f"User with telegram_id={user_data.telegram_id} "
                "already exists"
            )
        )

    # Create new user (SCD Type 1 - main table only)
    now = datetime.utcnow()
    new_user = User(
        telegram_id=user_data.telegram_id,
        username=user_data.username,
        first_name=user_data.first_name,
        is_admin=user_data.is_admin,
        is_active=False,  # NEW: Requires admin activation
        created_at=now,
        updated_at=now,
    )

    session.add(new_user)
    await session.commit()
    await session.refresh(new_user)

    # Create initial UserHistory record (SCD Type 2 - history table)
    await create_initial_history(session=session, user=new_user, change_type="CREATE")

    return new_user


@router.put("/users/{user_id}", response_model=UserDetailResponse)
async def update_user_role(
    user_id: int,
    user_data: UserUpdate,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Update user role (admin only, Hybrid SCD1 + History SCD2).

    **Admin Only:** Only admin users can update user roles.

    **Hybrid Behavior (NEW):**
    - User table (t_d_user): In-place UPDATE (SCD Type 1 - stable id)
    - UserHistory table: Creates new version (SCD Type 2 - full audit trail)
    - User.id NEVER changes (stable FK for fact tables)

    **Use Cases:**
    - Promote user to admin: is_admin=True
    - Demote admin to regular user: is_admin=False

    Args:
        user_id: User ID to update
        user_data: Update request data (is_admin field)
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: Updated user (same id, in-place update)

    Raises:
        HTTPException: 404 if user not found
        HTTPException: 400 if trying to demote last admin
    """
    # Load user
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User with id={user_id} not found"
        )

    # Prepare update data
    updates = user_data.model_dump(exclude_unset=True)

    # If no updates provided, return existing user
    if not updates:
        return user

    # Prevent demoting the last admin
    if updates.get("is_admin") is False and user.is_admin:
        # Check if this is the last admin
        admin_count_query = select(func.count(User.id)).where(
            User.is_admin == True,  # noqa: E712
            User.id != user_id
        )
        admin_count_result = await session.execute(admin_count_query)
        remaining_admins = admin_count_result.scalar()

        if remaining_admins == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot demote the last admin. Promote another user to admin first."
            )

    # Update user using User Service (SCD1 + UserHistory SCD2)
    updated_user = await update_user_profile(
        session=session,
        user=user,
        updates=updates,
        changed_by_user_id=current_admin.id,
        change_type="ROLE_CHANGE",
    )

    return updated_user


@router.put("/users/{user_id}/activate", response_model=UserDetailResponse)
async def activate_user(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Activate user (admin only).

    **Admin Only:** Only admin users can activate/deactivate users.

    **NOT SCD Type 2:** is_active is an access control flag, not business data.
    Simple UPDATE is used instead of creating new version.

    Args:
        user_id: User ID to activate
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: Updated user with is_active=True

    Raises:
        HTTPException: 404 if user not found
    """
    # Load user
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User with id={user_id} not found"
        )

    # Simple UPDATE (NOT SCD Type 2)
    user.is_active = True
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)

    logger.info(
        f"User {user_id} activated by admin {current_admin.id} "
        f"(telegram_id={user.telegram_id}, username={user.username})"
    )

    return user


@router.put("/users/{user_id}/deactivate", response_model=UserDetailResponse)
async def deactivate_user(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Deactivate user (admin only).

    **Admin Only:** Only admin users can activate/deactivate users.

    **NOT SCD Type 2:** is_active is an access control flag, not business data.
    Simple UPDATE is used instead of creating new version.

    **Security:** Cannot deactivate self (current admin).

    Args:
        user_id: User ID to deactivate
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: Updated user with is_active=False

    Raises:
        HTTPException: 404 if user not found
        HTTPException: 400 if trying to deactivate self
    """
    # Load user
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User with id={user_id} not found"
        )

    # Prevent deactivating self
    if user.id == current_admin.id:
        raise HTTPException(
            status_code=400,
            detail="Cannot deactivate your own account"
        )

    # Prevent deactivating the last active admin
    if user.is_admin:
        admin_count_query = select(func.count(User.id)).where(
            User.is_admin == True,  # noqa: E712
            User.is_active == True,  # noqa: E712
            User.id != user_id
        )
        admin_count_result = await session.execute(admin_count_query)
        remaining_active_admins = admin_count_result.scalar()

        if remaining_active_admins == 0:
            raise HTTPException(
                status_code=400,
                detail="Cannot deactivate the last active admin. Activate another admin first."
            )

    # Simple UPDATE (NOT SCD Type 2)
    user.is_active = False
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)

    logger.info(
        f"User {user_id} deactivated by admin {current_admin.id} "
        f"(telegram_id={user.telegram_id}, username={user.username})"
    )

    return user


@router.put("/users/{user_id}/refresh-profile", response_model=UserDetailResponse)
async def refresh_user_profile_from_telegram(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Fetch fresh user data from Telegram and update profile (admin only).

    **Admin Only:** Only admin users can refresh user profiles.

    **Requires:** User must have started the Telegram bot (@ikenibornbudgetbot).
    Bot uses Telegram Bot API to fetch user info.

    **Updates (SCD Type 2):**
    - username
    - first_name
    - last_name
    - photo_url (downloads fresh avatar)

    Args:
        user_id: User ID to refresh
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: Updated user with fresh data from Telegram

    Raises:
        HTTPException: 404 if user not found or not in Telegram bot
        HTTPException: 500 if Telegram API error
    """
    # Load user
    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=404,
            detail=f"User with id={user_id} not found"
        )

    # Fetch from Telegram Bot API
    try:
        telegram_info = await fetch_telegram_user_info(user.telegram_id)
    except Exception as e:
        logger.error(f"Failed to fetch Telegram info for user {user_id}: {e}")
        raise HTTPException(
            status_code=404,
            detail=(
                f"Failed to fetch user info from Telegram. "
                f"User may not have started the bot @ikenibornbudgetbot. "
                f"Please ask them to send /start to the bot."
            )
        )

    if not telegram_info:
        raise HTTPException(
            status_code=404,
            detail=(
                f"User not found in Telegram bot. "
                f"Please ask them to send /start to @ikenibornbudgetbot."
            )
        )

    # Download fresh avatar if available
    local_photo_path = None
    if telegram_info.get("photo_url"):
        from backend.app.services.avatar_service import download_user_avatar
        try:
            local_photo_path = await download_user_avatar(
                telegram_photo_url=telegram_info["photo_url"],
                user_id=user.id
            )
        except Exception as e:
            logger.warning(f"Failed to download avatar for user {user_id}: {e}")
            # Continue without avatar update

    # Update profile using User Service (Hybrid SCD1 + History SCD2)
    updates = {}
    if telegram_info.get("first_name") is not None:
        updates["first_name"] = telegram_info.get("first_name")
    if telegram_info.get("last_name") is not None:
        updates["last_name"] = telegram_info.get("last_name")
    if telegram_info.get("username") is not None:
        updates["username"] = telegram_info.get("username")
    if local_photo_path is not None:
        updates["photo_url"] = local_photo_path

    # Only update if there are changes
    if updates:
        updated_user = await update_user_profile(
            session=session,
            user=user,
            updates=updates,
            changed_by_user_id=current_admin.id,
            change_type="UPDATE",
        )
    else:
        updated_user = user

    logger.info(
        f"User {user_id} profile refreshed from Telegram by admin {current_admin.id}"
    )

    return updated_user


@router.get("/articles", response_model=List[ArticleResponse])
async def get_all_articles(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    include_inactive: bool = Query(True, description="Include archived categories (is_active=false)"),
    type: str | None = Query(None, description="Filter by article type (income or expense)")
):
    """
    Get all articles (admin only).

    Returns list of all articles.
    Can filter by is_active flag and article type.

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session
        include_inactive: Whether to include archived categories (default: True for admin)
        type: Optional filter by article type (income or expense)

    Returns:
        List[ArticleResponse]: List of articles
    """
    query = select(Article, User).outerjoin(User, Article.user_id == User.id)

    # Filter archived categories unless explicitly included
    if not include_inactive:
        query = query.where(Article.is_active == True)  # noqa: E712

    if type:
        query = query.where(Article.type == type)

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
            code=article.code,
            is_active=article.is_active,
            created_at=article.created_at.isoformat() if article.created_at else None,
            updated_at=article.updated_at.isoformat() if article.updated_at else None,
            usage_count=0,
            hierarchy=None,
            user_name=user.full_name if user else None
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

    # Generate code for article
    from backend.app.utils.code_generator import generate_code
    generated_code = await generate_code(session, Article)

    # Create new article
    new_article = Article(
        user_id=current_admin.id,
        parent_id=create_data.parent_id,
        name=create_data.name,
        type=create_data.type,
        code=generated_code,
        is_active=create_data.is_active,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
        is_current=True
    )
    session.add(new_article)
    await session.commit()
    await session.refresh(new_article)

    # Return dict with datetime converted to ISO strings for JSON serialization
    return {
        "id": new_article.id,
        "user_id": new_article.user_id,
        "parent_id": new_article.parent_id,
        "name": new_article.name,
        "type": new_article.type,
        "code": new_article.code,
        "is_active": new_article.is_active,
        "created_at": new_article.created_at.isoformat(),
        "updated_at": new_article.updated_at.isoformat(),
        "usage_count": 0,  # Default for newly created articles
        "hierarchy": None,
        "user_name": None  # No user name for new articles (system created)
    }


@router.put("/articles/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: int,
    update_data: ArticleUpdate,
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
    )
    result = await session.execute(query)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Prepare update data
    updates = {}
    if update_data.name is not None:
        updates["name"] = update_data.name
    if update_data.type is not None:
        updates["type"] = update_data.type
    if update_data.parent_id is not None:
        updates["parent_id"] = update_data.parent_id
    if update_data.is_active is not None:
        updates["is_active"] = update_data.is_active

    # Validate parent_id if changing
    if "parent_id" in updates and updates["parent_id"] != article.parent_id:
        # Check parent exists
        parent_query = select(Article).where(
            Article.id == updates["parent_id"],
        )
        parent_result = await session.execute(parent_query)
        parent = parent_result.scalar_one_or_none()

        if not parent:
            raise HTTPException(status_code=400, detail="Parent article not found")

        # Cannot set self as parent
        if updates["parent_id"] == article_id:
            raise HTTPException(status_code=400, detail="Cannot set article as its own parent")

    # Validate type change if changing
    if "type" in updates and updates["type"] != article.type:
        # VALIDATION 1: Check for duplicate (name + type + user_id)
        # If we're changing type, check that no other article with same name and new type exists
        effective_name = updates.get("name", article.name)
        duplicate_query = select(Article).where(
            Article.user_id == article.user_id,
            Article.name == effective_name,
            Article.type == updates["type"],
            Article.id != article_id
        )
        duplicate_result = await session.execute(duplicate_query)
        duplicate = duplicate_result.scalar_one_or_none()

        if duplicate:
            raise HTTPException(
                status_code=400,
                detail=f"Категория с именем '{effective_name}' и типом '{updates['type']}' уже существует"
            )

        # VALIDATION 2: Check parent type mismatch (block if parent has different type)
        # Use NEW parent_id from updates if provided, otherwise use current parent_id
        effective_parent_id = updates.get("parent_id", article.parent_id)

        if effective_parent_id is not None:
            parent_query = select(Article).where(
                Article.id == effective_parent_id,
            )
            parent_result = await session.execute(parent_query)
            parent_article = parent_result.scalar_one_or_none()

            if parent_article and parent_article.type != updates["type"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"Невозможно изменить тип: родительская категория '{parent_article.name}' имеет тип '{parent_article.type}'. Сначала измените родителя или удалите привязку."
                )

        # CASCADE: Get all children to update their type as well
        # This query gets all immediate children (depth=1 from current article)
        children_query = select(Article).where(
            Article.parent_id == article_id,
        )
        children_result = await session.execute(children_query)
        children = children_result.scalars().all()

        # Store children count for frontend confirmation (will be passed in response metadata)
        # Note: We'll need to recursively update children after main article update
        # The SCD2 service will handle parent_id redirection automatically

    # Check if anything changed
    changed, changed_fields = has_changes(article, updates)
    if not changed:
        # No changes, return existing article as dict with ISO datetime strings
        return {
            "id": article.id,
            "user_id": article.user_id,
            "parent_id": article.parent_id,
            "name": article.name,
            "type": article.type,
            "code": article.code,
            "is_active": article.is_active,
            "created_at": article.created_at.isoformat(),
            "updated_at": article.updated_at.isoformat(),
            "usage_count": 0,  # Default - stats not loaded
            "hierarchy": None,
            "user_name": None  # No user name in simple return
        }

    # Use SCD2Service to create new version (includes automatic child redirection)
    new_article = await create_new_version(
        session=session,
        old_instance=article,
        updates=updates,
        changed_fields=changed_fields,
        changed_by_user_id=current_admin.id,
    )

    # UPDATE TRANSACTIONS: Repoint all transactions from old article_id to new article_id
    # This ensures historical transactions show under the new category attributes (e.g., new type)
    # Without this, old transactions would be "lost" in analytics filtered by new attributes
    update_stmt = (
        sa_update(Fact)
        .where(Fact.article_id == article.id)
        .values(article_id=new_article.id)
    )
    await session.execute(update_stmt)
    await session.commit()  # Commit transaction updates

    # Refresh article to ensure it's not stale
    await session.refresh(new_article)

    logger.info(
        f"Updated transactions: article_id {article.id} → {new_article.id} "
        f"(old: {article.name}/{article.type}, new: {new_article.name}/{new_article.type})"
    )

    # CASCADE: If type was changed, recursively update all children
    if "type" in updates and updates["type"] != article.type:
        # Recursively update all descendants
        async def cascade_update_type(parent_article_id: int, new_type: str):
            """Recursively update type for all children of given article."""
            # Get all immediate children
            children_query = select(Article).where(
                Article.parent_id == parent_article_id,
            )
            children_result = await session.execute(children_query)
            children_list = children_result.scalars().all()

            for child in children_list:
                # Only update if child has different type (should always be true if validations passed)
                if child.type != new_type:
                    old_child_id = child.id

                    # Create new version with updated type
                    child_updates = {"type": new_type}
                    new_child = await create_new_version(
                        session=session,
                        old_instance=child,
                        updates=child_updates,
                        changed_fields=["type"],
                        changed_by_user_id=current_admin.id,
                    )

                    # UPDATE TRANSACTIONS: Repoint child's transactions to new version
                    update_child_stmt = (
                        sa_update(Fact)
                        .where(Fact.article_id == old_child_id)
                        .values(article_id=new_child.id)
                    )
                    await session.execute(update_child_stmt)
                    await session.commit()  # Commit cascade transaction updates

                    logger.info(
                        f"CASCADE: Updated transactions for child: article_id {old_child_id} → {new_child.id} "
                        f"({child.name}: {child.type} → {new_type})"
                    )

                    # Recursively update this child's children
                    await cascade_update_type(new_child.id, new_type)

        # Start cascade from the newly created article
        await cascade_update_type(new_article.id, new_article.type)

    # TRIGGER: Recalculate article usage statistics after category update
    # This ensures usage_count is up-to-date for category selection UI sorting
    try:
        logger.info(f"Triggering article usage statistics recalculation after update of article {new_article.id}")
        await session.execute(text("SELECT recalculate_article_usage_stats()"))
        logger.info("Article usage statistics recalculated successfully")
    except Exception as e:
        logger.error(f"Error recalculating article usage statistics: {e}", exc_info=True)

    # Return dict with datetime converted to ISO strings for JSON serialization
    # ArticleResponse includes usage_count which is not in Article model (comes from separate stats table)
    return {
        "id": new_article.id,
        "user_id": new_article.user_id,
        "parent_id": new_article.parent_id,
        "name": new_article.name,
        "type": new_article.type,
        "code": new_article.code,
        "is_active": new_article.is_active,
        "created_at": new_article.created_at.isoformat(),
        "updated_at": new_article.updated_at.isoformat(),
        "usage_count": 0,  # Default for updated articles - stats recalculated daily
        "hierarchy": None,
        "user_name": None  # No user name after update
    }


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
    )
    result = await session.execute(query)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Check for active children
    children_query = select(func.count(Article.id)).where(
        Article.parent_id == article_id,
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
    search: str | None = Query(None, max_length=200, description="Search in description"),
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
        search: Search in description (case-insensitive substring)
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

    if search is not None:
        # Substring search using ILIKE with pg_trgm GIN index
        # GIN index on description (gin_trgm_ops) speeds up ILIKE queries significantly
        query = query.where(Fact.description.ilike(f"%{search}%"))

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
