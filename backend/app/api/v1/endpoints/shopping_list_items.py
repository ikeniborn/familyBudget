"""
ShoppingListItem API endpoints.

This module provides REST API endpoints for managing shopping list items (lines)
with batch operations and offline sync support.

ShoppingListItems are SHARED across all users (any user can add/edit/delete items).

Endpoints:
    GET    /api/v1/shopping-list-items         - List items for a shopping list
    POST   /api/v1/shopping-list-items         - Create new item
    GET    /api/v1/shopping-list-items/{id}    - Get item by ID
    PUT    /api/v1/shopping-list-items/{id}    - Update item
    DELETE /api/v1/shopping-list-items/{id}    - Delete item
    POST   /api/v1/shopping-list-items/batch-complete - Mark multiple items as completed
    POST   /api/v1/shopping-list-items/batch-delete   - Delete multiple items
    GET    /api/v1/shopping-list-items/pending-sync   - Get items pending offline sync
"""

import logging

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.models.shopping_list_item import ShoppingListItem
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.shopping_list_item import (
    BatchCompleteRequest,
    BatchDeleteRequest,
    ShoppingListItemCreate,
    ShoppingListItemListResponse,
    ShoppingListItemResponse,
    ShoppingListItemUpdate,
)
from backend.app.services import shopping_list_item_service
from backend.app.services.scd2_service import has_changes

router = APIRouter(
    prefix="/shopping-list-items",
    tags=["shopping-list-items"],
    responses=get_common_responses(),
)


@router.get(
    "",
    response_model=ShoppingListItemListResponse,
    summary="List shopping list items",
    description="Get items for a shopping list (with optional filters)",
)
async def list_shopping_list_items(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    shopping_list_id: int = Query(..., description="Shopping list ID to filter"),
    is_completed: bool | None = Query(
        None, description="Filter by completion status (True/False/None)"
    ),
    store_id: int | None = Query(None, description="Filter by store ID"),
    product_group_id: int | None = Query(None, description="Filter by product group ID"),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
) -> ShoppingListItemListResponse:
    """
    List shopping list items with optional filters.

    Shared references architecture: All users see all items.

    **Filters:**
    - shopping_list_id: Required (which list to display)
    - is_completed: Optional (True for completed, False for incomplete, None for all)
    - store_id: Optional (filter by store)
    - product_group_id: Optional (filter by product group)

    **Use Cases:**
    - Table view (all items)
    - Filter by completion status (show only incomplete)
    - Filter by store (shopping trip planning)
    - Filter by product group (category grouping)
    """
    # Build query
    query = select(ShoppingListItem).where(
        ShoppingListItem.shopping_list_id == shopping_list_id
    )

    # Apply filters
    if is_completed is not None:
        query = query.where(ShoppingListItem.is_completed == is_completed)

    if store_id is not None:
        query = query.where(ShoppingListItem.store_id == store_id)

    if product_group_id is not None:
        query = query.where(ShoppingListItem.product_group_id == product_group_id)

    # Order by created_at ASC (order added)
    query = query.order_by(ShoppingListItem.created_at.asc())

    # Execute query with pagination
    query = query.limit(limit).offset(offset)
    result = await session.execute(query)
    items = result.scalars().all()

    # Count total (without pagination)
    count_query = select(ShoppingListItem).where(
        ShoppingListItem.shopping_list_id == shopping_list_id
    )
    if is_completed is not None:
        count_query = count_query.where(ShoppingListItem.is_completed == is_completed)
    if store_id is not None:
        count_query = count_query.where(ShoppingListItem.store_id == store_id)
    if product_group_id is not None:
        count_query = count_query.where(
            ShoppingListItem.product_group_id == product_group_id
        )

    count_result = await session.execute(count_query)
    total = len(count_result.all())

    return ShoppingListItemListResponse(
        items=[ShoppingListItemResponse.model_validate(item) for item in items],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=ShoppingListItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create shopping list item",
    description="Create a new shopping list item (any user can create)",
)
async def create_shopping_list_item(
    item_data: ShoppingListItemCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListItemResponse:
    """
    Create a new shopping list item.

    Shared references architecture: Any authenticated user can create items.

    **Required fields:**
    - shopping_list_id: Which list to add item to
    - store_id: Which store to buy at
    - product_group_id: Product category
    - product_name: Product name

    **Optional fields:**
    - quantity: Amount to buy (Decimal)
    - unit: Unit of measurement (e.g., "kg", "pcs", "l")
    - comment: Additional notes
    """
    # Create shopping list item
    item = ShoppingListItem(
        creator_id=current_user.id,  # Audit trail
        shopping_list_id=item_data.shopping_list_id,
        store_id=item_data.store_id,
        product_group_id=item_data.product_group_id,
        product_name=item_data.product_name,
        quantity=item_data.quantity,
        unit=item_data.unit,
        comment=item_data.comment,
        sync_status="synced",  # Created online = synced
    )

    session.add(item)
    await session.commit()
    await session.refresh(item)

    logger.info(
        f"Created shopping list item {item.id} ({item.product_name}) "
        f"for list {item.shopping_list_id} by user {current_user.id}"
    )

    return ShoppingListItemResponse.model_validate(item)


@router.get(
    "/{item_id}",
    response_model=ShoppingListItemResponse,
    summary="Get shopping list item",
    description="Get a single shopping list item by ID",
)
async def get_shopping_list_item(
    item_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListItemResponse:
    """
    Get shopping list item by ID.

    Shared references architecture: All users can access all items.
    """
    query = select(ShoppingListItem).where(ShoppingListItem.id == item_id)

    result = await session.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list item {item_id} not found",
        )

    # NO access restrictions - all users can read all items

    return ShoppingListItemResponse.model_validate(item)


@router.put(
    "/{item_id}",
    response_model=ShoppingListItemResponse,
    summary="Update shopping list item",
    description="Update shopping list item (any user can update)",
)
async def update_shopping_list_item(
    item_id: int,
    update_data: ShoppingListItemUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListItemResponse:
    """
    Update shopping list item.

    Shared references architecture: Any user can update any item.

    **Simple UPDATE** (NOT SCD Type 2):
    - Updates item IN-PLACE
    - No history tracking for items (simple fact table)
    - Updates sync_status to 'synced' (online update)
    """
    # Fetch item
    query = select(ShoppingListItem).where(ShoppingListItem.id == item_id)

    result = await session.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list item {item_id} not found",
        )

    # Get update dict
    update_dict = update_data.model_dump(exclude_unset=True)

    # Check if anything changed
    changed, changed_fields = has_changes(item, update_dict)
    if not changed:
        # No changes, return existing item
        return ShoppingListItemResponse.model_validate(item)

    # Update item (simple UPDATE, no SCD Type 2)
    for key, value in update_dict.items():
        setattr(item, key, value)

    # Mark as synced (online update)
    item.sync_status = "synced"

    # Updated timestamp handled by SQLModel (updated_at auto-update)
    session.add(item)
    await session.commit()
    await session.refresh(item)

    logger.info(
        f"Updated shopping list item {item_id} ({item.product_name}) "
        f"fields: {changed_fields} by user {current_user.id}"
    )

    return ShoppingListItemResponse.model_validate(item)


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete shopping list item",
    description="Delete shopping list item (any user can delete)",
)
async def delete_shopping_list_item(
    item_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Physically delete shopping list item.

    Shared references architecture: Any user can delete any item.

    **No history tracking** (simple fact table).
    **IMPORTANT:** Use await session.delete() to avoid RuntimeWarning.
    """
    # Fetch item
    query = select(ShoppingListItem).where(ShoppingListItem.id == item_id)

    result = await session.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list item {item_id} not found",
        )

    # Delete item (IMPORTANT: await to avoid RuntimeWarning)
    await session.delete(item)
    await session.commit()

    logger.info(
        f"Deleted shopping list item {item_id} ({item.product_name}) "
        f"by user {current_user.id}"
    )

    return None  # 204 No Content


@router.post(
    "/batch-complete",
    status_code=status.HTTP_200_OK,
    summary="Batch complete items",
    description="Mark multiple items as completed (or uncompleted)",
)
async def batch_complete_items(
    request: BatchCompleteRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Mark multiple shopping list items as completed (or uncompleted).

    Batch operation for efficiency.

    **Shared references architecture:** Any user can complete any items.

    **Request:**
    - item_ids: List of item IDs to update
    - is_completed: True to mark as completed, False to unmark

    **Returns:**
    - count: Number of items updated
    """
    # Validate: item_ids not empty
    if not request.item_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="item_ids list cannot be empty",
        )

    # Batch complete using service
    count = await shopping_list_item_service.batch_complete_items(
        session=session,
        item_ids=request.item_ids,
        is_completed=request.is_completed,
    )

    logger.info(
        f"Batch {'completed' if request.is_completed else 'uncompleted'} "
        f"{count} items by user {current_user.id}"
    )

    return {
        "message": f"Marked {count} items as {'completed' if request.is_completed else 'incomplete'}",
        "count": count,
    }


