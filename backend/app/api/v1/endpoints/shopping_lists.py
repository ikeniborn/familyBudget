"""
ShoppingList API endpoints.

This module provides REST API endpoints for managing shopping lists (headers)
with Header+Lines pattern.

ShoppingLists are SHARED across all users:
- All users can CREATE, READ, UPDATE
- Only list OWNER (creator) can DELETE

Endpoints:
    GET    /api/v1/shopping-lists         - List all shopping lists
    POST   /api/v1/shopping-lists         - Create new shopping list
    GET    /api/v1/shopping-lists/{id}    - Get shopping list by ID
    PUT    /api/v1/shopping-lists/{id}    - Update shopping list
    PUT    /api/v1/shopping-lists/{id}/archive - Archive shopping list
    PUT    /api/v1/shopping-lists/{id}/restore - Restore shopping list
    DELETE /api/v1/shopping-lists/{id}    - Delete shopping list (owner only!)
    GET    /api/v1/shopping-lists/{id}/with-items - Get list with all items
"""

import logging
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.api.v1.endpoints.budget_ws import (
    broadcast_shopping_list_created,
    broadcast_shopping_list_deleted,
    broadcast_shopping_list_updated,
)
from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.models.shopping_list import ShoppingList
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.shopping_list import (
    ShoppingListCardResponse,
    ShoppingListCreate,
    ShoppingListListResponse,
    ShoppingListResponse,
    ShoppingListUpdate,
    ShoppingListWithItemsResponse,
)
from backend.app.services import shopping_list_service
from backend.app.services.scd2_service import has_changes

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/shopping-lists",
    tags=["shopping-lists"],
    responses=get_common_responses(),
)


