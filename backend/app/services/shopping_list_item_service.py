"""
ShoppingListItem Service Layer.

This module manages ShoppingListItem CRUD operations (lines in Header+Lines pattern).
Shopping list items are SHARED across all users with offline sync support.

Key Features:
    - SHARED model: All users can add/edit/delete items
    - Batch operations: Complete/delete multiple items at once
    - Offline sync: sync_status field ('synced', 'pending', 'conflict')
    - Soft delete: deleted_at timestamp, records kept for autocomplete
    - Optimistic locking: version field incremented on each update

Key Functions:
    - batch_complete_items(): Mark multiple items as completed
    - batch_delete_items(): Soft-delete multiple items at once
    - mark_items_pending(): Mark items as pending sync (offline create/update)
    - detect_conflicts(): Detect offline sync conflicts
    - resolve_conflict(): Resolve sync conflicts (server/client/merge)
"""
from datetime import datetime

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.shopping_list_item import ShoppingListItem


async def batch_complete_items(
    session: AsyncSession,
    item_ids: list[int],
    is_completed: bool = True,
    user_id: int | None = None,
) -> int:
    """
    Mark multiple shopping list items as completed (or uncompleted).

    Batch operation for efficiency.

    Args:
        session: AsyncSession for database operations
        item_ids: List of ShoppingListItem IDs to update
        is_completed: True to mark as completed, False to unmark
        user_id: Optional user ID for audit (last_modified_by)

    Returns:
        Number of items updated

    Example:
        >>> # Mark items 1, 2, 3 as completed
        >>> count = await batch_complete_items(
        ...     session=session,
        ...     item_ids=[1, 2, 3],
        ...     is_completed=True,
        ...     user_id=123
        ... )
        >>> print(f"Marked {count} items as completed")

    Notes:
        - SHARED model: Any user can complete any item
        - Increments version for optimistic locking
        - Sets completed_at when marking as completed
        - Excludes soft-deleted items (deleted_at IS NULL)
        - Returns 0 if no items found
    """
    if not item_ids:
        return 0

    # Get active items (exclude soft-deleted)
    statement = select(ShoppingListItem).where(
        ShoppingListItem.id.in_(item_ids),
        ShoppingListItem.deleted_at.is_(None),
    )
    result = await session.execute(statement)
    items = result.scalars().all()

    # Update each item
    now = datetime.utcnow()
    count = 0
    for item in items:
        # Skip if no change needed
        if item.is_completed == is_completed:
            continue

        item.is_completed = is_completed
        item.version += 1
        item.updated_at = now

        # Set completed_at when marking as completed
        if is_completed and not item.completed_at:
            item.completed_at = now

        # Audit trail
        if user_id:
            item.last_modified_by = user_id

        session.add(item)
        count += 1

    await session.commit()

    return count


async def batch_delete_items(
    session: AsyncSession,
    item_ids: list[int],
    user_id: int | None = None,
) -> int:
    """
    Soft-delete multiple shopping list items at once.

    Batch operation for efficiency.

    Args:
        session: AsyncSession for database operations
        item_ids: List of ShoppingListItem IDs to soft-delete
        user_id: Optional user ID for audit (last_modified_by)

    Returns:
        Number of items soft-deleted

    Example:
        >>> # Soft-delete items 1, 2, 3
        >>> count = await batch_delete_items(session=session, item_ids=[1, 2, 3], user_id=123)
        >>> print(f"Soft-deleted {count} items")

    Notes:
        - SHARED model: Any user can delete any item
        - Soft delete: Sets deleted_at timestamp, record remains in DB
        - Increments version for optimistic locking
        - Excludes already soft-deleted items
        - Returns 0 if no items found
    """
    if not item_ids:
        return 0

    # Get active items (exclude already soft-deleted)
    statement = select(ShoppingListItem).where(
        ShoppingListItem.id.in_(item_ids),
        ShoppingListItem.deleted_at.is_(None),
    )
    result = await session.execute(statement)
    items = result.scalars().all()

    # Soft-delete each item
    now = datetime.utcnow()
    count = 0
    for item in items:
        item.deleted_at = now
        item.version += 1
        item.updated_at = now

        # Audit trail
        if user_id:
            item.last_modified_by = user_id

        session.add(item)
        count += 1

    await session.commit()

    return count


