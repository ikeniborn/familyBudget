"""
Cost Center Service Layer (Hybrid: SCD Type 1 + History SCD Type 2).

This module manages CostCenter table updates with hybrid approach:
- Main table (t_d_cost_center): SCD Type 1 (in-place updates, NO versioning)
- History table (t_d_cost_center_history): SCD Type 2 (full change tracking)

This differs from generic scd2_service.py:
- CostCenter updates are in-place (no new id generated)
- History is stored in separate CostCenterHistory table
- FK in fact tables remain stable (no updates needed)

Key Functions:
    - update_cost_center_profile(): Update CostCenter (SCD1) + create CostCenterHistory snapshot (SCD2)
    - get_cost_center_history(): Get full change history from CostCenterHistory table
    - get_cost_center_version_at_date(): Time-travel query to CostCenterHistory
    - create_initial_history(): Create initial history record for new cost center
"""

from datetime import date, datetime, timezone
from typing import Any

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.cost_center import CostCenter
from backend.app.models.cost_center_history import CostCenterHistory

# Far future datetime constant for SCD Type 2 valid_to field
# Uses timezone-aware UTC to prevent asyncpg year overflow issues
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


async def update_cost_center_profile(
    session: AsyncSession,
    cost_center: CostCenter,
    updates: dict[str, Any],
    changed_by_user_id: int | None = None,
    change_type: str = "UPDATE",
) -> CostCenter:
    """
    Update CostCenter with SCD Type 1 + create CostCenterHistory snapshot (SCD Type 2).

    This function implements hybrid approach:
    1. Close old CostCenterHistory version (is_current=False, set valid_to)
    2. Update CostCenter table in-place (SCD1 - no new version, stable id)
    3. Create new CostCenterHistory version (is_current=True, snapshot all fields)

    Args:
        session: AsyncSession for database operations
        cost_center: Current CostCenter instance to update
        updates: Dictionary of field updates (e.g., {"name": "Updated Name", "description": "New desc"})
        changed_by_user_id: Optional user ID who made the change (for audit)
        change_type: Type of change (UPDATE/ARCHIVE/RESTORE/etc.)

    Returns:
        Updated CostCenter instance (same id, refreshed from DB)

    Example:
        >>> cc = await session.get(CostCenter, 1)
        >>> updated_cc = await update_cost_center_profile(
        ...     session=session,
        ...     cost_center=cc,
        ...     updates={"name": "Home Renovation", "description": "Updated project"},
        ...     changed_by_user_id=2,
        ...     change_type="UPDATE"
        ... )

    Notes:
        - CostCenter.id NEVER changes (stable FK for fact tables)
        - CostCenterHistory stores FULL snapshots with all fields
        - changed_fields automatically detected by comparing old vs new values
        - Use change_type to categorize changes (UPDATE/ARCHIVE/RESTORE)
    """
    now = datetime.utcnow()

    # Step 1: Detect changed fields (for audit trail)
    changed_fields = []
    for key, new_value in updates.items():
        old_value = getattr(cost_center, key, None)
        if old_value != new_value:
            changed_fields.append(key)

    # Optimization: if no fields changed, return existing cost center (no history record)
    if not changed_fields:
        return cost_center

    # Step 2: Close old CostCenterHistory version (set is_current=False, valid_to=now)
    # Find current history version (should exist from previous update or CREATE)
    statement = select(CostCenterHistory).where(
        CostCenterHistory.cost_center_id == cost_center.id,
        CostCenterHistory.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    old_history = result.scalar_one_or_none()

    if old_history:
        # Close old version
        old_history.is_current = False
        old_history.valid_to = now
        session.add(old_history)

    # Step 3: Update CostCenter table in-place (SCD1 - no new version)
    for key, value in updates.items():
        setattr(cost_center, key, value)

    cost_center.updated_at = now
    session.add(cost_center)

    # Step 4: Create new CostCenterHistory snapshot (SCD2 - all fields)
    new_history = CostCenterHistory(
        cost_center_id=cost_center.id,  # FK to stable CostCenter.id
        user_id=cost_center.user_id,
        name=cost_center.name,
        description=cost_center.description,
        code=cost_center.code,
        is_active=cost_center.is_active,
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
    await session.refresh(cost_center)

    return cost_center


async def get_cost_center_history(
    session: AsyncSession,
    cost_center_id: int,
) -> list[CostCenterHistory]:
    """
    Get full change history for a cost center from CostCenterHistory table.

    Returns all CostCenterHistory versions (is_current=True and False) ordered by
    valid_from DESC (newest first).

    Args:
        session: AsyncSession for database operations
        cost_center_id: CostCenter.id to get history for

    Returns:
        List of CostCenterHistory versions ordered by valid_from DESC (newest first)

    Example:
        >>> history = await get_cost_center_history(session=session, cost_center_id=1)
        >>> for version in history:
        ...     print(f"{version.valid_from}: {version.name}")
        ...     print(f"  Changed: {version.changed_fields}, by user_id={version.changed_by_user_id}")

    Notes:
        - Includes both current (is_current=True) and closed versions
        - Ordered newest first (valid_from DESC)
        - Each version is a full snapshot of cost center data at that time
        - Use for audit trail and GET /cost-centers/{id}/history endpoint
    """
    statement = (
        select(CostCenterHistory)
        .where(CostCenterHistory.cost_center_id == cost_center_id)
        .order_by(CostCenterHistory.valid_from.desc())
    )

    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_cost_center_version_at_date(
    session: AsyncSession,
    cost_center_id: int,
    target_date: date,
) -> CostCenterHistory | None:
    """
    Get CostCenter version that was active at a specific date (time-travel query).

    Queries CostCenterHistory for version where:
    - cost_center_id matches
    - valid_from <= target_date
    - valid_to > target_date

    Args:
        session: AsyncSession for database operations
        cost_center_id: CostCenter.id to query
        target_date: Date to query (as of date)

    Returns:
        CostCenterHistory version active at target_date or None if not found

    Example:
        >>> # Get cost center's name as of January 1, 2025
        >>> version = await get_cost_center_version_at_date(
        ...     session=session,
        ...     cost_center_id=1,
        ...     target_date=date(2025, 1, 1)
        ... )
        >>> if version:
        ...     print(f"On {target_date}, cost center was named: {version.name}")

    Notes:
        - Uses valid_from and valid_to for time-travel query
        - Useful for historical reporting (e.g., "what was project name on specific date?")
        - Returns None if cost center didn't exist at target_date
        - Target_date converted to datetime for comparison
    """
    # Convert date to datetime for comparison
    target_datetime = datetime.combine(target_date, datetime.min.time())

    statement = select(CostCenterHistory).where(
        CostCenterHistory.cost_center_id == cost_center_id,
        CostCenterHistory.valid_from <= target_datetime,
        CostCenterHistory.valid_to > target_datetime,
    )

    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_initial_history(
    session: AsyncSession,
    cost_center: CostCenter,
    change_type: str = "CREATE",
) -> CostCenterHistory:
    """
    Create initial CostCenterHistory record when cost center is first created.

    This should be called immediately after creating new CostCenter.

    Args:
        session: AsyncSession for database operations
        cost_center: Newly created CostCenter instance
        change_type: Type of change (typically "CREATE")

    Returns:
        Created CostCenterHistory instance

    Example:
        >>> # After creating new cost center
        >>> cc = CostCenter(user_id=1, name="Home Renovation", ...)
        >>> session.add(cc)
        >>> await session.commit()
        >>> await session.refresh(cc)
        >>> history = await create_initial_history(session=session, cost_center=cc)

    Notes:
        - Creates first history snapshot with is_current=True
        - changed_fields is None for initial creation (no previous version)
        - changed_by_user_id is None (automatic creation)
    """
    now = datetime.utcnow()

    history = CostCenterHistory(
        cost_center_id=cost_center.id,
        user_id=cost_center.user_id,
        name=cost_center.name,
        description=cost_center.description,
        code=cost_center.code,
        is_active=cost_center.is_active,
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
