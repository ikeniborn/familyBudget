"""
ProductGroup Service Layer (Hybrid: SCD Type 1 + History SCD Type 2 + Hierarchy).

This module manages ProductGroup table updates with hybrid approach:
- Main table (t_d_product_group): SCD Type 1 (in-place updates, NO versioning)
- History table (t_d_product_group_history): SCD Type 2 (full change tracking)
- Hierarchy table (t_d_product_group_hierarchy): Closure Table for efficient queries

Product groups represent hierarchical product categories (e.g., "Food" → "Dairy" → "Milk").
All product groups are SHARED across users (admin-managed).

Key Functions:
    - update_product_group_profile(): Update ProductGroup (SCD1) + create history + update hierarchy
    - move_product_group(): Move product group to new parent (updates hierarchy)
    - get_product_group_history(): Get full change history
    - get_product_group_version_at_date(): Time-travel query
    - create_initial_history(): Create initial history record
"""

from datetime import date, datetime, timezone
from typing import Any, Optional

from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.product_group import ProductGroup
from backend.app.models.product_group_history import ProductGroupHistory
from backend.app.services import product_group_hierarchy_service

# Far future datetime constant for SCD Type 2 valid_to field
FAR_FUTURE_DATETIME = datetime(9999, 12, 31, 23, 59, 59, tzinfo=timezone.utc)


async def update_product_group_profile(
    session: AsyncSession,
    product_group: ProductGroup,
    updates: dict[str, Any],
    changed_by_user_id: Optional[int] = None,
    change_type: str = "UPDATE",
) -> ProductGroup:
    """
    Update ProductGroup with SCD Type 1 + create history + update hierarchy if needed.

    This function implements hybrid approach:
    1. Close old ProductGroupHistory version (is_current=False, set valid_to)
    2. Update ProductGroup table in-place (SCD1 - no new version, stable id)
    3. Create new ProductGroupHistory version (is_current=True, snapshot all fields)
    4. If parent_id changed: update closure table (move subtree)

    Args:
        session: AsyncSession for database operations
        product_group: Current ProductGroup instance to update
        updates: Dictionary of field updates (e.g., {"name": "Updated Name", "parent_id": 5})
        changed_by_user_id: Optional user ID who made the change (for audit)
        change_type: Type of change (UPDATE/ARCHIVE/RESTORE/HIERARCHY_CHANGE)

    Returns:
        Updated ProductGroup instance (same id, refreshed from DB)

    Example:
        >>> pg = await session.get(ProductGroup, 1)
        >>> updated_pg = await update_product_group_profile(
        ...     session=session,
        ...     product_group=pg,
        ...     updates={"name": "Food & Beverages", "parent_id": None},
        ...     changed_by_user_id=2,
        ...     change_type="UPDATE"
        ... )

    Notes:
        - ProductGroup.id NEVER changes (stable FK for ShoppingListItem)
        - ProductGroupHistory stores FULL snapshots with all fields
        - If parent_id changes: automatically updates closure table via move_subtree()
        - Use change_type="HIERARCHY_CHANGE" when only parent_id changes
    """
    now = datetime.utcnow()

    # Step 1: Detect changed fields (for audit trail)
    changed_fields = []
    parent_id_changed = False
    old_parent_id = product_group.parent_id

    for key, new_value in updates.items():
        old_value = getattr(product_group, key, None)
        if old_value != new_value:
            changed_fields.append(key)
            if key == "parent_id":
                parent_id_changed = True

    # Optimization: if no fields changed, return existing product group
    if not changed_fields:
        return product_group

    # Step 2: Close old ProductGroupHistory version
    statement = select(ProductGroupHistory).where(
        ProductGroupHistory.product_group_id == product_group.id,
        ProductGroupHistory.is_current == True  # noqa: E712
    )
    result = await session.execute(statement)
    old_history = result.scalar_one_or_none()

    if old_history:
        old_history.is_current = False
        old_history.valid_to = now
        session.add(old_history)

    # Step 3: Update ProductGroup table in-place (SCD1)
    for key, value in updates.items():
        setattr(product_group, key, value)

    product_group.updated_at = now
    session.add(product_group)

    # Step 4: Create new ProductGroupHistory snapshot (SCD2)
    # Auto-set change_type to HIERARCHY_CHANGE if only parent_id changed
    if parent_id_changed and len(changed_fields) == 1:
        change_type = "HIERARCHY_CHANGE"

    new_history = ProductGroupHistory(
        product_group_id=product_group.id,
        creator_id=product_group.creator_id,
        parent_id=product_group.parent_id,
        name=product_group.name,
        description=product_group.description,
        code=product_group.code,
        is_active=product_group.is_active,
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=True,
        change_type=change_type,
        changed_fields=changed_fields,
        changed_by_user_id=changed_by_user_id,
    )
    session.add(new_history)

    # Step 5: Commit updates before hierarchy changes
    await session.commit()
    await session.refresh(product_group)

    # Step 6: If parent_id changed, update closure table
    if parent_id_changed:
        await product_group_hierarchy_service.move_subtree(
            session=session,
            product_group_id=product_group.id,
            new_parent_id=product_group.parent_id
        )

    return product_group


