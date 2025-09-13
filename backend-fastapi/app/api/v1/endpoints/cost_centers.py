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
    # Filter by user_id for data isolation
    stmt = (
        select(CostCenter)
        .where(CostCenter.user_id == current_user.get('user_id'))
        .offset(skip)
        .limit(limit)
        .order_by(CostCenter.name.asc())
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    centers_data = [CostCenterPublic.model_validate(center).dict() for center in centers]
    return success_response(data=centers_data, total=len(centers_data))


@router.get("/{center_id}", response_model=CostCenterPublic)
async def get_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get cost center by ID for current user."""
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        CostCenter.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Cost center not found or access denied")

    return success_response(data=CostCenterPublic.model_validate(center).dict())


@router.post("/", response_model=CostCenterPublic)
async def create_cost_center(
    center_data: CostCenterCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new cost center for current user."""
    # Auto-assign user_id from current_user for data isolation
    user_id = current_user.get('user_id')
    
    # Check if cost center with same name already exists for this user
    stmt = select(CostCenter).where(
        CostCenter.name == center_data.name,
        CostCenter.user_id == user_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        return error_bad_request(f"МВЗ с названием '{center_data.name}' уже существует")
    
    try:
        center = CostCenter(
            name=center_data.name,
            is_active=center_data.is_active,
            user_id=user_id  # Auto-assign from current_user
        )
        db.add(center)
        await db.commit()
        await db.refresh(center)
        
        return success_response(data=CostCenterPublic.model_validate(center).dict(), status_code=201)
    except IntegrityError:
        await db.rollback()
        return error_bad_request(f"МВЗ с названием '{center_data.name}' уже существует")


@router.put("/{center_id}", response_model=CostCenterPublic)
async def update_cost_center(
    center_id: int,
    center_data: CostCenterUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update cost center for current user."""
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        CostCenter.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Cost center not found or access denied")
    
    # Update only provided fields (excluding user_id to prevent unauthorized changes)
    update_data = center_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)
    
    for field, value in update_data.items():
        if field == 'name' and value:
            # Check for name uniqueness
            stmt = select(CostCenter).where(
                CostCenter.name == value,
                CostCenter.user_id == center.user_id,
                CostCenter.id != center_id
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if existing:
                return error_bad_request(f"МВЗ с названием '{value}' уже существует")
        
        setattr(center, field, value)
    
    try:
        await db.commit()
        await db.refresh(center)
        
        return success_response(data=CostCenterPublic.model_validate(center).dict())
    except IntegrityError:
        await db.rollback()
        return error_bad_request("МВЗ с таким названием уже существует")


@router.delete("/{center_id}")
async def delete_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete cost center for current user."""
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        CostCenter.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Cost center not found or access denied")

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
    stmt = select(CostCenter).where(
        CostCenter.id.in_(ids),
        CostCenter.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    if not centers:
        return error_not_found("No cost centers found or access denied")

    for center in centers:
        await db.delete(center)

    await db.commit()

    return success_response(data={"message": f"Deleted {len(centers)} cost centers"})