"""
Financial Centers API endpoints.

This module provides REST API endpoints for managing financial centers (bank accounts,
wallets, cash) with SCD Type 2 support.

Endpoints:
    GET    /api/v1/financial-centers      - List all financial centers (user + global)
    POST   /api/v1/financial-centers      - Create new financial center
    GET    /api/v1/financial-centers/{id} - Get financial center by ID
    PUT    /api/v1/financial-centers/{id} - Update financial center (creates new SCD2 version)
    DELETE /api/v1/financial-centers/{id} - Soft delete financial center
"""

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlmodel import or_, select

from backend.app.core.dependencies import get_current_user, get_session
from backend.app.models import FinancialCenter, User
from backend.app.schemas.errors import get_common_responses
from backend.app.schemas.financial_center import (
    FinancialCenterCreate,
    FinancialCenterListResponse,
    FinancialCenterResponse,
    FinancialCenterUpdate,
)
from backend.app.services import scd2_service

router = APIRouter(
    prefix="/financial-centers",
    tags=["financial-centers"],
    responses=get_common_responses(),
)


@router.get(
    "",
    response_model=FinancialCenterListResponse,
    summary="List financial centers",
    description="Get list of financial centers (user-specific + global)",
)
async def list_financial_centers(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    include_global: bool = Query(True, description="Include global financial centers"),
) -> FinancialCenterListResponse:
    """
    List financial centers for current user.

    Returns user-specific financial centers and optionally global financial centers.
    Only current versions (is_current=True) are returned.
    """
    # Build query
    conditions = [FinancialCenter.is_current == True]

    if include_global:
        # User financial centers OR global financial centers
        conditions.append(
            or_(
                FinancialCenter.user_id == current_user.id,
                FinancialCenter.is_global == True
            )
        )
    else:
        # Only user financial centers
        conditions.append(FinancialCenter.user_id == current_user.id)

    # Count total
    count_query = select(FinancialCenter).where(*conditions)
    count_result = await session.execute(count_query)
    total = len(count_result.all())

    # Fetch paginated results
    query = (
        select(FinancialCenter)
        .where(*conditions)
        .order_by(FinancialCenter.name)
        .limit(limit)
        .offset(offset)
    )

    result = await session.execute(query)
    financial_centers = result.scalars().all()

    return FinancialCenterListResponse(
        financial_centers=[
            FinancialCenterResponse.model_validate(fc) for fc in financial_centers
        ],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.post(
    "",
    response_model=FinancialCenterResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create financial center",
    description="Create a new financial center for current user",
)
async def create_financial_center(
    financial_center_data: FinancialCenterCreate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FinancialCenterResponse:
    """
    Create a new financial center.

    - Global financial centers (is_global=True) can only be created by admins
    - User financial centers are automatically assigned to current_user
    """
    # Check admin permissions for global financial centers
    if financial_center_data.is_global and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create global financial centers",
        )

    # Create financial center
    financial_center = FinancialCenter(
        user_id=None if financial_center_data.is_global else current_user.id,
        code=financial_center_data.code,
        name=financial_center_data.name,
        description=financial_center_data.description,
        is_global=financial_center_data.is_global,
        is_current=True,
        valid_from=datetime.utcnow(),
        valid_to=datetime(9999, 12, 31, 23, 59, 59),
    )

    session.add(financial_center)
    await session.commit()
    await session.refresh(financial_center)

    return FinancialCenterResponse.model_validate(financial_center)


@router.get(
    "/{financial_center_id}",
    response_model=FinancialCenterResponse,
    summary="Get financial center",
    description="Get a single financial center by ID",
)
async def get_financial_center(
    financial_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FinancialCenterResponse:
    """
    Get financial center by ID.

    Returns current version (is_current=True) only.
    """
    query = select(FinancialCenter).where(
        FinancialCenter.id == financial_center_id,
        FinancialCenter.is_current == True,
    )

    result = await session.execute(query)
    financial_center = result.scalar_one_or_none()

    if not financial_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Financial center {financial_center_id} not found",
        )

    # Check access: user can access their own financial centers or global financial centers
    if not financial_center.is_global and financial_center.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this financial center",
        )

    return FinancialCenterResponse.model_validate(financial_center)


@router.put(
    "/{financial_center_id}",
    response_model=FinancialCenterResponse,
    summary="Update financial center",
    description="Update financial center (creates new SCD Type 2 version)",
)
async def update_financial_center(
    financial_center_id: int,
    update_data: FinancialCenterUpdate,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> FinancialCenterResponse:
    """
    Update financial center.

    Creates new SCD Type 2 version:
    - Old version: is_current=False, valid_to=now()
    - New version: is_current=True, valid_from=now(), valid_to=9999-12-31

    Only owner (or admin for global) can update.
    """
    # Fetch current version
    query = select(FinancialCenter).where(
        FinancialCenter.id == financial_center_id,
        FinancialCenter.is_current == True,
    )

    result = await session.execute(query)
    old_financial_center = result.scalar_one_or_none()

    if not old_financial_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Financial center {financial_center_id} not found",
        )

    # Check permissions
    if old_financial_center.is_global and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update global financial centers",
        )

    if not old_financial_center.is_global and old_financial_center.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this financial center",
        )

    # Use SCD2 service for update
    update_dict = update_data.model_dump(exclude_unset=True)

    new_financial_center = await scd2_service.create_new_version(
        session=session,
        old_instance=old_financial_center,
        updates=update_dict,
    )

    return FinancialCenterResponse.model_validate(new_financial_center)


@router.delete(
    "/{financial_center_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete financial center",
    description="Soft delete financial center (sets is_current=False)",
)
async def delete_financial_center(
    financial_center_id: int,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
) -> None:
    """
    Soft delete financial center.

    Sets is_current=False and valid_to=now() for current version.
    Historical versions are preserved.
    """
    # Fetch current version
    query = select(FinancialCenter).where(
        FinancialCenter.id == financial_center_id,
        FinancialCenter.is_current == True,
    )

    result = await session.execute(query)
    financial_center = result.scalar_one_or_none()

    if not financial_center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Financial center {financial_center_id} not found",
        )

    # Check permissions
    if financial_center.is_global and not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete global financial centers",
        )

    if not financial_center.is_global and financial_center.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this financial center",
        )

    # Soft delete: set is_current=False and valid_to=now()
    financial_center.is_current = False
    financial_center.valid_to = datetime.utcnow()
    financial_center.updated_at = datetime.utcnow()

    session.add(financial_center)
    await session.commit()
