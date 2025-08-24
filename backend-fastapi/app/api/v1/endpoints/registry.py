"""
Registry (transactions) management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from decimal import Decimal
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from pydantic import BaseModel

from app.db.database import get_db
from app.models.registry import Registry
from app.core.session import get_current_user_from_session
from app.core.config import settings

router = APIRouter()


class RegistryCreate(BaseModel):
    """Registry creation schema."""
    operation_date: datetime
    period_id: int
    financial_center_id: int
    cost_center_id: int
    nomenclature_id: int
    row_type_id: int
    cost_sum: Decimal
    comment: Optional[str] = None


class RegistryUpdate(BaseModel):
    """Registry update schema."""
    operation_date: Optional[datetime] = None
    period_id: Optional[int] = None
    financial_center_id: Optional[int] = None
    cost_center_id: Optional[int] = None
    nomenclature_id: Optional[int] = None
    row_type_id: Optional[int] = None
    cost_sum: Optional[Decimal] = None
    comment: Optional[str] = None


class RegistryResponse(BaseModel):
    """Registry response schema."""
    id: int
    operation_date: datetime
    user_id: int
    period_id: int
    financial_center_id: int
    cost_center_id: int
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
    entry_dict = entry_data.dict()
    entry_dict["user_id"] = current_user["user_id"]
    
    entry = Registry(**entry_dict)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    
    return RegistryResponse(**entry.to_dict())


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