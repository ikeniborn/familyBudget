"""
Store API endpoints.

This module provides REST API endpoints for managing stores (shopping locations)
with SCD Type 1 + History support.

Stores are SHARED across all users (admin-managed).

Endpoints:
    GET    /api/v1/stores         - List all stores
    POST   /api/v1/stores         - Create new store (admin only)
    GET    /api/v1/stores/{id}    - Get store by ID
    PUT    /api/v1/stores/{id}    - Update store (admin only)
    PUT    /api/v1/stores/{id}/archive  - Archive store (admin only)
    PUT    /api/v1/stores/{id}/restore  - Restore store (admin only)
    DELETE /api/v1/stores/{id}    - Delete store (admin only, cascade)
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.api.v1.endpoints.budget_ws import (
    broadcast_store_created,
    broadcast_store_deleted,
    broadcast_store_updated,
)
from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.models.store import Store
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.store import (
    StoreCreate,
    StoreListResponse,
    StoreResponse,
    StoreUpdate,
)
from backend.app.services.scd2_service import has_changes
from backend.app.services.store_service import (
    FAR_FUTURE_DATETIME,
    create_initial_history,
    update_store_profile,
)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/stores",
    tags=["stores"],
    responses=get_common_responses(),
)


@router.get(
    "",
    response_model=StoreListResponse,
    summary="List stores",
    description="Get list of stores (shared across all users)",
)
async def list_stores(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    include_inactive: bool = Query(False, description="Include archived stores"),
) -> StoreListResponse:
    """
    List stores for all users (SHARED model).

    Shared references architecture: All users see all stores.
    By default, only active stores (is_active=True) are returned.
    """
    # Build query - all stores (shared references, NO user_id filter)
    conditions = []

    # Filter archived if not explicitly requested
    if not include_inactive:
        conditions.append(Store.is_active)

    # Count total
    count_query = select(func.count()).select_from(Store).where(*conditions)
    count_result = await session.execute(count_query)
    total = count_result.scalar_one()

    # Fetch paginated results
    query = (
        select(Store)
        .where(*conditions)
        .order_by(Store.name)
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(query)
    stores = result.scalars().all()

    return StoreListResponse(
        stores=[StoreResponse.model_validate(store) for store in stores],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=StoreResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create store",
    description="Create a new store (admin only)",
)
async def create_store(
    store_data: StoreCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StoreResponse:
    """
    Create a new store.

    Shared references architecture: All authenticated users can create stores.
    Store is created with current_user.id as creator_id (audit trail).
    """
    # Debug logging for validation troubleshooting
    logger.debug("create_store called by user %s", current_user.id)
    logger.debug("store_data received: %s", store_data.model_dump())

    # Generate code for store
    from backend.app.utils.code_generator import generate_code

    generated_code = await generate_code(session, Store)

    # Create store (SCD Type 1 - no versioning fields)
    store = Store(
        creator_id=current_user.id,  # Audit trail, NOT for filtering
        name=store_data.name,
        address=store_data.address,
        description=store_data.description,
        code=generated_code,
    )

    session.add(store)
    await session.commit()
    await session.refresh(store)

    # Create initial history record (SCD Type 2 for history)
    await create_initial_history(session=session, store=store, change_type="CREATE")

    logger.info("Created store %s (%s) by admin %s", store.id, store.name, current_user.id)

    response = StoreResponse.model_validate(store)
    try:
        await broadcast_store_created(response.model_dump(mode="json"))
    except Exception as e:
        logger.warning("broadcast_store_created failed: %s", e)

    return response


@router.get(
    "/{store_id}",
    response_model=StoreResponse,
    summary="Get store",
    description="Get a single store by ID",
)
async def get_store(
    store_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StoreResponse:
    """
    Get store by ID.

    Shared references architecture: All users can access all stores.
    """
    query = select(Store).where(Store.id == store_id)

    result = await session.execute(query)
    store = result.scalar_one_or_none()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store {store_id} not found",
        )

    # NO access restrictions - all users can read all stores

    return StoreResponse.model_validate(store)


@router.put(
    "/{store_id}",
    response_model=StoreResponse,
    summary="Update store",
    description="Update store (creates new History version, admin only)",
)
async def update_store(
    store_id: int,
    update_data: StoreUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StoreResponse:
    """
    Update store.

    SCD Type 1 + History:
    - Updates store IN-PLACE (id remains stable)
    - Creates StoreHistory snapshot (SCD Type 2 for audit)
    - FK in ShoppingListItem remain unchanged

    Shared references architecture: All authenticated users can update stores.
    """
    # Fetch store
    query = select(Store).where(Store.id == store_id)

    result = await session.execute(query)
    store = result.scalar_one_or_none()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store {store_id} not found",
        )

    # Get update dict
    update_dict = update_data.model_dump(exclude_unset=True)

    # Check if anything changed
    changed, changed_fields = has_changes(store, update_dict)
    if not changed:
        # No changes, return existing store
        return StoreResponse.model_validate(store)

    # Use SCD1+History service for update
    updated_store = await update_store_profile(
        session=session,
        store=store,
        updates=update_dict,
        changed_by_user_id=current_user.id,
        change_type="UPDATE",
    )

    logger.info(
        "Updated store %s (%s) fields: %s by admin %s",
        store_id, store.name, changed_fields, current_user.id
    )

    response = StoreResponse.model_validate(updated_store)
    try:
        await broadcast_store_updated(response.model_dump(mode="json"))
    except Exception as e:
        logger.warning("broadcast_store_updated failed: %s", e)

    return response


@router.put(
    "/{store_id}/archive",
    response_model=StoreResponse,
    summary="Archive store",
    description="Archive store (simple UPDATE is_active=False, admin only)",
)
async def archive_store(
    store_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StoreResponse:
    """
    Archive store by setting is_active=False.

    Simple UPDATE operation (NOT SCD Type 2).
    Archived stores are hidden from UI dropdowns but remain in analytics.
    Only administrators can archive stores.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can archive stores",
        )

    query = select(Store).where(Store.id == store_id)
    result = await session.execute(query)
    store = result.scalar_one_or_none()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store {store_id} not found",
        )

    # Simple UPDATE: is_active=False (NOT SCD Type 2)
    store.is_active = False
    store.updated_at = datetime.utcnow()

    session.add(store)
    await session.commit()
    await session.refresh(store)

    logger.info("Archived store %s (%s) by admin %s", store_id, store.name, current_user.id)

    response = StoreResponse.model_validate(store)
    try:
        await broadcast_store_updated(response.model_dump(mode="json"))
    except Exception as e:
        logger.warning("broadcast_store_updated (archive) failed: %s", e)

    return response


