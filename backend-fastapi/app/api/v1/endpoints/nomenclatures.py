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
from app.core.security import require_admin_access
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
    user_id = current_user.get('user_id')

    # Show only user's own nomenclatures
    stmt = (
        select(Nomenclature)
        .where(Nomenclature.user_id == user_id)
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

    nomenclatures_data = []
    for nomenclature in nomenclatures:
        nomenclature_dict = {
            'id': nomenclature.id,
            'code': nomenclature.code,
            'name': nomenclature.name,
            'description': nomenclature.description,
            'nomenclature_type': nomenclature.nomenclature_type,
            'account_name': nomenclature.account_name,
            'bill_name': nomenclature.bill_name,
            'operation': nomenclature.operation,
            'is_budget': nomenclature.is_budget,
            'is_fact': nomenclature.is_fact,
            'is_active': nomenclature.is_active,
            'parent_id': nomenclature.parent_id,
            'article_id': nomenclature.article_id,
            'user_id': nomenclature.user_id,
            'created_by': getattr(nomenclature, 'created_by', None),
            'managed_by': getattr(nomenclature, 'managed_by', None),
            'created_at': getattr(nomenclature, 'created_at', None),
            'updated_at': getattr(nomenclature, 'updated_at', None),
            'is_shared': False,
            'is_editable': True
        }
        nomenclatures_data.append(nomenclature_dict)

    return success_response(data=nomenclatures_data, total=len(nomenclatures_data))


@router.get("/{nomenclature_id}", response_model=NomenclaturePublic)
async def get_nomenclature(
    nomenclature_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get nomenclature by ID for current user."""
    user_id = current_user.get('user_id')

    # Show nomenclature if it belongs to current user
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        Nomenclature.user_id == user_id
    )
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()

    if not nomenclature:
        return error_not_found("Nomenclature not found")

    nomenclature_dict = {
        'id': nomenclature.id,
        'code': nomenclature.code,
        'name': nomenclature.name,
        'description': nomenclature.description,
        'nomenclature_type': nomenclature.nomenclature_type,
        'account_name': nomenclature.account_name,
        'bill_name': nomenclature.bill_name,
        'operation': nomenclature.operation,
        'is_budget': nomenclature.is_budget,
        'is_fact': nomenclature.is_fact,
        'is_active': nomenclature.is_active,
        'parent_id': nomenclature.parent_id,
        'article_id': nomenclature.article_id,
        'user_id': nomenclature.user_id,
        'created_by': getattr(nomenclature, 'created_by', None),
        'managed_by': getattr(nomenclature, 'managed_by', None),
        'created_at': getattr(nomenclature, 'created_at', None),
        'updated_at': getattr(nomenclature, 'updated_at', None),
        'is_shared': False,
        'is_editable': True
    }

    return success_response(data=nomenclature_dict)


@router.post("/", response_model=NomenclaturePublic)
async def create_nomenclature(
    nomenclature_data: NomenclatureCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new nomenclature for current user."""
    user_id = current_user.get('user_id')

    # Check for existing nomenclature with same code for current user
    stmt = select(Nomenclature).where(
        Nomenclature.code == nomenclature_data.code,
        Nomenclature.user_id == user_id
    )
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return error_conflict(f"Nomenclature with code '{nomenclature_data.code}' already exists")

    try:
        nomenclature = Nomenclature(
            code=nomenclature_data.code,
            name=nomenclature_data.name,
            description=nomenclature_data.description,
            nomenclature_type=NomenclatureType(nomenclature_data.nomenclature_type) if nomenclature_data.nomenclature_type else NomenclatureType.EXPENSE,
            account_name=nomenclature_data.account_name,
            bill_name=nomenclature_data.bill_name,
            operation=nomenclature_data.operation,
            is_budget=nomenclature_data.is_budget,
            is_fact=nomenclature_data.is_fact,
            is_active=nomenclature_data.is_active,
            parent_id=nomenclature_data.parent_id,
            article_id=nomenclature_data.article_id,
            user_id=user_id,
            created_by=user_id,
            managed_by=nomenclature_data.managed_by if hasattr(nomenclature_data, 'managed_by') else None
        )
        db.add(nomenclature)
        await db.commit()
        await db.refresh(nomenclature)

        nomenclature_dict = {
            'id': nomenclature.id,
            'code': nomenclature.code,
            'name': nomenclature.name,
            'description': nomenclature.description,
            'nomenclature_type': nomenclature.nomenclature_type,
            'account_name': nomenclature.account_name,
            'bill_name': nomenclature.bill_name,
            'operation': nomenclature.operation,
            'is_budget': nomenclature.is_budget,
            'is_fact': nomenclature.is_fact,
            'is_active': nomenclature.is_active,
            'parent_id': nomenclature.parent_id,
            'article_id': nomenclature.article_id,
            'user_id': nomenclature.user_id,
            'created_by': nomenclature.created_by,
            'managed_by': nomenclature.managed_by,
            'created_at': nomenclature.created_at,
            'updated_at': nomenclature.updated_at,
            'is_shared': False,
            'is_editable': True
        }

        return success_response(data=nomenclature_dict, status_code=201)
    except IntegrityError:
        await db.rollback()
        return error_conflict(f"Nomenclature with code '{nomenclature_data.code}' already exists")


@router.put("/{nomenclature_id}", response_model=NomenclaturePublic)
async def update_nomenclature(
    nomenclature_id: int,
    nomenclature_data: NomenclatureUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update nomenclature for current user."""
    user_id = current_user.get('user_id')

    # Get nomenclature for current user
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        Nomenclature.user_id == user_id
    )
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()

    if not nomenclature:
        return error_not_found("Nomenclature not found")

    # Update only provided fields (excluding user_id to prevent unauthorized changes)
    update_data = nomenclature_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)

    # Check for code conflicts if code is being updated
    if 'code' in update_data and update_data['code']:
        stmt = select(Nomenclature).where(
            Nomenclature.code == update_data['code'],
            Nomenclature.user_id == user_id,
            Nomenclature.id != nomenclature_id
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            return error_conflict(f"Nomenclature with code '{update_data['code']}' already exists")

    # Handle nomenclature_type conversion
    if 'nomenclature_type' in update_data and update_data['nomenclature_type']:
        update_data['nomenclature_type'] = NomenclatureType(update_data['nomenclature_type'])

    for field, value in update_data.items():
        setattr(nomenclature, field, value)

    try:
        await db.commit()
        await db.refresh(nomenclature)

        nomenclature_dict = {
            'id': nomenclature.id,
            'code': nomenclature.code,
            'name': nomenclature.name,
            'description': nomenclature.description,
            'nomenclature_type': nomenclature.nomenclature_type,
            'account_name': nomenclature.account_name,
            'bill_name': nomenclature.bill_name,
            'operation': nomenclature.operation,
            'is_budget': nomenclature.is_budget,
            'is_fact': nomenclature.is_fact,
            'is_active': nomenclature.is_active,
            'parent_id': nomenclature.parent_id,
            'article_id': nomenclature.article_id,
            'user_id': nomenclature.user_id,
            'created_by': nomenclature.created_by,
            'managed_by': nomenclature.managed_by,
            'created_at': nomenclature.created_at,
            'updated_at': nomenclature.updated_at,
            'is_shared': False,
            'is_editable': True
        }

        return success_response(data=nomenclature_dict)
    except IntegrityError:
        await db.rollback()
        return error_conflict("Nomenclature with this code already exists")


@router.delete("/{nomenclature_id}")
async def delete_nomenclature(
    nomenclature_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete nomenclature for current user."""
    user_id = current_user.get('user_id')

    # Get nomenclature for current user
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        Nomenclature.user_id == user_id
    )
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()

    if not nomenclature:
        return error_not_found("Nomenclature not found")

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
    user_id = current_user.get('user_id')

    # Get all nomenclatures that match the IDs and belong to current user
    stmt = select(Nomenclature).where(
        Nomenclature.id.in_(ids),
        Nomenclature.user_id == user_id
    )
    result = await db.execute(stmt)
    nomenclatures = result.scalars().all()

    if not nomenclatures:
        return error_not_found("No nomenclatures found")

    for nomenclature in nomenclatures:
        await db.delete(nomenclature)

    await db.commit()

    return success_response(data={"message": f"Deleted {len(nomenclatures)} nomenclatures"})