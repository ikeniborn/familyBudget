"""
Admin API endpoints.

Provides administrative functionality for managing users, articles, and facts.
All endpoints require admin privileges (is_admin=True).
"""

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentAdmin, get_session
from backend.app.models.article import Article
from backend.app.models.cost_center import CostCenter
from backend.app.models.fact import BudgetFact as Fact
from backend.app.models.financial_center import FinancialCenter
from backend.app.models.user import User
from backend.app.schemas.admin import SystemStatsResponse
from backend.app.schemas.article import (
    ArticleCreate,
    ArticleResponse,
    ArticleUpdate,
)
from backend.app.schemas.user import (
    TelegramUserInfo,
    UserCreate,
    UserDetailResponse,
    UserHistoryListResponse,
    UserListResponse,
    UserMergeRequest,
    UserMergeResponse,
    UserUpdate,
)
from backend.app.services import archive_recursive, has_changes, restore_recursive
from backend.app.services.article_service import (
    FAR_FUTURE_DATETIME,
)
from backend.app.services.article_service import (
    create_initial_history as create_article_initial_history,
)
from backend.app.services.article_service import (
    update_article_profile as update_article_scd1,
)
from backend.app.services.telegram_auth import fetch_telegram_user_info
from backend.app.services.user_service import create_initial_history, update_user_profile

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


# Removed duplicate schemas - using imports from backend.app.schemas.article instead


# ============================================================================
# Users Management Endpoints
# ============================================================================

# ============================================================================
# System Settings Endpoints
# ============================================================================


class SystemTimezoneResponse(BaseModel):
    """System timezone response."""
    current_timezone: str
    current_offset: str
    current_display: str
    server_time: str
    common_timezones: list[dict]


@router.get("/settings/timezone", response_model=SystemTimezoneResponse)
async def get_system_timezone(
    current_admin: CurrentAdmin,
) -> SystemTimezoneResponse:
    """
    Get current system timezone settings (admin only).

    Returns:
    - current_timezone: IANA timezone name (e.g., "Europe/Moscow")
    - current_offset: UTC offset (e.g., "UTC+03:00")
    - current_display: Human-readable format
    - server_time: Current server time in system timezone
    - common_timezones: List of available timezones for reference

    Note: To change SYSTEM_TIMEZONE, update .env file and restart the application.
    """
    from datetime import timezone as tz
    from zoneinfo import ZoneInfo

    from backend.app.core.config import get_settings
    from backend.app.utils.timezone import get_common_timezones

    settings = get_settings()
    tz_name = settings.SYSTEM_TIMEZONE

    # Get current offset
    now = datetime.now(tz.utc)
    try:
        local_tz = ZoneInfo(tz_name)
        local_time = now.astimezone(local_tz)
        offset = local_time.strftime("%z")
        offset_formatted = f"UTC{offset[:3]}:{offset[3:]}"
        display = f"({offset_formatted}) {tz_name}"
        server_time = local_time.strftime("%d.%m.%Y %H:%M:%S")
    except Exception:
        offset_formatted = "UTC+00:00"
        display = f"(UTC+00:00) {tz_name}"
        server_time = now.strftime("%d.%m.%Y %H:%M:%S")

    return SystemTimezoneResponse(
        current_timezone=tz_name,
        current_offset=offset_formatted,
        current_display=display,
        server_time=server_time,
        common_timezones=get_common_timezones(),
    )


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



