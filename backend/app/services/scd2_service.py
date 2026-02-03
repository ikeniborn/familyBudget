"""
SCD Type 2 (Slowly Changing Dimension Type 2) Service Layer.

This module provides reusable functions for managing SCD Type 2 versioning
across different models (User, Article, etc.).

SCD Type 2 Pattern:
    - Each update creates a NEW version with is_current=True
    - Old version: is_current=False, valid_to=now()
    - New version: is_current=True, valid_from=now(), valid_to=9999-12-31
    - Preserves complete audit trail

Key Functions:
    - create_new_version(): Generic version creation
    - get_current_version(): Query current version
    - get_version_at_date(): Query historical version
    - get_history(): Get all versions ordered by valid_from
"""

from datetime import date, datetime, timezone
from typing import Any, TypeVar, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.article import Article
from backend.app.models.user import User

# Far future datetime constant for SCD Type 2 valid_to field
# Uses timezone-aware UTC to prevent asyncpg year overflow issues
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)

# Generic type for SCD2 models
T = TypeVar("T", Article, User)


async def create_new_version(
    session: AsyncSession,
    old_instance: T,
    updates: dict[str, Any],
    changed_fields: Optional[list[str]] = None,
    changed_by_user_id: Optional[int] = None,
) -> T:
    """
    Create new SCD Type 2 version by closing old version and creating new one.

    This is the core SCD Type 2 function that:
    1. Closes old version (is_current=False, valid_to=now)
    2. Creates new version with updated fields
    3. Commits atomically

    Args:
        session: AsyncSession for database operations
        old_instance: Current version of the entity to update
        updates: Dictionary of field updates to apply to new version
        changed_fields: Optional list of fields that actually changed
                       (for optimization - if None, creates new version anyway)
        changed_by_user_id: Optional user ID who initiated the change
                           (stored in version link table for audit trail)

    Returns:
        New version instance with is_current=True

    Raises:
        IntegrityError: If database constraint violation occurs
        ValueError: If old_instance is not current version

    Example:
        >>> old_article = await session.get(Article, 1)
        >>> new_article = await create_new_version(
        ...     session=session,
        ...     old_instance=old_article,
        ...     updates={"name": "New Name", "type": "expense"},
        ...     changed_fields=["name", "type"]
        ... )

    Notes:
        - Preserves original created_at timestamp
        - Sets updated_at to current time
        - Maintains atomic transaction
        - Refreshes new instance after commit
    """
    # Validation: ensure we're updating a current version
    if not old_instance.is_current:
        raise ValueError(
            f"Cannot create new version: instance is not current "
            f"(is_current={old_instance.is_current})"
        )

    # Optimization: if no fields changed, return existing version
    if changed_fields is not None and len(changed_fields) == 0:
        return old_instance

    # Get current timestamp
    now = datetime.utcnow()

    # Save old instance ID before any modifications (for Article children update)
    old_instance_id = old_instance.id

    # Step 1: Close old version
    old_instance.is_current = False
    old_instance.valid_to = now
    old_instance.updated_at = now

    # Step 2: Prepare new version data
    # Start with all fields from old instance
    new_data = {
        column.key: getattr(old_instance, column.key)
        for column in old_instance.__table__.columns
        if column.key not in ("id",)  # Exclude primary key (will be auto-generated)
    }

    # Apply updates
    new_data.update(updates)

    # Set SCD Type 2 fields
    new_data["is_current"] = True
    new_data["valid_from"] = now
    new_data["valid_to"] = FAR_FUTURE_DATETIME
    new_data["updated_at"] = now

    # Preserve original creation timestamp
    new_data["created_at"] = old_instance.created_at

    # Step 3: Create new version instance
    model_class = type(old_instance)
    new_instance = model_class(**new_data)

    # Step 4: Add to session and commit atomically
    session.add(new_instance)
    await session.commit()
    await session.refresh(new_instance)

    # Step 4.5: Create version link record for audit trail
    # Lazy imports to avoid circular dependencies
    from backend.app.models.cost_center import CostCenter
    from backend.app.models.financial_center import FinancialCenter
    from backend.app.models.version_link import (
        ArticleVersionLink,
        CostCenterVersionLink,
        FinancialCenterVersionLink,
    )

    link_record = None

    if isinstance(new_instance, Article):
        link_record = ArticleVersionLink(
            old_article_id=old_instance_id,
            new_article_id=new_instance.id,
            created_at=now,
            changed_by_user_id=changed_by_user_id,
            changed_fields=changed_fields,
        )
    elif isinstance(new_instance, FinancialCenter):
        link_record = FinancialCenterVersionLink(
            old_fc_id=old_instance_id,
            new_fc_id=new_instance.id,
            created_at=now,
            changed_by_user_id=changed_by_user_id,
            changed_fields=changed_fields,
        )
    elif isinstance(new_instance, CostCenter):
        link_record = CostCenterVersionLink(
            old_cc_id=old_instance_id,
            new_cc_id=new_instance.id,
            created_at=now,
            changed_by_user_id=changed_by_user_id,
            changed_fields=changed_fields,
        )
    # NOTE: User model does NOT have version_link table - user updates
    # are rare (admin only) and tracked via SCD2 history in t_d_user directly

    if link_record:
        session.add(link_record)
        await session.commit()

    # Step 5: For Article model - redirect children to new parent version
    # This maintains parent-child relationships across SCD Type 2 versioning
    import logging
    logger = logging.getLogger(__name__)
    logger.info(f"[SCD2] After commit: instance type={type(new_instance).__name__}, is Article? {isinstance(new_instance, Article)}")

    if isinstance(new_instance, Article):
        # Update parent_id for all direct children pointing to old version
        from sqlmodel import update

        # Debug log
        logger.info(f"[SCD2] Processing article version: old_id={old_instance_id}, new_id={new_instance.id}")

        update_stmt = (
            update(Article)
            .where(
                Article.parent_id == old_instance_id,  # Use saved ID
                Article.is_active == True  # noqa: E712
            )
            .values(
                parent_id=new_instance.id,
                updated_at=datetime.utcnow()
            )
        )
        result = await session.execute(update_stmt)
        await session.commit()

        # Log result
        children_updated = result.rowcount
        logger.info(f"[SCD2] Redirected {children_updated} children from article {old_instance_id} to {new_instance.id}")

    return new_instance


