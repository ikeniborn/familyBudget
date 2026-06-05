"""
ShoppingListItem API endpoints.

This module provides REST API endpoints for managing shopping list items (lines)
with batch operations.

ShoppingListItems are SHARED across all users (any user can add/edit/delete items).

Endpoints:
    GET    /api/v1/shopping-list-items         - List items for a shopping list
    POST   /api/v1/shopping-list-items         - Create new item
    GET    /api/v1/shopping-list-items/{id}    - Get item by ID
    PUT    /api/v1/shopping-list-items/{id}    - Update item
    DELETE /api/v1/shopping-list-items/{id}    - Soft-delete item
    POST   /api/v1/shopping-list-items/batch-complete - Mark multiple items as completed
    POST   /api/v1/shopping-list-items/batch-delete   - Soft-delete multiple items
"""

import asyncio
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.models.product_group import ProductGroup
from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem
from backend.app.models.store import Store
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.shopping_list_item import (
    BatchCompleteRequest,
    BatchDeleteRequest,
    ProductSuggestion,
    ProductSuggestionsResponse,
    ShoppingListItemCreate,
    ShoppingListItemListResponse,
    ShoppingListItemResponse,
    ShoppingListItemUpdate,
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


async def _compute_list_stats(session: AsyncSession, shopping_list_id: int) -> dict | None:
    """Compute item stats for a shopping list. Returns payload dict or None."""
    list_result = await session.execute(
        select(ShoppingList).where(ShoppingList.id == shopping_list_id)
    )
    shopping_list = list_result.scalar_one_or_none()
    if not shopping_list:
        logger.warning("[LIST_STATS] Shopping list %s not found for stats broadcast", shopping_list_id)
        return None

    # Count total and completed items (exclude soft-deleted)
    total_result = await session.execute(
        select(func.count()).where(
            ShoppingListItem.shopping_list_id == shopping_list_id,
            ShoppingListItem.deleted_at.is_(None),
        )
    )
    total_items = total_result.scalar_one()

    completed_result = await session.execute(
        select(func.count()).where(
            ShoppingListItem.shopping_list_id == shopping_list_id,
            ShoppingListItem.is_completed == True,  # noqa: E712
            ShoppingListItem.deleted_at.is_(None),
        )
    )
    completed_items = completed_result.scalar_one()

    completion_percentage = round(
        (completed_items / total_items * 100) if total_items > 0 else 0.0, 1
    )

    return {
        "id": shopping_list.id,
        "name": shopping_list.name,
        "description": shopping_list.description,
        "creator_id": shopping_list.creator_id,
        "is_active": shopping_list.is_active,
        "total_items": total_items,
        "completed_items": completed_items,
        "completion_percentage": completion_percentage,
        "created_at": shopping_list.created_at.isoformat() if shopping_list.created_at else None,
        "updated_at": shopping_list.updated_at.isoformat() if shopping_list.updated_at else None,
    }


async def _broadcast_list_stats_update(session: AsyncSession, shopping_list_id: int) -> None:
    """Broadcast shopping_list_updated event with updated item stats."""
    try:
        list_data = await _compute_list_stats(session, shopping_list_id)
        if not list_data:
            return

        ws = _get_ws_broadcast()
        await ws.broadcast_shopping_list_updated(list_data)
        logger.debug(
            "[LIST_STATS] Broadcast list_id=%s, total=%s, completed=%s",
            shopping_list_id, list_data["total_items"], list_data["completed_items"]
        )
    except (ValueError, AttributeError, ConnectionError, RuntimeError, OSError) as e:
        # Non-critical: item operation already succeeded, only stats broadcast failed
        logger.warning("[LIST_STATS] Failed broadcast for list %s: %s", shopping_list_id, e)
    except asyncio.CancelledError:
        raise


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

    response_items = [ShoppingListItemResponse.model_validate(item) for item in items]

    return ShoppingListItemListResponse(
        items=response_items,
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
        logger.warning("WebSocket broadcast failed for created item %s: %s", item.id, e)

    # Broadcast updated shopping list stats to refresh landing page cards on all devices
    await _broadcast_list_stats_update(session, item.shopping_list_id)

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
        logger.warning("WebSocket broadcast failed for updated item %s: %s", item_id, e)

    # Broadcast updated shopping list stats when completion status changes
    # (completed_items count changes → landing page cards need refresh)
    if update_data.is_completed is not None:
        await _broadcast_list_stats_update(session, item.shopping_list_id)

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
        logger.warning("WebSocket broadcast failed for deleted item %s: %s", item_id, e)

    # Broadcast updated shopping list stats to refresh landing page cards on all devices
    await _broadcast_list_stats_update(session, list_id)

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
        logger.warning("WebSocket broadcast failed for restored item %s: %s", item_id, e)

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
        logger.warning("WebSocket broadcast failed for batch complete: %s", e)

    # Broadcast updated shopping list stats for all affected lists
    for list_id in items_by_list.keys():
        await _broadcast_list_stats_update(session, list_id)

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

    logger.info("Batch deleted %s items by user %s", count, current_user.id)

    # Broadcast SSE events to all connected clients
    try:
        ws = _get_ws_broadcast()
        for list_id, item_ids in items_by_list.items():
            for item_id in item_ids:
                await ws.broadcast_item_deleted(item_id=item_id, shopping_list_id=list_id)
    except Exception as e:
        logger.warning("WebSocket broadcast failed for batch delete: %s", e)

    # Broadcast updated shopping list stats for all affected lists
    for list_id in items_by_list.keys():
        await _broadcast_list_stats_update(session, list_id)

    return {"message": f"Deleted {count} items", "count": count}