async def restore_item(
    session: AsyncSession,
    item_id: int,
    user_id: int | None = None,
) -> ShoppingListItem | None:
    """
    Restore a soft-deleted shopping list item.

    Sets deleted_at=None, increments version for optimistic locking.
    Idempotent: returns the item unchanged if already active.

    Args:
        session: AsyncSession for database operations
        item_id: ShoppingListItem ID to restore
        user_id: Optional user ID for audit (last_modified_by)

    Returns:
        Restored ShoppingListItem or None if not found

    Example:
        >>> # Restore item 123
        >>> item = await restore_item(session=session, item_id=123, user_id=456)
        >>> if item:
        ...     print(f"Restored: {item.product_name}")

    Notes:
        - SHARED model: Any user can restore any item
        - Idempotent: If item is already active, returns it unchanged
        - Increments version for optimistic locking
        - Sets sync_status to "synced"
    """
    statement = select(ShoppingListItem).where(ShoppingListItem.id == item_id)
    result = await session.execute(statement)
    item = result.scalar_one_or_none()

    if not item:
        return None

    # Idempotent: if already active, return as-is
    if item.deleted_at is None:
        return item

    # Restore: clear deleted_at and reset completion state
    now = datetime.utcnow()
    item.deleted_at = None
    item.is_completed = False
    item.completed_at = None
    item.version += 1
    item.updated_at = now
    item.sync_status = "synced"

    if user_id:
        item.last_modified_by = user_id

    session.add(item)
    await session.commit()
    await session.refresh(item)

    return item


async def mark_items_pending(
    session: AsyncSession,
    item_ids: list[int],
) -> int:
    """
    Mark items as pending sync (offline create/update).

    Used when items are created/updated offline and need to be synced to server.

    Args:
        session: AsyncSession for database operations
        item_ids: List of ShoppingListItem IDs to mark as pending

    Returns:
        Number of items marked as pending

    Example:
        >>> # Mark items 1, 2 as pending sync
        >>> count = await mark_items_pending(session=session, item_ids=[1, 2])
        >>> print(f"Marked {count} items as pending sync")

    Notes:
        - Sets sync_status='pending'
        - Used for offline-first functionality
        - Items with sync_status='pending' need to be synced when online
    """
    if not item_ids:
        return 0

    # Get items
    statement = select(ShoppingListItem).where(
        ShoppingListItem.id.in_(item_ids)
    )
    result = await session.execute(statement)
    items = result.scalars().all()

    # Update each item
    count = 0
    for item in items:
        item.sync_status = 'pending'
        item.updated_at = func.now()
        session.add(item)
        count += 1

    await session.commit()

    return count


async def get_pending_sync_items(
    session: AsyncSession,
    shopping_list_id: int | None = None,
) -> list[ShoppingListItem]:
    """
    Get all items with pending sync status.

    Used for offline sync queue processing.

    Args:
        session: AsyncSession for database operations
        shopping_list_id: Optional filter by shopping list ID

    Returns:
        List of ShoppingListItem instances with sync_status='pending'

    Example:
        >>> # Get all pending items
        >>> pending_items = await get_pending_sync_items(session)
        >>> for item in pending_items:
        ...     print(f"Item {item.id} needs sync: {item.product_name}")

        >>> # Get pending items for specific list
        >>> pending_items = await get_pending_sync_items(session, shopping_list_id=1)

    Notes:
        - Returns items with sync_status='pending'
        - Excludes soft-deleted items (deleted_at IS NULL)
        - Ordered by created_at ASC (oldest first)
        - Used for background sync queue processing
    """
    statement = select(ShoppingListItem).where(
        ShoppingListItem.sync_status == 'pending',
        ShoppingListItem.deleted_at.is_(None),
    )

    if shopping_list_id is not None:
        statement = statement.where(
            ShoppingListItem.shopping_list_id == shopping_list_id
        )

    statement = statement.order_by(ShoppingListItem.created_at.asc())

    result = await session.execute(statement)
    return list(result.scalars().all())


async def detect_conflicts(
    session: AsyncSession,
    shopping_list_id: int,
) -> list[ShoppingListItem]:
    """
    Detect items with sync conflicts.

    Conflicts occur when item is modified both offline and online.

    Args:
        session: AsyncSession for database operations
        shopping_list_id: ShoppingList ID to check for conflicts

    Returns:
        List of ShoppingListItem instances with sync_status='conflict'

    Example:
        >>> conflicts = await detect_conflicts(session, shopping_list_id=1)
        >>> if conflicts:
        ...     print(f"Found {len(conflicts)} conflicts that need resolution")
        ...     for item in conflicts:
        ...         print(f"  Item {item.id}: {item.product_name}")

    Notes:
        - Returns items with sync_status='conflict'
        - Excludes soft-deleted items (deleted_at IS NULL)
        - Conflicts must be resolved manually (user chooses: server/client/merge)
        - UI should show conflict indicators (⚠️ icon)
    """
    statement = select(ShoppingListItem).where(
        ShoppingListItem.shopping_list_id == shopping_list_id,
        ShoppingListItem.sync_status == 'conflict',
        ShoppingListItem.deleted_at.is_(None),
    )

    result = await session.execute(statement)
    return list(result.scalars().all())