@router.post(
    "/batch-delete",
    status_code=status.HTTP_200_OK,
    summary="Batch delete items",
    description="Delete multiple items at once",
)
async def batch_delete_items(
    request: BatchDeleteRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Delete multiple shopping list items at once.

    Batch operation for efficiency.

    **Shared references architecture:** Any user can delete any items.

    **Request:**
    - item_ids: List of item IDs to delete

    **Returns:**
    - count: Number of items deleted
    """
    # Validate: item_ids not empty
    if not request.item_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="item_ids list cannot be empty",
        )

    # Batch delete using service
    count = await shopping_list_item_service.batch_delete_items(
        session=session, item_ids=request.item_ids
    )

    logger.info(f"Batch deleted {count} items by user {current_user.id}")

    return {"message": f"Deleted {count} items", "count": count}


@router.get(
    "/pending-sync",
    response_model=ShoppingListItemListResponse,
    summary="Get pending sync items",
    description="Get items pending offline sync (sync_status='pending')",
)
async def get_pending_sync_items(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    shopping_list_id: int | None = Query(
        None, description="Optional filter by shopping list ID"
    ),
) -> ShoppingListItemListResponse:
    """
    Get all items with pending sync status.

    Used for offline sync queue processing.

    **Shared references architecture:** Returns all pending items (no user filtering).

    **Returns:**
    - Items with sync_status='pending'
    - Ordered by created_at ASC (oldest first)

    **Use Cases:**
    - Offline sync queue processing
    - Display sync indicator in UI
    - Background sync job
    """
    # Get pending items using service
    pending_items = await shopping_list_item_service.get_pending_sync_items(
        session=session, shopping_list_id=shopping_list_id
    )

    return ShoppingListItemListResponse(
        items=[ShoppingListItemResponse.model_validate(item) for item in pending_items],
        total=len(pending_items),
        limit=len(pending_items),
        offset=0,
    )