async def get_current_version(
    session: AsyncSession,
    model_class: type[T],
    **filters: Any,
) -> Optional[T]:
    """
    Get current version of an entity.

    Queries for the version where is_current=True and applies additional filters.

    Args:
        session: AsyncSession for database operations
        model_class: SQLModel class (Article, User, etc.)
        **filters: Additional filter conditions (e.g., id=1, user_id=5)

    Returns:
        Current version instance or None if not found

    Example:
        >>> user = await get_current_version(
        ...     session=session,
        ...     model_class=User,
        ...     id=1
        ... )

        >>> article = await get_current_version(
        ...     session=session,
        ...     model_class=Article,
        ...     id=5,
        ...     user_id=10
        ... )

    Notes:
        - Always filters by is_current=True
        - Returns None if no current version found
        - Use this instead of direct queries to ensure SCD Type 2 compliance
    """
    statement = select(model_class).where(model_class.is_current == True)  # noqa: E712

    # Apply additional filters
    for key, value in filters.items():
        column = getattr(model_class, key)
        statement = statement.where(column == value)

    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_version_at_date(
    session: AsyncSession,
    model_class: type[T],
    target_date: date,
    **filters: Any,
) -> Optional[T]:
    """
    Get version that was active at a specific date (time-travel query).

    Queries for version where:
    - valid_from <= target_date
    - valid_to > target_date

    Args:
        session: AsyncSession for database operations
        model_class: SQLModel class (Article, User, etc.)
        target_date: Date to query (as of date)
        **filters: Additional filter conditions

    Returns:
        Version active at target_date or None if not found

    Example:
        >>> # Get user's role as of January 1, 2025
        >>> user = await get_version_at_date(
        ...     session=session,
        ...     model_class=User,
        ...     target_date=date(2025, 1, 1),
        ...     id=1
        ... )

    Notes:
        - Uses valid_from and valid_to for time-travel query
        - Useful for historical reporting
        - Returns None if entity didn't exist at target_date
    """
    # Convert date to datetime for comparison
    target_datetime = datetime.combine(target_date, datetime.min.time())

    statement = select(model_class).where(
        model_class.valid_from <= target_datetime,
        model_class.valid_to > target_datetime,
    )

    # Apply additional filters
    for key, value in filters.items():
        column = getattr(model_class, key)
        statement = statement.where(column == value)

    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def get_history(
    session: AsyncSession,
    model_class: type[T],
    **filters: Any,
) -> list[T]:
    """
    Get all versions (history) of an entity ordered by valid_from DESC.

    Returns all versions (is_current=True and is_current=False) for audit trail.

    Args:
        session: AsyncSession for database operations
        model_class: SQLModel class (Article, User, etc.)
        **filters: Filter conditions (typically business key like telegram_id)

    Returns:
        List of all versions ordered by valid_from DESC (newest first)

    Example:
        >>> # Get complete history of user's role changes
        >>> versions = await get_history(
        ...     session=session,
        ...     model_class=User,
        ...     telegram_id=123456789
        ... )
        >>> for version in versions:
        ...     print(f"{version.valid_from}: is_admin={version.is_admin}")

    Notes:
        - Includes both current and closed versions
        - Ordered by valid_from DESC (newest first)
        - Useful for audit trails and compliance
        - Use business key (not id) for filters
    """
    statement = select(model_class)

    # Apply filters (typically business key)
    for key, value in filters.items():
        column = getattr(model_class, key)
        statement = statement.where(column == value)

    # Order by valid_from DESC (newest first)
    statement = statement.order_by(model_class.valid_from.desc())

    result = await session.execute(statement)
    return list(result.scalars().all())


