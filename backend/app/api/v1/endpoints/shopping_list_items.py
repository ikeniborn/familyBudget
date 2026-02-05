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
    DELETE /api/v1/shopping-list-items/{id}    - Soft-delete item
    POST   /api/v1/shopping-list-items/batch-complete - Mark multiple items as completed
    POST   /api/v1/shopping-list-items/batch-delete   - Soft-delete multiple items
    GET    /api/v1/shopping-list-items/pending-sync   - Get items pending offline sync
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.models.product_group import ProductGroup
from backend.app.models.shopping_list_item import ShoppingListItem
from backend.app.models.store import Store
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.shopping_list_item import (
    BatchCompleteRequest,
    BatchDeleteRequest,
    BatchSyncRequest,
    BatchSyncResponse,
    ConflictResolutionRequest,
    ProductSuggestion,
    ProductSuggestionsResponse,
    ShoppingListItemCreate,
    ShoppingListItemListResponse,
    ShoppingListItemResponse,
    ShoppingListItemUpdate,
    SyncConflict,
    SyncCreatedItem,
    SyncDeltaResponse,
)
from backend.app.services import shopping_list_item_service
from backend.app.services.scd2_service import has_changes

logger = logging.getLogger(__name__)

# WebSocket broadcast functions (lazy import to avoid circular dependencies)
_ws_module = None

