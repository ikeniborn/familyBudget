"""
Article Service Layer (Hybrid: SCD Type 1 + History SCD Type 2).

This module manages Article table updates with hybrid approach:
- Main table (t_d_article): SCD Type 1 (in-place updates, NO versioning)
- History table (t_d_article_history): SCD Type 2 (full change tracking)

This differs from generic scd2_service.py:
- Article updates are in-place (no new id generated)
- History is stored in separate ArticleHistory table
- FK in fact tables remain stable (no updates needed)

Key Functions:
    - update_article_profile(): Update Article (SCD1) + create ArticleHistory snapshot (SCD2)
    - get_article_history(): Get full change history from ArticleHistory table
    - get_article_version_at_date(): Time-travel query to ArticleHistory
    - create_initial_history(): Create initial history record for new article
"""

import logging
from datetime import date, datetime, timezone
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import delete, func
from sqlalchemy.sql import Select
from sqlmodel import or_, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article, ArticleUsageStats
from backend.app.models.article_financial_center import ArticleFinancialCenter
from backend.app.models.article_history import ArticleHistory
from backend.app.models.user import User
from backend.app.schemas.article import ArticleResponse

logger = logging.getLogger(__name__)

# Far future datetime constant for SCD Type 2 valid_to field
# Uses timezone-aware UTC to prevent asyncpg year overflow issues
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


