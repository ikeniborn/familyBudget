"""
Period management endpoints.
"""
from typing import List, Optional, Union
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
    """Get all periods for current user."""
    # Filter by user_id for data isolation
    stmt = (
        select(Period)
        .where(Period.user_id == current_user.get('user_id'))
        .offset(skip)
        .limit(limit)
        .order_by(Period.date.asc())
    )
    result = await db.execute(stmt)
    periods = result.scalars().all()
    
    response_periods = []
    for period in periods:
        # Use the actual datetime object from the database
        period_dict = {
            'id': period.id,
            'date': period.date,
            'ru_name': period.ru_name,
            'start_date': period.start_date,
            'end_date': period.end_date,
            # Add legacy fields
            'period_id': period.id,
            'period_name': period.ru_name,
            'period_year': period.date.year if period.date else None,
            'period_month': period.date.month if period.date else None,
            'period_order': 1,  # Default value
            'is_active': True,  # Default value
            'created_at': period.date,
            'updated_at': period.date,
            'user_id': period.user_id  # Use actual user_id from database
        }
        response_periods.append(PeriodResponse(**period_dict))
    
    return response_periods


@router.get("/current", response_model=PeriodResponse)
async def get_current_period(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get current period based on today's date for current user."""
    # Get period closest to current date, filtered by user_id
    stmt = (
        select(Period)
        .where(Period.user_id == current_user.get('user_id'))
        .order_by(func.abs(func.extract('epoch', Period.date - func.now())))
        .limit(1)
    )
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No periods found for current user"
        )
    
    # Prepare response with legacy fields
    period_dict = {
        'id': period.id,
        'date': period.date,
        'ru_name': period.ru_name,
        'start_date': period.start_date,
        'end_date': period.end_date,
        'period_id': period.id,
        'period_name': period.ru_name,
        'period_year': period.date.year if period.date else None,
        'period_month': period.date.month if period.date else None,
        'period_order': 1,
        'is_active': True,
        'created_at': period.date,
        'updated_at': period.date,
        'user_id': period.user_id  # Use actual user_id from database
    }
    
    return PeriodResponse(**period_dict)


@router.get("/{period_id}", response_model=PeriodResponse)
async def get_period(
    period_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get period by ID for current user."""
    # Filter by both period_id and user_id for data isolation
    stmt = select(Period).where(
        Period.id == period_id,
        Period.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Period not found or access denied"
        )
    
    # Prepare response with legacy fields
    period_dict = {
        'id': period.id,
        'date': period.date,
        'ru_name': period.ru_name,
        'start_date': period.start_date,
        'end_date': period.end_date,
        'period_id': period.id,
        'period_name': period.ru_name,
        'period_year': period.date.year if period.date else None,
        'period_month': period.date.month if period.date else None,
        'period_order': 1,
        'is_active': True,
        'created_at': period.date,
        'updated_at': period.date,
        'user_id': period.user_id  # Use actual user_id from database
    }
    
    return PeriodResponse(**period_dict)


@router.post("/", response_model=PeriodResponse)
async def create_period(
    period_data: PeriodCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Create new period for current user."""
    # Handle legacy format conversion
    date: Optional[datetime] = None
    ru_name: Optional[str] = None
    
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
    
    # Check for existing period with same date for current user (user-specific uniqueness)
    stmt = select(Period).where(
        Period.date == date,
        Period.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    existing_period = result.scalar_one_or_none()
    
    if existing_period:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Период на дату {date.strftime('%Y-%m-%d')} уже существует"
        )
    
    # Create period with automatic user_id assignment
    period = Period(
        date=date,
        ru_name=ru_name,
        start_date=period_data.start_date,
        end_date=period_data.end_date,
        user_id=current_user.get('user_id')  # Automatically assign current user
    )
    
    db.add(period)
    await db.commit()
    await db.refresh(period)
    
    # Prepare response with legacy fields
    period_dict = {
        'id': period.id,
        'date': period.date,
        'ru_name': period.ru_name,
        'start_date': period.start_date,
        'end_date': period.end_date,
        'period_id': period.id,
        'period_name': period.ru_name,
        'period_year': period.date.year if period.date else None,
        'period_month': period.date.month if period.date else None,
        'period_order': period_data.period_order or 1,
        'is_active': period_data.is_active if period_data.is_active is not None else True,
        'created_at': period.date,
        'updated_at': period.date,
        'user_id': period.user_id  # Use actual user_id from database
    }
    
    return PeriodResponse(**period_dict)


@router.put("/{period_id}", response_model=PeriodResponse)
async def update_period(
    period_id: int,
    period_data: PeriodUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Update period for current user."""
    # Filter by both period_id and user_id for data isolation
    stmt = select(Period).where(
        Period.id == period_id,
        Period.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Period not found or access denied"
        )
    
    # Update period fields (excluding user_id to prevent unauthorized changes)
    update_data = period_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)
    
    for field, value in update_data.items():
        setattr(period, field, value)
    
    await db.commit()
    await db.refresh(period)
    
    # Prepare response with legacy fields
    period_dict = {
        'id': period.id,
        'date': period.date,
        'ru_name': period.ru_name,
        'start_date': period.start_date,
        'end_date': period.end_date,
        'period_id': period.id,
        'period_name': period.ru_name,
        'period_year': period.date.year if period.date else None,
        'period_month': period.date.month if period.date else None,
        'period_order': 1,
        'is_active': True,
        'created_at': period.date,
        'updated_at': period.date,
        'user_id': period.user_id  # Use actual user_id from database
    }
    
    return PeriodResponse(**period_dict)


@router.delete("/{period_id}")
async def delete_period(
    period_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete period for current user."""
    # Filter by both period_id and user_id for data isolation
    stmt = select(Period).where(
        Period.id == period_id,
        Period.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()
    
    if not period:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Period not found or access denied"
        )
    
    await db.delete(period)
    await db.commit()
    
    return {"message": "Period deleted successfully"}