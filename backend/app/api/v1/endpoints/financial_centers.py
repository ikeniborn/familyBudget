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
from backend.app.services.scd2_service import has_changes

router = APIRouter(
    prefix="/financial-centers",
    tags=["financial-centers"],
    responses=get_common_responses(),
)


@router.get(
    "",
    response_model=FinancialCenterListResponse,
    summary="List financial centers",
    description="Get list of user's financial centers",
)
async def list_financial_centers(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user),
    limit: int = Query(100, ge=1, le=1000, description="Maximum number of results"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
) -> FinancialCenterListResponse:
    """
    List financial centers for current user.

    Shared references architecture: All users see all financial centers.
    Only current versions (is_current=True) are returned.
    """
    # Build query - all financial centers (shared references)
    conditions = [
        FinancialCenter.is_current == True,
    ]

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

    Shared references architecture: Only admins can create financial centers.
    Financial center is created with current_user as creator (audit trail).
    """
    # Check: Only admins can create financial centers
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create financial centers"
        )

    # Generate code for financial center
    from backend.app.utils.code_generator import generate_code
    generated_code = await generate_code(session, FinancialCenter)

    # Create financial center
    financial_center = FinancialCenter(
        user_id=current_user.id,
        name=financial_center_data.name,
        description=financial_center_data.description,
        code=generated_code,
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
    Shared references architecture: All users can access all financial centers.
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

    # NO access restrictions - all users can read all financial centers

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

    Shared references architecture: Only admins can update financial centers.
    """
    # Check: Only admins can update financial centers
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can update financial centers",
        )

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

    # Get update dict
    update_dict = update_data.model_dump(exclude_unset=True)

    # Check if anything changed
    changed, changed_fields = has_changes(old_financial_center, update_dict)
    if not changed:
        # No changes, return existing financial center
        return FinancialCenterResponse.model_validate(old_financial_center)

    # Use SCD2 service for update
    new_financial_center = await scd2_service.create_new_version(
        session=session,
        old_instance=old_financial_center,
        updates=update_dict,
        changed_fields=changed_fields,
        changed_by_user_id=current_user.id,
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
    Shared references architecture: Only admins can delete financial centers.
    """
    # Check: Only admins can delete financial centers
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete financial centers",
        )

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

    # Soft delete: set is_current=False and valid_to=now()
    financial_center.is_current = False
    financial_center.valid_to = datetime.utcnow()
    financial_center.updated_at = datetime.utcnow()

    session.add(financial_center)
    await session.commit()
