"""
Cost Center management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.models.cost_center import CostCenter
from app.schemas.cost_center import (
    CostCenterCreate,
    CostCenterUpdate,
    CostCenterPublic
)
from app.api.deps import get_current_user
from app.core.security import require_admin_access
from app.core.response import (
    success_response,
    error_response,
    error_not_found,
    error_bad_request,
    error_conflict
)

router = APIRouter()


@router.get("/", response_model=List[CostCenterPublic])
async def get_cost_centers(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all cost centers for current user."""
    user_id = current_user.get('user_id')

    # Show only user's own centers
    stmt = (
        select(CostCenter)
        .where(CostCenter.user_id == user_id)
        .offset(skip)
        .limit(limit)
        .order_by(CostCenter.name.asc())
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()

    centers_data = []
    for center in centers:
        center_dict = {
            'id': center.id,
            'code': center.code,
            'name': center.name,
            'description': center.description,
            'is_active': center.is_active,
            'user_id': center.user_id,
            'created_at': center.created_at,
            'updated_at': center.updated_at,
            'is_shared': False,
            'is_editable': True
        }
        centers_data.append(center_dict)

    return success_response(data=centers_data, total=len(centers_data))


@router.get("/{center_id}", response_model=CostCenterPublic)
async def get_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get cost center by ID for current user."""
    user_id = current_user.get('user_id')

    # Show center if it belongs to current user
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        CostCenter.user_id == user_id
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Cost center not found")

    center_dict = {
        'id': center.id,
        'code': center.code,
        'name': center.name,
        'description': center.description,
        'is_active': center.is_active,
        'user_id': center.user_id,
        'created_by': getattr(center, 'created_by', None),
        'managed_by': getattr(center, 'managed_by', None),
        'created_at': getattr(center, 'created_at', None),
        'updated_at': getattr(center, 'updated_at', None),
        'is_shared': False,
        'is_editable': True
    }

    return success_response(data=center_dict)


@router.post("/", response_model=CostCenterPublic)
async def create_cost_center(
    center_data: CostCenterCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new cost center for current user."""
    user_id = current_user.get('user_id')

    # Check for existing center with same code for current user
    stmt = select(CostCenter).where(
        CostCenter.code == center_data.code,
        CostCenter.user_id == user_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return error_conflict(f"Cost center with code '{center_data.code}' already exists")

    try:
        center = CostCenter(
            code=center_data.code,
            name=center_data.name,
            description=center_data.description,
            is_active=center_data.is_active,
            user_id=user_id
        )
        db.add(center)
        await db.commit()
        await db.refresh(center)

        center_dict = {
            'id': center.id,
            'code': center.code,
            'name': center.name,
            'description': center.description,
            'is_active': center.is_active,
            'user_id': center.user_id,
            'created_at': center.created_at,
            'updated_at': center.updated_at,
            'is_shared': False,
            'is_editable': True
        }

        return success_response(data=center_dict, status_code=201)
    except IntegrityError:
        await db.rollback()
        return error_conflict(f"Cost center with code '{center_data.code}' already exists")


@router.put("/{center_id}", response_model=CostCenterPublic)
async def update_cost_center(
    center_id: int,
    center_data: CostCenterUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update cost center for current user."""
    user_id = current_user.get('user_id')

    # Get center for current user
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        CostCenter.user_id == user_id
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Cost center not found")

    # Update only provided fields (excluding user_id to prevent unauthorized changes)
    update_data = center_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)

    # Check for code conflicts if code is being updated
    if 'code' in update_data and update_data['code']:
        stmt = select(CostCenter).where(
            CostCenter.code == update_data['code'],
            CostCenter.user_id == user_id,
            CostCenter.id != center_id
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            return error_conflict(f"Cost center with code '{update_data['code']}' already exists")

    for field, value in update_data.items():
        setattr(center, field, value)

    try:
        await db.commit()
        await db.refresh(center)

        center_dict = {
            'id': center.id,
            'code': center.code,
            'name': center.name,
            'description': center.description,
            'is_active': center.is_active,
            'user_id': center.user_id,
            'created_at': center.created_at,
            'updated_at': center.updated_at,
            'is_shared': False,
            'is_editable': True
        }

        return success_response(data=center_dict)
    except IntegrityError:
        await db.rollback()
        return error_conflict("Cost center with this code already exists")


@router.delete("/{center_id}")
async def delete_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete cost center for current user."""
    user_id = current_user.get('user_id')

    # Get center for current user
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        CostCenter.user_id == user_id
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Cost center not found")

    await db.delete(center)
    await db.commit()

    return success_response(data={"message": "Cost center deleted successfully"})


@router.post("/bulk-delete")
async def bulk_delete_cost_centers(
    ids: List[int] = Body(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple cost centers for current user."""
    user_id = current_user.get('user_id')

    # Get all centers that match the IDs and belong to current user
    stmt = select(CostCenter).where(
        CostCenter.id.in_(ids),
        CostCenter.user_id == user_id
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()

    if not centers:
        return error_not_found("No cost centers found")

    for center in centers:
        await db.delete(center)

    await db.commit()

    return success_response(data={"message": f"Deleted {len(centers)} cost centers"})