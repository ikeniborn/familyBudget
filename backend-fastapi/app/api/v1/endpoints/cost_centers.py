"""
Cost Center management endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.database import get_db
from app.models.cost_center import CostCenter
from app.core.session import get_current_user_from_session

router = APIRouter()


class CostCenterCreate(BaseModel):
    """Cost Center creation schema."""
    name: str


class CostCenterUpdate(BaseModel):
    """Cost Center update schema."""
    name: str


class CostCenterResponse(BaseModel):
    """Cost Center response schema."""
    id: int
    name: str


async def require_auth(request: Request) -> dict:
    """Require authentication."""
    user = await get_current_user_from_session(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return user


@router.get("/", response_model=List[CostCenterResponse])
async def get_cost_centers(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get all cost centers."""
    stmt = select(CostCenter).offset(skip).limit(limit).order_by(CostCenter.name)
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    return [CostCenterResponse(**center.to_dict()) for center in centers]


@router.get("/{center_id}", response_model=CostCenterResponse)
async def get_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get cost center by ID."""
    stmt = select(CostCenter).where(CostCenter.id == center_id)
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
    current_user: dict = Depends(require_auth)
):
    """Create new cost center."""
    center = CostCenter(**center_data.dict())
    db.add(center)
    await db.commit()
    await db.refresh(center)
    
    return CostCenterResponse(**center.to_dict())


@router.put("/{center_id}", response_model=CostCenterResponse)
async def update_cost_center(
    center_id: int,
    center_data: CostCenterUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Update cost center."""
    stmt = select(CostCenter).where(CostCenter.id == center_id)
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost center not found"
        )
    
    center.name = center_data.name
    await db.commit()
    await db.refresh(center)
    
    return CostCenterResponse(**center.to_dict())


@router.delete("/{center_id}")
async def delete_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete cost center."""
    stmt = select(CostCenter).where(CostCenter.id == center_id)
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cost center not found"
        )
    
    await db.delete(center)
    await db.commit()
    
    return {"message": "Cost center deleted successfully"}