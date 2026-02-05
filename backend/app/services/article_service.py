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

from datetime import date, datetime, timezone
from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.article_history import ArticleHistory

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