@router.get(
    "",
    response_model=ShoppingListListResponse,
    summary="List shopping lists",
    description="Get list of shopping lists with stats (shared across all users)",
)
async def list_shopping_lists(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    active_only: bool = Query(True, description="Show only active lists"),
) -> ShoppingListListResponse:
    """
    List shopping lists for all users (SHARED model).

    Shared references architecture: All users see all shopping lists.
    Returns lists with statistics (total_items, completed_items, completion_percentage).

    **NO user_id filtering** - returns ALL lists for all users.
    """
    # Get lists with statistics using service
    lists_with_stats, total = await shopping_list_service.get_shopping_lists_with_stats(
        session=session,
        limit=limit,
        offset=offset,
        active_only=active_only,
    )

    # Convert to card responses (for landing page grid)
    cards = [ShoppingListCardResponse(**list_data) for list_data in lists_with_stats]

    return ShoppingListListResponse(
        shopping_lists=cards,
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=ShoppingListResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create shopping list",
    description="Create a new shopping list (any authenticated user can create)",
)
async def create_shopping_list(
    shopping_list_data: ShoppingListCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListResponse:
    """
    Create a new shopping list.

    Shared references architecture: Any authenticated user can create lists.
    List is created with current_user.id as creator_id (tracks owner for delete permission).

    **IMPORTANT:** creator_id is used for:
    - Audit trail (who created the list)
    - DELETE permission (only owner can delete their list)
    - NOT for filtering (all users see all lists)
    """
    # Create shopping list (any authenticated user can create)
    shopping_list = ShoppingList(
        creator_id=current_user.id,  # Tracks owner for delete permission
        name=shopping_list_data.name,
        description=shopping_list_data.description,
    )

    # Generate temp_id for offline sync (before commit)
    shopping_list.temp_id = str(uuid.uuid4())

    session.add(shopping_list)
    await session.commit()
    await session.refresh(shopping_list)

    logger.info(
        f"Created shopping list {shopping_list.id} ({shopping_list.name}) "
        f"by user {current_user.id}"
    )

    response = ShoppingListResponse.model_validate(shopping_list)

    # Broadcast WebSocket event for multi-client sync
    try:
        await broadcast_shopping_list_created(response.model_dump(mode="json"))
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed for created list {shopping_list.id}: {e}")

    return response


@router.get(
    "/{shopping_list_id}",
    response_model=ShoppingListResponse,
    summary="Get shopping list",
    description="Get a single shopping list by ID",
)
async def get_shopping_list(
    shopping_list_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListResponse:
    """
    Get shopping list by ID.

    Shared references architecture: All users can access all shopping lists.
    """
    query = select(ShoppingList).where(ShoppingList.id == shopping_list_id)

    result = await session.execute(query)
    shopping_list = result.scalar_one_or_none()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list {shopping_list_id} not found",
        )

    # NO access restrictions - all users can read all shopping lists

    return ShoppingListResponse.model_validate(shopping_list)


@router.get(
    "/{shopping_list_id}/with-items",
    response_model=ShoppingListWithItemsResponse,
    summary="Get shopping list with items",
    description="Get shopping list with all associated items",
)
async def get_shopping_list_with_items(
    shopping_list_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListWithItemsResponse:
    """
    Get shopping list with all associated items.

    Shared references architecture: All users can access all lists and items.

    **Returns:**
    - Shopping list header
    - List of shopping list items (ordered by created_at ASC)

    **Use Cases:**
    - Detail view (table display)
    - Hierarchy view (tree display)
    """
    # Get list with items using service
    result = await shopping_list_service.get_shopping_list_with_items(
        session=session, shopping_list_id=shopping_list_id
    )

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list {shopping_list_id} not found",
        )

    shopping_list, items = result

    return ShoppingListWithItemsResponse(
        shopping_list=ShoppingListResponse.model_validate(shopping_list),
        items=items,
        total_items=len(items),
    )


@router.put(
    "/{shopping_list_id}",
    response_model=ShoppingListResponse,
    summary="Update shopping list",
    description="Update shopping list (any user can update)",
)
async def update_shopping_list(
    shopping_list_id: int,
    update_data: ShoppingListUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListResponse:
    """
    Update shopping list.

    Shared references architecture: Any user can update any list.

    **Simple UPDATE** (NOT SCD Type 2):
    - Updates shopping list IN-PLACE
    - No history tracking for list headers
    """
    # Fetch shopping list
    query = select(ShoppingList).where(ShoppingList.id == shopping_list_id)

    result = await session.execute(query)
    shopping_list = result.scalar_one_or_none()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list {shopping_list_id} not found",
        )

    # Get update dict
    update_dict = update_data.model_dump(exclude_unset=True)

    # Check if anything changed
    changed, changed_fields = has_changes(shopping_list, update_dict)
    if not changed:
        # No changes, return existing shopping list
        return ShoppingListResponse.model_validate(shopping_list)

    # Update shopping list (simple UPDATE, no SCD Type 2)
    for key, value in update_dict.items():
        setattr(shopping_list, key, value)

    shopping_list.updated_at = datetime.utcnow()
    session.add(shopping_list)
    await session.commit()
    await session.refresh(shopping_list)

    logger.info(
        f"Updated shopping list {shopping_list_id} ({shopping_list.name}) "
        f"fields: {changed_fields} by user {current_user.id}"
    )

    response = ShoppingListResponse.model_validate(shopping_list)

    # Broadcast WebSocket event for multi-client sync
    try:
        await broadcast_shopping_list_updated(response.model_dump(mode="json"))
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed for updated list {shopping_list_id}: {e}")

    return response


@router.put(
    "/{shopping_list_id}/archive",
    response_model=ShoppingListResponse,
    summary="Archive shopping list",
    description="Archive shopping list (simple UPDATE is_active=False)",
)
async def archive_shopping_list(
    shopping_list_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListResponse:
    """
    Archive shopping list by setting is_active=False.

    Simple UPDATE operation (NOT SCD Type 2).
    Archived shopping lists are hidden from landing page but data remains.
    Any user can archive any list.
    """
    query = select(ShoppingList).where(ShoppingList.id == shopping_list_id)
    result = await session.execute(query)
    shopping_list = result.scalar_one_or_none()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list {shopping_list_id} not found",
        )

    # Use service function for archive
    archived_list = await shopping_list_service.archive_shopping_list(
        session=session, shopping_list=shopping_list
    )

    logger.info(
        f"Archived shopping list {shopping_list_id} ({shopping_list.name}) "
        f"by user {current_user.id}"
    )

    return ShoppingListResponse.model_validate(archived_list)


@router.put(
    "/{shopping_list_id}/restore",
    response_model=ShoppingListResponse,
    summary="Restore archived shopping list",
    description="Restore shopping list (simple UPDATE is_active=True)",
)
async def restore_shopping_list(
    shopping_list_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListResponse:
    """
    Restore archived shopping list by setting is_active=True.

    Simple UPDATE operation (NOT SCD Type 2).
    Any user can restore any list.
    """
    query = select(ShoppingList).where(ShoppingList.id == shopping_list_id)
    result = await session.execute(query)
    shopping_list = result.scalar_one_or_none()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list {shopping_list_id} not found",
        )

    # Use service function for restore
    restored_list = await shopping_list_service.restore_shopping_list(
        session=session, shopping_list=shopping_list
    )

    logger.info(
        f"Restored shopping list {shopping_list_id} ({shopping_list.name}) "
        f"by user {current_user.id}"
    )

    return ShoppingListResponse.model_validate(restored_list)


@router.delete(
    "/{shopping_list_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete shopping list",
    description="Delete shopping list (owner only!) with cascade (deletes all items)",
)
async def delete_shopping_list(
    shopping_list_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Physically delete shopping list with cascade deletion.

    **IMPORTANT: Only list OWNER can delete!**
    - Checks creator_id == current_user.id
    - Returns 403 Forbidden if user is not the owner

    Cascade deletion order:
    1. Check delete permission (owner only)
    2. Delete all ShoppingListItem records (CASCADE via FK constraint)
    3. Delete the ShoppingList record
    4. No history tracking for shopping lists (simple fact table)

    Raises:
        HTTPException: 403 if not owner
        HTTPException: 404 if shopping list not found
    """
    from backend.app.models.shopping_list_item import ShoppingListItem

    # Fetch shopping list
    query = select(ShoppingList).where(ShoppingList.id == shopping_list_id)

    result = await session.execute(query)
    shopping_list = result.scalar_one_or_none()

    if not shopping_list:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list {shopping_list_id} not found",
        )

    # Check delete permission using service (CRITICAL: only owner can delete)
    has_permission, error_msg = await shopping_list_service.check_delete_permission(
        session=session,
        shopping_list_id=shopping_list_id,
        user_id=current_user.id,
    )

    if not has_permission:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=error_msg,
        )

    # Count items for logging
    items_query = select(func.count(ShoppingListItem.id)).where(
        ShoppingListItem.shopping_list_id == shopping_list_id
    )
    items_result = await session.execute(items_query)
    items_count = items_result.scalar()

    # Delete shopping list (CASCADE will delete all items via FK constraint)
    await session.delete(shopping_list)
    await session.commit()

    # Broadcast WebSocket event for multi-client sync
    try:
        await broadcast_shopping_list_deleted(shopping_list_id)
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed for deleted list {shopping_list_id}: {e}")

    logger.info(
        f"Deleted shopping list {shopping_list_id} ({shopping_list.name}) "
        f"with {items_count} items by owner {current_user.id}"
    )

    return None  # 204 No Content