async def update_article_profile(
    session: AsyncSession,
    article: Article,
    updates: dict[str, Any],
    changed_by_user_id: int | None = None,
    change_type: str = "UPDATE",
    auto_commit: bool = True,
) -> Article:
    """
    Update Article with SCD Type 1 + create ArticleHistory snapshot (SCD Type 2).

    This function implements hybrid approach:
    1. Close old ArticleHistory version (is_current=False, set valid_to)
    2. Update Article table in-place (SCD1 - no new version, stable id)
    3. Create new ArticleHistory version (is_current=True, snapshot all fields)

    Args:
        session: AsyncSession for database operations
        article: Current Article instance to update
        updates: Dictionary of field updates (e.g., {"name": "Updated Name", "description": "New desc"})
        changed_by_user_id: Optional user ID who made the change (for audit)
        change_type: Type of change (UPDATE/ARCHIVE/RESTORE/etc.)
        auto_commit: Whether to commit after update (default True for backwards compatibility).
                     Set to False when doing bulk/cascade updates to avoid session state issues.

    Returns:
        Updated Article instance (same id, refreshed from DB if auto_commit=True)

    Example:
        >>> article = await session.get(Article, 1)
        >>> updated_article = await update_article_profile(
        ...     session=session,
        ...     article=article,
        ...     updates={"name": "Food & Drinks", "description": "Updated category"},
        ...     changed_by_user_id=2,
        ...     change_type="UPDATE"
        ... )

    Notes:
        - Article.id NEVER changes (stable FK for fact tables)
        - ArticleHistory stores FULL snapshots with all fields (including parent_id, type)
        - changed_fields automatically detected by comparing old vs new values
        - Use change_type to categorize changes (UPDATE/ARCHIVE/RESTORE)
        - For cascade updates, use auto_commit=False and commit once at the end
    """
    now = datetime.utcnow()

    # Step 1: Detect changed fields (for audit trail)
    changed_fields = []
    for key, new_value in updates.items():
        old_value = getattr(article, key, None)
        if old_value != new_value:
            changed_fields.append(key)

    # Optimization: if no fields changed, return existing article (no history record)
    if not changed_fields:
        return article

    # Step 2: Close old ArticleHistory version (set is_current=False, valid_to=now)
    # Find current history version (should exist from previous update or CREATE)
    statement = select(ArticleHistory).where(
        ArticleHistory.article_id == article.id,
        ArticleHistory.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    old_history = result.scalar_one_or_none()

    if old_history:
        # Close old version
        old_history.is_current = False
        old_history.valid_to = now
        session.add(old_history)

    # Step 3: Update Article table in-place (SCD1 - no new version)
    for key, value in updates.items():
        setattr(article, key, value)

    article.updated_at = now
    session.add(article)

    # Step 4: Create new ArticleHistory snapshot (SCD2 - all fields)
    new_history = ArticleHistory(
        article_id=article.id,  # FK to stable Article.id
        user_id=article.user_id,
        parent_id=article.parent_id,
        name=article.name,
        description=article.description,
        type=article.type,
        code=article.code,
        is_active=article.is_active,
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=True,
        change_type=change_type,
        changed_fields=changed_fields,
        changed_by_user_id=changed_by_user_id,
    )
    session.add(new_history)

    # Step 5: Commit atomically (if auto_commit enabled)
    if auto_commit:
        await session.commit()
        await session.refresh(article)

    return article


async def get_article_history(
    session: AsyncSession,
    article_id: int,
) -> list[ArticleHistory]:
    """
    Get full change history for an article from ArticleHistory table.

    Returns all ArticleHistory versions (is_current=True and False) ordered by
    valid_from DESC (newest first).

    Args:
        session: AsyncSession for database operations
        article_id: Article.id to get history for

    Returns:
        List of ArticleHistory versions ordered by valid_from DESC (newest first)

    Example:
        >>> history = await get_article_history(session=session, article_id=1)
        >>> for version in history:
        ...     print(f"{version.valid_from}: {version.name}, type={version.type}")
        ...     print(f"  Changed: {version.changed_fields}, by user_id={version.changed_by_user_id}")

    Notes:
        - Includes both current (is_current=True) and closed versions
        - Ordered newest first (valid_from DESC)
        - Each version is a full snapshot of article data at that time
        - Use for audit trail and GET /articles/{id}/history endpoint
    """
    statement = (
        select(ArticleHistory)
        .where(ArticleHistory.article_id == article_id)
        .order_by(ArticleHistory.valid_from.desc())
    )

    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_article_version_at_date(
    session: AsyncSession,
    article_id: int,
    target_date: date,
) -> ArticleHistory | None:
    """
    Get Article version that was active at a specific date (time-travel query).

    Queries ArticleHistory for version where:
    - article_id matches
    - valid_from <= target_date
    - valid_to > target_date

    Args:
        session: AsyncSession for database operations
        article_id: Article.id to query
        target_date: Date to query (as of date)

    Returns:
        ArticleHistory version active at target_date or None if not found

    Example:
        >>> # Get article's name as of January 1, 2025
        >>> version = await get_article_version_at_date(
        ...     session=session,
        ...     article_id=1,
        ...     target_date=date(2025, 1, 1)
        ... )
        >>> if version:
        ...     print(f"On {target_date}, article was named: {version.name}")

    Notes:
        - Uses valid_from and valid_to for time-travel query
        - Useful for historical reporting (e.g., "what was category name on specific date?")
        - Returns None if article didn't exist at target_date
        - Target_date converted to datetime for comparison
    """
    # Convert date to datetime for comparison
    target_datetime = datetime.combine(target_date, datetime.min.time())

    statement = select(ArticleHistory).where(
        ArticleHistory.article_id == article_id,
        ArticleHistory.valid_from <= target_datetime,
        ArticleHistory.valid_to > target_datetime,
    )

    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_initial_history(
    session: AsyncSession,
    article: Article,
    change_type: str = "CREATE",
) -> ArticleHistory:
    """
    Create initial ArticleHistory record when article is first created.

    This should be called immediately after creating new Article.

    Args:
        session: AsyncSession for database operations
        article: Newly created Article instance
        change_type: Type of change (typically "CREATE")

    Returns:
        Created ArticleHistory instance

    Example:
        >>> # After creating new article
        >>> article = Article(user_id=1, name="Food", type="expense", ...)
        >>> session.add(article)
        >>> await session.commit()
        >>> await session.refresh(article)
        >>> history = await create_initial_history(session=session, article=article)

    Notes:
        - Creates first history snapshot with is_current=True
        - changed_fields is None for initial creation (no previous version)
        - changed_by_user_id is None (automatic creation)
    """
    now = datetime.utcnow()

    history = ArticleHistory(
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
        is_current=True,
        change_type=change_type,
        changed_fields=None,  # Initial creation - no previous version
        changed_by_user_id=None,  # Automatic creation
    )
    session.add(history)
    await session.commit()
    await session.refresh(history)

    return history


# ── Article query / update helpers ──────────────────────────────────────────


async def handle_is_active_change(
    session: AsyncSession,
    article_id: int,
    is_active: bool,
    changed_by_user_id: int | None,
) -> None:
    """Process recursive archive/restore when is_active changes."""
    from backend.app.services import archive_recursive, restore_recursive
    if is_active is False:
        logger.info("[ARTICLE UPDATE] Archiving article %s and all descendants", article_id)
        archived_count = await archive_recursive(session, article_id, changed_by_user_id=changed_by_user_id)
        logger.info("[ARTICLE UPDATE] Archived %s articles", archived_count)
    else:
        logger.info("[ARTICLE UPDATE] Restoring article %s and all descendants", article_id)
        restored_count = await restore_recursive(session, article_id, changed_by_user_id=changed_by_user_id)
        logger.info("[ARTICLE UPDATE] Restored %s articles", restored_count)


async def update_financial_center_links(
    session: AsyncSession,
    article_id: int,
    financial_center_ids: list[int],
) -> None:
    """Replace M2M financial center links for an article."""
    logger.info("[UPDATE_ARTICLE] Updating financial center links for article_id=%s", article_id)

    delete_stmt = delete(ArticleFinancialCenter).where(
        ArticleFinancialCenter.article_id == article_id
    )
    await session.execute(delete_stmt)
    logger.info("[UPDATE_ARTICLE] Deleted existing FC links")

    if financial_center_ids:
        for fc_id in financial_center_ids:
            link = ArticleFinancialCenter(
                article_id=article_id,
                financial_center_id=fc_id
            )
            session.add(link)
        logger.info("[UPDATE_ARTICLE] Created %s new FC links", len(financial_center_ids))
    else:
        logger.info("[UPDATE_ARTICLE] Cleared all FC links (available for all FCs)")

    await session.commit()


def apply_article_filters(
    statement: Select,
    type_filter: str | None,
    parent_id: int | None,
    include_inactive: bool,
    financial_center_id: int | None,
) -> Select:
    """Apply shared filter conditions to a query (main or count)."""
    if type_filter:
        statement = statement.where(Article.type == type_filter)

    if parent_id is not None:
        statement = statement.where(Article.parent_id == parent_id)

    if not include_inactive:
        statement = statement.where(Article.is_active == True)  # noqa: E712

    if financial_center_id is not None:
        articles_with_fc_restrictions = select(
            ArticleFinancialCenter.article_id
        ).distinct()
        articles_linked_to_fc = select(
            ArticleFinancialCenter.article_id
        ).where(
            ArticleFinancialCenter.financial_center_id == financial_center_id
        )
        statement = statement.where(
            or_(
                Article.id.not_in(articles_with_fc_restrictions),
                Article.id.in_(articles_linked_to_fc)
            )
        )

    return statement


async def execute_article_list_query(
    session: AsyncSession,
    type_filter: str | None,
    parent_id: int | None,
    include_inactive: bool,
    financial_center_id: int | None,
    sort_by: str,
    limit: int,
    offset: int,
) -> tuple[list, int]:
    """Build, filter, sort and execute article list query. Returns (rows, total)."""
    statement = select(
        Article,
        func.coalesce(ArticleUsageStats.usage_count, 0).label("usage_count")
    ).outerjoin(ArticleUsageStats, Article.id == ArticleUsageStats.article_id)

    statement = apply_article_filters(statement, type_filter, parent_id, include_inactive, financial_center_id)

    if sort_by == "usage_count":
        statement = statement.order_by(func.coalesce(ArticleUsageStats.usage_count, 0).desc(), Article.name.asc())
    else:
        statement = statement.order_by(Article.name.asc())

    count_stmt = apply_article_filters(
        select(func.count(Article.id)), type_filter, parent_id, include_inactive, financial_center_id
    )
    total_result = await session.execute(count_stmt)
    total = total_result.scalar_one()

    result = await session.execute(statement.limit(limit).offset(offset))
    return result.all(), total


async def build_article_responses(
    session: AsyncSession, rows: list
) -> list[ArticleResponse]:
    """Build ArticleResponse list with usage_count and is_leaf from query rows."""
    parent_ids_query = select(Article.parent_id).where(
        Article.parent_id.isnot(None)
    ).distinct()
    parent_ids_result = await session.execute(parent_ids_query)
    parent_ids = {row[0] for row in parent_ids_result.all()}

    articles = []
    for row in rows:
        article = row[0]
        usage_count = row[1]
        article_dict = {
            **article.model_dump(),
            "usage_count": usage_count,
            "is_leaf": article.id not in parent_ids,
        }
        articles.append(ArticleResponse.model_validate(article_dict))
    return articles


async def validate_parent_id(session: AsyncSession, parent_id: int, article_id: int) -> None:
    """Validate parent_id: must exist and not be self."""
    parent_stmt = select(Article).where(Article.id == parent_id)
    parent_result = await session.execute(parent_stmt)
    if not parent_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Parent article with id={parent_id} not found"
        )
    if parent_id == article_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Article cannot be its own parent"
        )


async def prepare_article_update(
    session: AsyncSession, article_id: int, article_data: Any, current_user: User
) -> tuple[Article, dict, list[int] | None]:
    """Validate admin, parse update_data, load article, validate parent_id."""
    if not current_user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only administrators can update articles")

    update_data = article_data.model_dump(exclude_unset=True)
    financial_center_ids = update_data.pop('financial_center_ids', None)

    if not update_data and financial_center_ids is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one field must be provided for update")

    statement = select(Article).where(Article.id == article_id)
    result = await session.execute(statement)
    old_article = result.scalar_one_or_none()

    if not old_article:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Article with id={article_id} not found")

    if "parent_id" in update_data and update_data["parent_id"]:
        await validate_parent_id(session, update_data["parent_id"], article_id)

    return old_article, update_data, financial_center_ids


def extract_is_active_change(update_data: dict, changed_fields: list[str]) -> bool | None:
    """Extract and remove is_active from update_data if changed. Returns new is_active value or None."""
    if "is_active" not in update_data or "is_active" not in changed_fields:
        return None
    is_active_change = update_data.pop("is_active")
    changed_fields[:] = [f for f in changed_fields if f != "is_active"]
    return is_active_change
