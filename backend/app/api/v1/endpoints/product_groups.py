"""
ProductGroup API endpoints.

This module provides REST API endpoints for managing product groups (hierarchical
product categories) with SCD Type 1 + History + Closure Table support.

ProductGroups are SHARED across all users (admin-managed).

Endpoints:
    GET    /api/v1/product-groups              - List all product groups
    POST   /api/v1/product-groups              - Create new product group (admin only)
    GET    /api/v1/product-groups/{id}         - Get product group by ID
    PUT    /api/v1/product-groups/{id}         - Update product group (admin only)
    PUT    /api/v1/product-groups/{id}/archive - Archive product group (admin only)
    PUT    /api/v1/product-groups/{id}/restore - Restore product group (admin only)
    DELETE /api/v1/product-groups/{id}         - Delete product group (admin only, cascade)
    GET    /api/v1/product-groups/{id}/subtree - Get subtree (all descendants)
    GET    /api/v1/product-groups/{id}/ancestors - Get ancestors (path to root)
    PUT    /api/v1/product-groups/{id}/move    - Move to new parent (admin only)
"""

import logging
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import select

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import User
from backend.app.models.product_group import ProductGroup
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.product_group import (
    ProductGroupCreate,
    ProductGroupListResponse,
    ProductGroupMove,
    ProductGroupResponse,
    ProductGroupUpdate,
)
from backend.app.services import product_group_hierarchy_service
from backend.app.services.product_group_service import (
    create_initial_history,
    move_product_group,
    update_product_group_profile,
)
from backend.app.services.scd2_service import has_changes
from backend.app.services.store_service import FAR_FUTURE_DATETIME

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/product-groups",
    tags=["product-groups"],
    responses=get_common_responses(),
)


