"""
Financial Center Service Layer (Hybrid: SCD Type 1 + History SCD Type 2).

This module manages FinancialCenter table updates with hybrid approach:
- Main table (t_d_financial_center): SCD Type 1 (in-place updates, NO versioning)
- History table (t_d_financial_center_history): SCD Type 2 (full change tracking)

This differs from generic scd2_service.py:
- FinancialCenter updates are in-place (no new id generated)
- History is stored in separate FinancialCenterHistory table
- FK in fact tables remain stable (no updates needed)

Key Functions:
    - update_financial_center_profile(): Update FinancialCenter (SCD1) + create FinancialCenterHistory snapshot (SCD2)
    - get_financial_center_history(): Get full change history from FinancialCenterHistory table
    - get_financial_center_version_at_date(): Time-travel query to FinancialCenterHistory
    - create_initial_history(): Create initial history record for new financial center
"""

from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.financial_center import FinancialCenter
from backend.app.models.financial_center_history import FinancialCenterHistory

# Far future datetime constant for SCD Type 2 valid_to field
# Uses timezone-aware UTC to prevent asyncpg year overflow issues
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


async def update_financial_center_profile(
    session: AsyncSession,
    financial_center: FinancialCenter,
    updates: dict[str, Any],
    changed_by_user_id: Optional[int] = None,
    change_type: str = "UPDATE",
) -> FinancialCenter:
    """
    Update FinancialCenter with SCD Type 1 + create FinancialCenterHistory snapshot (SCD Type 2).

    This function implements hybrid approach:
    1. Close old FinancialCenterHistory version (is_current=False, set valid_to)
    2. Update FinancialCenter table in-place (SCD1 - no new version, stable id)
    3. Create new FinancialCenterHistory version (is_current=True, snapshot all fields)

    Args:
        session: AsyncSession for database operations
        financial_center: Current FinancialCenter instance to update
        updates: Dictionary of field updates (e.g., {"name": "Updated Name", "description": "New desc"})
        changed_by_user_id: Optional user ID who made the change (for audit)
        change_type: Type of change (UPDATE/ARCHIVE/RESTORE/etc.)

    Returns:
        Updated FinancialCenter instance (same id, refreshed from DB)

    Example:
        >>> fc = await session.get(FinancialCenter, 1)
        >>> updated_fc = await update_financial_center_profile(
        ...     session=session,
        ...     financial_center=fc,
        ...     updates={"name": "Sberbank Main", "description": "Updated account"},
        ...     changed_by_user_id=2,
        ...     change_type="UPDATE"
        ... )

    Notes:
        - FinancialCenter.id NEVER changes (stable FK for fact tables)
        - FinancialCenterHistory stores FULL snapshots with all fields
        - changed_fields automatically detected by comparing old vs new values
        - Use change_type to categorize changes (UPDATE/ARCHIVE/RESTORE)
    """
    now = datetime.utcnow()

    # Step 1: Detect changed fields (for audit trail)
    changed_fields = []
    for key, new_value in updates.items():
        old_value = getattr(financial_center, key, None)
        if old_value != new_value:
            changed_fields.append(key)

    # Optimization: if no fields changed, return existing financial center (no history record)
    if not changed_fields:
        return financial_center

    # Step 2: Close old FinancialCenterHistory version (set is_current=False, valid_to=now)
    # Find current history version (should exist from previous update or CREATE)
    statement = select(FinancialCenterHistory).where(
        FinancialCenterHistory.financial_center_id == financial_center.id,
        FinancialCenterHistory.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    old_history = result.scalar_one_or_none()

    if old_history:
        # Close old version
        old_history.is_current = False
        old_history.valid_to = now
        session.add(old_history)

    # Step 3: Update FinancialCenter table in-place (SCD1 - no new version)
    for key, value in updates.items():
        setattr(financial_center, key, value)

    financial_center.updated_at = now
    session.add(financial_center)

    # Step 4: Create new FinancialCenterHistory snapshot (SCD2 - all fields)
    new_history = FinancialCenterHistory(
        financial_center_id=financial_center.id,  # FK to stable FinancialCenter.id
        user_id=financial_center.user_id,
        name=financial_center.name,
        description=financial_center.description,
        code=financial_center.code,
        is_active=financial_center.is_active,
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
    await session.refresh(financial_center)

    return financial_center


async def get_financial_center_history(
    session: AsyncSession,
    financial_center_id: int,
) -> list[FinancialCenterHistory]:
    """
    Get full change history for a financial center from FinancialCenterHistory table.

    Returns all FinancialCenterHistory versions (is_current=True and False) ordered by
    valid_from DESC (newest first).

    Args:
        session: AsyncSession for database operations
        financial_center_id: FinancialCenter.id to get history for

    Returns:
        List of FinancialCenterHistory versions ordered by valid_from DESC (newest first)

    Example:
        >>> history = await get_financial_center_history(session=session, financial_center_id=1)
        >>> for version in history:
        ...     print(f"{version.valid_from}: {version.name}")
        ...     print(f"  Changed: {version.changed_fields}, by user_id={version.changed_by_user_id}")

    Notes:
        - Includes both current (is_current=True) and closed versions
        - Ordered newest first (valid_from DESC)
        - Each version is a full snapshot of financial center data at that time
        - Use for audit trail and GET /financial-centers/{id}/history endpoint
    """
    statement = (
        select(FinancialCenterHistory)
        .where(FinancialCenterHistory.financial_center_id == financial_center_id)
        .order_by(FinancialCenterHistory.valid_from.desc())
    )

    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_financial_center_version_at_date(
    session: AsyncSession,
    financial_center_id: int,
    target_date: date,
) -> Optional[FinancialCenterHistory]:
    """
    Get FinancialCenter version that was active at a specific date (time-travel query).

    Queries FinancialCenterHistory for version where:
    - financial_center_id matches
    - valid_from <= target_date
    - valid_to > target_date

    Args:
        session: AsyncSession for database operations
        financial_center_id: FinancialCenter.id to query
        target_date: Date to query (as of date)

    Returns:
        FinancialCenterHistory version active at target_date or None if not found

    Example:
        >>> # Get financial center's name as of January 1, 2025
        >>> version = await get_financial_center_version_at_date(
        ...     session=session,
        ...     financial_center_id=1,
        ...     target_date=date(2025, 1, 1)
        ... )
        >>> if version:
        ...     print(f"On {target_date}, financial center was named: {version.name}")

    Notes:
        - Uses valid_from and valid_to for time-travel query
        - Useful for historical reporting (e.g., "what was account name on specific date?")
        - Returns None if financial center didn't exist at target_date
        - Target_date converted to datetime for comparison
    """
    # Convert date to datetime for comparison
    target_datetime = datetime.combine(target_date, datetime.min.time())

    statement = select(FinancialCenterHistory).where(
        FinancialCenterHistory.financial_center_id == financial_center_id,
        FinancialCenterHistory.valid_from <= target_datetime,
        FinancialCenterHistory.valid_to > target_datetime,
    )

    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_initial_history(
    session: AsyncSession,
    financial_center: FinancialCenter,
    change_type: str = "CREATE",
) -> FinancialCenterHistory:
    """
    Create initial FinancialCenterHistory record when financial center is first created.

    This should be called immediately after creating new FinancialCenter.

    Args:
        session: AsyncSession for database operations
        financial_center: Newly created FinancialCenter instance
        change_type: Type of change (typically "CREATE")

    Returns:
        Created FinancialCenterHistory instance

    Example:
        >>> # After creating new financial center
        >>> fc = FinancialCenter(user_id=1, name="Sberbank", ...)
        >>> session.add(fc)
        >>> await session.commit()
        >>> await session.refresh(fc)
        >>> history = await create_initial_history(session=session, financial_center=fc)

    Notes:
        - Creates first history snapshot with is_current=True
        - changed_fields is None for initial creation (no previous version)
        - changed_by_user_id is None (automatic creation)
    """
    now = datetime.utcnow()

    history = FinancialCenterHistory(
        financial_center_id=financial_center.id,
        user_id=financial_center.user_id,
        name=financial_center.name,
        description=financial_center.description,
        code=financial_center.code,
        is_active=financial_center.is_active,
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
