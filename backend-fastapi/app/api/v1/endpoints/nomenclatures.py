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
    """Get all nomenclatures (both shared and user-specific) with optional filtering."""
    user_id = current_user.get('user_id')

    # Show all shared nomenclatures (user_id=NULL) and user's own nomenclatures
    stmt = (
        select(Nomenclature)
        .where(
            (Nomenclature.user_id.is_(None)) |  # Shared nomenclatures
            (Nomenclature.user_id == user_id)   # User's own nomenclatures
        )
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
    
    nomenclatures_data = [NomenclaturePublic.from_db_model(nomenclature, current_user).dict() for nomenclature in nomenclatures]
    return success_response(data=nomenclatures_data, total=len(nomenclatures_data))


@router.get("/{nomenclature_id}", response_model=NomenclaturePublic)
async def get_nomenclature(
    nomenclature_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get nomenclature by ID (shared nomenclatures and user's own nomenclatures)."""
    user_id = current_user.get('user_id')

    # Show nomenclature if it's shared or belongs to current user
    stmt = select(Nomenclature).where(
        Nomenclature.id == nomenclature_id,
        (
            (Nomenclature.user_id.is_(None)) |  # Shared nomenclatures
            (Nomenclature.user_id == user_id)   # User's own nomenclatures
        )
    )
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()

    if not nomenclature:
        return error_not_found("Nomenclature not found or access denied")

    return success_response(data=NomenclaturePublic.from_db_model(nomenclature, current_user).dict())


@router.post("/", response_model=NomenclaturePublic)
async def create_nomenclature(
    nomenclature_data: NomenclatureCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new nomenclature. Admins can create shared nomenclatures (user_id=NULL)."""
    user_role = current_user.get('role', 'user')
    requested_user_id = nomenclature_data.user_id if hasattr(nomenclature_data, 'user_id') else None

    # Check admin access for shared nomenclatures
    if requested_user_id is None:  # Requesting to create shared nomenclature
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to create shared nomenclatures"
            )
    elif requested_user_id != current_user.get('user_id'):
        # Can't create nomenclatures for other users (unless admin)
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create nomenclatures for other users"
            )

    # Check for existing nomenclature with same code (global uniqueness)
    stmt = select(Nomenclature).where(Nomenclature.code == nomenclature_data.code)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return error_conflict(f"Nomenclature with code '{nomenclature_data.code}' already exists")

    # Determine final user_id and admin fields
    if requested_user_id is None:
        # Creating shared nomenclature
        final_user_id = None
        created_by = current_user.get('user_id')
        managed_by = nomenclature_data.managed_by if hasattr(nomenclature_data, 'managed_by') else current_user.get('user_id')
    else:
        # Creating user-specific nomenclature
        final_user_id = requested_user_id if user_role == 'admin' else current_user.get('user_id')
        created_by = current_user.get('user_id')
        managed_by = nomenclature_data.managed_by if hasattr(nomenclature_data, 'managed_by') else None

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
            user_id=final_user_id,
            created_by=created_by,
            managed_by=managed_by
        )
        db.add(nomenclature)
        await db.commit()
        await db.refresh(nomenclature)

        return success_response(data=NomenclaturePublic.from_db_model(nomenclature, current_user).dict(), status_code=201)
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
    """Update nomenclature. Admins can edit shared nomenclatures and any user nomenclatures."""
    user_role = current_user.get('role', 'user')
    user_id = current_user.get('user_id')

    # Get nomenclature without user restriction first
    stmt = select(Nomenclature).where(Nomenclature.id == nomenclature_id)
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()

    if not nomenclature:
        return error_not_found("Nomenclature not found")

    # Check permissions
    is_shared = nomenclature.user_id is None
    if is_shared:
        # Shared nomenclatures only editable by admins
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to edit shared nomenclatures"
            )
    else:
        # User nomenclatures editable by owner or admins
        if nomenclature.user_id != user_id and user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only edit your own nomenclatures"
            )
    
    # Update only provided fields (excluding user_id to prevent unauthorized changes)
    update_data = nomenclature_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)

    # Check for code conflicts if code is being updated
    if 'code' in update_data and update_data['code']:
        stmt = select(Nomenclature).where(
            Nomenclature.code == update_data['code'],
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

        return success_response(data=NomenclaturePublic.from_db_model(nomenclature, current_user).dict())
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
    """Delete nomenclature. Admins can delete shared nomenclatures and any user nomenclatures."""
    user_role = current_user.get('role', 'user')
    user_id = current_user.get('user_id')

    # Get nomenclature without user restriction first
    stmt = select(Nomenclature).where(Nomenclature.id == nomenclature_id)
    result = await db.execute(stmt)
    nomenclature = result.scalar_one_or_none()

    if not nomenclature:
        return error_not_found("Nomenclature not found")

    # Check permissions
    is_shared = nomenclature.user_id is None
    if is_shared:
        # Shared nomenclatures only deletable by admins
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to delete shared nomenclatures"
            )
    else:
        # User nomenclatures deletable by owner or admins
        if nomenclature.user_id != user_id and user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only delete your own nomenclatures"
            )

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
    """Delete multiple nomenclatures. Admins can delete shared and any user nomenclatures."""
    user_role = current_user.get('role', 'user')
    user_id = current_user.get('user_id')

    # Get all nomenclatures that match the IDs
    stmt = select(Nomenclature).where(Nomenclature.id.in_(ids))
    result = await db.execute(stmt)
    nomenclatures = result.scalars().all()

    if not nomenclatures:
        return error_not_found("No nomenclatures found")

    # Filter nomenclatures based on permissions
    deletable_nomenclatures = []
    for nomenclature in nomenclatures:
        is_shared = nomenclature.user_id is None
        if is_shared:
            # Shared nomenclatures only deletable by admins
            if user_role == 'admin':
                deletable_nomenclatures.append(nomenclature)
        else:
            # User nomenclatures deletable by owner or admins
            if nomenclature.user_id == user_id or user_role == 'admin':
                deletable_nomenclatures.append(nomenclature)

    if not deletable_nomenclatures:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No nomenclatures can be deleted (permission denied)"
        )

    for nomenclature in deletable_nomenclatures:
        await db.delete(nomenclature)

    await db.commit()

    return success_response(data={"message": f"Deleted {len(deletable_nomenclatures)} nomenclatures"})