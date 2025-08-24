"""
Period management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.db.database import get_db
from app.models.period import Period
from app.core.session import get_current_user_from_session

router = APIRouter()


class PeriodCreate(BaseModel):
    """Period creation schema."""
    date: datetime
    ru_name: str
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class PeriodUpdate(BaseModel):
    """Period update schema."""
    date: Optional[datetime] = None
    ru_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None


class PeriodResponse(BaseModel):
    """Period response schema."""
    id: int
    date: datetime
    ru_name: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]


async def require_auth(request: Request) -> dict:
    """Require authentication."""
    user = await get_current_user_from_session(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return user


@router.get("/", response_model=List[PeriodResponse])
async def get_periods(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get all periods."""
    stmt = select(Period).offset(skip).limit(limit).order_by(Period.date.desc())
    result = await db.execute(stmt)
    periods = result.scalars().all()
    
    return [PeriodResponse(**period.to_dict()) for period in periods]


@router.get("/current", response_model=PeriodResponse)
async def get_current_period(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get current period based on today's date."""
    # Get period closest to current date
    stmt = select(Period).order_by(func.abs(func.extract('epoch', Period.date - func.now()))).limit(1)
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No periods found"
        )
    
    return PeriodResponse(**period.to_dict())


@router.get("/{period_id}", response_model=PeriodResponse)
async def get_period(
    period_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get period by ID."""
    stmt = select(Period).where(Period.id == period_id)
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Period not found"
        )
    
    return PeriodResponse(**period.to_dict())


@router.post("/", response_model=PeriodResponse)
async def create_period(
    period_data: PeriodCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Create new period."""
    period = Period(**period_data.dict())
    db.add(period)
    await db.commit()
    await db.refresh(period)
    
    return PeriodResponse(**period.to_dict())


@router.put("/{period_id}", response_model=PeriodResponse)
async def update_period(
    period_id: int,
    period_data: PeriodUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Update period."""
    stmt = select(Period).where(Period.id == period_id)
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Period not found"
        )
    
    # Update period fields
    update_data = period_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(period, field, value)
    
    await db.commit()
    await db.refresh(period)
    
    return PeriodResponse(**period.to_dict())


@router.delete("/{period_id}")
async def delete_period(
    period_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete period."""
    stmt = select(Period).where(Period.id == period_id)
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Period not found"
        )
    
    await db.delete(period)
    await db.commit()
    
    return {"message": "Period deleted successfully"}