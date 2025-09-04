"""
Financial Center management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.models.financial_center import FinancialCenter
from app.core.session import get_current_user_from_session

router = APIRouter()


class FinancialCenterCreate(BaseModel):
    """Financial Center creation schema."""
    financial_center_name: str = Field(..., min_length=1, max_length=255)
    is_active: Optional[bool] = Field(default=True)
    user_id: int


class FinancialCenterUpdate(BaseModel):
    """Financial Center update schema."""
    financial_center_name: Optional[str] = Field(None, min_length=1, max_length=255)
    is_active: Optional[bool] = None


class FinancialCenterResponse(BaseModel):
    """Financial Center response schema."""
    financial_center_id: int
    financial_center_name: str
    is_active: bool
    user_id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


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
    user_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get all financial centers."""
    # Always filter by current user's ID for data isolation
    effective_user_id = user_id if user_id else current_user['user_id']
    stmt = select(FinancialCenter).where(
        FinancialCenter.user_id == effective_user_id
    ).order_by(FinancialCenter.name)
    
    stmt = stmt.offset(skip).limit(limit)
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
    stmt = select(FinancialCenter).where(
        FinancialCenter.id == center_id,
        FinancialCenter.user_id == current_user['user_id']
    )
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
    # Check if financial center with same name already exists for this user
    stmt = select(FinancialCenter).where(
        FinancialCenter.name == center_data.financial_center_name,
        FinancialCenter.user_id == center_data.user_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ЦФО с названием '{center_data.financial_center_name}' уже существует"
        )
    
    try:
        center = FinancialCenter(
            name=center_data.financial_center_name,
            is_active=center_data.is_active if center_data.is_active is not None else True,
            user_id=center_data.user_id
        )
        db.add(center)
        await db.commit()
        await db.refresh(center)
        
        return FinancialCenterResponse(**center.to_dict())
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ЦФО с названием '{center_data.financial_center_name}' уже существует"
        )


@router.put("/{center_id}", response_model=FinancialCenterResponse)
async def update_financial_center(
    center_id: int,
    center_data: FinancialCenterUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Update financial center."""
    stmt = select(FinancialCenter).where(
        FinancialCenter.id == center_id,
        FinancialCenter.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial center not found"
        )
    
    # Update only provided fields
    update_data = center_data.dict(exclude_unset=True)
    
    # Check for name uniqueness if name is being updated
    if 'financial_center_name' in update_data:
        stmt = select(FinancialCenter).where(
            FinancialCenter.name == update_data['financial_center_name'],
            FinancialCenter.user_id == center.user_id,
            FinancialCenter.id != center_id
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"ЦФО с названием '{update_data['financial_center_name']}' уже существует"
            )
        
        center.name = update_data['financial_center_name']
    
    if 'is_active' in update_data:
        center.is_active = update_data['is_active']
    
    try:
        await db.commit()
        await db.refresh(center)
        
        return FinancialCenterResponse(**center.to_dict())
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ЦФО с таким названием уже существует"
        )


@router.delete("/{center_id}")
async def delete_financial_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete financial center."""
    stmt = select(FinancialCenter).where(
        FinancialCenter.id == center_id,
        FinancialCenter.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial center not found"
        )
    
    await db.delete(center)
    await db.commit()
    
    return {"success": True, "message": "Financial center deleted successfully"}


@router.post("/bulk-delete")
async def bulk_delete_financial_centers(
    ids: List[int] = Body(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete multiple financial centers."""
    stmt = select(FinancialCenter).where(
        FinancialCenter.id.in_(ids),
        FinancialCenter.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    if not centers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No financial centers found"
        )
    
    for center in centers:
        await db.delete(center)
    
    await db.commit()
    
    return {"success": True, "message": f"Deleted {len(centers)} financial centers"}