def has_changes(old_instance: T, updates: dict[str, Any]) -> tuple[bool, list[str]]:
    """
    Check if updates actually change any fields.

    Compares current field values with proposed updates.

    Args:
        old_instance: Current version instance
        updates: Dictionary of proposed field updates

    Returns:
        Tuple of (has_changes: bool, changed_fields: list[str])

    Example:
        >>> changed, fields = has_changes(
        ...     old_instance=old_article,
        ...     updates={"name": "New Name", "type": "expense"}
        ... )
        >>> if changed:
        ...     new_article = await create_new_version(...)

    Notes:
        - Use this to avoid creating unnecessary versions
        - Returns empty list if no fields changed
        - Compares values using == operator
    """
    changed_fields = []

    for key, new_value in updates.items():
        old_value = getattr(old_instance, key, None)
        if old_value != new_value:
            changed_fields.append(key)

    return len(changed_fields) > 0, changed_fields


def validate_scd2_instance(instance: T) -> None:
    """
    Validate that instance has correct SCD Type 2 fields.

    Checks:
    - Has is_current field (bool)
    - Has valid_from field (datetime)
    - Has valid_to field (datetime)
    - valid_from < valid_to
    - If is_current=True, valid_to must be far future (9999-12-31)

    Args:
        instance: SQLModel instance to validate

    Raises:
        ValueError: If validation fails

    Example:
        >>> validate_scd2_instance(article)

    Notes:
        - Use this for debugging SCD2 implementation
        - Called automatically in create_new_version
    """
    # Check required fields exist
    if not hasattr(instance, "is_current"):
        raise ValueError(f"{type(instance).__name__} missing required field: is_current")

    if not hasattr(instance, "valid_from"):
        raise ValueError(f"{type(instance).__name__} missing required field: valid_from")

    if not hasattr(instance, "valid_to"):
        raise ValueError(f"{type(instance).__name__} missing required field: valid_to")

    # Check field types
    if not isinstance(instance.is_current, bool):
        raise ValueError(
            f"is_current must be bool, got {type(instance.is_current).__name__}"
        )

    # Check temporal consistency
    if instance.valid_from >= instance.valid_to:
        raise ValueError(
            f"valid_from ({instance.valid_from}) must be < valid_to ({instance.valid_to})"
        )

    # Check current version validity
    if instance.is_current:
        far_future = datetime(9999, 1, 1)
        if instance.valid_to < far_future:
            raise ValueError(
                f"Current version (is_current=True) must have valid_to=9999-12-31, "
                f"got {instance.valid_to}"
            )


async def verify_no_concurrent_update(
    session: AsyncSession,
    instance: T,
) -> None:
    """
    Verify that instance hasn't been modified by concurrent transaction.

    Uses updated_at timestamp to detect concurrent modifications.

    Args:
        session: AsyncSession for database operations
        instance: Instance to check for concurrent updates

    Raises:
        HTTPException: If concurrent update detected (409 Conflict)

    Example:
        >>> await verify_no_concurrent_update(session, old_article)
        >>> # Proceed with update

    Notes:
        - Call this before create_new_version() in high-concurrency scenarios
        - Uses optimistic locking pattern
        - Requires updated_at field in model
    """
    if not hasattr(instance, "updated_at"):
        # If no updated_at field, skip check
        return

    if not hasattr(instance, "id"):
        # New instance, no concurrent update possible
        return

    # Refresh instance from DB to get latest state
    model_class = type(instance)
    statement = select(model_class).where(
        model_class.id == instance.id,
        model_class.is_current == True,  # noqa: E712
    )
    result = await session.execute(statement)
    current_db_instance = result.scalar_one_or_none()

    if not current_db_instance:
        # Instance was deleted or updated (no longer current)
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{model_class.__name__} was modified or deleted by another transaction. "
                "Please refresh and try again."
            ),
        )

    # Compare updated_at timestamps
    if current_db_instance.updated_at != instance.updated_at:
        from fastapi import HTTPException, status

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"{model_class.__name__} was modified by another transaction "
                f"(expected updated_at={instance.updated_at}, "
                f"got {current_db_instance.updated_at}). "
                "Please refresh and try again."
            ),
        )
