"""
Nomenclature management endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.database import get_db
from app.models.nomenclature import Nomenclature
from app.core.session import get_current_user_from_session

router = APIRouter()


class NomenclatureCreate(BaseModel):
    """Nomenclature creation schema."""
    name: str
    account_name: str
    bill_name: str
    operation: str
    is_budget: bool = True
    is_fact: bool = True


class NomenclatureUpdate(BaseModel):
    """Nomenclature update schema."""
    name: Optional[str] = None
    account_name: Optional[str] = None
    bill_name: Optional[str] = None
    operation: Optional[str] = None
    is_budget: Optional[bool] = None
    is_fact: Optional[bool] = None


class NomenclatureResponse(BaseModel):
    """Nomenclature response schema."""
    id: int
    name: str
    account_name: str
    bill_name: str
    operation: str
    is_budget: bool
    is_fact: bool


async def require_auth(request: Request) -> dict:
    """Require authentication."""
    user = await get_current_user_from_session(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return user


@router.get("/", response_model=List[NomenclatureResponse])
async def get_nomenclatures(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    is_budget: Optional[bool] = None,
    is_fact: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get all nomenclatures with optional filtering."""
    stmt = select(Nomenclature)
    
    if is_budget is not None:
        stmt = stmt.where(Nomenclature.is_budget == is_budget)
    
    if is_fact is not None:
        stmt = stmt.where(Nomenclature.is_fact == is_fact)
    
    stmt = stmt.offset(skip).limit(limit).order_by(Nomenclature.name)
    result = await db.execute(stmt)
    nomenclatures = result.scalars().all()
    
    return [NomenclatureResponse(**nomenclature.to_dict()) for nomenclature in nomenclatures]


@router.get("/{nomenclature_id}", response_model=NomenclatureResponse)
async def get_nomenclature(
    nomenclature_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get nomenclature by ID."""
    stmt = select(Nomenclature).where(Nomenclature.id == nomenclature_id)
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()
    
    if not nomenclature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nomenclature not found"
        )
    
    return NomenclatureResponse(**nomenclature.to_dict())


@router.post("/", response_model=NomenclatureResponse)
async def create_nomenclature(
    nomenclature_data: NomenclatureCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Create new nomenclature."""
    nomenclature = Nomenclature(**nomenclature_data.dict())
    db.add(nomenclature)
    await db.commit()
    await db.refresh(nomenclature)
    
    return NomenclatureResponse(**nomenclature.to_dict())


@router.put("/{nomenclature_id}", response_model=NomenclatureResponse)
async def update_nomenclature(
    nomenclature_id: int,
    nomenclature_data: NomenclatureUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Update nomenclature."""
    stmt = select(Nomenclature).where(Nomenclature.id == nomenclature_id)
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()
    
    if not nomenclature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nomenclature not found"
        )
    
    # Update nomenclature fields
    update_data = nomenclature_data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(nomenclature, field, value)
    
    await db.commit()
    await db.refresh(nomenclature)
    
    return NomenclatureResponse(**nomenclature.to_dict())


@router.delete("/{nomenclature_id}")
async def delete_nomenclature(
    nomenclature_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete nomenclature."""
    stmt = select(Nomenclature).where(Nomenclature.id == nomenclature_id)
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()
    
    if not nomenclature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nomenclature not found"
        )
    
    await db.delete(nomenclature)
    await db.commit()
    
    return {"message": "Nomenclature deleted successfully"}