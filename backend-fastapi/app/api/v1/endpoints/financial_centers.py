"""
Financial Center management endpoints.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.database import get_db
from app.models.financial_center import FinancialCenter
from app.core.session import get_current_user_from_session

router = APIRouter()


class FinancialCenterCreate(BaseModel):
    """Financial Center creation schema."""
    name: str


class FinancialCenterUpdate(BaseModel):
    """Financial Center update schema."""
    name: str


class FinancialCenterResponse(BaseModel):
    """Financial Center response schema."""
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


@router.get("/", response_model=List[FinancialCenterResponse])
async def get_financial_centers(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get all financial centers."""
    stmt = select(FinancialCenter).offset(skip).limit(limit).order_by(FinancialCenter.name)
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    return [FinancialCenterResponse(**center.to_dict()) for center in centers]


@router.get("/{center_id}", response_model=FinancialCenterResponse)
async def get_financial_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get financial center by ID."""
    stmt = select(FinancialCenter).where(FinancialCenter.id == center_id)
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial center not found"
        )
    
    return FinancialCenterResponse(**center.to_dict())


@router.post("/", response_model=FinancialCenterResponse)
async def create_financial_center(
    center_data: FinancialCenterCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Create new financial center."""
    center = FinancialCenter(**center_data.dict())
    db.add(center)
    await db.commit()
    await db.refresh(center)
    
    return FinancialCenterResponse(**center.to_dict())


@router.put("/{center_id}", response_model=FinancialCenterResponse)
async def update_financial_center(
    center_id: int,
    center_data: FinancialCenterUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Update financial center."""
    stmt = select(FinancialCenter).where(FinancialCenter.id == center_id)
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial center not found"
        )
    
    center.name = center_data.name
    await db.commit()
    await db.refresh(center)
    
    return FinancialCenterResponse(**center.to_dict())


@router.delete("/{center_id}")
async def delete_financial_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete financial center."""
    stmt = select(FinancialCenter).where(FinancialCenter.id == center_id)
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial center not found"
        )
    
    await db.delete(center)
    await db.commit()
    
    return {"message": "Financial center deleted successfully"}