async def move_product_group(
    session: AsyncSession,
    product_group: ProductGroup,
    new_parent_id: Optional[int],
    changed_by_user_id: Optional[int] = None,
) -> ProductGroup:
    """
    Move product group to new parent (convenience wrapper).

    This is a convenience function that calls update_product_group_profile()
    with parent_id update and change_type="HIERARCHY_CHANGE".

    Args:
        session: AsyncSession for database operations
        product_group: ProductGroup instance to move
        new_parent_id: ID of new parent (None to move to root)
        changed_by_user_id: Optional user ID who made the change

    Returns:
        Updated ProductGroup instance

    Example:
        >>> pg = await session.get(ProductGroup, 3)
        >>> # Move "Milk" from "Dairy" to "Beverages"
        >>> moved_pg = await move_product_group(
        ...     session=session,
        ...     product_group=pg,
        ...     new_parent_id=10,
        ...     changed_by_user_id=2
        ... )

    Notes:
        - Automatically updates closure table
        - Creates history record with change_type="HIERARCHY_CHANGE"
        - Validates that new_parent_id exists (handled by FK constraint)
    """
    return await update_product_group_profile(
        session=session,
        product_group=product_group,
        updates={"parent_id": new_parent_id},
        changed_by_user_id=changed_by_user_id,
        change_type="HIERARCHY_CHANGE",
    )


async def get_product_group_history(
    session: AsyncSession,
    product_group_id: int,
) -> list[ProductGroupHistory]:
    """
    Get full change history for a product group.

    Returns all ProductGroupHistory versions ordered by valid_from DESC (newest first).

    Args:
        session: AsyncSession for database operations
        product_group_id: ProductGroup.id to get history for

    Returns:
        List of ProductGroupHistory versions ordered by valid_from DESC

    Example:
        >>> history = await get_product_group_history(session=session, product_group_id=1)
        >>> for version in history:
        ...     print(f"{version.valid_from}: {version.name}, parent_id={version.parent_id}")
        ...     if version.change_type == "HIERARCHY_CHANGE":
        ...         print(f"  Moved in hierarchy")

    Notes:
        - Includes both current and closed versions
        - Useful for audit trail
        - Shows hierarchy changes (parent_id modifications)
    """
    statement = (
        select(ProductGroupHistory)
        .where(ProductGroupHistory.product_group_id == product_group_id)
        .order_by(ProductGroupHistory.valid_from.desc())
    )

    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_product_group_version_at_date(
    session: AsyncSession,
    product_group_id: int,
    target_date: date,
) -> Optional[ProductGroupHistory]:
    """
    Get ProductGroup version that was active at a specific date (time-travel query).

    Args:
        session: AsyncSession for database operations
        product_group_id: ProductGroup.id to query
        target_date: Date to query (as of date)

    Returns:
        ProductGroupHistory version active at target_date or None if not found

    Example:
        >>> version = await get_product_group_version_at_date(
        ...     session=session,
        ...     product_group_id=1,
        ...     target_date=date(2025, 1, 1)
        ... )
        >>> if version:
        ...     print(f"On {target_date}, group was named: {version.name}")
        ...     print(f"Parent was: {version.parent_id}")

    Notes:
        - Uses valid_from and valid_to for time-travel query
        - Returns None if product group didn't exist at target_date
        - Includes parent_id for historical hierarchy structure
    """
    target_datetime = datetime.combine(target_date, datetime.min.time())

    statement = select(ProductGroupHistory).where(
        ProductGroupHistory.product_group_id == product_group_id,
        ProductGroupHistory.valid_from <= target_datetime,
        ProductGroupHistory.valid_to > target_datetime,
    )

    result = await session.execute(statement)
    return result.scalar_one_or_none()


async def create_initial_history(
    session: AsyncSession,
    product_group: ProductGroup,
    change_type: str = "CREATE",
) -> ProductGroupHistory:
    """
    Create initial ProductGroupHistory record when product group is first created.

    This should be called immediately after creating new ProductGroup.

    Args:
        session: AsyncSession for database operations
        product_group: Newly created ProductGroup instance
        change_type: Type of change (typically "CREATE")

    Returns:
        Created ProductGroupHistory instance

    Example:
        >>> # After creating new product group
        >>> pg = ProductGroup(creator_id=1, name="Dairy", parent_id=1)
        >>> session.add(pg)
        >>> await session.commit()
        >>> await session.refresh(pg)
        >>>
        >>> # Create history record
        >>> history = await create_initial_history(session=session, product_group=pg)
        >>>
        >>> # Create hierarchy paths
        >>> await product_group_hierarchy_service.create_hierarchy_paths(
        ...     session=session,
        ...     product_group_id=pg.id,
        ...     parent_id=pg.parent_id
        ... )

    Notes:
        - Creates first history snapshot with is_current=True
        - changed_fields is None for initial creation
        - Must also call create_hierarchy_paths() separately
    """
    now = datetime.utcnow()

    history = ProductGroupHistory(
        product_group_id=product_group.id,
        creator_id=product_group.creator_id,
        parent_id=product_group.parent_id,
        name=product_group.name,
        description=product_group.description,
        code=product_group.code,
        is_active=product_group.is_active,
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=True,
        change_type=change_type,
        changed_fields=None,  # Initial creation
        changed_by_user_id=None,  # Automatic creation
    )
    session.add(history)
    await session.commit()
    await session.refresh(history)

    return history