def _get_ws_broadcast():
    """Lazy import WebSocket module to avoid circular dependencies."""
    global _ws_module
    if _ws_module is None:
        from backend.app.api.v1.endpoints import budget_ws
        _ws_module = budget_ws
    return _ws_module


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
    # Build query (exclude soft-deleted items)
    query = select(ShoppingListItem).where(
        ShoppingListItem.shopping_list_id == shopping_list_id,
        ShoppingListItem.deleted_at.is_(None),
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

    # Count total (without pagination, exclude soft-deleted)
    count_query = select(ShoppingListItem).where(
        ShoppingListItem.shopping_list_id == shopping_list_id,
        ShoppingListItem.deleted_at.is_(None),
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
    # Log before creation
    logger.info(
        f"[ITEM_CREATE] Creating item: user_id={current_user.id}, "
        f"list_id={item_data.shopping_list_id}, product='{item_data.product_name}', "
        f"store_id={item_data.store_id}, quantity={item_data.quantity}"
    )

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

    # Warn if non-integer quantity detected (legacy data or bypassed frontend validation)
    if item.quantity is not None and item.quantity % 1 != 0:
        logger.warning(
            f"[SHOPPING_ITEM] Non-integer quantity detected: "
            f"item_id={item.id}, quantity={item.quantity}, "
            f"message='Integer quantities preferred (legacy data)'"
        )

    # Log after successful creation
    logger.info(
        f"[ITEM_CREATE] Item created successfully: item_id={item.id}, "
        f"product='{item.product_name}'"
    )

    # Broadcast SSE event to all connected clients
    response = ShoppingListItemResponse.model_validate(item)
    try:
        ws = _get_ws_broadcast()
        await ws.broadcast_item_created(item_data=response.model_dump(mode="json"))
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed for created item {item.id}: {e}")

    return response


# ==================== AUTOCOMPLETE ENDPOINT ====================
# NOTE: This endpoint MUST be defined BEFORE /{item_id} to prevent
# FastAPI from matching "/products/suggest" as item_id parameter


@router.get(
    "/products/suggest",
    response_model=ProductSuggestionsResponse,
    summary="Get product suggestions for autocomplete",
    description="Search product names from shopping list history for autocomplete",
)
async def suggest_products(
    q: str = Query(
        ...,
        min_length=2,
        max_length=100,
        description="Search query (min 2 characters)"
    ),
    shopping_list_id: int | None = Query(
        default=None,
        description="Filter by shopping list ID (enables restore of deleted items)"
    ),
    include_deleted: bool = Query(
        default=True,
        description="Include soft-deleted items from current list (for restore)"
    ),
    limit: int = Query(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of suggestions"
    ),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProductSuggestionsResponse:
    """
    Get product suggestions based on shopping list history.

    **Features:**
    - Case-insensitive substring search using func.lower() + LIKE
    - Works reliably with Cyrillic characters regardless of database collation
    - Finds products containing the search query (e.g., "мол" finds "Молоко", "МОЛ" finds "молоко")
    - Returns unique products with store and product group info
    - Sorted by last usage, then by usage count
    - Includes usage count for relevance
    - **NEW:** When shopping_list_id is provided, includes soft-deleted items
      from that list (marked with is_deleted=true) for restore functionality

    **Example:**
    ```
    GET /api/v1/shopping-list-items/products/suggest?q=мол&limit=10
    GET /api/v1/shopping-list-items/products/suggest?q=мол&shopping_list_id=5&include_deleted=true
    ```

    **Response:**
    ```json
    {
      "suggestions": [
        {
          "id": 123,
          "is_deleted": true,
          "shopping_list_id": 5,
          "product_name": "Молоко",
          "store_id": 1,
          "store_name": "Ашан",
          "product_group_id": 5,
          "product_group_name": "Молочные продукты",
          "quantity": 2,
          "unit": "л",
          "comment": "3.2%",
          "last_used": "2025-01-10T12:00:00",
          "usage_count": 1
        }
      ],
      "query": "мол",
      "count": 1
    }
    ```
    """
    # Escape LIKE special characters to prevent SQL injection
    # Note: pg_trgm similarity doesn't work with Cyrillic when DB collate is 'C'
    search_pattern = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    suggestions: list[ProductSuggestion] = []

    # Query 1: Soft-deleted items from current list (priority - can be restored)
    if shopping_list_id and include_deleted:
        deleted_query = (
            select(
                ShoppingListItem.id,
                ShoppingListItem.shopping_list_id,
                ShoppingListItem.product_name,
                ShoppingListItem.store_id,
                ShoppingListItem.product_group_id,
                ShoppingListItem.quantity,
                ShoppingListItem.unit,
                ShoppingListItem.comment,
                Store.name.label("store_name"),
                ProductGroup.name.label("product_group_name"),
                ShoppingListItem.deleted_at.label("last_used"),
            )
            .join(Store, ShoppingListItem.store_id == Store.id, isouter=True)
            .join(
                ProductGroup,
                ShoppingListItem.product_group_id == ProductGroup.id,
                isouter=True
            )
            .where(
                ShoppingListItem.shopping_list_id == shopping_list_id,
                func.lower(ShoppingListItem.product_name.collate("ru-RU-x-icu")).like(f"%{search_pattern.lower()}%"),
                ShoppingListItem.deleted_at.is_not(None),  # Only soft-deleted
            )
            .order_by(ShoppingListItem.deleted_at.desc())  # Most recently deleted first
            .limit(limit)
        )

        deleted_result = await session.execute(deleted_query)
        deleted_rows = deleted_result.all()

        for row in deleted_rows:
            suggestions.append(
                ProductSuggestion(
                    id=row.id,
                    is_deleted=True,
                    shopping_list_id=row.shopping_list_id,
                    product_name=row.product_name,
                    store_id=row.store_id,
                    store_name=row.store_name,
                    product_group_id=row.product_group_id,
                    product_group_name=row.product_group_name,
                    quantity=row.quantity,
                    unit=row.unit,
                    comment=row.comment,
                    last_used=row.last_used,
                    usage_count=1,
                )
            )

    # Query 2: Active items (aggregated across all lists)
    active_query = (
        select(
            ShoppingListItem.product_name,
            ShoppingListItem.store_id,
            ShoppingListItem.product_group_id,
            Store.name.label("store_name"),
            ProductGroup.name.label("product_group_name"),
            func.max(ShoppingListItem.created_at).label("last_used"),
            func.count().label("usage_count"),
        )
        .join(Store, ShoppingListItem.store_id == Store.id, isouter=True)
        .join(ProductGroup, ShoppingListItem.product_group_id == ProductGroup.id, isouter=True)
        .where(
            func.lower(ShoppingListItem.product_name.collate("ru-RU-x-icu")).like(f"%{search_pattern.lower()}%"),
            ShoppingListItem.deleted_at.is_(None),  # Exclude soft-deleted
        )
        .group_by(
            ShoppingListItem.product_name,
            ShoppingListItem.store_id,
            ShoppingListItem.product_group_id,
            Store.name,
            ProductGroup.name,
        )
        .order_by(
            func.max(ShoppingListItem.created_at).desc(),
            func.count().desc()
        )
        .limit(limit)
    )

    active_result = await session.execute(active_query)
    active_rows = active_result.all()

    for row in active_rows:
        suggestions.append(
            ProductSuggestion(
                id=None,  # Aggregated - no specific item ID
                is_deleted=False,
                shopping_list_id=None,
                product_name=row.product_name,
                store_id=row.store_id,
                store_name=row.store_name,
                product_group_id=row.product_group_id,
                product_group_name=row.product_group_name,
                quantity=None,
                unit=None,
                comment=None,
                last_used=row.last_used,
                usage_count=row.usage_count,
            )
        )

    # Deduplicate: prefer deleted items (have specific ID for restore)
    seen: set[tuple[str, int | None, int | None]] = set()
    unique_suggestions: list[ProductSuggestion] = []

    for s in suggestions:
        key = (s.product_name.lower(), s.store_id, s.product_group_id)
        if key not in seen:
            seen.add(key)
            unique_suggestions.append(s)
            if len(unique_suggestions) >= limit:
                break

    logger.debug(
        f"Product suggestions for '{q}' (list={shopping_list_id}): "
        f"{len(unique_suggestions)} results "
        f"({sum(1 for s in unique_suggestions if s.is_deleted)} deleted)"
    )

    return ProductSuggestionsResponse(
        suggestions=unique_suggestions,
        query=q,
        count=len(unique_suggestions),
    )


@router.get(
    "/check-duplicate",
    response_model=ShoppingListItemResponse | None,
    summary="Check for duplicate item in list",
    description="Search for existing non-completed item matching product_name and store_id",
)
async def check_duplicate_item(
    shopping_list_id: int = Query(..., description="Shopping list ID"),
    product_name: str = Query(
        ..., min_length=1, description="Product name to search"
    ),
    store_id: int = Query(..., description="Store ID"),
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListItemResponse | None:
    """
    Check if similar item exists in shopping list (NOT completed).

    Used for duplicate detection in Add/Edit modal.

    Matching logic:
    - Same shopping_list_id
    - Same store_id
    - Product name matches (case-insensitive EXACT)
    - NOT completed (is_completed=False)
    - NOT soft-deleted (deleted_at IS NULL)

    Returns:
    - Matching item if found (first result)
    - None if no duplicate found
    """
    logger.info(
        f"[DUPLICATE_SEARCH] Checking duplicate: "
        f"list_id={shopping_list_id}, product='{product_name}', store_id={store_id}, "
        f"user_id={current_user.id}"
    )

    # Query for duplicate (case-insensitive exact match)
    query = (
        select(ShoppingListItem)
        .where(
            ShoppingListItem.shopping_list_id == shopping_list_id,
            ShoppingListItem.store_id == store_id,
            func.lower(ShoppingListItem.product_name)
            == func.lower(product_name),
            not ShoppingListItem.is_completed,
            ShoppingListItem.deleted_at.is_(None),
        )
        .limit(1)
    )

    result = await session.execute(query)
    item = result.scalar_one_or_none()

    if item:
        logger.info(
            f"[DUPLICATE_SEARCH] Found duplicate: "
            f"item_id={item.id}, quantity={item.quantity}, unit={item.unit}"
        )
        return ShoppingListItemResponse.model_validate(item)

    logger.info("[DUPLICATE_SEARCH] No duplicate found")
    return None


# ==================== ITEM CRUD ENDPOINTS ====================


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
    Soft-deleted items are excluded (return 404).
    """
    query = select(ShoppingListItem).where(
        ShoppingListItem.id == item_id,
        ShoppingListItem.deleted_at.is_(None),
    )

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
    - Increments version for optimistic locking
    - Sets completed_at when is_completed changes to True
    - Updates sync_status to 'synced' (online update)
    """
    # Fetch item (exclude soft-deleted)
    query = select(ShoppingListItem).where(
        ShoppingListItem.id == item_id,
        ShoppingListItem.deleted_at.is_(None),
    )

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

    # Log before update
    logger.info(
        f"[ITEM_UPDATE] Updating item: item_id={item_id}, user_id={current_user.id}, "
        f"changes={update_dict}"
    )

    # Track if is_completed changed to True
    is_completing = (
        "is_completed" in update_dict
        and update_dict["is_completed"]
        and not item.is_completed
    )

    # Update item (simple UPDATE, no SCD Type 2)
    for key, value in update_dict.items():
        setattr(item, key, value)

    # Increment version for optimistic locking
    item.version += 1

    # Set completed_at when marking as completed
    if is_completing:
        item.completed_at = datetime.utcnow()

    # Track who made the change
    item.last_modified_by = current_user.id

    # Mark as synced (online update)
    item.sync_status = "synced"

    # Update timestamp
    item.updated_at = datetime.utcnow()

    session.add(item)
    await session.commit()
    await session.refresh(item)

    # Log after successful update
    logger.info(
        f"[ITEM_UPDATE] Item updated successfully: item_id={item_id}, "
        f"product='{item.product_name}', quantity={item.quantity}"
    )

    # Broadcast SSE event to all connected clients
    response = ShoppingListItemResponse.model_validate(item)
    try:
        ws = _get_ws_broadcast()
        await ws.broadcast_item_updated(item_data=response.model_dump(mode="json"))
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed for updated item {item_id}: {e}")

    return response


@router.delete(
    "/{item_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete shopping list item",
    description="Soft-delete shopping list item (any user can delete)",
)
async def delete_shopping_list_item(
    item_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Soft-delete shopping list item.

    Shared references architecture: Any user can delete any item.

    **Soft delete** (NOT physical deletion):
    - Sets deleted_at timestamp
    - Increments version for optimistic locking
    - Item remains in DB for autocomplete history
    - Excluded from regular queries via deleted_at IS NULL
    """
    # Fetch item (exclude already soft-deleted)
    query = select(ShoppingListItem).where(
        ShoppingListItem.id == item_id,
        ShoppingListItem.deleted_at.is_(None),
    )

    result = await session.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list item {item_id} not found",
        )

    # Soft delete: set deleted_at instead of physical deletion
    list_id = item.shopping_list_id  # Save for SSE broadcast
    item.deleted_at = datetime.utcnow()
    item.version += 1
    item.last_modified_by = current_user.id
    item.updated_at = datetime.utcnow()

    session.add(item)
    await session.commit()

    logger.info(
        f"Soft-deleted shopping list item {item_id} ({item.product_name}) "
        f"version: {item.version} by user {current_user.id}"
    )

    # Broadcast SSE event to all connected clients
    try:
        ws = _get_ws_broadcast()
        await ws.broadcast_item_deleted(item_id=item_id, shopping_list_id=list_id)
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed for deleted item {item_id}: {e}")

    return None  # 204 No Content


# ==================== RESTORE ENDPOINT ====================


@router.put(
    "/{item_id}/restore",
    response_model=ShoppingListItemResponse,
    summary="Restore soft-deleted item",
    description="Restore a soft-deleted shopping list item (sets deleted_at=NULL)",
)
async def restore_shopping_list_item(
    item_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListItemResponse:
    """
    Restore a soft-deleted shopping list item.

    Sets deleted_at=NULL, increments version for optimistic locking.
    Idempotent: if item is already active, returns it unchanged.

    **Shared references architecture:** Any user can restore any item.

    **Returns:**
    - Restored ShoppingListItemResponse

    **Errors:**
    - 404: Item not found
    """
    item = await shopping_list_item_service.restore_item(
        session=session,
        item_id=item_id,
        user_id=current_user.id,
    )

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list item {item_id} not found",
        )

    logger.info(
        f"Restored shopping list item {item_id} ({item.product_name}) "
        f"version: {item.version} by user {current_user.id}"
    )

    response = ShoppingListItemResponse.model_validate(item)

    # Broadcast SSE event (item "appeared" back)
    try:
        ws = _get_ws_broadcast()
        await ws.broadcast_item_created(item_data=response.model_dump(mode="json"))
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed for restored item {item_id}: {e}")

    return response


# ==================== BATCH OPERATIONS ====================


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

    # First, get shopping_list_ids for SSE broadcast
    items_query = select(ShoppingListItem).where(
        ShoppingListItem.id.in_(request.item_ids),
        ShoppingListItem.deleted_at.is_(None),
    )
    items_result = await session.execute(items_query)
    items = items_result.scalars().all()

    # Group items by shopping_list_id for broadcast
    items_by_list: dict[int, list[int]] = {}
    for item in items:
        if item.shopping_list_id not in items_by_list:
            items_by_list[item.shopping_list_id] = []
        items_by_list[item.shopping_list_id].append(item.id)

    # Batch complete using service (with version increment, completed_at)
    count = await shopping_list_item_service.batch_complete_items(
        session=session,
        item_ids=request.item_ids,
        is_completed=request.is_completed,
        user_id=current_user.id,
    )

    logger.info(
        f"Batch {'completed' if request.is_completed else 'uncompleted'} "
        f"{count} items by user {current_user.id}"
    )

    # Broadcast SSE events to all connected clients
    try:
        ws = _get_ws_broadcast()
        for list_id, item_ids in items_by_list.items():
            for item_id in item_ids:
                await ws.broadcast_item_completed(
                    item_id=item_id,
                    shopping_list_id=list_id,
                    is_completed=request.is_completed,
                )
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed for batch complete: {e}")

    return {
        "message": f"Marked {count} items as {'completed' if request.is_completed else 'incomplete'}",
        "count": count,
    }


@router.post(
    "/batch-delete",
    status_code=status.HTTP_200_OK,
    summary="Batch soft-delete items",
    description="Soft-delete multiple items at once (sets deleted_at, keeps for autocomplete)",
)
async def batch_delete_items(
    request: BatchDeleteRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Soft-delete multiple shopping list items at once.

    Batch operation for efficiency.

    **Shared references architecture:** Any user can delete any items.

    **Soft delete** (NOT physical deletion):
    - Sets deleted_at timestamp
    - Increments version for optimistic locking
    - Items remain in DB for autocomplete history
    - Excluded from regular queries via deleted_at IS NULL

    **Request:**
    - item_ids: List of item IDs to soft-delete

    **Returns:**
    - count: Number of items soft-deleted
    """
    # Validate: item_ids not empty
    if not request.item_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="item_ids list cannot be empty",
        )

    # First, get shopping_list_ids for SSE broadcast
    items_query = select(ShoppingListItem).where(
        ShoppingListItem.id.in_(request.item_ids),
        ShoppingListItem.deleted_at.is_(None),
    )
    items_result = await session.execute(items_query)
    items = items_result.scalars().all()

    # Group items by shopping_list_id for broadcast
    items_by_list: dict[int, list[int]] = {}
    for item in items:
        if item.shopping_list_id not in items_by_list:
            items_by_list[item.shopping_list_id] = []
        items_by_list[item.shopping_list_id].append(item.id)

    # Batch soft-delete using service (with version increment)
    count = await shopping_list_item_service.batch_delete_items(
        session=session,
        item_ids=request.item_ids,
        user_id=current_user.id,
    )

    logger.info(f"Batch deleted {count} items by user {current_user.id}")

    # Broadcast SSE events to all connected clients
    try:
        ws = _get_ws_broadcast()
        for list_id, item_ids in items_by_list.items():
            for item_id in item_ids:
                await ws.broadcast_item_deleted(item_id=item_id, shopping_list_id=list_id)
    except Exception as e:
        logger.warning(f"WebSocket broadcast failed for batch delete: {e}")

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


# ============== Sync API Endpoints ==============


@router.get(
    "/sync",
    response_model=SyncDeltaResponse,
    summary="Delta sync",
    description="Get items changed since last sync timestamp",
)
async def delta_sync(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    shopping_list_id: int = Query(..., description="Shopping list ID"),
    since: datetime | None = Query(
        None, description="Get changes since this timestamp (ISO 8601)"
    ),
) -> SyncDeltaResponse:
    """
    Delta sync: Get items changed since last sync.

    Returns:
    - items: Active items created/updated since timestamp
    - deleted_ids: IDs of items soft-deleted since timestamp
    - server_time: Current server time (use for next sync)

    **Use Case:**
    - Initial sync (since=None): Get all active items
    - Incremental sync: Get only changes since last sync
    """
    server_time = datetime.utcnow()

    # Build query for active items
    query = select(ShoppingListItem).where(
        ShoppingListItem.shopping_list_id == shopping_list_id,
        ShoppingListItem.deleted_at.is_(None),
    )

    # If 'since' provided, filter by updated_at
    if since:
        query = query.where(ShoppingListItem.updated_at > since)

    query = query.order_by(ShoppingListItem.updated_at.asc())
    result = await session.execute(query)
    items = result.scalars().all()

    # Get deleted IDs (soft-deleted since timestamp)
    deleted_ids: list[int] = []
    if since:
        deleted_query = select(ShoppingListItem.id).where(
            ShoppingListItem.shopping_list_id == shopping_list_id,
            ShoppingListItem.deleted_at.is_not(None),
            ShoppingListItem.deleted_at > since,
        )
        deleted_result = await session.execute(deleted_query)
        deleted_ids = list(deleted_result.scalars().all())

    return SyncDeltaResponse(
        items=[ShoppingListItemResponse.model_validate(item) for item in items],
        deleted_ids=deleted_ids,
        server_time=server_time,
    )


@router.post(
    "/sync/batch",
    response_model=BatchSyncResponse,
    summary="Batch sync",
    description="Sync multiple create/update/delete operations in one request",
)
async def batch_sync(
    request: BatchSyncRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> BatchSyncResponse:
    """
    Batch sync: Process multiple operations in one request.

    **Creates:** New items with temp_id mapping
    **Updates:** With version check (conflict if version mismatch)
    **Deletes:** With version check (conflict if version mismatch)

    **Conflict Resolution:**
    - update_update: Server and client both modified (auto-merge where possible)
    - update_delete: Client updated, server deleted (UI conflict)
    - delete_update: Client deleted, server updated (UI conflict)

    **Auto-merge Rules:**
    - Content fields (product_name, quantity, etc.): Server wins
    - is_completed: true wins (if either side is completed)
    """
    server_time = datetime.utcnow()
    created: list[SyncCreatedItem] = []
    updated: list[ShoppingListItemResponse] = []
    deleted: list[int] = []
    conflicts: list[SyncConflict] = []

    # Process CREATES
    for create_req in request.creates:
        item = ShoppingListItem(
            creator_id=current_user.id,
            shopping_list_id=request.shopping_list_id,
            store_id=create_req.store_id,
            product_group_id=create_req.product_group_id,
            product_name=create_req.product_name,
            quantity=create_req.quantity,
            unit=create_req.unit,
            comment=create_req.comment,
            is_completed=create_req.is_completed,
            completed_at=create_req.completed_at,
            sync_status="synced",
            last_modified_by=current_user.id,
        )

        session.add(item)
        await session.flush()  # Get ID without committing
        await session.refresh(item)

        created.append(SyncCreatedItem(
            temp_id=create_req.temp_id,
            item=ShoppingListItemResponse.model_validate(item),
        ))

    # Process UPDATES
    for update_req in request.updates:
        # Fetch item
        query = select(ShoppingListItem).where(ShoppingListItem.id == update_req.id)
        result = await session.execute(query)
        item = result.scalar_one_or_none()

        if not item:
            # Item not found - check if deleted
            conflicts.append(SyncConflict(
                item_id=update_req.id,
                conflict_type="update_delete",
                server_item=None,
                merged_item=None,
                client_version=update_req.client_version,
                server_version=0,
            ))
            continue

        if item.deleted_at:
            # Item was soft-deleted on server - conflict
            conflicts.append(SyncConflict(
                item_id=update_req.id,
                conflict_type="update_delete",
                server_item=None,  # Deleted
                merged_item=None,
                client_version=update_req.client_version,
                server_version=item.version,
            ))
            continue

        # Version check
        if item.version != update_req.client_version:
            # Version mismatch - attempt auto-merge
            merged_item = _auto_merge_items(item, update_req)

            if merged_item:
                # Auto-merge successful
                for key, value in merged_item.items():
                    setattr(item, key, value)
                item.version += 1
                item.last_modified_by = current_user.id
                item.updated_at = server_time
                session.add(item)
                await session.flush()
                await session.refresh(item)
                updated.append(ShoppingListItemResponse.model_validate(item))
            else:
                # Cannot auto-merge - return conflict
                conflicts.append(SyncConflict(
                    item_id=update_req.id,
                    conflict_type="update_update",
                    server_item=ShoppingListItemResponse.model_validate(item),
                    merged_item=None,
                    client_version=update_req.client_version,
                    server_version=item.version,
                ))
            continue

        # No conflict - apply update
        update_dict = update_req.model_dump(exclude_unset=True, exclude={"id", "client_version"})

        # Track if is_completed changed to True
        is_completing = (
            "is_completed" in update_dict
            and update_dict["is_completed"]
            and not item.is_completed
        )

        for key, value in update_dict.items():
            setattr(item, key, value)

        item.version += 1
        item.last_modified_by = current_user.id
        item.updated_at = server_time

        if is_completing and not item.completed_at:
            item.completed_at = server_time

        session.add(item)
        await session.flush()
        await session.refresh(item)
        updated.append(ShoppingListItemResponse.model_validate(item))

    # Process DELETES
    for delete_req in request.deletes:
        # Fetch item
        query = select(ShoppingListItem).where(ShoppingListItem.id == delete_req.id)
        result = await session.execute(query)
        item = result.scalar_one_or_none()

        if not item:
            # Already deleted - success
            deleted.append(delete_req.id)
            continue

        if item.deleted_at:
            # Already soft-deleted - success
            deleted.append(delete_req.id)
            continue

        # Version check
        if item.version != delete_req.client_version:
            # Item was modified on server - conflict
            conflicts.append(SyncConflict(
                item_id=delete_req.id,
                conflict_type="delete_update",
                server_item=ShoppingListItemResponse.model_validate(item),
                merged_item=None,
                client_version=delete_req.client_version,
                server_version=item.version,
            ))
            continue

        # Soft delete
        item.deleted_at = server_time
        item.version += 1
        item.last_modified_by = current_user.id
        item.updated_at = server_time
        session.add(item)
        deleted.append(delete_req.id)

    await session.commit()

    logger.info(
        f"Batch sync for list {request.shopping_list_id}: "
        f"created={len(created)}, updated={len(updated)}, "
        f"deleted={len(deleted)}, conflicts={len(conflicts)} "
        f"by user {current_user.id}"
    )

    return BatchSyncResponse(
        created=created,
        updated=updated,
        deleted=deleted,
        conflicts=conflicts,
        server_time=server_time,
    )


def _auto_merge_items(server_item: ShoppingListItem, client_update) -> dict | None:
    """
    Attempt to auto-merge server and client changes.

    Rules:
    - Content fields (product_name, quantity, unit, comment, store_id, product_group_id): Server wins
    - is_completed: true wins (if either is completed, result is completed)

    Returns:
        Merged dict if auto-merge possible, None if manual resolution needed
    """
    merged = {}

    # Check is_completed - true wins
    client_is_completed = getattr(client_update, "is_completed", None)

    if client_is_completed is not None:
        # Client wants to change is_completed
        if client_is_completed and not server_item.is_completed:
            # Client marking as completed - accept
            merged["is_completed"] = True
            merged["completed_at"] = getattr(client_update, "completed_at", None) or datetime.utcnow()
        elif not client_is_completed and server_item.is_completed:
            # Client wants to uncomplete, but server already completed - server wins
            pass  # Don't include in merged (keep server value)
        # else: both same value, no change needed

    # For other fields, we could implement more complex merge logic
    # For now, server wins for all content fields (no auto-merge)

    # If only is_completed changed and we handled it, return merged
    # Otherwise, if client tried to change other fields, return None (conflict)
    update_dict = client_update.model_dump(exclude_unset=True, exclude={"id", "client_version"})

    # Remove is_completed from check (we handled it above)
    content_fields = {k: v for k, v in update_dict.items() if k not in ("is_completed", "completed_at")}

    if content_fields:
        # Client tried to change content fields - cannot auto-merge
        # Return conflict so user can decide
        return None

    # Only is_completed was changed - auto-merge successful
    return merged if merged else {}


@router.post(
    "/{item_id}/resolve-conflict",
    response_model=ShoppingListItemResponse,
    summary="Resolve sync conflict",
    description="Resolve conflict for a specific item",
)
async def resolve_conflict(
    item_id: int,
    request: ConflictResolutionRequest,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingListItemResponse:
    """
    Resolve sync conflict for a specific item.

    **Strategies:**
    - `server`: Keep server version (discard client changes)
    - `client`: Force client version (overwrite server)
    - `merge`: Apply merged data from client_data field

    **Note:** For delete conflicts, use batch_sync with appropriate action.
    """
    # Fetch item (including soft-deleted for conflict resolution)
    query = select(ShoppingListItem).where(ShoppingListItem.id == item_id)
    result = await session.execute(query)
    item = result.scalar_one_or_none()

    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Shopping list item {item_id} not found",
        )

    if request.strategy == "server":
        # Server wins - just return current server state
        # If item was deleted, restore it (conflict resolved)
        if item.deleted_at:
            item.deleted_at = None
            item.version += 1
            item.last_modified_by = current_user.id
            item.updated_at = datetime.utcnow()
            item.sync_status = "synced"
            session.add(item)
            await session.commit()
            await session.refresh(item)

        logger.info(f"Conflict resolved (server wins) for item {item_id} by user {current_user.id}")
        return ShoppingListItemResponse.model_validate(item)

    elif request.strategy == "client":
        # Client wins - apply client_data
        if not request.client_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="client_data is required for 'client' strategy",
            )

        # If item was deleted, restore it first
        if item.deleted_at:
            item.deleted_at = None

        # Apply client data
        for key, value in request.client_data.items():
            if key not in ("id", "version", "created_at", "creator_id"):
                setattr(item, key, value)

        item.version += 1
        item.last_modified_by = current_user.id
        item.updated_at = datetime.utcnow()
        item.sync_status = "synced"

        session.add(item)
        await session.commit()
        await session.refresh(item)

        logger.info(f"Conflict resolved (client wins) for item {item_id} by user {current_user.id}")
        return ShoppingListItemResponse.model_validate(item)

    elif request.strategy == "merge":
        # Merge - apply specific fields from client_data
        if not request.client_data:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="client_data is required for 'merge' strategy",
            )

        # If item was deleted, restore it first
        if item.deleted_at:
            item.deleted_at = None

        # Apply only specified fields from client_data
        for key, value in request.client_data.items():
            if key not in ("id", "version", "created_at", "creator_id"):
                setattr(item, key, value)

        item.version += 1
        item.last_modified_by = current_user.id
        item.updated_at = datetime.utcnow()
        item.sync_status = "synced"

        session.add(item)
        await session.commit()
        await session.refresh(item)

        logger.info(f"Conflict resolved (merge) for item {item_id} by user {current_user.id}")
        return ShoppingListItemResponse.model_validate(item)

    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid strategy: {request.strategy}. Use 'server', 'client', or 'merge'",
        )