@router.get("/users/stats/summary", response_model=list[UserStatsResponse])
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
    articles_count_query = select(func.count(Article.id))
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

    Creates a new user record with SCD Type 1 fields.
    Validates telegram_id and/or email uniqueness in database.

    **Supports two auth methods:**
    - Telegram ID only (for Telegram OAuth users)
    - Email only (for email/password auth users)
    - Both (user can login via either method)

    **SCD Type 1 Behavior:**
    - Creates record in main User table
    - Creates initial history record in UserHistory table

    Args:
        user_data: User creation data (telegram_id and/or email, username, etc.)
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: Created user record

    Raises:
        HTTPException: 409 if telegram_id or email already exists (duplicate)
        HTTPException: 400 if neither telegram_id nor email provided

    Example:
        POST /api/v1/admin/users
        Body: {
            "telegram_id": 123456789,  // optional if email provided
            "email": "user@example.com",  // optional if telegram_id provided
            "username": "johndoe",
            "first_name": "John",
            "is_admin": false
        }
    """
    # Check if user with this telegram_id already exists (if provided)
    if user_data.telegram_id is not None:
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

    # Check if user with this email already exists (if provided)
    if user_data.email is not None and user_data.email.strip() != '':
        email_statement = select(User).where(User.email == user_data.email)
        email_result = await session.execute(email_statement)
        existing_email_user = email_result.scalar_one_or_none()

        if existing_email_user:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"User with email={user_data.email} "
                    "already exists"
                )
            )

    # Create new user (SCD Type 1 - main table only)
    now = datetime.utcnow()
    new_user = User(
        telegram_id=user_data.telegram_id,
        email=user_data.email if user_data.email and user_data.email.strip() else None,
        username=user_data.username,
        first_name=user_data.first_name,
        last_name=user_data.last_name,
        is_admin=user_data.is_admin,
        is_active=user_data.is_active,  # Admin can activate immediately
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

    # Validate telegram_id uniqueness if being changed
    if "telegram_id" in updates and updates["telegram_id"] is not None:
        new_telegram_id = updates["telegram_id"]
        # Check if another user has this telegram_id
        existing_query = select(User).where(
            User.telegram_id == new_telegram_id,
            User.id != user_id
        )
        existing_result = await session.execute(existing_query)
        existing_user = existing_result.scalar_one_or_none()
        if existing_user:
            raise HTTPException(
                status_code=409,
                detail=f"Telegram ID {new_telegram_id} is already used by another user"
            )

    # Validate that at least one auth method remains
    # Calculate future state of telegram_id and email
    future_telegram_id = updates.get("telegram_id", user.telegram_id) if "telegram_id" in updates else user.telegram_id
    future_email = updates.get("email", user.email) if "email" in updates else user.email
    if future_telegram_id is None and (future_email is None or future_email == ""):
        raise HTTPException(
            status_code=400,
            detail="At least one auth method (Telegram ID or Email) must be set"
        )

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


@router.put("/users/{user_id}/reset-password", response_model=UserDetailResponse)
async def reset_user_password(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Reset user's password (admin only).

    **Admin Only:** Only admin users can reset passwords for other users.

    This endpoint:
    - Clears password_hash

    User will need to set a new password before they can login via email.

    Args:
        user_id: User ID to reset password
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: Updated user with password cleared

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

    # Check if password is set
    if not user.password_hash:
        raise HTTPException(
            status_code=400,
            detail="Password is not set for this user"
        )

    # Reset password
    user.password_hash = None
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)

    logger.info(
        f"Password reset for user {user_id} by admin {current_admin.id} "
        f"(telegram_id={user.telegram_id}, email={user.email})"
    )

    return user


@router.put("/users/{user_id}/reset-2fa", response_model=UserDetailResponse)
async def reset_user_2fa(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Reset user's 2FA (admin only).

    **Admin Only:** Only admin users can reset 2FA for other users.

    This endpoint:
    - Clears two_factor_secret
    - Sets two_factor_enabled to False
    - Clears backup_codes

    User will need to set up 2FA again before they can login via email.

    Args:
        user_id: User ID to reset 2FA
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: Updated user with 2FA disabled

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

    # Check if 2FA is enabled
    if not user.two_factor_enabled:
        raise HTTPException(
            status_code=400,
            detail="2FA is not enabled for this user"
        )

    # Reset 2FA
    user.two_factor_secret = None
    user.two_factor_enabled = False
    user.backup_codes = None
    user.updated_at = datetime.utcnow()
    session.add(user)
    await session.commit()
    await session.refresh(user)

    logger.info(
        f"2FA reset for user {user_id} by admin {current_admin.id} "
        f"(telegram_id={user.telegram_id}, email={user.email})"
    )

    return user


@router.put("/users/{user_id}/reset-webauthn", response_model=UserDetailResponse)
async def reset_user_webauthn(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> User:
    """
    Reset user's WebAuthn credentials (admin only).

    **Admin Only:** Only admin users can reset WebAuthn credentials for other users.

    This endpoint:
    - Revokes all WebAuthn credentials (sets is_revoked=True)
    - User will need to re-register biometric authentication

    Args:
        user_id: User ID to reset WebAuthn
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserDetailResponse: Updated user

    Raises:
        HTTPException: 404 if user not found
        HTTPException: 400 if user has no WebAuthn credentials
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

    # Check if user has WebAuthn credentials
    from backend.app.models.webauthn_credential import WebAuthnCredential
    credentials_query = select(WebAuthnCredential).where(
        WebAuthnCredential.user_id == user_id,
        WebAuthnCredential.is_revoked == False  # noqa: E712
    )
    credentials_result = await session.execute(credentials_query)
    credentials = credentials_result.scalars().all()

    if not credentials:
        raise HTTPException(
            status_code=400,
            detail="User has no active WebAuthn credentials"
        )

    # Revoke all credentials
    now = datetime.utcnow()
    revoked_count = 0
    for credential in credentials:
        credential.is_revoked = True
        credential.revoked_at = now
        session.add(credential)
        revoked_count += 1

    # Update user timestamp
    user.updated_at = now
    session.add(user)

    await session.commit()
    await session.refresh(user)

    logger.info(
        f"WebAuthn reset for user {user_id} by admin {current_admin.id} "
        f"({revoked_count} credentials revoked, telegram_id={user.telegram_id}, email={user.email})"
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
        logger.error("Failed to fetch Telegram info for user %s: %s", user_id, e)
        raise HTTPException(
            status_code=404,
            detail=(
                "Failed to fetch user info from Telegram. "
                "User may not have started the bot @ikenibornbudgetbot. "
                "Please ask them to send /start to the bot."
            )
        )

    if not telegram_info:
        raise HTTPException(
            status_code=404,
            detail=(
                "User not found in Telegram bot. "
                "Please ask them to send /start to @ikenibornbudgetbot."
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
            logger.warning("Failed to download avatar for user %s: %s", user_id, e)
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


@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete user (admin only).

    Hard delete — permanently removes user and their history records.
    Blocked if user has any budget facts (suggest deactivation instead).

    Security: Cannot delete self or last active admin.
    """
    from backend.app.models.user_history import UserHistory

    statement = select(User).where(User.id == user_id)
    result = await session.execute(statement)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail=f"User with id={user_id} not found")

    if user.id == current_admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    # Prevent deleting last active admin
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
                detail="Cannot delete the last active admin. Activate another admin first."
            )

    # Block deletion if user has facts (data loss prevention)
    facts_count_query = select(func.count(Fact.id)).where(Fact.user_id == user_id)
    facts_count_result = await session.execute(facts_count_query)
    facts_count = facts_count_result.scalar()
    if facts_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete user with {facts_count} budget fact(s). Use deactivation instead."
        )

    # Delete UserHistory records first (FK constraint)
    history_query = select(UserHistory).where(UserHistory.user_id == user_id)
    history_result = await session.execute(history_query)
    for history_record in history_result.scalars().all():
        await session.delete(history_record)

    await session.delete(user)
    await session.commit()

    logger.info(
        f"User {user_id} permanently deleted by admin {current_admin.id} "
        f"(email={user.email}, telegram_id={user.telegram_id})"
    )

    return {"message": "User deleted successfully", "user_id": user_id}


@router.post("/users/merge", response_model=UserMergeResponse)
async def merge_users(
    merge_data: UserMergeRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
) -> UserMergeResponse:
    """
    Merge two user accounts (admin only).

    Merges source user into target user:
    - All facts from source are transferred to target
    - Telegram ID is transferred from source to target (if applicable)
    - Source user is deactivated and marked with merged_into_user_id
    - Historical data is preserved (facts remain attributed to source in history)

    Use case: When a user has registered twice (e.g., with different Telegram ID)
    and admin needs to consolidate their data.

    Args:
        merge_data: Source and target user IDs
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        UserMergeResponse: Summary of merge operation

    Raises:
        HTTPException: 404 if source or target user not found
        HTTPException: 400 if merge is invalid (same user, already merged, etc.)
    """
    source_user_id = merge_data.source_user_id
    target_user_id = merge_data.target_user_id

    # Validate: Cannot merge user into themselves
    if source_user_id == target_user_id:
        raise HTTPException(
            status_code=400,
            detail="Нельзя объединить пользователя с самим собой"
        )

    # Load source user
    source_query = select(User).where(User.id == source_user_id)
    source_result = await session.execute(source_query)
    source_user = source_result.scalar_one_or_none()

    if not source_user:
        raise HTTPException(
            status_code=404,
            detail=f"Исходный пользователь с ID {source_user_id} не найден"
        )

    # Check if source user is already merged
    if source_user.merged_into_user_id is not None:
        raise HTTPException(
            status_code=400,
            detail=f"Исходный аккаунт уже объединен с пользователем ID {source_user.merged_into_user_id}"
        )

    # Load target user
    target_query = select(User).where(User.id == target_user_id)
    target_result = await session.execute(target_query)
    target_user = target_result.scalar_one_or_none()

    if not target_user:
        raise HTTPException(
            status_code=404,
            detail=f"Целевой пользователь с ID {target_user_id} не найден"
        )

    # Check if target user is already merged (cannot merge into merged account)
    if target_user.merged_into_user_id is not None:
        raise HTTPException(
            status_code=400,
            detail="Целевой аккаунт уже объединен с другим пользователем"
        )

    now = datetime.utcnow()
    telegram_id_transferred = False
    source_telegram_id = source_user.telegram_id

    # Use raw SQL for atomic telegram_id transfer to avoid constraint violations
    # The constraint chk_user_has_auth_method requires telegram_id OR email to be set
    # We need to transfer telegram_id atomically: clear from source AND set on target in one transaction

    from sqlmodel import update

    # 1. Transfer Telegram ID if source has it and target doesn't
    if source_telegram_id is not None and target_user.telegram_id is None:
        # First, clear from source (use raw SQL to avoid ORM autoflush issues)
        # Set a placeholder to satisfy constraint temporarily if source has no email
        if source_user.email is None:
            # Source has only telegram_id - give it a placeholder email before clearing telegram_id
            placeholder_email = f"merged_{source_user_id}@placeholder.local"
            source_clear_stmt = (
                update(User)
                .where(User.id == source_user_id)
                .values(telegram_id=None, email=placeholder_email, updated_at=now)
            )
        else:
            # Source has email - can safely clear telegram_id
            source_clear_stmt = (
                update(User)
                .where(User.id == source_user_id)
                .values(telegram_id=None, updated_at=now)
            )
        await session.execute(source_clear_stmt)

        # Then, set on target
        target_set_stmt = (
            update(User)
            .where(User.id == target_user_id)
            .values(telegram_id=source_telegram_id, updated_at=now)
        )
        await session.execute(target_set_stmt)
        telegram_id_transferred = True

    # 2. Transfer all facts from source to target
    facts_update_stmt = (
        update(Fact)
        .where(Fact.user_id == source_user_id)
        .values(user_id=target_user_id, updated_at=now)
    )
    facts_result = await session.execute(facts_update_stmt)
    facts_transferred = facts_result.rowcount

    # 3. Transfer financial centers from source to target
    fc_update_stmt = (
        update(FinancialCenter)
        .where(FinancialCenter.user_id == source_user_id)
        .values(user_id=target_user_id, updated_at=now)
    )
    await session.execute(fc_update_stmt)

    # 4. Transfer cost centers from source to target
    cc_update_stmt = (
        update(CostCenter)
        .where(CostCenter.user_id == source_user_id)
        .values(user_id=target_user_id, updated_at=now)
    )
    await session.execute(cc_update_stmt)

    # 5. Mark source user as merged and deactivate (using raw SQL to avoid stale ORM state)
    source_merge_stmt = (
        update(User)
        .where(User.id == source_user_id)
        .values(merged_into_user_id=target_user_id, is_active=False, updated_at=now)
    )
    await session.execute(source_merge_stmt)

    # 6. Commit all changes
    await session.commit()

    logger.info(
        f"Users merged: {source_user_id} -> {target_user_id} "
        f"(facts: {facts_transferred}, telegram_id_transferred: {telegram_id_transferred}) "
        f"by admin {current_admin.id}"
    )

    return UserMergeResponse(
        message="Аккаунты успешно объединены",
        source_user_id=source_user_id,
        target_user_id=target_user_id,
        facts_transferred=facts_transferred,
        telegram_id_transferred=telegram_id_transferred,
    )


@router.get("/articles", response_model=list[ArticleResponse])
async def get_all_articles(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    include_inactive: Annotated[bool, Query(description="Include archived categories (is_active=false)")] = True,
    type: Annotated[str | None, Query(description="Filter by article type (income or expense)")] = None,
):
    """
    Get all articles (admin only).

    Returns list of all articles with financial_center_ids and is_leaf flags.
    Can filter by is_active flag and article type.

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session
        include_inactive: Whether to include archived categories (default: True for admin)
        type: Optional filter by article type (income or expense)

    Returns:
        List[ArticleResponse]: List of articles with financial_center_ids and is_leaf
    """
    from backend.app.models.article_financial_center import ArticleFinancialCenter

    query = select(Article, User).outerjoin(User, Article.user_id == User.id)

    # Filter archived categories unless explicitly included
    if not include_inactive:
        query = query.where(Article.is_active == True)  # noqa: E712

    if type:
        query = query.where(Article.type == type)

    query = query.order_by(Article.type, Article.name)

    result = await session.execute(query)
    rows = result.all()

    # Get all article IDs
    article_ids = [article.id for article, _ in rows]

    # Load all financial center links in one query
    fc_links_query = select(ArticleFinancialCenter).where(
        ArticleFinancialCenter.article_id.in_(article_ids)
    )
    fc_links_result = await session.execute(fc_links_query)
    fc_links = fc_links_result.scalars().all()

    # Build mapping: article_id -> list of financial_center_ids
    fc_map: dict[int, list[int]] = {}
    for link in fc_links:
        if link.article_id not in fc_map:
            fc_map[link.article_id] = []
        fc_map[link.article_id].append(link.financial_center_id)

    # Determine which articles have children (for is_leaf calculation)
    # An article is a leaf if it has NO children (i.e., not used as parent_id)
    parent_ids_query = select(Article.parent_id).where(
        Article.parent_id.isnot(None)
    ).distinct()
    parent_ids_result = await session.execute(parent_ids_query)
    parent_ids = {row[0] for row in parent_ids_result.all()}

    return [
        ArticleResponse(
            id=article.id,
            user_id=article.user_id,
            user_name=user.first_name if user else None,  # Populate from joined User
            parent_id=article.parent_id,
            name=article.name,
            type=article.type,
            code=article.code,
            is_active=article.is_active,
            created_at=article.created_at,
            updated_at=article.updated_at,
            usage_count=0,
            hierarchy=None,
            financial_center_ids=fc_map.get(article.id, []),
            is_leaf=article.id not in parent_ids,
        )
        for article, user in rows
    ]


@router.post("/articles", response_model=ArticleResponse, status_code=201)
async def create_article(
    create_data: ArticleCreate,
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
        HTTPException: 400 if parent_id invalid, type mismatch, or duplicate name+type
    """
    # Check for duplicate (name + type) - same name with same type is not allowed
    duplicate_query = select(Article).where(
        Article.name == create_data.name,
        Article.type == create_data.type,
    )
    duplicate_result = await session.execute(duplicate_query)
    duplicate = duplicate_result.scalar_one_or_none()

    if duplicate:
        raise HTTPException(
            status_code=400,
            detail=f"Категория с именем '{create_data.name}' и типом '{create_data.type}' уже существует"
        )

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

    # Create new article (SCD Type 1 - no versioning fields)
    new_article = Article(
        user_id=current_admin.id,
        parent_id=create_data.parent_id,
        name=create_data.name,
        type=create_data.type,
        code=generated_code,
        is_active=create_data.is_active,
    )
    session.add(new_article)
    await session.commit()
    await session.refresh(new_article)

    # Create initial history record (SCD Type 1 pattern)
    await create_article_initial_history(
        session=session,
        article=new_article,
        change_type="CREATE",
    )

    # Handle financial center links (only for leaf articles - new articles are always leaves)
    financial_center_ids = []
    if create_data.financial_center_ids:
        from backend.app.models.article_financial_center import ArticleFinancialCenter

        # Validate all financial centers exist
        for fc_id in create_data.financial_center_ids:
            fc_query = select(FinancialCenter).where(FinancialCenter.id == fc_id)
            fc_result = await session.execute(fc_query)
            fc = fc_result.scalar_one_or_none()
            if not fc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Финансовый центр с id={fc_id} не найден"
                )

            # Create link
            link = ArticleFinancialCenter(
                article_id=new_article.id,
                financial_center_id=fc_id
            )
            session.add(link)

        await session.commit()
        financial_center_ids = create_data.financial_center_ids

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
        "user_name": None,  # No user name for new articles (system created)
        "financial_center_ids": financial_center_ids,
        "is_leaf": True,  # New articles are always leaves
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
    # Get current article
    query = select(Article).where(
        Article.id == article_id,
    )
    result = await session.execute(query)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Prepare update data
    # Note: We need to handle parent_id specially - it can be explicitly set to null (move to root)
    # Frontend always sends parent_id (either a valid ID or null for root level)
    updates = {}
    if update_data.name is not None:
        updates["name"] = update_data.name
    if update_data.type is not None:
        updates["type"] = update_data.type
    # Always include parent_id - null means "move to root", not "don't change"
    # Frontend always sends parent_id in the request body
    updates["parent_id"] = update_data.parent_id
    if update_data.is_active is not None:
        updates["is_active"] = update_data.is_active

    # Validate parent_id if changing
    if "parent_id" in updates and updates["parent_id"] != article.parent_id:
        new_parent_id = updates["parent_id"]

        # parent_id = null means "move to root" - this is valid, skip validation
        if new_parent_id is not None:
            # Check parent exists
            parent_query = select(Article).where(
                Article.id == new_parent_id,
            )
            parent_result = await session.execute(parent_query)
            parent = parent_result.scalar_one_or_none()

            if not parent:
                raise HTTPException(status_code=400, detail="Parent article not found")

            # Cannot set self as parent
            if new_parent_id == article_id:
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
        children_result.scalars().all()

        # Store children count for frontend confirmation (will be passed in response metadata)
        # Note: We'll need to recursively update children after main article update
        # The SCD2 service will handle parent_id redirection automatically

    # Handle is_active changes separately (archiving/restoring)
    is_active_change = None
    if "is_active" in updates and updates.get("is_active") != article.is_active:
        is_active_change = updates["is_active"]
        # Remove from updates - will be handled separately
        del updates["is_active"]

    # Check if anything changed (after removing is_active)
    changed, changed_fields = has_changes(article, updates)

    # Also check if financial_center_ids changed
    fc_changed = update_data.financial_center_ids is not None

    # Process is_active change (recursive archive/restore)
    if is_active_change is not None:
        if is_active_change is False:
            # Archive article and all descendants
            archived_count = await archive_recursive(session, article_id)
            logger.info("Archived %s articles", archived_count)
        else:
            # Restore article and all descendants
            restored_count = await restore_recursive(session, article_id)
            logger.info("Restored %s articles", restored_count)

        # Refresh article to get updated is_active status
        await session.refresh(article)

    # If no changes to article fields AND no FC changes, return current article
    # NOTE: fc_changed must be checked here to ensure FC updates are processed
    if not changed and not fc_changed:
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
            "usage_count": 0,
            "hierarchy": None,
            "user_name": None
        }

    # Store original type BEFORE update (for cascade detection)
    original_type = article.type

    # Only update article fields if they actually changed
    updated_article = article  # Default to current article
    if changed:
        # Use SCD Type 1 + History (in-place update with history tracking)
        updated_article = await update_article_scd1(
            session=session,
            article=article,
            updates=updates,
            changed_by_user_id=current_admin.id,
            change_type="UPDATE",
        )

    # CASCADE: If type was changed, recursively update all children
    if changed and "type" in updates and updates["type"] != original_type:
        # Get all descendants and update without intermediate commits
        async def cascade_update_type(parent_article_id: int, new_type: str):
            """Recursively update type for all children of given article."""
            # Get all immediate children
            children_query = select(Article).where(
                Article.parent_id == parent_article_id,
            )
            children_result = await session.execute(children_query)
            children_list = children_result.scalars().all()

            for child in children_list:
                # Store child's original type before potential update
                child_original_type = child.type

                # Only update if child has different type
                if child_original_type != new_type:
                    # Update child type using SCD Type 1 (no auto commit - we'll commit once at the end)
                    child_updates = {"type": new_type}
                    await update_article_scd1(
                        session=session,
                        article=child,
                        updates=child_updates,
                        changed_by_user_id=current_admin.id,
                        change_type="CASCADE_TYPE_UPDATE",
                        auto_commit=False,  # Don't commit yet - avoid session state issues
                    )

                    logger.info(
                        f"CASCADE: Updated child type: {child.name} ({child_original_type} → {new_type})"
                    )

                    # Recursively update this child's children
                    await cascade_update_type(child.id, new_type)

        # Start cascade from the updated article
        await cascade_update_type(updated_article.id, updated_article.type)

        # Single commit for all cascade updates
        await session.commit()
        await session.refresh(updated_article)

    # Handle financial_center_ids update
    from backend.app.models.article_financial_center import ArticleFinancialCenter
    from backend.app.services.hierarchy_service import get_depth

    financial_center_ids = []
    if update_data.financial_center_ids is not None:
        # Check if article is leaf (no children)
        depth = await get_depth(session, article_id)
        if depth > 0:
            raise HTTPException(
                status_code=400,
                detail="Привязки к ЦФО можно устанавливать только для листовых категорий (без подкатегорий)"
            )

        # Delete existing links
        delete_links_query = select(ArticleFinancialCenter).where(
            ArticleFinancialCenter.article_id == article_id
        )
        links_result = await session.execute(delete_links_query)
        for link in links_result.scalars().all():
            await session.delete(link)

        # Create new links
        for fc_id in update_data.financial_center_ids:
            fc_query = select(FinancialCenter).where(FinancialCenter.id == fc_id)
            fc_result = await session.execute(fc_query)
            fc = fc_result.scalar_one_or_none()
            if not fc:
                raise HTTPException(
                    status_code=400,
                    detail=f"Финансовый центр с id={fc_id} не найден"
                )

            link = ArticleFinancialCenter(
                article_id=article_id,
                financial_center_id=fc_id
            )
            session.add(link)

        await session.commit()
        financial_center_ids = update_data.financial_center_ids
    else:
        # Load existing financial_center_ids
        existing_links_query = select(ArticleFinancialCenter.financial_center_id).where(
            ArticleFinancialCenter.article_id == article_id
        )
        existing_links_result = await session.execute(existing_links_query)
        financial_center_ids = [row[0] for row in existing_links_result.all()]

    # Calculate is_leaf
    depth = await get_depth(session, article_id)
    is_leaf = (depth == 0)

    # TRIGGER: Recalculate article usage statistics after category update
    # This ensures usage_count is up-to-date for category selection UI sorting
    try:
        logger.info("Triggering article usage statistics recalculation after update of article %s", updated_article.id)
        await session.execute(text("SELECT recalculate_article_usage_stats()"))
        logger.info("Article usage statistics recalculated successfully")
    except Exception as e:
        logger.error("Error recalculating article usage statistics: %s", e, exc_info=True)

    # Return dict with datetime converted to ISO strings for JSON serialization
    # ArticleResponse includes usage_count which is not in Article model (comes from separate stats table)
    return {
        "id": updated_article.id,
        "user_id": updated_article.user_id,
        "parent_id": updated_article.parent_id,
        "name": updated_article.name,
        "type": updated_article.type,
        "code": updated_article.code,
        "is_active": updated_article.is_active,
        "created_at": updated_article.created_at.isoformat(),
        "updated_at": updated_article.updated_at.isoformat(),
        "usage_count": 0,  # Default for updated articles - stats recalculated daily
        "hierarchy": None,
        "user_name": None,  # No user name after update
        "financial_center_ids": financial_center_ids,
        "is_leaf": is_leaf,
    }


@router.delete("/articles/{article_id}")
async def delete_article(
    article_id: int,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Delete article physically (admin only).

    Permanently deletes the article from database after validation.

    Args:
        article_id: Article ID to delete
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        dict: Success message

    Raises:
        HTTPException: 404 if article not found
        HTTPException: 400 if article has children or is used in transactions
    """
    from backend.app.models.article import ArticleUsageStats
    from backend.app.models.article_history import ArticleHistory
    from backend.app.models.hierarchy import ArticleHierarchy

    # Get article
    query = select(Article).where(Article.id == article_id)
    result = await session.execute(query)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Check if article has children
    children_query = select(func.count(Article.id)).where(
        Article.parent_id == article_id
    )
    children_result = await session.execute(children_query)
    children_count = children_result.scalar()

    if children_count > 0:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot delete article with {children_count} child categories. Delete children first."
        )

    # NOTE: Removed validation blocking deletion when article has transactions
    # Now we CASCADE DELETE facts with history tracking (see below)

    # 1. Create DELETE history record (for audit trail)
    now = datetime.utcnow()
    delete_history = ArticleHistory(
        article_id=article.id,
        user_id=article.user_id,
        parent_id=article.parent_id,
        name=article.name,
        description=article.description,
        type=article.type,
        code=article.code,
        is_active=article.is_active,
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=False,  # Deleted records are never current
        change_type="DELETE",
        changed_fields=None,  # Full deletion
        changed_by_user_id=current_admin.id,
    )
    session.add(delete_history)

    # 2. CASCADE DELETE: Delete facts with history tracking
    from backend.app.models.budget_fact_history import BudgetFactHistory
    from backend.app.models.fact import BudgetFact

    # Count facts for this article
    facts_count_query = select(func.count(BudgetFact.id)).where(
        BudgetFact.article_id == article_id
    )
    facts_count_result = await session.execute(facts_count_query)
    facts_count = facts_count_result.scalar()

    # If facts exist, delete them with history tracking
    if facts_count > 0:
        # Load all facts for this article
        facts_query = select(BudgetFact).where(
            BudgetFact.article_id == article_id
        )
        facts_result = await session.execute(facts_query)
        facts_to_delete = facts_result.scalars().all()

        # Create BudgetFactHistory record for each deleted fact
        for fact in facts_to_delete:
            fact_delete_history = BudgetFactHistory(
                fact_id=fact.id,
                user_id=fact.user_id,
                article_id=fact.article_id,
                financial_center_id=fact.financial_center_id,
                cost_center_id=fact.cost_center_id,
                amount=fact.amount,
                fact_date=fact.fact_date,
                description=fact.description,
                record_type=fact.record_type,
                transfer_id=fact.transfer_id,
                valid_from=now,
                valid_to=FAR_FUTURE_DATETIME,
                is_current=False,
                change_type="DELETE",
                changed_fields=None,  # Full deletion
                changed_by_user_id=current_admin.id,
                cascade_delete_source=f"article_id:{article_id}",  # Mark as cascade deleted
            )
            session.add(fact_delete_history)

            # Delete fact
            await session.delete(fact)

    # 3. Delete from ArticleHierarchy (closure table)
    hierarchy_delete = select(ArticleHierarchy).where(
        (ArticleHierarchy.ancestor_id == article_id) |
        (ArticleHierarchy.descendant_id == article_id)
    )
    hierarchy_result = await session.execute(hierarchy_delete)
    hierarchy_records = hierarchy_result.scalars().all()
    for record in hierarchy_records:
        await session.delete(record)

    # 4. History records are PRESERVED for audit (NOT deleted)
    # ArticleHistory keeps full change history including DELETE record above

    # 5. Delete from ArticleUsageStats if exists
    usage_stats_delete = select(ArticleUsageStats).where(
        ArticleUsageStats.article_id == article_id
    )
    usage_stats_result = await session.execute(usage_stats_delete)
    usage_stats_record = usage_stats_result.scalar_one_or_none()
    if usage_stats_record:
        await session.delete(usage_stats_record)

    # 6. Delete article
    await session.delete(article)
    await session.commit()

    logger.info(
        f"Physically deleted article {article_id} ({article.name}) "
        f"with {facts_count} cascade-deleted facts "
        f"by admin {current_admin.id}"
    )

    return {
        "message": "Article deleted successfully",
        "article_id": article_id,
        "cascade_deleted": {
            "facts": facts_count
        }
    }


# ============================================================================
# Facts Management Endpoints
# ============================================================================

class FactResponse(BaseModel):
    """Fact response model for admin."""
    id: int
    user_id: int
    article_id: int
    amount: int
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
    amount: int | None = None
    fact_date: str | None = None  # ISO date string
    description: str | None = None
    article_id: int | None = None
    financial_center_id: int | None = None
    cost_center_id: int | None = None


@router.get("/facts", response_model=list[FactResponse])
async def get_all_facts(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    user_id: int | None = Query(None, description="Filter by user ID"),
    article_id: int | None = Query(None, description="Filter by article ID"),
    article_type: str | None = Query(None, pattern="^(income|expense|debit|credit)$", description="Filter by article type"),
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

    if article_type is not None:
        query = query.where(Article.type == article_type)

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

    # Order and paginate (newest by updated_at first, then by created_at, then by id as tiebreaker)
    query = query.order_by(Fact.updated_at.desc(), Fact.created_at.desc(), Fact.id.desc()).limit(limit).offset(offset)

    result = await session.execute(query)
    rows = result.all()

    return [
        FactResponse(
            id=fact.id,
            user_id=fact.user_id,
            article_id=fact.article_id,
            amount=int(fact.amount),
            fact_date=fact.fact_date.isoformat(),
            description=fact.description,
            record_type=fact.record_type,
            financial_center_id=fact.financial_center_id,
            cost_center_id=fact.cost_center_id,
            user_name=(
                user.first_name or
                user.username or
                user.last_name or
                (f"User {user.telegram_id}" if user.telegram_id else None) or
                f"Пользователь #{user.id}"
            ) if user else None,
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
    article_type: str | None = Query(None, pattern="^(income|expense|debit|credit)$", description="Filter by article type"),
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

    # Build query with join to Article for article_type filtering
    query = select(func.count(Fact.id)).join(Article, Fact.article_id == Article.id)

    # Apply same filters as get_all_facts
    if user_id is not None:
        query = query.where(Fact.user_id == user_id)

    if article_id is not None:
        query = query.where(Fact.article_id == article_id)

    if article_type is not None:
        query = query.where(Article.type == article_type)

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

    if update_data.financial_center_id is not None:
        fact.financial_center_id = update_data.financial_center_id

    if update_data.cost_center_id is not None:
        fact.cost_center_id = update_data.cost_center_id

    # Update timestamp (model doesn't have onupdate, so must do manually)
    fact.updated_at = datetime.utcnow()

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
        amount=int(fact.amount),
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

    logger.info("Fact %s deleted successfully by admin %s", fact_id, current_admin.id)

    return {
        "message": "Fact deleted successfully",
        "fact_id": fact_id,
        "status": "deleted"
    }


@router.post("/facts/batch-delete")
async def batch_delete_facts(
    fact_ids: list[int],
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


@router.get("/redis-stats")
async def get_redis_detailed_stats(
    current_admin: CurrentAdmin,
):
    """
    Get detailed Redis cache statistics (admin only).

    Returns comprehensive Redis metrics including:
    - Memory usage and peak
    - Total keys count
    - Keyspace hits/misses (absolute numbers)
    - Hit ratio percentage
    - Cache breakdown by category
    - Connected clients
    - Uptime

    Args:
        current_admin: Current admin user (from dependency)

    Returns:
        dict: Detailed Redis statistics
    """
    from backend.app.services.redis_service import (
        get_cache_breakdown,
        get_redis_stats,
        is_redis_available,
    )

    if not is_redis_available():
        raise HTTPException(
            status_code=503,
            detail="Redis is not available"
        )

    # Get basic stats
    stats = await get_redis_stats()

    # Get cache breakdown
    breakdown = await get_cache_breakdown()

    return {
        **stats,
        "cache_breakdown": breakdown,
    }
