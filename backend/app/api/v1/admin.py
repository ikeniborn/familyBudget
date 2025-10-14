"""
Admin API endpoints.

Provides administrative functionality for managing users, articles, and facts.
All endpoints require admin privileges (is_admin=True).
"""

from typing import List

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import CurrentAdmin, get_session
from backend.app.models.article import Article
from backend.app.models.fact import Fact
from backend.app.models.user import User

router = APIRouter(prefix="/admin", tags=["Admin"])


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
    from datetime import datetime, timezone

    # Close old record
    user.valid_to = datetime.now(timezone.utc)
    user.is_current = False
    session.add(user)

    # Create new record
    new_user = User(
        telegram_id=user.telegram_id,
        username=user.username,
        first_name=user.first_name,
        last_name=user.last_name,
        is_admin=update_data.is_admin if update_data.is_admin is not None else user.is_admin,
        valid_from=datetime.now(timezone.utc),
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
