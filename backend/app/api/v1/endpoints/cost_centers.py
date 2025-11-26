"""
Cost Centers API endpoints.

This module provides REST API endpoints for managing cost centers (projects, departments,
budget groups) with SCD Type 2 support.

Endpoints:
    GET    /api/v1/cost-centers      - List all cost centers (user + global)
    POST   /api/v1/cost-centers      - Create new cost center
    GET    /api/v1/cost-centers/{id} - Get cost center by ID
    PUT    /api/v1/cost-centers/{id} - Update cost center (creates new SCD2 version)
    DELETE /api/v1/cost-centers/{id} - Soft delete cost center
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import or_, select

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import CostCenter, User
from backend.app.schemas.cost_center import (
    CostCenterCreate,
    CostCenterListResponse,
    CostCenterResponse,
    CostCenterUpdate,
)
from backend.app.schemas.errors import get_common_responses
from backend.app.services.scd2_service import has_changes
from backend.app.services.cost_center_service import (
    create_initial_history,
    update_cost_center_profile,
)

router = APIRouter(
    prefix="/cost-centers",
    tags=["cost-centers"],
    responses=get_common_responses(),
)


@router.get(
    "",
    response_model=CostCenterListResponse,
    summary="List cost centers",
    description="Get list of user's cost centers",
)
async def list_cost_centers(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    include_inactive: bool = Query(False, description="Include archived cost centers"),
) -> CostCenterListResponse:
    """
    List cost centers for current user.

    Shared references architecture: All users see all cost centers.
    By default, only active cost centers (is_active=True) are returned.
    """
    # Build query - all cost centers (shared references)
    conditions = []

    # Filter archived if not explicitly requested
    if not include_inactive:
        conditions.append(CostCenter.is_active == True)

    # Count total
    count_query = select(CostCenter).where(*conditions)
    count_result = await session.execute(count_query)
    total = len(count_result.all())

    # Fetch paginated results
    query = (
        select(CostCenter)
        .where(*conditions)
        .order_by(CostCenter.name)
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(query)
    cost_centers = result.scalars().all()

    return CostCenterListResponse(
        cost_centers=[
            CostCenterResponse.model_validate(cc) for cc in cost_centers
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=CostCenterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create cost center",
    description="Create a new cost center for current user",
)
async def create_cost_center(
    cost_center_data: CostCenterCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Create a new cost center.

    Shared references architecture: Only admins can create cost centers.
    Cost center is created with current_user as creator (audit trail).
    """
    # Check: Only admins can create cost centers
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create cost centers"
        )

    # Generate code for cost center
    from backend.app.utils.code_generator import generate_code
    generated_code = await generate_code(session, CostCenter)

    # Create cost center (SCD Type 1 - no versioning fields)
    cost_center = CostCenter(
        user_id=current_user.id,
        name=cost_center_data.name,
        description=cost_center_data.description,
        code=generated_code,
    )

    session.add(cost_center)
    await session.commit()
    await session.refresh(cost_center)

    # Create initial history record (SCD Type 2 for history)
    await create_initial_history(session=session, cost_center=cost_center, change_type="CREATE")

    return CostCenterResponse.model_validate(cost_center)


@router.get(
    "/{cost_center_id}",
    response_model=CostCenterResponse,
    summary="Get cost center",
    description="Get a single cost center by ID",
)
async def get_cost_center(
    cost_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Get cost center by ID.

    Shared references architecture: All users can access all cost centers.
    """
    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )

    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # NO access restrictions - all users can read all cost centers

    return CostCenterResponse.model_validate(cost_center)


@router.put(
    "/{cost_center_id}",
    response_model=CostCenterResponse,
    summary="Update cost center",
    description="Update cost center (creates new SCD Type 2 version)",
)
async def update_cost_center(
    cost_center_id: int,
    update_data: CostCenterUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Update cost center.

    SCD Type 1 + History:
    - Updates cost center IN-PLACE (id remains stable)
    - Creates CostCenterHistory snapshot (SCD Type 2 for audit)
    - FK in fact tables remain unchanged

    Shared references architecture: Only admins can update cost centers.
    """
    # Check: Only admins can update cost centers
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update cost centers",
        )

    # Fetch cost center
    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )

    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # Get update dict
    update_dict = update_data.model_dump(exclude_unset=True)

    # Check if anything changed
    changed, changed_fields = has_changes(cost_center, update_dict)
    if not changed:
        # No changes, return existing cost center
        return CostCenterResponse.model_validate(cost_center)

    # Use SCD1+History service for update
    updated_cost_center = await update_cost_center_profile(
        session=session,
        cost_center=cost_center,
        updates=update_dict,
        changed_by_user_id=current_user.id,
        change_type="UPDATE",
    )

    return CostCenterResponse.model_validate(updated_cost_center)


@router.put(
    "/{cost_center_id}/archive",
    response_model=CostCenterResponse,
    summary="Archive cost center",
    description="Archive cost center (simple UPDATE is_active=False, not SCD Type 2)",
)
async def archive_cost_center(
    cost_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Archive cost center by setting is_active=False.

    Simple UPDATE operation (NOT SCD Type 2).
    Archived cost centers are hidden from UI dropdowns but remain in analytics.
    Only administrators can archive cost centers.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can archive cost centers",
        )

    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )
    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # Simple UPDATE: is_active=False (NOT SCD Type 2)
    cost_center.is_active = False
    cost_center.updated_at = datetime.utcnow()

    session.add(cost_center)
    await session.commit()
    await session.refresh(cost_center)

    return cost_center


@router.put(
    "/{cost_center_id}/restore",
    response_model=CostCenterResponse,
    summary="Restore archived cost center",
    description="Restore cost center (simple UPDATE is_active=True, not SCD Type 2)",
)
async def restore_cost_center(
    cost_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> CostCenterResponse:
    """
    Restore archived cost center by setting is_active=True.

    Simple UPDATE operation (NOT SCD Type 2).
    Only administrators can restore cost centers.
    """
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can restore cost centers",
        )

    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )
    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # Simple UPDATE: is_active=True (NOT SCD Type 2)
    cost_center.is_active = True
    cost_center.updated_at = datetime.utcnow()

    session.add(cost_center)
    await session.commit()
    await session.refresh(cost_center)

    return cost_center


@router.delete(
    "/{cost_center_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete cost center",
    description="Soft delete cost center (sets is_current=False)",
)
async def delete_cost_center(
    cost_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Soft delete cost center.

    Sets is_active=False (archived).
    Historical versions are preserved in CostCenterHistory.
    Shared references architecture: Only admins can delete cost centers.
    """
    # Check: Only admins can delete cost centers
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete cost centers",
        )

    # Fetch cost center
    query = select(CostCenter).where(
        CostCenter.id == cost_center_id
    )

    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # Soft delete: set is_active=False
    cost_center.is_active = False
    cost_center.updated_at = datetime.utcnow()

    session.add(cost_center)
    await session.commit()