async def resolve_conflict(
    session: AsyncSession,
    item: ShoppingListItem,
    strategy: str = 'server',
) -> ShoppingListItem:
    """
    Resolve sync conflict.

    Strategies:
    - 'server': Use server version (discard local changes)
    - 'client': Use client version (overwrite server)
    - 'synced': Mark as synced without changes (manual merge completed)

    Args:
        session: AsyncSession for database operations
        item: ShoppingListItem instance with conflict
        strategy: Resolution strategy ('server', 'client', 'synced')

    Returns:
        Updated ShoppingListItem instance

    Example:
        >>> item = await session.get(ShoppingListItem, 5)
        >>> if item.sync_status == 'conflict':
        ...     # User chose to keep server version
        ...     resolved_item = await resolve_conflict(
        ...         session=session,
        ...         item=item,
        ...         strategy='server'
        ...     )

    Notes:
        - 'server': Reload from server (client discards local changes)
        - 'client': Client overwrites server (server accepts local changes)
        - 'synced': Mark as synced (user manually merged)
        - After resolution, sync_status set to 'synced'
    """
    if strategy == 'server':
        # Server wins: reload item from DB (discard local changes)
        await session.refresh(item)
    elif strategy == 'client':
        # Client wins: keep current item state (overwrite server)
        pass  # No changes needed, local state is correct
    elif strategy == 'synced':
        # Manual merge completed: just mark as synced
        pass  # No changes needed

    # Mark as synced
    item.sync_status = 'synced'
    item.updated_at = func.now()
    session.add(item)
    await session.commit()
    await session.refresh(item)

    return item


async def get_items_by_completion_status(
    session: AsyncSession,
    shopping_list_id: int,
    is_completed: bool,
) -> list[ShoppingListItem]:
    """
    Get items filtered by completion status.

    Args:
        session: AsyncSession for database operations
        shopping_list_id: ShoppingList ID to filter
        is_completed: True for completed items, False for incomplete

    Returns:
        List of ShoppingListItem instances

    Example:
        >>> # Get all incomplete items
        >>> incomplete = await get_items_by_completion_status(
        ...     session=session,
        ...     shopping_list_id=1,
        ...     is_completed=False
        ... )
        >>> print(f"Still need to buy: {len(incomplete)} items")

    Notes:
        - Excludes soft-deleted items (deleted_at IS NULL)
        - Ordered by created_at ASC (order added)
        - Used for filtering UI (show only incomplete items)
    """
    statement = (
        select(ShoppingListItem)
        .where(
            ShoppingListItem.shopping_list_id == shopping_list_id,
            ShoppingListItem.is_completed == is_completed,
            ShoppingListItem.deleted_at.is_(None),
        )
        .order_by(ShoppingListItem.created_at.asc())
    )

    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_items_by_store(
    session: AsyncSession,
    shopping_list_id: int,
    store_id: int,
) -> list[ShoppingListItem]:
    """
    Get items filtered by store.

    Args:
        session: AsyncSession for database operations
        shopping_list_id: ShoppingList ID to filter
        store_id: Store ID to filter

    Returns:
        List of ShoppingListItem instances for specific store

    Example:
        >>> # Get all items to buy at Walmart (store_id=5)
        >>> walmart_items = await get_items_by_store(
        ...     session=session,
        ...     shopping_list_id=1,
        ...     store_id=5
        ... )
        >>> print(f"Need to buy {len(walmart_items)} items at Walmart")

    Notes:
        - Excludes soft-deleted items (deleted_at IS NULL)
        - Ordered by product_group_id, product_name (grouped by category)
        - Useful for shopping trip planning (items per store)
    """
    statement = (
        select(ShoppingListItem)
        .where(
            ShoppingListItem.shopping_list_id == shopping_list_id,
            ShoppingListItem.store_id == store_id,
            ShoppingListItem.deleted_at.is_(None),
        )
        .order_by(
            ShoppingListItem.product_group_id,
            ShoppingListItem.product_name
        )
    )

    result = await session.execute(statement)
    return list(result.scalars().all())


async def get_items_by_product_group(
    session: AsyncSession,
    shopping_list_id: int,
    product_group_id: int,
) -> list[ShoppingListItem]:
    """
    Get items filtered by product group (category).

    Args:
        session: AsyncSession for database operations
        shopping_list_id: ShoppingList ID to filter
        product_group_id: ProductGroup ID to filter

    Returns:
        List of ShoppingListItem instances for specific category

    Example:
        >>> # Get all dairy items (product_group_id=10)
        >>> dairy_items = await get_items_by_product_group(
        ...     session=session,
        ...     shopping_list_id=1,
        ...     product_group_id=10
        ... )
        >>> print(f"Dairy: {len(dairy_items)} items")

    Notes:
        - Excludes soft-deleted items (deleted_at IS NULL)
        - Ordered by product_name
        - Used for hierarchy view (grouped by category)
    """
    statement = (
        select(ShoppingListItem)
        .where(
            ShoppingListItem.shopping_list_id == shopping_list_id,
            ShoppingListItem.product_group_id == product_group_id,
            ShoppingListItem.deleted_at.is_(None),
        )
        .order_by(ShoppingListItem.product_name)
    )

    result = await session.execute(statement)
    return list(result.scalars().all())
