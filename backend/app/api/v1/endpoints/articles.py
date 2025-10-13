"""
Articles CRUD endpoints.

This module implements CRUD operations for budget articles (categories)
with SCD Type 2 versioning and hierarchical organization.

Features:
    - User data isolation (users see only their articles + global articles)
    - Admin bypass (admins see all articles)
    - SCD Type 2 updates (creates new version, closes old version)
    - Soft delete (sets is_current=False)
    - Hierarchy support (parent_id, closure table)
"""

from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
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
from backend.app.schemas import get_common_responses
from backend.app.schemas.article import (
    ArticleCreate,
    ArticleListResponse,
    ArticleResponse,
    ArticleUpdate,
)
from backend.app.services import (
    create_new_version,
    get_ancestors,
    get_depth,
    get_direct_children,
    get_subtree,
    has_changes,
)

router = APIRouter(prefix="/articles", tags=["Articles"])


@router.post(
    "",
    response_model=ArticleResponse,
    status_code=status.HTTP_201_CREATED,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def create_article(
    article_data: ArticleCreate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> Article:
    """
    Create a new article (budget category).

    **User Isolation:**
    - Article is created with current user as owner
    - Global articles (is_global=True) can only be created by admins

    **Validation:**
    - Parent article must exist if parent_id provided
    - Parent article must belong to same user or be global
    - Name is required, max 255 characters
    - Type must be 'income' or 'expense'

    **Returns:**
    - 201 Created: Article created successfully
    - 403 Forbidden: Non-admin trying to create global article
    - 404 Not Found: Parent article not found
    """
    # Validate: Only admins can create global articles
    if article_data.is_global and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create global articles"
        )

    # Validate: Parent article must exist and be accessible
    if article_data.parent_id:
        parent_stmt = select(Article).where(
            Article.id == article_data.parent_id,
            Article.is_current == True  # noqa: E712
        )
        parent_result = await session.execute(parent_stmt)
        parent = parent_result.scalar_one_or_none()

        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent article with id={article_data.parent_id} not found"
            )

        # Parent must be global OR belong to same user
        if not parent.is_global and parent.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Parent article not accessible"
            )

    # Create new article
    article = Article(
        **article_data.model_dump(),
        user_id=None if article_data.is_global else get_user_id_for_create(current_user),
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    return article


@router.get(
    "",
    response_model=ArticleListResponse,
    responses=get_common_responses(include_400=True),
)
async def list_articles(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    limit: Annotated[int, Query(ge=1, le=1000)] = 100,
    offset: Annotated[int, Query(ge=0)] = 0,
    type_filter: Annotated[str | None, Query(alias="type")] = None,
    parent_id: Annotated[int | None, Query()] = None,
    include_global: Annotated[bool, Query()] = True,
) -> ArticleListResponse:
    """
    List articles with optional filtering.

    **User Isolation:**
    - Regular users see their own articles + global articles (if include_global=True)
    - Admins see all articles

    **Filters:**
    - type: Filter by article type ('income' or 'expense')
    - parent_id: Filter by parent article (NULL for root articles)
    - include_global: Include global articles (default: True)

    **Pagination:**
    - limit: Maximum number of results (1-1000, default: 100)
    - offset: Number of results to skip (default: 0)

    **Returns:**
    - 200 OK: List of articles with pagination info
    """
    # Base query: only current versions
    statement = select(Article).where(Article.is_current == True)  # noqa: E712

    # Apply filters
    if type_filter:
        if type_filter not in ["income", "expense"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="type must be 'income' or 'expense'"
            )
        statement = statement.where(Article.type == type_filter)

    if parent_id is not None:
        statement = statement.where(Article.parent_id == parent_id)

    # Apply user isolation
    if not current_user.is_admin:
        if include_global:
            # User's articles OR global articles
            statement = statement.where(
                (Article.user_id == current_user.id) | (Article.is_global == True)  # noqa: E712
            )
        else:
            # Only user's articles
            statement = statement.where(Article.user_id == current_user.id)
    # Admins see everything (no filter)

    # Count total (before pagination)
    from sqlalchemy import func
    count_stmt = select(func.count()).select_from(statement.subquery())
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Apply pagination
    statement = statement.limit(limit).offset(offset)

    # Execute query
    result = await session.execute(statement)
    articles = result.scalars().all()

    return ArticleListResponse(
        articles=articles,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get(
    "/{article_id}",
    response_model=ArticleResponse,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def get_article(
    article_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> Article:
    """
    Get a single article by ID.

    **User Isolation:**
    - User can access their own articles + global articles
    - Admins can access all articles

    **Returns:**
    - 200 OK: Article found
    - 403 Forbidden: Article belongs to another user (not global)
    - 404 Not Found: Article not found or not current
    """
    # Load article (current version only)
    statement = select(Article).where(
        Article.id == article_id,
        Article.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article with id={article_id} not found"
        )

    # Check access: own article OR global article OR admin
    if not current_user.is_admin:
        if not article.is_global and article.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this article"
            )

    return article


@router.put(
    "/{article_id}",
    response_model=ArticleResponse,
    responses=get_common_responses(include_400=True, include_403=True, include_404=True),
)
async def update_article(
    article_id: int,
    article_data: ArticleUpdate,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> Article:
    """
    Update an article (creates new SCD Type 2 version).

    **SCD Type 2 Behavior:**
    - Creates NEW version with is_current=True
    - Old version: is_current=False, valid_to=now()
    - New version: is_current=True, valid_from=now(), valid_to=9999-12-31

    **User Isolation:**
    - User can only update their own articles
    - Global articles can only be updated by admins
    - Admins can update any article

    **Validation:**
    - At least one field must be provided
    - Parent article must exist if parent_id changed
    - Cannot create cycles in hierarchy

    **Returns:**
    - 200 OK: Article updated (new version created)
    - 403 Forbidden: User doesn't own article
    - 404 Not Found: Article not found
    - 400 Bad Request: No fields provided for update
    """
    # Validate: At least one field provided
    update_data = article_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update"
        )

    # Load current version
    statement = select(Article).where(
        Article.id == article_id,
        Article.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    old_article = result.scalar_one_or_none()

    if not old_article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article with id={article_id} not found"
        )

    # Check ownership
    if old_article.is_global and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update global articles"
        )

    if not old_article.is_global:
        ensure_user_owns_resource(old_article.user_id, current_user)

    # Validate parent_id if changed
    if "parent_id" in update_data and update_data["parent_id"]:
        parent_stmt = select(Article).where(
            Article.id == update_data["parent_id"],
            Article.is_current == True  # noqa: E712
        )
        parent_result = await session.execute(parent_stmt)
        parent = parent_result.scalar_one_or_none()

        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent article with id={update_data['parent_id']} not found"
            )

        # Prevent setting self as parent
        if update_data["parent_id"] == article_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Article cannot be its own parent"
            )

    # Check if any fields actually changed
    changed, changed_fields = has_changes(old_article, update_data)
    if not changed:
        # No changes, return existing article
        return old_article

    # Create new version using SCD2 service
    new_article = await create_new_version(
        session=session,
        old_instance=old_article,
        updates=update_data,
        changed_fields=changed_fields,
    )

    return new_article


