"""
Registry (transactions) management endpoints.
"""
from typing import List, Optional, Union
from datetime import datetime, date
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel, Field, validator

from app.db.database import get_db
from app.models.registry import Registry
from app.core.session import get_current_user_from_session
from app.core.config import settings

router = APIRouter()


class RegistryCreate(BaseModel):
    """Registry creation schema."""
    operation_dttm: Union[str, datetime, date]
    period_id: int
    financial_center_id: int
    cost_center_id: Optional[int] = None
    nomenclature_id: int
    row_type_id: int
    cost_sum: Decimal
    comment_description: Optional[str] = None
    
    @validator('operation_dttm', pre=True)
    def parse_operation_date(cls, value):
        """Convert string date to datetime."""
        if isinstance(value, str):
            # Try parsing date string in format YYYY-MM-DD
            try:
                return datetime.strptime(value, '%Y-%m-%d')
            except ValueError:
                # Try ISO format
                return datetime.fromisoformat(value)
        elif isinstance(value, date) and not isinstance(value, datetime):
            # Convert date to datetime
            return datetime.combine(value, datetime.min.time())
        return value


class RegistryUpdate(BaseModel):
    """Registry update schema."""
    operation_dttm: Optional[Union[str, datetime, date]] = None
    period_id: Optional[int] = None
    financial_center_id: Optional[int] = None
    cost_center_id: Optional[int] = None
    nomenclature_id: Optional[int] = None
    row_type_id: Optional[int] = None
    cost_sum: Optional[Decimal] = None
    comment_description: Optional[str] = None
    
    @validator('operation_dttm', pre=True)
    def parse_operation_date(cls, value):
        """Convert string date to datetime."""
        if value is None:
            return value
        if isinstance(value, str):
            # Try parsing date string in format YYYY-MM-DD
            try:
                return datetime.strptime(value, '%Y-%m-%d')
            except ValueError:
                # Try ISO format
                return datetime.fromisoformat(value)
        elif isinstance(value, date) and not isinstance(value, datetime):
            # Convert date to datetime
            return datetime.combine(value, datetime.min.time())
        return value


class RegistryResponse(BaseModel):
    """Registry response schema."""
    id: int
    operation_date: datetime
    user_id: int
    period_id: int
    financial_center_id: int
    cost_center_id: Optional[int]
    nomenclature_id: int
    row_type_id: int
    cost_sum: Decimal
    comment: Optional[str]


class BulkRegistryCreate(BaseModel):
    """Bulk registry creation schema."""
    entries: List[RegistryCreate]


