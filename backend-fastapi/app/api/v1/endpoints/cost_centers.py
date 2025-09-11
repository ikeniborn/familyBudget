"""
Cost Center management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.models.cost_center import CostCenter
from app.api.deps import get_current_user

router = APIRouter()


class CostCenterCreate(BaseModel):
    """Cost Center creation schema."""
    cost_center_name: str = Field(..., min_length=1, max_length=255)
    is_active: Optional[bool] = Field(default=True)
    user_id: int


class CostCenterUpdate(BaseModel):
    """Cost Center update schema."""
    cost_center_name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = None


class CostCenterResponse(BaseModel):
    """Cost Center response schema."""
    cost_center_id: int
    cost_center_name: str
    is_active: bool
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


@router.get("/", response_model=List[CostCenterResponse])
async def get_cost_centers(
    request: Request,
    user_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all cost centers."""
    # Always filter by current user's ID for data isolation
    effective_user_id = user_id if user_id else current_user['user_id']
    stmt = select(CostCenter).where(
        CostCenter.user_id == effective_user_id
    ).order_by(CostCenter.name)
    
    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    return [CostCenterResponse(**center.to_dict()) for center in centers]


@router.get("/{center_id}", response_model=CostCenterResponse)
async def get_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get cost center by ID."""
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        CostCenter.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost center not found"
        )
    
    return CostCenterResponse(**center.to_dict())


@router.post("/", response_model=CostCenterResponse)
async def create_cost_center(
    center_data: CostCenterCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new cost center."""
    # Check if cost center with same name already exists for this user
    stmt = select(CostCenter).where(
        CostCenter.name == center_data.cost_center_name,
        CostCenter.user_id == center_data.user_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"МВЗ с названием '{center_data.cost_center_name}' уже существует"
        )
    
    try:
        center = CostCenter(
            name=center_data.cost_center_name,
            is_active=center_data.is_active if center_data.is_active is not None else True,
            user_id=center_data.user_id
        )
        db.add(center)
        await db.commit()
        await db.refresh(center)
        
        return CostCenterResponse(**center.to_dict())
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"МВЗ с названием '{center_data.cost_center_name}' уже существует"
        )


@router.put("/{center_id}", response_model=CostCenterResponse)
async def update_cost_center(
    center_id: int,
    center_data: CostCenterUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update cost center."""
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        CostCenter.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost center not found"
        )
    
    # Update only provided fields
    update_data = center_data.dict(exclude_unset=True)
    
    # Check for name uniqueness if name is being updated
    if 'cost_center_name' in update_data:
        stmt = select(CostCenter).where(
            CostCenter.name == update_data['cost_center_name'],
            CostCenter.user_id == center.user_id,
            CostCenter.id != center_id
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"МВЗ с названием '{update_data['cost_center_name']}' уже существует"
            )
        
        center.name = update_data['cost_center_name']
    
    if 'is_active' in update_data:
        center.is_active = update_data['is_active']
    
    try:
        await db.commit()
        await db.refresh(center)
        
        return CostCenterResponse(**center.to_dict())
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"МВЗ с таким названием уже существует"
        )


@router.delete("/{center_id}")
async def delete_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete cost center."""
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        CostCenter.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost center not found"
        )
    
    await db.delete(center)
    await db.commit()
    
    return {"success": True, "message": "Cost center deleted successfully"}


@router.post("/bulk-delete")
async def bulk_delete_cost_centers(
    ids: List[int] = Body(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple cost centers."""
    stmt = select(CostCenter).where(
        CostCenter.id.in_(ids),
        CostCenter.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    if not centers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No cost centers found"
        )
    
    for center in centers:
        await db.delete(center)
    
    await db.commit()
    
    return {"success": True, "message": f"Deleted {len(centers)} cost centers"}