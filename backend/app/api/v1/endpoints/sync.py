"""
Shopping Lists Sync API endpoints (task-012).

This module provides sync endpoints for offline-first support (Dexie.js).

Endpoints:
    GET /api/v1/sync/shopping-reference - Initial sync for reference data (stores, product groups)
    GET /api/v1/sync/shopping-lists/delta - Incremental sync for lists and items

Sync Strategy:
    - Initial sync: Full download of reference data (stores, product_groups, hierarchy)
    - Incremental sync: Delta changes since last sync timestamp
    - Reference data is read-only on client (server is source of truth)
    - Transactional data (lists, items) supports bidirectional sync with conflict resolution
"""
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import Select
from sqlmodel import select

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.models.product_group import ProductGroup
from backend.app.models.product_group_hierarchy import ProductGroupHierarchy
from backend.app.models.shopping_list import ShoppingList
from backend.app.models.shopping_list_item import ShoppingListItem
from backend.app.models.store import Store
from backend.app.schemas.errors import get_common_responses

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/sync",
    tags=["sync"],
    responses=get_common_responses(),
)


# ========================================
# RESPONSE SCHEMAS
# ========================================

class StoreResponse(BaseModel):
    """Store reference data for offline database."""
    id: int
    name: str
    address: str | None
    code: str | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProductGroupResponse(BaseModel):
    """Product Group reference data for offline database."""
    id: int
    parent_id: int | None
    name: str
    code: str | None
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class ProductGroupHierarchyResponse(BaseModel):
    """Product Group Hierarchy (Closure Table) for offline database."""
    ancestor_id: int
    descendant_id: int
    depth: int

    class Config:
        from_attributes = True


class ShoppingReferenceResponse(BaseModel):
    """
    Response schema for initial reference data sync.

    Contains all reference data needed by PGlite:
    - Stores (shopping locations)
    - Product Groups (categories with hierarchy)
    - Product Group Hierarchy (Closure Table for fast queries)
    """
    stores: list[StoreResponse]
    product_groups: list[ProductGroupResponse]
    product_group_hierarchy: list[ProductGroupHierarchyResponse]


class ShoppingListDeltaItem(BaseModel):
    """Shopping list for delta sync."""
    id: int
    creator_id: int
    name: str
    description: str | None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ShoppingListItemDeltaItem(BaseModel):
    """Shopping list item for delta sync."""
    id: int
    creator_id: int
    shopping_list_id: int
    store_id: int
    product_group_id: int
    product_name: str
    quantity: int | None
    unit: str | None
    comment: str | None
    is_completed: bool
    completed_at: datetime | None
    deleted_at: datetime | None
    last_modified_by: int | None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DeltaCreated(BaseModel):
    """Created records in delta sync."""
    lists: list[ShoppingListDeltaItem]
    items: list[ShoppingListItemDeltaItem]


class DeltaUpdated(BaseModel):
    """Updated records in delta sync."""
    lists: list[ShoppingListDeltaItem]
    items: list[ShoppingListItemDeltaItem]


class DeltaDeleted(BaseModel):
    """Deleted record IDs in delta sync."""
    list_ids: list[int]
    item_ids: list[int]


class ShoppingListsDeltaResponse(BaseModel):
    """
    Response schema for incremental delta sync.

    Returns changes since last sync timestamp:
    - created: New lists and items
    - updated: Modified lists and items
    - deleted: Deleted list IDs and item IDs
    - server_time: Current server timestamp (for next delta sync)
    """
    created: DeltaCreated
    updated: DeltaUpdated
    deleted: DeltaDeleted
    server_time: datetime


# ========================================
# ENDPOINTS
# ========================================

