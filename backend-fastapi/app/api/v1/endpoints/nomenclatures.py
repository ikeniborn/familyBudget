"""
Nomenclature management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.models.nomenclature import Nomenclature, NomenclatureType
from app.schemas.nomenclature import (
    NomenclatureCreate,
    NomenclatureUpdate,
    NomenclaturePublic
)
from app.api.deps import get_current_user
from app.core.response import (
    success_response,
    error_response,
    error_not_found,
    error_bad_request,
    error_conflict
)

router = APIRouter()


@router.get("/", response_model=List[NomenclaturePublic])
async def get_nomenclatures(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    is_budget: Optional[bool] = None,
    is_fact: Optional[bool] = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all nomenclatures for current user with optional filtering."""
    # Filter by user_id for data isolation
    stmt = (
        select(Nomenclature)
        .where(Nomenclature.user_id == current_user.get('user_id'))
        .offset(skip)
        .limit(limit)
        .order_by(Nomenclature.name.asc())
    )
    
    if is_budget is not None:
        stmt = stmt.where(Nomenclature.is_budget == is_budget)
    
    if is_fact is not None:
        stmt = stmt.where(Nomenclature.is_fact == is_fact)
    
    result = await db.execute(stmt)
    nomenclatures = result.scalars().all()
    
    nomenclatures_data = [NomenclaturePublic.model_validate(nomenclature).dict() for nomenclature in nomenclatures]
    return success_response(data=nomenclatures_data, total=len(nomenclatures_data))


@router.get("/{nomenclature_id}", response_model=NomenclaturePublic)
async def get_nomenclature(
    nomenclature_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get nomenclature by ID for current user."""
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        Nomenclature.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()

    if not nomenclature:
        return error_not_found("Nomenclature not found or access denied")

    return success_response(data=NomenclaturePublic.model_validate(nomenclature).dict())


@router.post("/", response_model=NomenclaturePublic)
async def create_nomenclature(
    nomenclature_data: NomenclatureCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new nomenclature for current user."""
    # Auto-assign user_id from current_user for data isolation
    user_id = current_user.get('user_id')
    
    # Check if nomenclature with same name already exists for this user
    stmt = select(Nomenclature).where(
        Nomenclature.name == nomenclature_data.name,
        Nomenclature.user_id == user_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()
    
    if existing:
        return error_bad_request(f"Номенклатура с названием '{nomenclature_data.name}' уже существует")
    
    try:
        nomenclature = Nomenclature(
            name=nomenclature_data.name,
            account_name=nomenclature_data.account_name,
            bill_name=nomenclature_data.bill_name,
            operation=nomenclature_data.operation,
            is_budget=nomenclature_data.is_budget,
            is_fact=nomenclature_data.is_fact,
            is_active=nomenclature_data.is_active,
            user_id=user_id  # Auto-assign from current_user
        )
        db.add(nomenclature)
        await db.commit()
        await db.refresh(nomenclature)
        
        return success_response(data=NomenclaturePublic.model_validate(nomenclature).dict(), status_code=201)
    except IntegrityError:
        await db.rollback()
        return error_bad_request(f"Номенклатура с названием '{nomenclature_data.name}' уже существует")


@router.put("/{nomenclature_id}", response_model=NomenclaturePublic)
async def update_nomenclature(
    nomenclature_id: int,
    nomenclature_data: NomenclatureUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update nomenclature for current user."""
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        Nomenclature.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()

    if not nomenclature:
        return error_not_found("Nomenclature not found or access denied")
    
    # Update only provided fields (excluding user_id to prevent unauthorized changes)
    update_data = nomenclature_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)
    
    for field, value in update_data.items():
        if field == 'name' and value:
            # Check for name uniqueness
            stmt = select(Nomenclature).where(
                Nomenclature.name == value,
                Nomenclature.user_id == nomenclature.user_id,
                Nomenclature.id != nomenclature_id
            )
            result = await db.execute(stmt)
            existing = result.scalar_one_or_none()
            
            if existing:
                return error_bad_request(f"Номенклатура с названием '{value}' уже существует")
        
        setattr(nomenclature, field, value)
    
    try:
        await db.commit()
        await db.refresh(nomenclature)
        
        return success_response(data=NomenclaturePublic.model_validate(nomenclature).dict())
    except IntegrityError:
        await db.rollback()
        return error_bad_request("Номенклатура с таким названием уже существует")


@router.delete("/{nomenclature_id}")
async def delete_nomenclature(
    nomenclature_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete nomenclature for current user."""
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        Nomenclature.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()

    if not nomenclature:
        return error_not_found("Nomenclature not found or access denied")

    await db.delete(nomenclature)
    await db.commit()

    return success_response(data={"message": "Nomenclature deleted successfully"})


@router.post("/bulk-delete")
async def bulk_delete_nomenclatures(
    ids: List[int] = Body(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple nomenclatures for current user."""
    stmt = select(Nomenclature).where(
        Nomenclature.id.in_(ids),
        Nomenclature.user_id == current_user.get('user_id')
    )
    result = await db.execute(stmt)
    nomenclatures = result.scalars().all()
    
    if not nomenclatures:
        return error_not_found("No nomenclatures found or access denied")

    for nomenclature in nomenclatures:
        await db.delete(nomenclature)

    await db.commit()

    return success_response(data={"message": f"Deleted {len(nomenclatures)} nomenclatures"})