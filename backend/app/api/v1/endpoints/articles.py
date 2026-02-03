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

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.dependencies import (
    CurrentUser,
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
    archive_recursive,
    get_ancestors,
    get_subtree,
    has_changes,
    restore_recursive,
)
from backend.app.services.article_service import (
    create_initial_history,
    update_article_profile,
)
from backend.app.services.cache_service import cache_service

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

    # Create new article (SCD Type 1 - no versioning fields)
    article = Article(
        **article_data.model_dump(),
        user_id=get_user_id_for_create(current_user),
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
    """
    List articles with optional filtering and sorting.

    **Shared References Architecture:**
    - All users see all articles (shared model)
    - No user isolation filtering

    **Filters:**
    - type: Filter by article type ('income', 'expense', 'debit', 'credit')
    - parent_id: Filter by parent article (NULL for root articles)
    - include_inactive: Include archived categories (default: False)
        - False: Only active categories (visible in dropdowns)
        - True: Include archived categories (for admin UI)
    - financial_center_id: Filter articles by financial center (whitelist pattern)
        - If provided: Returns articles with NO FC restrictions OR linked to this FC
        - If not provided: Returns all articles (no FC filtering)

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
    from backend.app.models.article_financial_center import ArticleFinancialCenter

    # Base query with LEFT JOIN to ArticleUsageStats
    # Returns: Row(Article, usage_count)
    statement = select(
        Article,
        func.coalesce(ArticleUsageStats.usage_count, 0).label("usage_count")
    ).outerjoin(
        ArticleUsageStats,
        Article.id == ArticleUsageStats.article_id
    )

    # Apply filters
    if type_filter:
        if type_filter not in ["income", "expense", "debit", "credit"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="type must be 'income', 'expense', 'debit', or 'credit'"
            )
        statement = statement.where(Article.type == type_filter)

    if parent_id is not None:
        statement = statement.where(Article.parent_id == parent_id)

    # Filter by active status (archived categories functionality)
    if not include_inactive:
        statement = statement.where(Article.is_active == True)  # noqa: E712

    # Filter by financial_center_id (whitelist pattern)
    # Articles with NO entries in t_article_financial_center = available for ALL FCs
    # Articles WITH entries = available ONLY for linked FCs
    if financial_center_id is not None:
        # Subquery: article IDs that have ANY FC restriction
        articles_with_fc_restrictions = select(
            ArticleFinancialCenter.article_id
        ).distinct()

        # Subquery: article IDs linked to the specified FC
        articles_linked_to_fc = select(
            ArticleFinancialCenter.article_id
        ).where(
            ArticleFinancialCenter.financial_center_id == financial_center_id
        )

        # Filter: article has NO restrictions OR is linked to this FC
        statement = statement.where(
            or_(
                Article.id.not_in(articles_with_fc_restrictions),
                Article.id.in_(articles_linked_to_fc)
            )
        )

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
    # Build separate count query to avoid cartesian product warning
    # Reuse same WHERE conditions but without JOIN and ORDER BY
    count_stmt = select(func.count(Article.id))

    # Apply same filters as main query
    if type_filter:
        count_stmt = count_stmt.where(Article.type == type_filter)

    if parent_id is not None:
        count_stmt = count_stmt.where(Article.parent_id == parent_id)

    if not include_inactive:
        count_stmt = count_stmt.where(Article.is_active == True)  # noqa: E712

    # Apply financial_center_id filter to count query as well
    if financial_center_id is not None:
        articles_with_fc_restrictions = select(
            ArticleFinancialCenter.article_id
        ).distinct()

        articles_linked_to_fc = select(
            ArticleFinancialCenter.article_id
        ).where(
            ArticleFinancialCenter.financial_center_id == financial_center_id
        )

        count_stmt = count_stmt.where(
            or_(
                Article.id.not_in(articles_with_fc_restrictions),
                Article.id.in_(articles_linked_to_fc)
            )
        )

    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    # Apply pagination
    statement = statement.limit(limit).offset(offset)

    # Execute query
    result = await session.execute(statement)
    rows = result.all()  # Returns list of Row(Article, usage_count)

    # Get all article IDs that are used as parent_id (for is_leaf calculation)
    # An article is a leaf if it has NO children (i.e., not used as parent_id)
    parent_ids_query = select(Article.parent_id).where(
        Article.parent_id.isnot(None)
    ).distinct()
    parent_ids_result = await session.execute(parent_ids_query)
    parent_ids = {row[0] for row in parent_ids_result.all()}

    # Build ArticleResponse with usage_count and is_leaf
    from backend.app.schemas.article import ArticleResponse
    articles_with_usage = []
    for row in rows:
        article = row[0]  # Article object
        usage_count = row[1]  # int (from COALESCE)

        # Create ArticleResponse from Article and add usage_count + is_leaf
        article_dict = {
            **article.model_dump(),
            "usage_count": usage_count,
            "is_leaf": article.id not in parent_ids,  # Calculate from DB, not filtered list
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
    """
    Update an article (in-place update with history tracking).

    **SCD Type 1 + History Behavior:**
    - Updates article IN-PLACE (id remains stable)
    - Creates ArticleHistory snapshot (SCD Type 2 for audit)
    - FK in fact tables remain unchanged

    **Archived Categories (is_active field):**
    - is_active changes are processed SEPARATELY from regular updates
    - Changing is_active triggers RECURSIVE archive/restore:
        - is_active=False: Archives article and ALL descendants
        - is_active=True: Restores article and ALL descendants
    - Does NOT create history record if ONLY is_active changes
    - If is_active + other fields change: both operations execute

    **Shared References Architecture:**
    - All authenticated users can update articles
    - All articles are shared across all users

    **Validation:**
    - At least one field must be provided
    - Parent article must exist if parent_id changed
    - Cannot create cycles in hierarchy

    **Returns:**
    - 200 OK: Article updated (in-place update with history)
    - 404 Not Found: Article not found
    - 400 Bad Request: No fields provided for update
    """
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[UPDATE_ARTICLE] ENTRY: article_id={article_id}")

    # Validate: At least one field provided
    update_data = article_data.model_dump(exclude_unset=True)
    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="At least one field must be provided for update"
        )

    # Load article
    statement = select(Article).where(
        Article.id == article_id
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
            Article.id == update_data["parent_id"]
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
        logger.info("[ARTICLE UPDATE] No changes detected, returning old article")
        return old_article

    # Handle is_active changes separately (archiving/restoring)
    # is_active changes should NOT trigger SCD Type 2 versioning
    # Instead, they trigger recursive archive/restore operations
    is_active_change = None
    if "is_active" in update_data and "is_active" in changed_fields:
        new_is_active = update_data["is_active"]
        is_active_change = new_is_active  # Store for later processing

        # Remove is_active from update_data - will be handled separately
        del update_data["is_active"]
        changed_fields = [f for f in changed_fields if f != "is_active"]

        logger.info(f"[ARTICLE UPDATE] Detected is_active change: {old_article.is_active} -> {new_is_active}")

    # Check if there are any remaining fields to update (after removing is_active)
    has_other_changes = len(update_data) > 0

    # Process is_active change (recursive archive/restore)
    if is_active_change is not None:
        if is_active_change is False:
            # Archive article and all descendants
            logger.info(f"[ARTICLE UPDATE] Archiving article {article_id} and all descendants")
            archived_count = await archive_recursive(session, article_id, changed_by_user_id=current_user.id)
            logger.info(f"[ARTICLE UPDATE] Archived {archived_count} articles")
        else:
            # Restore article and all descendants
            logger.info(f"[ARTICLE UPDATE] Restoring article {article_id} and all descendants")
            restored_count = await restore_recursive(session, article_id, changed_by_user_id=current_user.id)
            logger.info(f"[ARTICLE UPDATE] Restored {restored_count} articles")

        # Refresh old_article to get updated is_active status
        await session.refresh(old_article)

    # If there are other fields to update, use SCD Type 1 + create history
    if has_other_changes:
        logger.info(f"[ARTICLE UPDATE] Calling update_article_profile for article_id={article_id}")
        updated_article = await update_article_profile(
            session=session,
            article=old_article,
            updates=update_data,
            changed_by_user_id=current_user.id,
            change_type="UPDATE",
        )
        logger.info(f"[ARTICLE UPDATE] Updated article (SCD1+History): id={article_id}")
        # Invalidate articles cache
        await cache_service.invalidate_articles()
        return updated_article
    else:
        # Only is_active was changed, return updated article (no history record needed - already done by archive/restore)
        logger.info("[ARTICLE UPDATE] Only is_active changed, returning updated article")
        # Invalidate articles cache (is_active change affects listing)
        await cache_service.invalidate_articles()
        return old_article


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
