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
    # Modern fields
    date: Optional[datetime] = None
    ru_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    # Legacy fields for backward compatibility
    period_name: Optional[str] = None
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    period_order: Optional[int] = None
    is_active: Optional[bool] = True
    user_id: Optional[int] = None


class PeriodUpdate(BaseModel):
    """Period update schema."""
    # Modern fields
    date: Optional[datetime] = None
    ru_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    
    # Legacy fields for backward compatibility
    period_name: Optional[str] = None
    period_year: Optional[int] = None
    period_month: Optional[int] = None
    period_order: Optional[int] = None
    is_active: Optional[bool] = None


class PeriodResponse(BaseModel):
    """Period response schema."""
    id: int
    date: datetime
    ru_name: str
    start_date: Optional[datetime]
    end_date: Optional[datetime]
    
    # Legacy fields for backward compatibility
    period_id: int
    period_name: str
    period_year: int
    period_month: int
    period_order: Optional[int] = 1
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user_id: Optional[int] = None


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
    
    response_periods = []
    for period in periods:
        period_dict = period.to_dict()
        # Add legacy fields
        period_dict['period_id'] = period_dict['id']
        period_dict['period_name'] = period_dict['ru_name']
        period_dict['period_year'] = period_dict['date'].year
        period_dict['period_month'] = period_dict['date'].month
        period_dict['period_order'] = 1  # Default value
        period_dict['is_active'] = True  # Default value
        period_dict['created_at'] = period_dict['date']
        period_dict['updated_at'] = period_dict['date']
        period_dict['user_id'] = current_user.get('id')
        response_periods.append(PeriodResponse(**period_dict))
    
    return response_periods


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
    
    # Prepare response with legacy fields
    period_dict = period.to_dict()
    period_dict['period_id'] = period_dict['id']
    period_dict['period_name'] = period_dict['ru_name']
    period_dict['period_year'] = period_dict['date'].year
    period_dict['period_month'] = period_dict['date'].month
    period_dict['period_order'] = 1
    period_dict['is_active'] = True
    period_dict['created_at'] = period_dict['date']
    period_dict['updated_at'] = period_dict['date']
    period_dict['user_id'] = current_user.get('id')
    
    return PeriodResponse(**period_dict)


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
    
    # Prepare response with legacy fields
    period_dict = period.to_dict()
    period_dict['period_id'] = period_dict['id']
    period_dict['period_name'] = period_dict['ru_name']
    period_dict['period_year'] = period_dict['date'].year
    period_dict['period_month'] = period_dict['date'].month
    period_dict['period_order'] = 1
    period_dict['is_active'] = True
    period_dict['created_at'] = period_dict['date']
    period_dict['updated_at'] = period_dict['date']
    period_dict['user_id'] = current_user.get('id')
    
    return PeriodResponse(**period_dict)


@router.post("/", response_model=PeriodResponse)
async def create_period(
    period_data: PeriodCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Create new period."""
    # Handle legacy format conversion
    if period_data.period_year and period_data.period_month:
        # Convert legacy format to modern format
        date = datetime(period_data.period_year, period_data.period_month, 1)
        ru_name = period_data.period_name or f"{period_data.period_year}.{str(period_data.period_month).zfill(2)}"
    else:
        # Use modern format directly
        date = period_data.date
        ru_name = period_data.ru_name
    
    if not date or not ru_name:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing required fields: date and ru_name, or period_year and period_month"
        )
    
    period = Period(
        date=date,
        ru_name=ru_name,
        start_date=period_data.start_date,
        end_date=period_data.end_date
    )
    
    db.add(period)
    await db.commit()
    await db.refresh(period)
    
    # Prepare response with legacy fields
    period_dict = period.to_dict()
    period_dict['period_id'] = period_dict['id']
    period_dict['period_name'] = period_dict['ru_name']
    period_dict['period_year'] = period_dict['date'].year
    period_dict['period_month'] = period_dict['date'].month
    period_dict['period_order'] = period_data.period_order or 1
    period_dict['is_active'] = period_data.is_active if period_data.is_active is not None else True
    period_dict['created_at'] = period_dict['date']
    period_dict['updated_at'] = period_dict['date']
    period_dict['user_id'] = current_user.get('id')
    
    return PeriodResponse(**period_dict)


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
    
    # Prepare response with legacy fields
    period_dict = period.to_dict()
    period_dict['period_id'] = period_dict['id']
    period_dict['period_name'] = period_dict['ru_name']
    period_dict['period_year'] = period_dict['date'].year
    period_dict['period_month'] = period_dict['date'].month
    period_dict['period_order'] = 1
    period_dict['is_active'] = True
    period_dict['created_at'] = period_dict['date']
    period_dict['updated_at'] = period_dict['date']
    period_dict['user_id'] = current_user.get('id')
    
    return PeriodResponse(**period_dict)


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