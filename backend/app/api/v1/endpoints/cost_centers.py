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
from backend.app.services import scd2_service

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
) -> CostCenterListResponse:
    """
    List cost centers for current user.

    Returns user-specific cost centers.
    Only current versions (is_current=True) are returned.
    """
    # Build query - only user's cost centers
    conditions = [
        CostCenter.is_current == True,
        CostCenter.user_id == current_user.id
    ]

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

    Cost center is automatically assigned to current_user.
    """
    # Create cost center
    cost_center = CostCenter(
        user_id=current_user.id,
        name=cost_center_data.name,
        description=cost_center_data.description,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )

    session.add(cost_center)
    await session.commit()
    await session.refresh(cost_center)

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

    Returns current version (is_current=True) only.
    """
    query = select(CostCenter).where(
        CostCenter.id == cost_center_id,
        CostCenter.is_current == True,
    )

    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # Check access: user can only access their own cost centers
    if cost_center.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this cost center",
        )

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

    Creates new SCD Type 2 version:
    - Old version: is_current=False, valid_to=now()
    - New version: is_current=True, valid_from=now(), valid_to=9999-12-31

    Only owner (or admin for global) can update.
    """
    # Fetch current version
    query = select(CostCenter).where(
        CostCenter.id == cost_center_id,
        CostCenter.is_current == True,
    )

    result = await session.execute(query)
    old_cost_center = result.scalar_one_or_none()

    if not old_cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # Check permissions - only owner can update
    if old_cost_center.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this cost center",
        )

    # Use SCD2 service for update
    update_dict = update_data.model_dump(exclude_unset=True)

    new_cost_center = await scd2_service.create_new_version(
        session=session,
        old_instance=old_cost_center,
        updates=update_dict,
    )

    return CostCenterResponse.model_validate(new_cost_center)


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

    Sets is_current=False and valid_to=now() for current version.
    Historical versions are preserved.
    """
    # Fetch current version
    query = select(CostCenter).where(
        CostCenter.id == cost_center_id,
        CostCenter.is_current == True,
    )

    result = await session.execute(query)
    cost_center = result.scalar_one_or_none()

    if not cost_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cost center {cost_center_id} not found",
        )

    # Check permissions - only owner can delete
    if cost_center.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this cost center",
        )

    # Soft delete: set is_current=False and valid_to=now()
    cost_center.is_current = False
    cost_center.valid_to = datetime.utcnow()
    cost_center.updated_at = datetime.utcnow()

    session.add(cost_center)
    await session.commit()
