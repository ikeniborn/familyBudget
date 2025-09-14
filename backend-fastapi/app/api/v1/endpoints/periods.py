"""
Period management endpoints.
"""
from typing import List, Optional, Union
from datetime import datetime
import logging
from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel

from app.db.database import get_db
from app.models.period import Period
from app.api.deps import get_current_user
from app.core.response import (
    success_response,
    error_response,
    error_not_found,
    error_conflict,
    error_unprocessable_entity
)
from app.core.timezone import prepare_datetime_for_db, prepare_datetime_fields_for_db

logger = logging.getLogger(__name__)
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
    is_active: Optional[bool] = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    user_id: Optional[int] = None


@router.get("/", response_model=List[PeriodResponse])
async def get_periods(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
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
            'is_active': True,  # Default value
            'created_at': period.date,
            'updated_at': period.date,
            'user_id': period.user_id  # Use actual user_id from database
        }
        # Convert PeriodResponse to dict for JSON serialization with proper datetime handling
        response_periods.append(PeriodResponse(**period_dict).dict())

    return success_response(data=response_periods, total=len(response_periods))


@router.get("/current", response_model=PeriodResponse)
async def get_current_period(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
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
        return error_not_found("No periods found for current user")

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
        'is_active': True,
        'created_at': period.date,
        'updated_at': period.date,
        'user_id': period.user_id  # Use actual user_id from database
    }

    return success_response(data=PeriodResponse(**period_dict).dict())


@router.get("/{period_id}", response_model=PeriodResponse)
async def get_period(
    period_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
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
        return error_not_found("Period not found or access denied")

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
        'is_active': True,
        'created_at': period.date,
        'updated_at': period.date,
        'user_id': period.user_id  # Use actual user_id from database
    }

    return success_response(data=PeriodResponse(**period_dict).dict())


@router.post("/", response_model=PeriodResponse)
async def create_period(
    period_data: PeriodCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
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
        return error_unprocessable_entity("Missing required fields: date and ru_name, or period_year and period_month")

    # Prepare datetime fields for database storage (strip timezone info)
    try:
        db_safe_date = prepare_datetime_for_db(date)
        db_safe_start_date = prepare_datetime_for_db(period_data.start_date)
        db_safe_end_date = prepare_datetime_for_db(period_data.end_date)
    except (ValueError, TypeError) as e:
        logger.error(f"Failed to prepare datetime fields for database: {e}")
        return error_unprocessable_entity(f"Invalid datetime format: {str(e)}")

    # Check for existing period with same date for current user (user-specific uniqueness)
    stmt = select(Period).where(
        Period.date == db_safe_date,
        Period.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    existing_period = result.scalar_one_or_none()

    if existing_period:
        return error_conflict(f"Период на дату {db_safe_date.strftime('%Y-%m-%d')} уже существует")

    # Create period with automatic user_id assignment
    period = Period(
        date=db_safe_date,
        ru_name=ru_name,
        start_date=db_safe_start_date,
        end_date=db_safe_end_date,
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
        'is_active': period_data.is_active if period_data.is_active is not None else True,
        'created_at': period.date,
        'updated_at': period.date,
        'user_id': period.user_id  # Use actual user_id from database
    }

    return success_response(data=PeriodResponse(**period_dict).dict(), status_code=201)


@router.put("/{period_id}", response_model=PeriodResponse)
async def update_period(
    period_id: int,
    period_data: PeriodUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
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
        return error_not_found("Period not found or access denied")

    # Update period fields (excluding user_id to prevent unauthorized changes)
    update_data = period_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)

    # Prepare datetime fields for database storage (strip timezone info)
    try:
        if 'date' in update_data:
            update_data['date'] = prepare_datetime_for_db(update_data['date'])
        if 'start_date' in update_data:
            update_data['start_date'] = prepare_datetime_for_db(update_data['start_date'])
        if 'end_date' in update_data:
            update_data['end_date'] = prepare_datetime_for_db(update_data['end_date'])
    except (ValueError, TypeError) as e:
        logger.error(f"Failed to prepare datetime fields for database update: {e}")
        return error_unprocessable_entity(f"Invalid datetime format: {str(e)}")

    # Check for conflicts if date is being updated
    if 'date' in update_data:
        # Check for existing period with same date for current user (excluding current period)
        conflict_stmt = select(Period).where(
            Period.date == update_data['date'],
            Period.user_id == current_user.get('user_id'),
            Period.id != period_id
        )
        conflict_result = await db.execute(conflict_stmt)
        existing_period = conflict_result.scalar_one_or_none()

        if existing_period:
            return error_conflict(f"Период на дату {update_data['date'].strftime('%Y-%m-%d')} уже существует")

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
        'is_active': True,
        'created_at': period.date,
        'updated_at': period.date,
        'user_id': period.user_id  # Use actual user_id from database
    }

    return success_response(data=PeriodResponse(**period_dict).dict())


@router.delete("/{period_id}")
async def delete_period(
    period_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete period for current user."""
    from sqlalchemy.exc import IntegrityError
    from app.models.registry import Registry

    # Filter by both period_id and user_id for data isolation
    stmt = select(Period).where(
        Period.id == period_id,
        Period.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    period = result.scalar_one_or_none()

    if not period:
        return error_not_found("Period not found or access denied")

    # Check for dependent registry entries before attempting deletion
    registry_stmt = select(func.count(Registry.id)).where(
        Registry.period_id == period_id,
        Registry.user_id == current_user.get('user_id')
    )
    registry_result = await db.execute(registry_stmt)
    registry_count = registry_result.scalar()

    if registry_count > 0:
        return error_conflict(
            f"Невозможно удалить период '{period.ru_name}'. "
            f"Существует {registry_count} записей бюджета, связанных с этим периодом. "
            f"Сначала удалите все связанные записи или перенесите их в другой период."
        )

    try:
        await db.delete(period)
        await db.commit()
        return success_response(data={"message": "Period deleted successfully"})
    except IntegrityError as e:
        await db.rollback()
        return error_conflict(
            f"Невозможно удалить период '{period.ru_name}' из-за связанных данных. "
            f"Убедитесь, что все связанные записи были удалены."
        )
    except Exception as e:
        await db.rollback()
        return error_response(f"Ошибка при удалении периода: {str(e)}")