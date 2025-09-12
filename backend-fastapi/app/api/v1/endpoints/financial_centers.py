"""
Financial Center management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.models.financial_center import FinancialCenter
from app.schemas.financial_center import (
    FinancialCenterCreate,
    FinancialCenterUpdate,
    FinancialCenterPublic
)
from app.api.deps import get_current_user

router = APIRouter()


@router.get("/", response_model=List[FinancialCenterPublic])
async def get_financial_centers(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all financial centers for current user."""
    # Filter by user_id for data isolation
    stmt = (
        select(FinancialCenter)
        .where(FinancialCenter.user_id == current_user.get('user_id'))
        .offset(skip)
        .limit(limit)
        .order_by(FinancialCenter.name.asc())
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    return [FinancialCenterPublic.model_validate(center) for center in centers]


@router.get("/{center_id}", response_model=FinancialCenterPublic)
async def get_financial_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get financial center by ID for current user."""
    stmt = select(FinancialCenter).where(
        FinancialCenter.id == center_id,
        FinancialCenter.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial center not found or access denied"
        )
    
    return FinancialCenterPublic.model_validate(center)


@router.post("/", response_model=FinancialCenterPublic)
async def create_financial_center(
    center_data: FinancialCenterCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new financial center for current user."""
    # Auto-assign user_id from current_user for data isolation
    user_id = current_user.get('user_id')
    
    # Check if financial center with same name already exists for this user
    stmt = select(FinancialCenter).where(
        FinancialCenter.name == center_data.name,
        FinancialCenter.user_id == user_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ЦФО с названием '{center_data.name}' уже существует"
        )
    
    try:
        center = FinancialCenter(
            name=center_data.name,
            is_active=center_data.is_active,
            user_id=user_id  # Auto-assign from current_user
        )
        db.add(center)
        await db.commit()
        await db.refresh(center)
        
        return FinancialCenterPublic.model_validate(center)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"ЦФО с названием '{center_data.name}' уже существует"
        )


@router.put("/{center_id}", response_model=FinancialCenterPublic)
async def update_financial_center(
    center_id: int,
    center_data: FinancialCenterUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update financial center for current user."""
    stmt = select(FinancialCenter).where(
        FinancialCenter.id == center_id,
        FinancialCenter.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial center not found or access denied"
        )
    
    # Update only provided fields (excluding user_id to prevent unauthorized changes)
    update_data = center_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)
    
    for field, value in update_data.items():
        if field == 'name' and value:
            # Check for name uniqueness
            stmt = select(FinancialCenter).where(
                FinancialCenter.name == value,
                FinancialCenter.user_id == center.user_id,
                FinancialCenter.id != center_id
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if existing:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"ЦФО с названием '{value}' уже существует"
                )
        
        setattr(center, field, value)
    
    try:
        await db.commit()
        await db.refresh(center)
        
        return FinancialCenterPublic.model_validate(center)
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
    current_user: dict = Depends(get_current_user)
):
    """Delete financial center for current user."""
    stmt = select(FinancialCenter).where(
        FinancialCenter.id == center_id,
        FinancialCenter.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()
    
    if not center:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Financial center not found or access denied"
        )
    
    await db.delete(center)
    await db.commit()
    
    return {"message": "Financial center deleted successfully"}


@router.post("/bulk-delete")
async def bulk_delete_financial_centers(
    ids: List[int] = Body(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple financial centers for current user."""
    stmt = select(FinancialCenter).where(
        FinancialCenter.id.in_(ids),
        FinancialCenter.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    if not centers:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No financial centers found or access denied"
        )
    
    for center in centers:
        await db.delete(center)
    
    await db.commit()
    
    return {"message": f"Deleted {len(centers)} financial centers"}