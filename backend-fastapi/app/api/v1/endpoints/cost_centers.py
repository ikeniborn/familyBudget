"""
Cost Center management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.models.cost_center import CostCenter
from app.schemas.cost_center import (
    CostCenterCreate,
    CostCenterUpdate,
    CostCenterPublic
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


@router.get("/", response_model=List[CostCenterPublic])
async def get_cost_centers(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all cost centers (both shared and user-specific)."""
    user_id = current_user.get('user_id')

    # Show all shared centers (user_id=NULL) and user's own centers
    stmt = (
        select(CostCenter)
        .where(
            (CostCenter.user_id.is_(None)) |  # Shared centers
            (CostCenter.user_id == user_id)   # User's own centers
        )
        .offset(skip)
        .limit(limit)
        .order_by(CostCenter.name.asc())
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    centers_data = [CostCenterPublic.from_db_model(center, current_user).dict() for center in centers]
    return success_response(data=centers_data, total=len(centers_data))


@router.get("/{center_id}", response_model=CostCenterPublic)
async def get_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get cost center by ID (shared centers and user's own centers)."""
    user_id = current_user.get('user_id')

    # Show center if it's shared or belongs to current user
    stmt = select(CostCenter).where(
        CostCenter.id == center_id,
        (
            (CostCenter.user_id.is_(None)) |  # Shared centers
            (CostCenter.user_id == user_id)   # User's own centers
        )
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Cost center not found or access denied")

    return success_response(data=CostCenterPublic.from_db_model(center, current_user).dict())


@router.post("/", response_model=CostCenterPublic)
async def create_cost_center(
    center_data: CostCenterCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new cost center. Admins can create shared centers (user_id=NULL)."""
    user_role = current_user.get('role', 'user')
    requested_user_id = center_data.user_id if hasattr(center_data, 'user_id') else None

    # Check admin access for shared centers
    if requested_user_id is None:  # Requesting to create shared center
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to create shared cost centers"
            )
    elif requested_user_id != current_user.get('user_id'):
        # Can't create centers for other users (unless admin)
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create cost centers for other users"
            )

    # Check for existing center with same code (global uniqueness)
    stmt = select(CostCenter).where(CostCenter.code == center_data.code)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return error_conflict(f"Cost center with code '{center_data.code}' already exists")

    # Determine final user_id and admin fields
    if requested_user_id is None:
        # Creating shared center
        final_user_id = None
        created_by = current_user.get('user_id')
        managed_by = center_data.managed_by if hasattr(center_data, 'managed_by') else current_user.get('user_id')
    else:
        # Creating user-specific center
        final_user_id = requested_user_id if user_role == 'admin' else current_user.get('user_id')
        created_by = current_user.get('user_id')
        managed_by = center_data.managed_by if hasattr(center_data, 'managed_by') else None

    try:
        center = CostCenter(
            code=center_data.code,
            name=center_data.name,
            description=center_data.description,
            is_active=center_data.is_active,
            user_id=final_user_id,
            created_by=created_by,
            managed_by=managed_by
        )
        db.add(center)
        await db.commit()
        await db.refresh(center)

        return success_response(data=CostCenterPublic.from_db_model(center, current_user).dict(), status_code=201)
    except IntegrityError:
        await db.rollback()
        return error_conflict(f"Cost center with code '{center_data.code}' already exists")


@router.put("/{center_id}", response_model=CostCenterPublic)
async def update_cost_center(
    center_id: int,
    center_data: CostCenterUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update cost center. Admins can edit shared centers and any user centers."""
    user_role = current_user.get('role', 'user')
    user_id = current_user.get('user_id')

    # Get center without user restriction first
    stmt = select(CostCenter).where(CostCenter.id == center_id)
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Cost center not found")

    # Check permissions
    is_shared = center.user_id is None
    if is_shared:
        # Shared centers only editable by admins
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to edit shared cost centers"
            )
    else:
        # User centers editable by owner or admins
        if center.user_id != user_id and user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only edit your own cost centers"
            )
    
    # Update only provided fields (excluding user_id to prevent unauthorized changes)
    update_data = center_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)

    # Check for code conflicts if code is being updated
    if 'code' in update_data and update_data['code']:
        stmt = select(CostCenter).where(
            CostCenter.code == update_data['code'],
            CostCenter.id != center_id
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            return error_conflict(f"Cost center with code '{update_data['code']}' already exists")

    for field, value in update_data.items():
        setattr(center, field, value)

    try:
        await db.commit()
        await db.refresh(center)

        return success_response(data=CostCenterPublic.from_db_model(center, current_user).dict())
    except IntegrityError:
        await db.rollback()
        return error_conflict("Cost center with this code already exists")


@router.delete("/{center_id}")
async def delete_cost_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete cost center. Admins can delete shared centers and any user centers."""
    user_role = current_user.get('role', 'user')
    user_id = current_user.get('user_id')

    # Get center without user restriction first
    stmt = select(CostCenter).where(CostCenter.id == center_id)
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Cost center not found")

    # Check permissions
    is_shared = center.user_id is None
    if is_shared:
        # Shared centers only deletable by admins
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to delete shared cost centers"
            )
    else:
        # User centers deletable by owner or admins
        if center.user_id != user_id and user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only delete your own cost centers"
            )

    await db.delete(center)
    await db.commit()

    return success_response(data={"message": "Cost center deleted successfully"})


@router.post("/bulk-delete")
async def bulk_delete_cost_centers(
    ids: List[int] = Body(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple cost centers. Admins can delete shared and any user centers."""
    user_role = current_user.get('role', 'user')
    user_id = current_user.get('user_id')

    # Get all centers that match the IDs
    stmt = select(CostCenter).where(CostCenter.id.in_(ids))
    result = await db.execute(stmt)
    centers = result.scalars().all()

    if not centers:
        return error_not_found("No cost centers found")

    # Filter centers based on permissions
    deletable_centers = []
    for center in centers:
        is_shared = center.user_id is None
        if is_shared:
            # Shared centers only deletable by admins
            if user_role == 'admin':
                deletable_centers.append(center)
        else:
            # User centers deletable by owner or admins
            if center.user_id == user_id or user_role == 'admin':
                deletable_centers.append(center)

    if not deletable_centers:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No cost centers can be deleted (permission denied)"
        )

    for center in deletable_centers:
        await db.delete(center)

    await db.commit()

    return success_response(data={"message": f"Deleted {len(deletable_centers)} cost centers"})