@router.get(
    "/shopping-reference",
    response_model=ShoppingReferenceResponse,
    summary="Initial sync: Reference data",
    description="Get all reference data for offline database initial sync (stores, product groups, hierarchy)",
)
async def get_shopping_reference_data(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ShoppingReferenceResponse:
    """
    Initial sync endpoint for reference data.

    Returns all reference data needed by PGlite:
    - Stores (shopping locations)
    - Product Groups (categories)
    - Product Group Hierarchy (Closure Table)

    Reference data is read-only on client (server is source of truth).

    **Authentication:** Required (any authenticated user)
    **Shared:** All users get the same reference data
    """
    logger.info("[SYNC] User %s requesting shopping reference data", current_user.id)

    # Fetch all stores
    stores_query = select(Store).where(Store.is_active).order_by(Store.name)
    stores_result = await session.execute(stores_query)
    stores = stores_result.scalars().all()

    # Fetch all product groups
    product_groups_query = select(ProductGroup).where(ProductGroup.is_active).order_by(ProductGroup.name)
    product_groups_result = await session.execute(product_groups_query)
    product_groups = product_groups_result.scalars().all()

    # Fetch product group hierarchy (Closure Table)
    hierarchy_query = select(ProductGroupHierarchy).order_by(
        ProductGroupHierarchy.ancestor_id,
        ProductGroupHierarchy.depth
    )
    hierarchy_result = await session.execute(hierarchy_query)
    hierarchy = hierarchy_result.scalars().all()

    logger.info(
        "[SYNC] Returning %s stores, %s product groups, %s hierarchy records",
        len(stores), len(product_groups), len(hierarchy)
    )

    return ShoppingReferenceResponse(
        stores=[StoreResponse.model_validate(store) for store in stores],
        product_groups=[ProductGroupResponse.model_validate(pg) for pg in product_groups],
        product_group_hierarchy=[ProductGroupHierarchyResponse.model_validate(h) for h in hierarchy]
    )


def _build_shopping_lists_queries(since: datetime | None) -> tuple[Select, Select, list[int]]:
    """
    Build queries for shopping lists delta sync.

    Returns tuple: (created_query, updated_query, deleted_ids)
    """
    if since:
        # Created records (created_at > since)
        created_query = select(ShoppingList).where(
            ShoppingList.created_at > since
        ).order_by(ShoppingList.created_at)

        # Updated records (updated_at > since AND created_at <= since)
        updated_query = select(ShoppingList).where(
            ShoppingList.updated_at > since,
            ShoppingList.created_at <= since
        ).order_by(ShoppingList.updated_at)

        # Note: Shopping lists don't have soft delete
        deleted_ids = []
    else:
        # Initial sync - return all active lists
        created_query = select(ShoppingList).where(
            ShoppingList.is_active
        ).order_by(ShoppingList.created_at)
        updated_query = select(ShoppingList).where(False)  # Empty query
        deleted_ids = []

    return created_query, updated_query, deleted_ids


def _build_shopping_list_items_queries(since: datetime | None) -> tuple[Select, Select, Select]:
    """
    Build queries for shopping list items delta sync.

    Returns tuple: (created_query, updated_query, deleted_query)
    """
    if since:
        # Created items
        created_query = select(ShoppingListItem).where(
            ShoppingListItem.created_at > since,
            ShoppingListItem.deleted_at.is_(None)  # type: ignore[attr-defined] # SQLAlchemy Column method
        ).order_by(ShoppingListItem.created_at)

        # Updated items (not deleted)
        updated_query = select(ShoppingListItem).where(
            ShoppingListItem.updated_at > since,
            ShoppingListItem.created_at <= since,
            ShoppingListItem.deleted_at.is_(None)  # type: ignore[attr-defined] # SQLAlchemy Column method
        ).order_by(ShoppingListItem.updated_at)

        # Deleted items (soft delete)
        deleted_query = select(ShoppingListItem.id).where(
            ShoppingListItem.deleted_at.isnot(None),  # type: ignore[attr-defined] # SQLAlchemy Column method
            ShoppingListItem.deleted_at > since  # type: ignore[operator] # SQLAlchemy Column comparison
        )
    else:
        # Initial sync - return all active items
        created_query = select(ShoppingListItem).where(
            ShoppingListItem.deleted_at.is_(None)  # type: ignore[attr-defined] # SQLAlchemy Column method
        ).order_by(ShoppingListItem.created_at)
        updated_query = select(ShoppingListItem).where(False)  # Empty query
        deleted_query = select(ShoppingListItem.id).where(False)  # Empty query

    return created_query, updated_query, deleted_query


@router.get(
    "/shopping-lists/delta",
    response_model=ShoppingListsDeltaResponse,
    summary="Incremental sync: Delta changes",
    description="Get delta changes for shopping lists and items since last sync timestamp",
)
async def get_shopping_lists_delta(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    since: datetime | None = Query(
        None,
        description="Last sync timestamp (ISO 8601). Returns all records if not provided."
    ),
) -> ShoppingListsDeltaResponse:
    """
    Incremental sync endpoint for shopping lists and items.

    Returns changes since `since` timestamp:
    - **created**: New lists and items (created_at > since)
    - **updated**: Modified lists and items (updated_at > since AND created_at <= since)
    - **deleted**: Soft-deleted items (deleted_at > since)

    If `since` is not provided, returns all active records.

    **Authentication:** Required (any authenticated user)
    **Shared:** All users get all changes (no filtering by creator_id)

    **Important:** Always use `server_time` from response as `since` for next sync.
    """
    logger.info("[SYNC] User %s requesting delta sync since %s", current_user.id, since)

    current_time = datetime.now(timezone.utc)

    # Build and execute shopping lists queries
    created_lists_query, updated_lists_query, deleted_list_ids = _build_shopping_lists_queries(since)

    created_lists_result = await session.execute(created_lists_query)
    created_lists = created_lists_result.scalars().all()

    updated_lists_result = await session.execute(updated_lists_query)
    updated_lists = updated_lists_result.scalars().all()

    # Build and execute shopping list items queries
    created_items_query, updated_items_query, deleted_items_query = _build_shopping_list_items_queries(since)

    created_items_result = await session.execute(created_items_query)
    created_items = created_items_result.scalars().all()

    updated_items_result = await session.execute(updated_items_query)
    updated_items = updated_items_result.scalars().all()

    deleted_items_result = await session.execute(deleted_items_query)
    deleted_item_ids = list(deleted_items_result.scalars().all())

    logger.info(
        "[SYNC] Delta results: created_lists=%s, updated_lists=%s, "
        "created_items=%s, updated_items=%s, deleted_items=%s",
        len(created_lists), len(updated_lists),
        len(created_items), len(updated_items), len(deleted_item_ids)
    )

    return ShoppingListsDeltaResponse(
        created=DeltaCreated(
            lists=[ShoppingListDeltaItem.model_validate(lst) for lst in created_lists],
            items=[ShoppingListItemDeltaItem.model_validate(i) for i in created_items]
        ),
        updated=DeltaUpdated(
            lists=[ShoppingListDeltaItem.model_validate(lst) for lst in updated_lists],
            items=[ShoppingListItemDeltaItem.model_validate(i) for i in updated_items]
        ),
        deleted=DeltaDeleted(
            list_ids=deleted_list_ids,
            item_ids=deleted_item_ids
        ),
        server_time=current_time
    )