@router.get(
    "",
    response_model=ProductGroupListResponse,
    summary="List product groups",
    description="Get list of product groups (shared across all users)",
)
async def list_product_groups(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    include_inactive: bool = Query(
        False, description="Include archived product groups"
    ),
    parent_id: int | None = Query(
        None, description="Filter by parent ID (NULL for root groups)"
    ),
) -> ProductGroupListResponse:
    """
    List product groups for all users (SHARED model).

    Shared references architecture: All users see all product groups.
    By default, only active product groups (is_active=True) are returned.

    **Filters:**
    - parent_id: Filter by parent (NULL for root groups)
    """
    # Build query - all product groups (shared references, NO user_id filter)
    conditions = []

    # Filter archived if not explicitly requested
    if not include_inactive:
        conditions.append(ProductGroup.is_active)

    # Filter by parent_id
    if parent_id is not None:
        conditions.append(ProductGroup.parent_id == parent_id)

    # Count total
    count_query = select(func.count()).select_from(ProductGroup).where(*conditions)
    count_result = await session.execute(count_query)
    total = count_result.scalar_one()

    # Fetch paginated results
    query = (
        select(ProductGroup)
        .where(*conditions)
        .order_by(ProductGroup.name)
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(query)
    product_groups = result.scalars().all()

    return ProductGroupListResponse(
        product_groups=[
            ProductGroupResponse.model_validate(pg) for pg in product_groups
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=ProductGroupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create product group",
    description="Create a new product group (admin only)",
)
async def create_product_group(
    product_group_data: ProductGroupCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProductGroupResponse:
    """
    Create a new product group.

    Shared references architecture: All authenticated users can create product groups.
    ProductGroup is created with current_user.id as creator_id (audit trail).

    **Validation:**
    - Parent product group must exist if parent_id provided
    - Name is required, max 255 characters
    """
    # Debug logging for validation troubleshooting
    logger.debug(f"create_product_group called by user {current_user.id}")
    logger.debug(f"product_group_data received: {product_group_data.model_dump()}")

    # Validate: Parent product group must exist if provided
    if product_group_data.parent_id:
        parent_stmt = select(ProductGroup).where(
            ProductGroup.id == product_group_data.parent_id
        )
        parent_result = await session.execute(parent_stmt)
        parent = parent_result.scalar_one_or_none()

        if not parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Parent product group with id={product_group_data.parent_id} not found",
            )

    # Generate code for product group
    from backend.app.utils.code_generator import generate_code

    generated_code = await generate_code(session, ProductGroup)

    # Create product group (SCD Type 1 - no versioning fields)
    product_group = ProductGroup(
        creator_id=current_user.id,  # Audit trail, NOT for filtering
        parent_id=product_group_data.parent_id,
        name=product_group_data.name,
        description=product_group_data.description,
        code=generated_code,
    )

    session.add(product_group)
    await session.commit()
    await session.refresh(product_group)

    # Create initial history record (SCD Type 2 for history)
    await create_initial_history(
        session=session, product_group=product_group, change_type="CREATE"
    )

    # Create hierarchy paths (Closure Table)
    await product_group_hierarchy_service.create_hierarchy_paths(
        session=session,
        product_group_id=product_group.id,
        parent_id=product_group.parent_id,
    )

    logger.info(
        f"Created product group {product_group.id} ({product_group.name}) "
        f"under parent {product_group.parent_id} by admin {current_user.id}"
    )

    return ProductGroupResponse.model_validate(product_group)


@router.get(
    "/{product_group_id}",
    response_model=ProductGroupResponse,
    summary="Get product group",
    description="Get a single product group by ID",
)
async def get_product_group(
    product_group_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProductGroupResponse:
    """
    Get product group by ID.

    Shared references architecture: All users can access all product groups.
    """
    query = select(ProductGroup).where(ProductGroup.id == product_group_id)

    result = await session.execute(query)
    product_group = result.scalar_one_or_none()

    if not product_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product group {product_group_id} not found",
        )

    # NO access restrictions - all users can read all product groups

    return ProductGroupResponse.model_validate(product_group)


@router.put(
    "/{product_group_id}",
    response_model=ProductGroupResponse,
    summary="Update product group",
    description="Update product group (creates new History version, admin only)",
)
async def update_product_group(
    product_group_id: int,
    update_data: ProductGroupUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProductGroupResponse:
    """
    Update product group.

    SCD Type 1 + History + Hierarchy:
    - Updates product group IN-PLACE (id remains stable)
    - Creates ProductGroupHistory snapshot (SCD Type 2 for audit)
    - If parent_id changes: updates Closure Table (move_subtree)
    - FK in ShoppingListItem remain unchanged

    Shared references architecture: All authenticated users can update product groups.
    """
    # Fetch product group
    query = select(ProductGroup).where(ProductGroup.id == product_group_id)

    result = await session.execute(query)
    product_group = result.scalar_one_or_none()

    if not product_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product group {product_group_id} not found",
        )

    # Get update dict
    update_dict = update_data.model_dump(exclude_unset=True)

    # Check if anything changed
    changed, changed_fields = has_changes(product_group, update_dict)
    if not changed:
        # No changes, return existing product group
        return ProductGroupResponse.model_validate(product_group)

    # Use SCD1+History+Hierarchy service for update
    updated_product_group = await update_product_group_profile(
        session=session,
        product_group=product_group,
        updates=update_dict,
        changed_by_user_id=current_user.id,
        change_type="UPDATE",
    )

    logger.info(
        f"Updated product group {product_group_id} ({product_group.name}) "
        f"fields: {changed_fields} by admin {current_user.id}"
    )

    return ProductGroupResponse.model_validate(updated_product_group)


@router.put(
    "/{product_group_id}/archive",
    response_model=ProductGroupResponse,
    summary="Archive product group",
    description="Archive product group (simple UPDATE is_active=False, admin only)",
)
async def archive_product_group(
    product_group_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProductGroupResponse:
    """
    Archive product group by setting is_active=False.

    Simple UPDATE operation (NOT SCD Type 2).
    Archived product groups are hidden from UI dropdowns but remain in analytics.
    Only administrators can archive product groups.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can archive product groups",
        )

    query = select(ProductGroup).where(ProductGroup.id == product_group_id)
    result = await session.execute(query)
    product_group = result.scalar_one_or_none()

    if not product_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product group {product_group_id} not found",
        )

    # Simple UPDATE: is_active=False (NOT SCD Type 2)
    product_group.is_active = False
    product_group.updated_at = datetime.utcnow()

    session.add(product_group)
    await session.commit()
    await session.refresh(product_group)

    logger.info(
        f"Archived product group {product_group_id} ({product_group.name}) "
        f"by admin {current_user.id}"
    )

    return ProductGroupResponse.model_validate(product_group)


@router.put(
    "/{product_group_id}/restore",
    response_model=ProductGroupResponse,
    summary="Restore archived product group",
    description="Restore product group (simple UPDATE is_active=True, admin only)",
)
async def restore_product_group(
    product_group_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProductGroupResponse:
    """
    Restore archived product group by setting is_active=True.

    Simple UPDATE operation (NOT SCD Type 2).
    Only administrators can restore product groups.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can restore product groups",
        )

    query = select(ProductGroup).where(ProductGroup.id == product_group_id)
    result = await session.execute(query)
    product_group = result.scalar_one_or_none()

    if not product_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product group {product_group_id} not found",
        )

    # Simple UPDATE: is_active=True (NOT SCD Type 2)
    product_group.is_active = True
    product_group.updated_at = datetime.utcnow()

    session.add(product_group)
    await session.commit()
    await session.refresh(product_group)

    logger.info(
        f"Restored product group {product_group_id} ({product_group.name}) "
        f"by admin {current_user.id}"
    )

    return ProductGroupResponse.model_validate(product_group)


@router.delete(
    "/{product_group_id}",
    status_code=status.HTTP_200_OK,
    summary="Delete product group",
    description="Physically delete product group with cascade (admin only)",
)
async def delete_product_group(
    product_group_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Physically delete product group with cascade deletion.

    Cascade deletion order:
    1. Create DELETE history record (for audit trail)
    2. Delete all ShoppingListItem records referencing this product group
    3. Delete all ProductGroupHierarchy records (closure table)
    4. Delete the ProductGroup record
    5. History records are PRESERVED for audit

    Returns detailed message with count of cascade-deleted records.

    Raises:
        HTTPException: 403 if not admin
        HTTPException: 404 if product group not found
    """
    from backend.app.models.product_group_history import ProductGroupHistory
    from backend.app.models.shopping_list_item import ShoppingListItem

    # Check: Only admins can delete product groups
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete product groups",
        )

    # Fetch product group
    query = select(ProductGroup).where(ProductGroup.id == product_group_id)

    result = await session.execute(query)
    product_group = result.scalar_one_or_none()

    if not product_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product group {product_group_id} not found",
        )

    # 1. Create DELETE history record (for audit trail)
    now = datetime.utcnow()
    delete_history = ProductGroupHistory(
        product_group_id=product_group.id,
        creator_id=product_group.creator_id,
        parent_id=product_group.parent_id,
        name=product_group.name,
        description=product_group.description,
        code=product_group.code,
        is_active=product_group.is_active,
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
        ShoppingListItem.product_group_id == product_group_id
    )
    items_result = await session.execute(items_query)
    items_count = items_result.scalar()

    # Delete shopping list items
    if items_count > 0:
        delete_items_query = select(ShoppingListItem).where(
            ShoppingListItem.product_group_id == product_group_id
        )
        delete_items_result = await session.execute(delete_items_query)
        items_to_delete = delete_items_result.scalars().all()

        for item in items_to_delete:
            await session.delete(item)

    # 3. Delete hierarchy paths (Closure Table)
    await product_group_hierarchy_service.delete_hierarchy_paths(
        session=session, product_group_id=product_group_id
    )

    # 4. Delete product group
    await session.delete(product_group)
    await session.commit()

    logger.info(
        f"Physically deleted product group {product_group_id} "
        f"({product_group.name}) with {items_count} related shopping list items "
        f"by admin {current_user.id}"
    )

    return {
        "message": "Product group deleted successfully",
        "product_group_id": product_group_id,
        "cascade_deleted": {"shopping_list_items": items_count},
    }


@router.get(
    "/{product_group_id}/subtree",
    response_model=ProductGroupListResponse,
    summary="Get product group subtree",
    description="Get all descendants of a product group (uses Closure Table)",
)
async def get_product_group_subtree(
    product_group_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    max_depth: Annotated[int | None, Query(ge=0, le=10)] = None,
    include_self: Annotated[bool, Query()] = True,
) -> ProductGroupListResponse:
    """
    Get subtree of a product group (all descendants).

    Uses closure table for efficient O(1) hierarchical query.

    **Shared References Architecture:**
    - All users can access all product group subtrees (shared model)

    **Parameters:**
    - max_depth: Maximum depth to traverse (0-10, None = unlimited)
    - include_self: Include root product group in results (default: True)

    **Returns:**
    - 200 OK: List of product groups in subtree (ordered by depth)
    - 404 Not Found: Product group not found

    **Example:**
    ```
    GET /api/v1/product-groups/1/subtree?max_depth=2&include_self=true

    Returns: [Food, Dairy, Vegetables, Milk, Cheese]
    ```

    **Use Cases:**
    - Display category tree
    - Find all product groups under category
    - Category selector dropdown
    """
    # Verify product group exists
    query = select(ProductGroup).where(ProductGroup.id == product_group_id)
    result = await session.execute(query)
    product_group = result.scalar_one_or_none()

    if not product_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product group {product_group_id} not found",
        )

    # Get subtree using hierarchy service
    subtree_groups = await product_group_hierarchy_service.get_subtree(
        session=session,
        product_group_id=product_group_id,
        max_depth=max_depth,
        include_self=include_self,
    )

    # NO filtering - all users see all product groups (shared references)

    return ProductGroupListResponse(
        product_groups=[
            ProductGroupResponse.model_validate(pg) for pg in subtree_groups
        ],
        total=len(subtree_groups),
        limit=len(subtree_groups),
        offset=0,
    )


@router.get(
    "/{product_group_id}/ancestors",
    response_model=ProductGroupListResponse,
    summary="Get product group ancestors",
    description="Get ancestors of a product group (path to root, uses Closure Table)",
)
async def get_product_group_ancestors(
    product_group_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    include_self: Annotated[bool, Query()] = False,
) -> ProductGroupListResponse:
    """
    Get ancestors of a product group (path to root).

    Uses closure table for efficient O(1) query.

    **Shared References Architecture:**
    - All users can access all product group ancestors (shared model)

    **Parameters:**
    - include_self: Include product group itself in results (default: False)

    **Returns:**
    - 200 OK: List of ancestors (ordered root → product group)
    - 404 Not Found: Product group not found

    **Example:**
    ```
    GET /api/v1/product-groups/3/ancestors?include_self=true

    Returns: [Food, Dairy, Milk]  # Breadcrumb path
    ```

    **Use Cases:**
    - Breadcrumb navigation
    - Full category path display
    - Validate hierarchy constraints
    """
    # Verify product group exists
    query = select(ProductGroup).where(ProductGroup.id == product_group_id)
    result = await session.execute(query)
    product_group = result.scalar_one_or_none()

    if not product_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product group {product_group_id} not found",
        )

    # Get ancestors using hierarchy service
    ancestor_groups = await product_group_hierarchy_service.get_ancestors(
        session=session,
        product_group_id=product_group_id,
        include_self=include_self,
    )

    # NO filtering - all users see all product groups (shared references)

    return ProductGroupListResponse(
        product_groups=[
            ProductGroupResponse.model_validate(pg) for pg in ancestor_groups
        ],
        total=len(ancestor_groups),
        limit=len(ancestor_groups),
        offset=0,
    )


@router.put(
    "/{product_group_id}/move",
    response_model=ProductGroupResponse,
    summary="Move product group",
    description="Move product group to new parent (updates Closure Table, admin only)",
)
async def move_product_group_to_parent(
    product_group_id: int,
    move_data: ProductGroupMove,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> ProductGroupResponse:
    """
    Move product group to new parent.

    Updates parent_id and rebuilds Closure Table paths for entire subtree.

    **Shared References Architecture:**
    - Only admins can move product groups

    **Validation:**
    - Cannot move to itself
    - Cannot move to its own descendant (would create cycle)
    - New parent must exist (or None for root)

    **Returns:**
    - 200 OK: Product group moved successfully
    - 400 Bad Request: Invalid move (cycle detected)
    - 403 Forbidden: Not admin
    - 404 Not Found: Product group or new parent not found

    **Example:**
    ```
    PUT /api/v1/product-groups/5/move
    {
      "new_parent_id": 3
    }

    Moves product group 5 under product group 3
    ```
    """
    # Check: Only admins can move product groups
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can move product groups",
        )

    # Fetch product group
    query = select(ProductGroup).where(ProductGroup.id == product_group_id)
    result = await session.execute(query)
    product_group = result.scalar_one_or_none()

    if not product_group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product group {product_group_id} not found",
        )

    # Validate: Cannot move to itself
    if move_data.new_parent_id == product_group_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot move product group to itself",
        )

    # Validate: New parent must exist
    if move_data.new_parent_id is not None:
        parent_query = select(ProductGroup).where(
            ProductGroup.id == move_data.new_parent_id
        )
        parent_result = await session.execute(parent_query)
        new_parent = parent_result.scalar_one_or_none()

        if not new_parent:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"New parent product group {move_data.new_parent_id} not found",
            )

        # Validate: Cannot move to descendant (would create cycle)
        descendants = await product_group_hierarchy_service.get_subtree(
            session=session,
            product_group_id=product_group_id,
            include_self=False,
        )
        descendant_ids = [d.id for d in descendants]

        if move_data.new_parent_id in descendant_ids:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot move product group to its own descendant (would create cycle)",
            )

    # Move product group using service (updates parent_id + History + Closure Table)
    updated_product_group = await move_product_group(
        session=session,
        product_group=product_group,
        new_parent_id=move_data.new_parent_id,
        changed_by_user_id=current_user.id,
    )

    logger.info(
        f"Moved product group {product_group_id} ({product_group.name}) "
        f"from parent {product_group.parent_id} to {move_data.new_parent_id} "
        f"by admin {current_user.id}"
    )

    return ProductGroupResponse.model_validate(updated_product_group)
