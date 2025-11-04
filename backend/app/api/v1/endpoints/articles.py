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
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import (
    CurrentUser,
    apply_user_filter,
    ensure_user_owns_resource,
    get_session,
    get_user_id_for_create,
)
from backend.app.models.article import Article, ArticleUsageStats
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

    **Shared References Architecture:**
    - All articles are shared across all users
    - Only administrators can create articles
    - Article is created with current user as creator (audit trail)

    **Validation:**
    - Parent article must exist if parent_id provided
    - Name is required, max 255 characters
    - Type must be 'income' or 'expense'

    **Returns:**
    - 201 Created: Article created successfully
    - 403 Forbidden: Non-admin trying to create OR parent article not found
    - 404 Not Found: Parent article not found
    """

    # Check: Only admins can create articles
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create articles"
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

    # Create new article
    article = Article(
        **article_data.model_dump(),
        user_id=get_user_id_for_create(current_user),
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
    sort_by: Annotated[Literal["usage_count", "name"], Query()] = "usage_count",
) -> ArticleListResponse:
    """
    List articles with optional filtering and sorting.

    **Shared References Architecture:**
    - All users see all articles (shared model)
    - No user isolation filtering

    **Filters:**
    - type: Filter by article type ('income' or 'expense')
    - parent_id: Filter by parent article (NULL for root articles)

    **Sorting:**
    - sort_by: Sort order ('usage_count' or 'name', default: 'usage_count')
        - usage_count: Most used categories first (DESC), then by name (ASC)
        - name: Alphabetical order (ASC)

    **Pagination:**
    - limit: Maximum number of results (1-1000, default: 100)
    - offset: Number of results to skip (default: 0)

    **Returns:**
    - 200 OK: List of articles with pagination info and usage statistics
    """
    # Base query with LEFT JOIN to ArticleUsageStats
    # Returns: Row(Article, usage_count)
    statement = select(
        Article,
        func.coalesce(ArticleUsageStats.usage_count, 0).label("usage_count")
    ).outerjoin(
        ArticleUsageStats,
        Article.id == ArticleUsageStats.article_id
    ).where(Article.is_current == True)  # noqa: E712

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

    # NO user isolation - all users see all articles (shared references)

    # Apply sorting
    if sort_by == "usage_count":
        # Sort by usage_count DESC (most used first), then by name ASC
        statement = statement.order_by(
            func.coalesce(ArticleUsageStats.usage_count, 0).desc(),
            Article.name.asc()
        )
    else:  # sort_by == "name"
        # Sort alphabetically
        statement = statement.order_by(Article.name.asc())

    # Count total (before pagination)
    # Need to count distinct articles (not rows with joins)
    count_stmt = select(func.count(func.distinct(Article.id))).select_from(
        statement.subquery()
    )
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Apply pagination
    statement = statement.limit(limit).offset(offset)

    # Execute query
    result = await session.execute(statement)
    rows = result.all()  # Returns list of Row(Article, usage_count)

    # Build ArticleResponse with usage_count
    from backend.app.schemas.article import ArticleResponse
    articles_with_usage = []
    for row in rows:
        article = row[0]  # Article object
        usage_count = row[1]  # int (from COALESCE)

        # Create ArticleResponse from Article and add usage_count
        article_dict = {
            **article.model_dump(),
            "usage_count": usage_count
        }
        article_response = ArticleResponse.model_validate(article_dict)
        articles_with_usage.append(article_response)

    return ArticleListResponse(
        articles=articles_with_usage,
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

    **Shared References Architecture:**
    - All users can access all articles (shared model)
    - No access restrictions

    **Returns:**
    - 200 OK: Article found
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

    # NO access restrictions - all users can read all articles

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

    **Shared References Architecture:**
    - Only administrators can update articles
    - All articles are shared across all users

    **Validation:**
    - At least one field must be provided
    - Parent article must exist if parent_id changed
    - Cannot create cycles in hierarchy

    **Returns:**
    - 200 OK: Article updated (new version created)
    - 403 Forbidden: Non-admin trying to update
    - 404 Not Found: Article not found
    - 400 Bad Request: No fields provided for update
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[UPDATE_ARTICLE] ENTRY: article_id={article_id}")

    # Check: Only admins can update articles
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update articles"
        )

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

    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[ARTICLE UPDATE] article_id={article_id}, changed={changed}, changed_fields={changed_fields}, update_data={update_data}")

    if not changed:
        # No changes, return existing article
        logger.info(f"[ARTICLE UPDATE] No changes detected, returning old article")
        return old_article

    # Create new version using SCD2 service
    logger.info(f"[ARTICLE UPDATE] Calling create_new_version for article_id={article_id}")
    new_article = await create_new_version(
        session=session,
        old_instance=old_article,
        updates=update_data,
        changed_fields=changed_fields,
    )
    logger.info(f"[ARTICLE UPDATE] Created new version: old_id={article_id}, new_id={new_article.id}")

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

    **Shared References Architecture:**
    - Only administrators can delete articles
    - All articles are shared across all users

    **Cascade Behavior:**
    - Does NOT cascade to child articles
    - Child articles remain (orphaned)
    - Consider manual cascade if needed

    **Returns:**
    - 204 No Content: Article deleted successfully
    - 403 Forbidden: Non-admin trying to delete
    - 404 Not Found: Article not found or already deleted
    """
    # Check: Only admins can delete articles
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete articles"
        )

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

    **Shared References Architecture:**
    - All users can access all article subtrees (shared model)

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

    # NO filtering - all users see all articles (shared references)

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

    **Shared References Architecture:**
    - All users can access all article ancestors (shared model)

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

    # NO filtering - all users see all articles (shared references)

    return ArticleListResponse(
        articles=ancestor_articles,
        total=len(ancestor_articles),
        limit=len(ancestor_articles),
        offset=0,
    )
