"""
ShoppingList Service Layer.

This module manages ShoppingList CRUD operations (header in Header+Lines pattern).
Shopping lists are SHARED across all users.

Key Features:
    - SHARED model: Any authenticated user can view, edit, and delete any list
    - No history tracking (simple fact table)
    - Aggregation functions for list statistics

Key Functions:
    - get_shopping_lists_with_stats(): Get all lists with item count and completion stats
    - get_shopping_list_with_items(): Get list with all items (detail view)
"""

from sqlalchemy import func
from sqlmodel import select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem


async def get_shopping_lists_with_stats(
    session: AsyncSession,
    limit: int = 100,
    offset: int = 0,
    active_only: bool = True,
) -> tuple[list[dict], int]:
    """
    Get all shopping lists with item count and completion statistics.

    Used for landing page grid of cards.

    Args:
        session: AsyncSession for database operations
        limit: Maximum number of lists to return
        offset: Number of lists to skip (pagination)
        active_only: If True, only return active lists (is_active=True)

    Returns:
        Tuple of (list of dicts with stats, total count)

    Example:
        >>> lists, total = await get_shopping_lists_with_stats(session, limit=10)
        >>> for list_data in lists:
        ...     print(f"{list_data['name']}: {list_data['completed_items']}/{list_data['total_items']}")

    Dict structure:
        {
            "id": 1,
            "name": "Weekly Groceries",
            "description": "...",
            "creator_id": 123,
            "total_items": 10,
            "completed_items": 5,
            "completion_percentage": 50.0,
            "created_at": datetime(...),
            "updated_at": datetime(...)
        }

    Notes:
        - SHARED model: Returns ALL lists (no user_id filtering)
        - Statistics calculated via LEFT JOIN with ShoppingListItem
        - Ordered by created_at DESC (newest first)
    """
    # Build base query
    statement = select(ShoppingList).where(
        ShoppingList.is_active == True if active_only else True  # noqa: E712
    )

    # Get total count (before pagination)
    count_statement = select(func.count()).select_from(ShoppingList).where(
        ShoppingList.is_active == True if active_only else True  # noqa: E712
    )
    count_result = await session.execute(count_statement)
    total = count_result.scalar_one()

    # Add ordering and pagination
    statement = statement.order_by(ShoppingList.created_at.desc())
    statement = statement.limit(limit).offset(offset)

    # Execute query
    result = await session.execute(statement)
    shopping_lists = result.scalars().all()

    # For each list, calculate statistics
    lists_with_stats = []
    for shopping_list in shopping_lists:
        # Count total items (EXCLUDE soft-deleted)
        total_items_stmt = select(func.count()).where(
            ShoppingListItem.shopping_list_id == shopping_list.id,
            ShoppingListItem.deleted_at.is_(None),  # Exclude soft-deleted items
        )
        total_items_result = await session.execute(total_items_stmt)
        total_items = total_items_result.scalar_one()

        # Count completed items (EXCLUDE soft-deleted)
        completed_items_stmt = select(func.count()).where(
            ShoppingListItem.shopping_list_id == shopping_list.id,
            ShoppingListItem.is_completed == True,  # noqa: E712
            ShoppingListItem.deleted_at.is_(None),  # Exclude soft-deleted items
        )
        completed_items_result = await session.execute(completed_items_stmt)
        completed_items = completed_items_result.scalar_one()

        # Calculate completion percentage
        completion_percentage = (
            (completed_items / total_items * 100) if total_items > 0 else 0.0
        )

        lists_with_stats.append({
            "id": shopping_list.id,
            "name": shopping_list.name,
            "description": shopping_list.description,
            "creator_id": shopping_list.creator_id,
            "total_items": total_items,
            "completed_items": completed_items,
            "completion_percentage": round(completion_percentage, 1),
            "created_at": shopping_list.created_at,
            "updated_at": shopping_list.updated_at,
        })

    return lists_with_stats, total


