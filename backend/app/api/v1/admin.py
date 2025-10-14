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


class ArticleResponse(BaseModel):
    """Article response model for admin."""
    id: int
    user_id: int | None
    parent_id: int | None
    name: str
    type: str
    is_global: bool
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
    is_global: bool = False


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


# ============================================================================
# Articles Management Endpoints
# ============================================================================

@router.get("/articles", response_model=List[ArticleResponse])
async def get_all_articles(
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session),
    is_current: bool = Query(True, description="Filter by current articles only"),
    is_global: bool | None = Query(None, description="Filter by global articles")
):
    """
    Get all articles (admin only).

    Returns list of all articles (user-specific and global).
    Can filter by is_current and is_global flags.

    Args:
        current_admin: Current admin user (from dependency)
        session: Database session
        is_current: Whether to show only current (active) articles
        is_global: Filter by global articles (None = all, True = global only, False = user-specific only)

    Returns:
        List[ArticleResponse]: List of articles
    """
    query = select(Article, User).outerjoin(User, Article.user_id == User.id)

    if is_current:
        query = query.where(Article.is_current == True)  # noqa: E712

    if is_global is not None:
        query = query.where(Article.is_global == is_global)

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
            is_global=article.is_global,
            is_current=article.is_current,
            valid_from=article.valid_from.isoformat(),
            valid_to=article.valid_to.isoformat() if article.valid_to else None,
            user_name=user.username if user else None
        )
        for article, user in rows
    ]


@router.post("/articles", response_model=ArticleResponse)
async def create_article(
    create_data: ArticleCreateRequest,
    current_admin: CurrentAdmin,
    session: AsyncSession = Depends(get_session)
):
    """
    Create new article (admin only).

    Creates a new article (category). If is_global=True, it will be available to all users.

    Args:
        create_data: Article creation data
        current_admin: Current admin user (from dependency)
        session: Database session

    Returns:
        ArticleResponse: Created article

    Raises:
        HTTPException: 400 if parent_id invalid or type mismatch
    """
    from datetime import datetime, timezone

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
        user_id=None if create_data.is_global else current_admin.id,
        parent_id=create_data.parent_id,
        name=create_data.name,
        type=create_data.type,
        is_global=create_data.is_global,
        valid_from=datetime.now(timezone.utc),
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
        is_global=new_article.is_global,
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
    from datetime import datetime, timezone

    # Get current article version
    query = select(Article).where(
        Article.id == article_id,
        Article.is_current == True  # noqa: E712
    )
    result = await session.execute(query)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Validate parent_id if changing
    if update_data.parent_id is not None and update_data.parent_id != article.parent_id:
        # Check parent exists
        parent_query = select(Article).where(
            Article.id == update_data.parent_id,
            Article.is_current == True  # noqa: E712
        )
        parent_result = await session.execute(parent_query)
        parent = parent_result.scalar_one_or_none()

        if not parent:
            raise HTTPException(status_code=400, detail="Parent article not found")

        # Cannot set self as parent
        if update_data.parent_id == article_id:
            raise HTTPException(status_code=400, detail="Cannot set article as its own parent")

    # Close old record
    article.valid_to = datetime.now(timezone.utc)
    article.is_current = False
    session.add(article)

    # Create new record
    new_article = Article(
        user_id=article.user_id,
        parent_id=update_data.parent_id if update_data.parent_id is not None else article.parent_id,
        name=update_data.name if update_data.name is not None else article.name,
        type=article.type,  # Type cannot be changed
        is_global=article.is_global,  # is_global cannot be changed
        valid_from=datetime.now(timezone.utc),
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
        is_global=new_article.is_global,
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
    from datetime import datetime, timezone

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
    article.valid_to = datetime.now(timezone.utc)
    article.is_current = False
    session.add(article)
    await session.commit()

    return {"message": "Article deactivated successfully", "article_id": article_id}
