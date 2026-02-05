"""
Store Service Layer (Hybrid: SCD Type 1 + History SCD Type 2).

This module manages Store table updates with hybrid approach:
- Main table (t_d_store): SCD Type 1 (in-place updates, NO versioning)
- History table (t_d_store_history): SCD Type 2 (full change tracking)

Stores represent shopping locations (supermarkets, shops, etc.).
All stores are SHARED across users (admin-managed).

Key Functions:
    - update_store_profile(): Update Store (SCD1) + create StoreHistory snapshot (SCD2)
    - get_store_history(): Get full change history from StoreHistory table
    - get_store_version_at_date(): Time-travel query to StoreHistory
    - create_initial_history(): Create initial history record for new store
"""

from datetime import date, datetime, timezone
from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.store import Store
from backend.app.models.store_history import StoreHistory

# Far future datetime constant for SCD Type 2 valid_to field
# Uses timezone-aware UTC to prevent asyncpg year overflow issues
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


async def update_store_profile(
    session: AsyncSession,
    store: Store,
    updates: dict[str, Any],
    changed_by_user_id: int | None = None,
    change_type: str = "UPDATE",
) -> Store:
    """
    Update Store with SCD Type 1 + create StoreHistory snapshot (SCD Type 2).

    This function implements hybrid approach:
    1. Close old StoreHistory version (is_current=False, set valid_to)
    2. Update Store table in-place (SCD1 - no new version, stable id)
    3. Create new StoreHistory version (is_current=True, snapshot all fields)

    Args:
        session: AsyncSession for database operations
        store: Current Store instance to update
        updates: Dictionary of field updates (e.g., {"name": "Updated Name", "address": "New address"})
        changed_by_user_id: Optional user ID who made the change (for audit)
        change_type: Type of change (UPDATE/ARCHIVE/RESTORE/etc.)

    Returns:
        Updated Store instance (same id, refreshed from DB)

    Example:
        >>> store = await session.get(Store, 1)
        >>> updated_store = await update_store_profile(
        ...     session=session,
        ...     store=store,
        ...     updates={"name": "Walmart Supercenter", "address": "456 New St"},
        ...     changed_by_user_id=2,
        ...     change_type="UPDATE"
        ... )

    Notes:
        - Store.id NEVER changes (stable FK for ShoppingListItem)
        - StoreHistory stores FULL snapshots with all fields
        - changed_fields automatically detected by comparing old vs new values
        - Use change_type to categorize changes (UPDATE/ARCHIVE/RESTORE)
    """
    now = datetime.utcnow()

    # Step 1: Detect changed fields (for audit trail)
    changed_fields = []
    for key, new_value in updates.items():
        old_value = getattr(store, key, None)
        if old_value != new_value:
            changed_fields.append(key)

    # Optimization: if no fields changed, return existing store (no history record)
    if not changed_fields:
        return store

    # Step 2: Close old StoreHistory version (set is_current=False, valid_to=now)
    # Find current history version (should exist from previous update or CREATE)
    statement = select(StoreHistory).where(
        StoreHistory.store_id == store.id,
        StoreHistory.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    old_history = result.scalar_one_or_none()

    if old_history:
        # Close old version
        old_history.is_current = False
        old_history.valid_to = now
        session.add(old_history)

    # Step 3: Update Store table in-place (SCD1 - no new version)
    for key, value in updates.items():
        setattr(store, key, value)

    store.updated_at = now
    session.add(store)

    # Step 4: Create new StoreHistory snapshot (SCD2 - all fields)
    new_history = StoreHistory(
        store_id=store.id,  # FK to stable Store.id
        creator_id=store.creator_id,
        name=store.name,
        address=store.address,
        description=store.description,
        code=store.code,
        is_active=store.is_active,
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=True,
        change_type=change_type,
        changed_fields=changed_fields,
        changed_by_user_id=changed_by_user_id,
    )
    session.add(new_history)

    # Step 5: Commit atomically
    await session.commit()
    await session.refresh(store)

    return store


async def get_store_history(
    session: AsyncSession,
    store_id: int,
) -> list[StoreHistory]:
    """
    Get full change history for a store from StoreHistory table.

    Returns all StoreHistory versions (is_current=True and False) ordered by
    valid_from DESC (newest first).

    Args:
        session: AsyncSession for database operations
        store_id: Store.id to get history for

    Returns:
        List of StoreHistory versions ordered by valid_from DESC (newest first)

    Example:
        >>> history = await get_store_history(session=session, store_id=1)
        >>> for version in history:
        ...     print(f"{version.valid_from}: {version.name}")
        ...     print(f"  Changed: {version.changed_fields}, by user_id={version.changed_by_user_id}")

    Notes:
        - Includes both current (is_current=True) and closed versions
        - Ordered newest first (valid_from DESC)
        - Each version is a full snapshot of store data at that time
        - Use for audit trail and GET /stores/{id}/history endpoint
    """
    statement = (
        select(StoreHistory)
        .where(StoreHistory.store_id == store_id)
        .order_by(StoreHistory.valid_from.desc())
    )

    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_store_version_at_date(
    session: AsyncSession,
    store_id: int,
    target_date: date,
) -> StoreHistory | None:
    """
    Get Store version that was active at a specific date (time-travel query).

    Queries StoreHistory for version where:
    - store_id matches
    - valid_from <= target_date
    - valid_to > target_date

    Args:
        session: AsyncSession for database operations
        store_id: Store.id to query
        target_date: Date to query (as of date)

    Returns:
        StoreHistory version active at target_date or None if not found

    Example:
        >>> # Get store's name as of January 1, 2025
        >>> version = await get_store_version_at_date(
        ...     session=session,
        ...     store_id=1,
        ...     target_date=date(2025, 1, 1)
        ... )
        >>> if version:
        ...     print(f"On {target_date}, store was named: {version.name}")

    Notes:
        - Uses valid_from and valid_to for time-travel query
        - Useful for historical reporting
        - Returns None if store didn't exist at target_date
        - Target_date converted to datetime for comparison
    """
    # Convert date to datetime for comparison
    target_datetime = datetime.combine(target_date, datetime.min.time())

    statement = select(StoreHistory).where(
        StoreHistory.store_id == store_id,
        StoreHistory.valid_from <= target_datetime,
        StoreHistory.valid_to > target_datetime,
    )

    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_initial_history(
    session: AsyncSession,
    store: Store,
    change_type: str = "CREATE",
) -> StoreHistory:
    """
    Create initial StoreHistory record when store is first created.

    This should be called immediately after creating new Store.

    Args:
        session: AsyncSession for database operations
        store: Newly created Store instance
        change_type: Type of change (typically "CREATE")

    Returns:
        Created StoreHistory instance

    Example:
        >>> # After creating new store
        >>> store = Store(creator_id=1, name="Walmart", address="123 Main St")
        >>> session.add(store)
        >>> await session.commit()
        >>> await session.refresh(store)
        >>> history = await create_initial_history(session=session, store=store)

    Notes:
        - Creates first history snapshot with is_current=True
        - changed_fields is None for initial creation (no previous version)
        - changed_by_user_id is None (automatic creation)
    """
    now = datetime.utcnow()

    history = StoreHistory(
        store_id=store.id,
        creator_id=store.creator_id,
        name=store.name,
        address=store.address,
        description=store.description,
        code=store.code,
        is_active=store.is_active,
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
