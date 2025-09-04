"""
Nomenclature management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel, Field

from app.db.database import get_db
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.core.session import get_current_user_from_session

router = APIRouter()


class NomenclatureCreate(BaseModel):
    """Nomenclature creation schema."""
    nomenclature_name: str = Field(..., min_length=1, max_length=255)
    nomenclature_type: Optional[NomenclatureType] = Field(default=NomenclatureType.EXPENSE)
    account_name: str
    bill_name: str
    operation_name: str
    is_budget: bool = True
    is_fact: bool = True
    is_active: Optional[bool] = Field(default=True)
    user_id: int
    parent_id: Optional[int] = None


class NomenclatureUpdate(BaseModel):
    """Nomenclature update schema."""
    nomenclature_name: Optional[str] = Field(None, min_length=1, max_length=255)
    nomenclature_type: Optional[NomenclatureType] = None
    account_name: Optional[str] = None
    bill_name: Optional[str] = None
    operation_name: Optional[str] = None
    is_budget: Optional[bool] = None
    is_fact: Optional[bool] = None
    is_active: Optional[bool] = None
    parent_id: Optional[int] = None


class NomenclatureResponse(BaseModel):
    """Nomenclature response schema."""
    nomenclature_id: int
    nomenclature_name: str
    nomenclature_type: Optional[str] = None
    account_name: str
    bill_name: str
    operation_name: str
    is_budget: bool
    is_fact: bool
    is_active: bool
    user_id: int
    parent_id: Optional[int] = None
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


@router.get("/", response_model=List[NomenclatureResponse])
async def get_nomenclatures(
    request: Request,
    user_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    is_budget: Optional[bool] = None,
    is_fact: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Get all nomenclatures with optional filtering."""
    # Always filter by current user's ID for data isolation
    effective_user_id = user_id if user_id else current_user['user_id']
    stmt = select(Nomenclature).where(
        Nomenclature.user_id == effective_user_id
    ).order_by(Nomenclature.name)
    
    if is_budget is not None:
        stmt = stmt.where(Nomenclature.is_budget == is_budget)
    
    if is_fact is not None:
        stmt = stmt.where(Nomenclature.is_fact == is_fact)
    
    stmt = stmt.offset(skip).limit(limit)
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
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        Nomenclature.user_id == current_user['user_id']
    )
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
    # Check if nomenclature with same name already exists for this user
    stmt = select(Nomenclature).where(
        Nomenclature.name == nomenclature_data.nomenclature_name,
        Nomenclature.user_id == nomenclature_data.user_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Номенклатура с названием '{nomenclature_data.nomenclature_name}' уже существует"
        )
    
    try:
        nomenclature = Nomenclature(
            name=nomenclature_data.nomenclature_name,
            nomenclature_type=nomenclature_data.nomenclature_type,
            account_name=nomenclature_data.account_name,
            bill_name=nomenclature_data.bill_name,
            operation=nomenclature_data.operation_name,
            is_budget=nomenclature_data.is_budget,
            is_fact=nomenclature_data.is_fact,
            is_active=nomenclature_data.is_active if nomenclature_data.is_active is not None else True,
            user_id=nomenclature_data.user_id,
            parent_id=nomenclature_data.parent_id
        )
        db.add(nomenclature)
        await db.commit()
        await db.refresh(nomenclature)
        
        return NomenclatureResponse(**nomenclature.to_dict())
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Номенклатура с названием '{nomenclature_data.nomenclature_name}' уже существует"
        )


@router.put("/{nomenclature_id}", response_model=NomenclatureResponse)
async def update_nomenclature(
    nomenclature_id: int,
    nomenclature_data: NomenclatureUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Update nomenclature."""
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        Nomenclature.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()
    
    if not nomenclature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nomenclature not found"
        )
    
    # Update only provided fields
    update_data = nomenclature_data.dict(exclude_unset=True)
    
    # Check for name uniqueness if name is being updated
    if 'nomenclature_name' in update_data:
        stmt = select(Nomenclature).where(
            Nomenclature.name == update_data['nomenclature_name'],
            Nomenclature.user_id == nomenclature.user_id,
            Nomenclature.id != nomenclature_id
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()
        
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Номенклатура с названием '{update_data['nomenclature_name']}' уже существует"
            )
        
        nomenclature.name = update_data['nomenclature_name']
    
    # Update other fields
    field_mapping = {
        'nomenclature_type': 'nomenclature_type',
        'account_name': 'account_name',
        'bill_name': 'bill_name',
        'operation_name': 'operation',
        'is_budget': 'is_budget',
        'is_fact': 'is_fact',
        'is_active': 'is_active',
        'parent_id': 'parent_id'
    }
    
    for api_field, db_field in field_mapping.items():
        if api_field in update_data:
            setattr(nomenclature, db_field, update_data[api_field])
    
    try:
        await db.commit()
        await db.refresh(nomenclature)
        
        return NomenclatureResponse(**nomenclature.to_dict())
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Номенклатура с таким названием уже существует"
        )


@router.delete("/{nomenclature_id}")
async def delete_nomenclature(
    nomenclature_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete nomenclature."""
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        Nomenclature.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()
    
    if not nomenclature:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Nomenclature not found"
        )
    
    await db.delete(nomenclature)
    await db.commit()
    
    return {"success": True, "message": "Nomenclature deleted successfully"}


@router.post("/bulk-delete")
async def bulk_delete_nomenclatures(
    ids: List[int] = Body(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_auth)
):
    """Delete multiple nomenclatures."""
    stmt = select(Nomenclature).where(
        Nomenclature.id.in_(ids),
        Nomenclature.user_id == current_user['user_id']
    )
    result = await db.execute(stmt)
    nomenclatures = result.scalars().all()
    
    if not nomenclatures:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No nomenclatures found"
        )
    
    for nomenclature in nomenclatures:
        await db.delete(nomenclature)
    
    await db.commit()
    
    return {"success": True, "message": f"Deleted {len(nomenclatures)} nomenclatures"}