@router.delete(
    "/{article_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def delete_article(
    article_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> None:
    """
    Soft delete an article (sets is_current=False).

    **SCD Type 2 Behavior:**
    - Sets is_current=False
    - Sets valid_to=now()
    - Article still exists in database (soft delete)
    - Historical queries can still access it

    **User Isolation:**
    - User can only delete their own articles
    - Global articles can only be deleted by admins
    - Admins can delete any article

    **Cascade Behavior:**
    - Does NOT cascade to child articles
    - Child articles remain (orphaned)
    - Consider manual cascade if needed

    **Returns:**
    - 204 No Content: Article deleted successfully
    - 403 Forbidden: User doesn't own article
    - 404 Not Found: Article not found or already deleted
    """
    # Load current version
    statement = select(Article).where(
        Article.id == article_id,
        Article.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article with id={article_id} not found or already deleted"
        )

    # Check ownership
    if article.is_global and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete global articles"
        )

    if not article.is_global:
        ensure_user_owns_resource(article.user_id, current_user)

    # Soft delete
    now = datetime.utcnow()
    article.is_current = False
    article.valid_to = now
    article.updated_at = now

    await session.commit()

    return None


@router.get(
    "/{article_id}/subtree",
    response_model=ArticleListResponse,
    responses=get_common_responses(include_400=True, include_403=True, include_404=True),
)
async def get_article_subtree(
    article_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    max_depth: Annotated[int | None, Query(ge=0, le=10)] = None,
    include_self: Annotated[bool, Query()] = True,
) -> ArticleListResponse:
    """
    Get subtree of an article (all descendants).

    Uses closure table for efficient O(1) hierarchical query.

    **User Isolation:**
    - User can access subtree of their own articles + global articles
    - Admins can access any subtree

    **Parameters:**
    - max_depth: Maximum depth to traverse (0-10, None = unlimited)
    - include_self: Include root article in results (default: True)

    **Returns:**
    - 200 OK: List of articles in subtree (ordered by depth)
    - 403 Forbidden: Article not accessible
    - 404 Not Found: Article not found

    **Example:**
    ```
    GET /api/v1/articles/1/subtree?max_depth=2&include_self=true

    Returns: [Food, Groceries, Dining Out, Organic, Regular]
    ```

    **Use Cases:**
    - Display category tree
    - Calculate subtree budget totals
    - Find all articles under category
    """
    # Verify article exists and is accessible
    article = await get_article(article_id, current_user, session)

    # Get subtree using hierarchy service
    subtree_articles = await get_subtree(
        session=session,
        article_id=article_id,
        max_depth=max_depth,
        include_self=include_self,
    )

    # Filter by user isolation (already done by get_article, but double-check)
    if not current_user.is_admin:
        subtree_articles = [
            a for a in subtree_articles
            if a.is_global or a.user_id == current_user.id
        ]

    return ArticleListResponse(
        articles=subtree_articles,
        total=len(subtree_articles),
        limit=len(subtree_articles),
        offset=0,
    )