async def get_shopping_list_with_items(
    session: AsyncSession,
    shopping_list_id: int,
) -> tuple[ShoppingList, list[ShoppingListItem]] | None:
    """
    Get shopping list with all associated items (detail view).

    Args:
        session: AsyncSession for database operations
        shopping_list_id: ShoppingList.id to retrieve

    Returns:
        Tuple of (ShoppingList, list of ShoppingListItem) or None if not found

    Example:
        >>> result = await get_shopping_list_with_items(session, shopping_list_id=1)
        >>> if result:
        ...     shopping_list, items = result
        ...     print(f"{shopping_list.name}: {len(items)} items")
        ...     for item in items:
        ...         status = "✓" if item.is_completed else "○"
        ...         print(f"  {status} {item.product_name}")

    Notes:
        - SHARED model: No user_id filtering
        - Items ordered by created_at ASC (order added)
        - Returns None if shopping list not found
    """
    # Get shopping list
    statement = select(ShoppingList).where(ShoppingList.id == shopping_list_id)
    result = await session.execute(statement)
    shopping_list = result.scalar_one_or_none()

    if not shopping_list:
        return None

    # Get all items for this list
    items_statement = (
        select(ShoppingListItem)
        .where(ShoppingListItem.shopping_list_id == shopping_list_id)
        .order_by(ShoppingListItem.created_at.asc())
    )
    items_result = await session.execute(items_statement)
    items = list(items_result.scalars().all())

    return shopping_list, items


async def get_shopping_list_item_count(
    session: AsyncSession,
    shopping_list_id: int,
) -> tuple[int, int]:
    """
    Get item counts for a shopping list.

    Args:
        session: AsyncSession for database operations
        shopping_list_id: ShoppingList.id to count items for

    Returns:
        Tuple of (total_items, completed_items)

    Example:
        >>> total, completed = await get_shopping_list_item_count(session, shopping_list_id=1)
        >>> print(f"Progress: {completed}/{total} ({completed/total*100:.1f}%)")

    Notes:
        - Used for progress indicators
        - Returns (0, 0) if list has no items
    """
    # Count total items (EXCLUDE soft-deleted)
    total_stmt = select(func.count()).where(
        ShoppingListItem.shopping_list_id == shopping_list_id,
        ShoppingListItem.deleted_at.is_(None),  # Exclude soft-deleted items
    )
    total_result = await session.execute(total_stmt)
    total_items = total_result.scalar_one()

    # Count completed items (EXCLUDE soft-deleted)
    completed_stmt = select(func.count()).where(
        ShoppingListItem.shopping_list_id == shopping_list_id,
        ShoppingListItem.is_completed == True,  # noqa: E712
        ShoppingListItem.deleted_at.is_(None),  # Exclude soft-deleted items
    )
    completed_result = await session.execute(completed_stmt)
    completed_items = completed_result.scalar_one()

    return total_items, completed_items


async def archive_shopping_list(
    session: AsyncSession,
    shopping_list: ShoppingList,
) -> ShoppingList:
    """
    Archive shopping list (set is_active=False).

    Convenience function for marking list as completed/archived.

    Args:
        session: AsyncSession for database operations
        shopping_list: ShoppingList instance to archive

    Returns:
        Updated ShoppingList instance

    Example:
        >>> shopping_list = await session.get(ShoppingList, 1)
        >>> archived_list = await archive_shopping_list(session, shopping_list)
        >>> print(f"Archived: {archived_list.is_active}")  # False

    Notes:
        - Items are NOT deleted (still accessible)
        - Can be restored by setting is_active=True
        - Archived lists hidden from landing page by default
    """
    shopping_list.is_active = False
    shopping_list.updated_at = func.now()
    session.add(shopping_list)
    await session.commit()
    await session.refresh(shopping_list)

    return shopping_list


async def restore_shopping_list(
    session: AsyncSession,
    shopping_list: ShoppingList,
) -> ShoppingList:
    """
    Restore archived shopping list (set is_active=True).

    Args:
        session: AsyncSession for database operations
        shopping_list: ShoppingList instance to restore

    Returns:
        Updated ShoppingList instance

    Example:
        >>> shopping_list = await session.get(ShoppingList, 1)
        >>> restored_list = await restore_shopping_list(session, shopping_list)
        >>> print(f"Restored: {restored_list.is_active}")  # True

    Notes:
        - Restores list to active state
        - All items remain unchanged
    """
    shopping_list.is_active = True
    shopping_list.updated_at = func.now()
    session.add(shopping_list)
    await session.commit()
    await session.refresh(shopping_list)

    return shopping_list
