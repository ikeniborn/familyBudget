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

import logging
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import (
    CurrentUser,
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
    get_ancestors,
    get_subtree,
    has_changes,
)
from backend.app.services.article_service import (
    build_article_responses,
    create_initial_history,
    execute_article_list_query,
    extract_is_active_change,
    handle_is_active_change,
    prepare_article_update,
    update_article_profile,
    update_financial_center_links,
)
from backend.app.services.cache_service import cache_service
from backend.app.utils.code_generator import generate_code

logger = logging.getLogger(__name__)

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
    - All authenticated users can create articles
    - Article is created with current user as creator (audit trail)

    **Validation:**
    - Parent article must exist if parent_id provided
    - Name is required, max 255 characters
    - Type must be 'income' or 'expense'

    **Returns:**
    - 201 Created: Article created successfully
    - 404 Not Found: Parent article not found
    """

    # Validate: Parent article must exist and be accessible
    if article_data.parent_id:
        parent_stmt = select(Article).where(
            Article.id == article_data.parent_id
        )
        parent_result = await session.execute(parent_stmt)
        parent = parent_result.scalar_one_or_none()

        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent article with id={article_data.parent_id} not found"
            )

    # Generate code for article (natural key, auto-generated, immutable after creation)
    generated_code = await generate_code(session, Article)

    # Create new article (SCD Type 1 - no versioning fields)
    # financial_center_ids is handled separately (M2M relation, not a model field)
    article = Article(
        **article_data.model_dump(exclude={"financial_center_ids"}),
        user_id=get_user_id_for_create(current_user),
        code=generated_code,
    )

    session.add(article)
    await session.commit()
    await session.refresh(article)

    # Create initial history record (SCD Type 2 for history)
    await create_initial_history(session=session, article=article, change_type="CREATE")

    # Invalidate articles cache
    await cache_service.invalidate_articles()

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
    include_inactive: Annotated[bool, Query()] = False,
    financial_center_id: Annotated[int | None, Query(
        description="Filter articles by financial center ID. "
                    "Returns articles with NO FC restrictions OR linked to this specific FC."
    )] = None,
) -> ArticleListResponse:
    """List articles with filtering (type, parent_id, is_active, financial_center_id), sorting (usage_count/name) and pagination."""
    if type_filter and type_filter not in ["income", "expense", "debit", "credit"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="type must be 'income', 'expense', 'debit', or 'credit'"
        )

    rows, total = await execute_article_list_query(
        session, type_filter, parent_id, include_inactive, financial_center_id, sort_by, limit, offset
    )
    articles_with_usage = await build_article_responses(session, rows)

    return ArticleListResponse(articles=articles_with_usage, total=total, limit=limit, offset=offset)


@router.get(
    "/hierarchy",
    response_model=list[dict],
    responses=get_common_responses(include_403=True),
)
async def get_article_hierarchy(
    current_user: CurrentUser,
    session: AsyncSession = Depends(get_session),
) -> list[dict]:
    """
    Get article hierarchy closure table.

    Returns ALL ancestor-descendant paths for articles accessible to the user.
    Used for offline Dexie sync.

    **Returns:**
    - Array of hierarchy records: [{ ancestor_id, descendant_id, depth }, ...]

    **Access Control:**
    - Regular users: All hierarchy paths (articles are shared across users)
    - Admin bypass: Not needed (hierarchy is global)
    """
    from backend.app.models.hierarchy import ArticleHierarchy

    # Query all hierarchy records (closure table)
    stmt = select(ArticleHierarchy).order_by(
        ArticleHierarchy.ancestor_id,
        ArticleHierarchy.depth
    )
    result = await session.execute(stmt)
    hierarchy_records = result.scalars().all()

    # Convert to simple dict format for frontend
    hierarchy_list = [
        {
            "ancestor_id": record.ancestor_id,
            "descendant_id": record.descendant_id,
            "depth": record.depth
        }
        for record in hierarchy_records
    ]

    return hierarchy_list


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
    - 404 Not Found: Article not found
    """
    # Load article
    statement = select(Article).where(
        Article.id == article_id
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
    """Update an article in-place (SCD Type 1) with history tracking and recursive archive/restore."""
    logger.info("[UPDATE_ARTICLE] ENTRY: article_id=%s", article_id)

    old_article, update_data, financial_center_ids = await prepare_article_update(
        session, article_id, article_data, current_user
    )

    changed, changed_fields = has_changes(old_article, update_data)
    logger.info("[ARTICLE UPDATE] article_id=%s, changed=%s, changed_fields=%s", article_id, changed, changed_fields)

    if not changed and financial_center_ids is None:
        return old_article

    is_active_change = extract_is_active_change(update_data, changed_fields)

    if is_active_change is not None:
        await handle_is_active_change(session, article_id, is_active_change, current_user.id)
        await session.refresh(old_article)

    if update_data:
        result_article = await update_article_profile(
            session=session, article=old_article, updates=update_data,
            changed_by_user_id=current_user.id, change_type="UPDATE",
        )
    else:
        result_article = old_article

    if financial_center_ids is not None:
        await update_financial_center_links(session, article_id, financial_center_ids)
        await session.refresh(result_article)

    await cache_service.invalidate_articles()
    return result_article


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
    Soft delete an article (sets is_active=False).

    **SCD Type 1 Behavior:**
    - Sets is_active=False (archived)
    - Article still exists in database (soft delete)
    - Historical queries can still access it via ArticleHistory

    **Shared References Architecture:**
    - Only administrators can delete articles
    - All articles are shared across all users

    **Cascade Behavior:**
    - Uses archive_recursive() to archive child articles too
    - All descendants are archived (is_active=False)

    **Returns:**
    - 204 No Content: Article deleted successfully
    - 403 Forbidden: Non-admin trying to delete
    - 404 Not Found: Article not found
    """
    # Check: Only admins can delete articles
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete articles"
        )

    # Load article
    statement = select(Article).where(
        Article.id == article_id
    )
    result = await session.execute(statement)
    article = result.scalar_one_or_none()

    if not article:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Article with id={article_id} not found"
        )

    # Soft delete: archive article and all descendants
    await archive_recursive(session, article_id, changed_by_user_id=current_user.id)

    # Invalidate articles cache
    await cache_service.invalidate_articles()

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
    await get_article(article_id, current_user, session)

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
    await get_article(article_id, current_user, session)

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