async def require_auth(request: Request) -> dict:
    """Require authentication."""
    user = await get_current_user_from_session(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return user


@router.get("/", response_model=List[RegistryResponse])
async def get_registry_entries(
    request: Request,
    skip: int = 0,
    limit: int = Query(default=50, le=settings.MAX_PAGE_SIZE),
    period_id: Optional[int] = None,
    nomenclature_id: Optional[int] = None,
    row_type_id: Optional[int] = None,
    financial_center_id: Optional[int] = None,
    cost_center_id: Optional[int] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get registry entries for current user with filtering."""
    stmt = select(Registry).where(Registry.user_id == current_user["user_id"])
    
    # Apply filters
    if period_id:
        stmt = stmt.where(Registry.period_id == period_id)
    
    if nomenclature_id:
        stmt = stmt.where(Registry.nomenclature_id == nomenclature_id)
    
    if row_type_id:
        stmt = stmt.where(Registry.row_type_id == row_type_id)
    
    if financial_center_id:
        stmt = stmt.where(Registry.financial_center_id == financial_center_id)
    
    if cost_center_id:
        stmt = stmt.where(Registry.cost_center_id == cost_center_id)
    
    if date_from:
        stmt = stmt.where(Registry.operation_date >= date_from)
    
    if date_to:
        stmt = stmt.where(Registry.operation_date <= date_to)
    
    stmt = stmt.offset(skip).limit(limit).order_by(Registry.operation_date.desc())
    result = await db.execute(stmt)
    entries = result.scalars().all()
    
    return [RegistryResponse(**entry.to_dict()) for entry in entries]


@router.get("/{entry_id}", response_model=RegistryResponse)
async def get_registry_entry(
    entry_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get registry entry by ID (user filtered)."""
    stmt = select(Registry).where(
        and_(
            Registry.id == entry_id,
            Registry.user_id == current_user["user_id"]
        )
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registry entry not found"
        )
    
    return RegistryResponse(**entry.to_dict())


@router.post("/", response_model=RegistryResponse)
async def create_registry_entry(
    entry_data: RegistryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Create new registry entry."""
    import logging
    logger = logging.getLogger(__name__)
    
    try:
        logger.info(f"Received registry data: {entry_data.dict()}")
        
        entry_dict = entry_data.dict()
        entry_dict["user_id"] = current_user["user_id"]
        
        # Map frontend field names to database column names
        entry_dict["operation_date"] = entry_dict.pop("operation_dttm")
        entry_dict["comment"] = entry_dict.pop("comment_description", None)
        
        # Remove None values for optional fields
        if entry_dict.get("cost_center_id") is None:
            entry_dict.pop("cost_center_id", None)
        
        logger.info(f"Mapped data for DB: {entry_dict}")
        
        entry = Registry(**entry_dict)
        db.add(entry)
        await db.commit()
        await db.refresh(entry)
        
        return RegistryResponse(**entry.to_dict())
    except Exception as e:
        logger.error(f"Error creating registry entry: {e}")
        logger.error(f"Entry data was: {entry_data.dict()}")
        raise


@router.post("/bulk", response_model=List[RegistryResponse])
async def create_bulk_registry_entries(
    bulk_data: BulkRegistryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Create multiple registry entries at once."""
    entries = []
    
    for entry_data in bulk_data.entries:
        entry_dict = entry_data.dict()
        entry_dict["user_id"] = current_user["user_id"]
        
        # Map frontend field names to database column names
        entry_dict["operation_date"] = entry_dict.pop("operation_dttm")
        entry_dict["comment"] = entry_dict.pop("comment_description", None)
        
        # Remove None values for optional fields
        if entry_dict.get("cost_center_id") is None:
            entry_dict.pop("cost_center_id", None)
        
        entry = Registry(**entry_dict)
        db.add(entry)
        entries.append(entry)
    
    await db.commit()
    
    # Refresh all entries to get IDs
    for entry in entries:
        await db.refresh(entry)
    
    return [RegistryResponse(**entry.to_dict()) for entry in entries]


@router.put("/{entry_id}", response_model=RegistryResponse)
async def update_registry_entry(
    entry_id: int,
    entry_data: RegistryUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Update registry entry (user filtered)."""
    stmt = select(Registry).where(
        and_(
            Registry.id == entry_id,
            Registry.user_id == current_user["user_id"]
        )
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registry entry not found"
        )
    
    # Update entry fields
    update_data = entry_data.dict(exclude_unset=True)
    
    # Map frontend field names to database column names
    if "operation_dttm" in update_data:
        update_data["operation_date"] = update_data.pop("operation_dttm")
    if "comment_description" in update_data:
        update_data["comment"] = update_data.pop("comment_description")
    
    for field, value in update_data.items():
        setattr(entry, field, value)
    
    await db.commit()
    await db.refresh(entry)
    
    return RegistryResponse(**entry.to_dict())


@router.delete("/{entry_id}")
async def delete_registry_entry(
    entry_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete registry entry (user filtered)."""
    stmt = select(Registry).where(
        and_(
            Registry.id == entry_id,
            Registry.user_id == current_user["user_id"]
        )
    )
    result = await db.execute(stmt)
    entry = result.scalar_one_or_none()
    
    if not entry:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registry entry not found"
        )
    
    await db.delete(entry)
    await db.commit()
    
    return {"message": "Registry entry deleted successfully"}


@router.get("/summary/by-period")
async def get_registry_summary_by_period(
    request: Request,
    period_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get registry summary grouped by period."""
    stmt = select(
        Registry.period_id,
        Registry.row_type_id,
        func.sum(Registry.cost_sum).label("total_sum"),
        func.count(Registry.id).label("count")
    ).where(Registry.user_id == current_user["user_id"])
    
    if period_id:
        stmt = stmt.where(Registry.period_id == period_id)
    
    stmt = stmt.group_by(Registry.period_id, Registry.row_type_id)
    
    result = await db.execute(stmt)
    summary = result.all()
    
    return [
        {
            "period_id": row.period_id,
            "row_type_id": row.row_type_id,
            "total_sum": float(row.total_sum),
            "count": row.count
        }
        for row in summary
    ]


@router.get("/summary/by-nomenclature")
async def get_registry_summary_by_nomenclature(
    request: Request,
    period_id: Optional[int] = None,
    row_type_id: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get registry summary grouped by nomenclature."""
    stmt = select(
        Registry.nomenclature_id,
        Registry.row_type_id,
        func.sum(Registry.cost_sum).label("total_sum"),
        func.count(Registry.id).label("count")
    ).where(Registry.user_id == current_user["user_id"])
    
    if period_id:
        stmt = stmt.where(Registry.period_id == period_id)
    
    if row_type_id:
        stmt = stmt.where(Registry.row_type_id == row_type_id)
    
    stmt = stmt.group_by(Registry.nomenclature_id, Registry.row_type_id)
    
    result = await db.execute(stmt)
    summary = result.all()
    
    return [
        {
            "nomenclature_id": row.nomenclature_id,
            "row_type_id": row.row_type_id,
            "total_sum": float(row.total_sum),
            "count": row.count
        }
        for row in summary
    ]