@router.put(
    "/{store_id}/restore",
    response_model=StoreResponse,
    summary="Restore archived store",
    description="Restore store (simple UPDATE is_active=True, admin only)",
)
async def restore_store(
    store_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> StoreResponse:
    """
    Restore archived store by setting is_active=True.

    Simple UPDATE operation (NOT SCD Type 2).
    Only administrators can restore stores.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can restore stores",
        )

    query = select(Store).where(Store.id == store_id)
    result = await session.execute(query)
    store = result.scalar_one_or_none()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store {store_id} not found",
        )

    # Simple UPDATE: is_active=True (NOT SCD Type 2)
    store.is_active = True
    store.updated_at = datetime.utcnow()

    session.add(store)
    await session.commit()
    await session.refresh(store)

    logger.info("Restored store %s (%s) by admin %s", store_id, store.name, current_user.id)

    response = StoreResponse.model_validate(store)
    try:
        await broadcast_store_updated(response.model_dump(mode="json"))
    except Exception as e:
        logger.warning("broadcast_store_updated (restore) failed: %s", e)

    return response


@router.delete(
    "/{store_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete store",
    description="Physically delete store with cascade (deletes related shopping list items, admin only)",
)
async def delete_store(
    store_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Physically delete store with cascade deletion.

    Cascade deletion order:
    1. Create DELETE history record (for audit trail)
    2. Delete all ShoppingListItem records referencing this store
    3. Delete the Store record
    4. History records are PRESERVED for audit

    Returns detailed message with count of cascade-deleted records.

    Raises:
        HTTPException: 403 if not admin
        HTTPException: 404 if store not found
    """
    from backend.app.models.shopping_list_item import ShoppingListItem
    from backend.app.models.store_history import StoreHistory

    # Check: Only admins can delete stores
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete stores",
        )

    # Fetch store
    query = select(Store).where(Store.id == store_id)

    result = await session.execute(query)
    store = result.scalar_one_or_none()

    if not store:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Store {store_id} not found",
        )

    # 1. Create DELETE history record (for audit trail)
    now = datetime.utcnow()
    delete_history = StoreHistory(
        store_id=store.id,
        creator_id=store.creator_id,
        name=store.name,
        address=store.address,
        description=store.description,
        code=store.code,
        is_active=store.is_active,
        valid_from=now,
        valid_to=FAR_FUTURE_DATETIME,
        is_current=False,  # Deleted records are never current
        change_type="DELETE",
        changed_fields=None,  # Full deletion
        changed_by_user_id=current_user.id,
    )
    session.add(delete_history)

    # 2. Count and delete related ShoppingListItem records (cascade)
    items_query = select(func.count(ShoppingListItem.id)).where(
        ShoppingListItem.store_id == store_id
    )
    items_result = await session.execute(items_query)
    items_count = items_result.scalar()

    # Delete shopping list items (no history tracking for items in delete cascade)
    if items_count > 0:
        delete_items_query = select(ShoppingListItem).where(
            ShoppingListItem.store_id == store_id
        )
        delete_items_result = await session.execute(delete_items_query)
        items_to_delete = delete_items_result.scalars().all()

        # Delete items
        for item in items_to_delete:
            await session.delete(item)

    # 3. Delete store
    await session.delete(store)
    await session.commit()

    logger.info(
        "Physically deleted store %s (%s) with %s related shopping list items by admin %s",
        store_id, store.name, items_count, current_user.id
    )

    try:
        await broadcast_store_deleted(store_id)
    except Exception as e:
        logger.warning("broadcast_store_deleted failed: %s", e)

    return {
        "message": "Store deleted successfully",
        "store_id": store_id,
        "cascade_deleted": {"shopping_list_items": items_count},
    }