@router.get(
    "/{article_id}/ancestors",
    response_model=ArticleListResponse,
    responses=get_common_responses(include_403=True, include_404=True),
)
async def get_article_ancestors(
    article_id: int,
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
    include_self: Annotated[bool, Query()] = False,
) -> ArticleListResponse:
    """
    Get ancestors of an article (path to root).

    Uses closure table for efficient O(1) query.

    **User Isolation:**
    - User can access ancestors of their own articles + global articles
    - Admins can access any ancestors

    **Parameters:**
    - include_self: Include article itself in results (default: False)

    **Returns:**
    - 200 OK: List of ancestors (ordered root → article)
    - 403 Forbidden: Article not accessible
    - 404 Not Found: Article not found

    **Example:**
    ```
    GET /api/v1/articles/3/ancestors?include_self=true

    Returns: [Food, Groceries, Organic]  # Breadcrumb path
    ```

    **Use Cases:**
    - Breadcrumb navigation
    - Full category path display
    - Validate hierarchy constraints
    """
    # Verify article exists and is accessible
    article = await get_article(article_id, current_user, session)

    # Get ancestors using hierarchy service
    ancestor_articles = await get_ancestors(
        session=session,
        article_id=article_id,
        include_self=include_self,
    )

    # Filter by user isolation
    if not current_user.is_admin:
        ancestor_articles = [
            a for a in ancestor_articles
            if a.is_global or a.user_id == current_user.id
        ]

    return ArticleListResponse(
        articles=ancestor_articles,
        total=len(ancestor_articles),
        limit=len(ancestor_articles),
        offset=0,
    )
