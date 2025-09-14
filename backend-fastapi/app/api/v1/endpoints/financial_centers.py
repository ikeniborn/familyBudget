"""
Financial Center management endpoints.
"""
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status, Request, Body
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.models.financial_center import FinancialCenter
from app.schemas.financial_center import (
    FinancialCenterCreate,
    FinancialCenterUpdate,
    FinancialCenterPublic
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


@router.get("/", response_model=List[FinancialCenterPublic])
async def get_financial_centers(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all financial centers (both shared and user-specific)."""
    user_id = current_user.get('user_id')

    # Show all shared centers (user_id=NULL) and user's own centers
    stmt = (
        select(FinancialCenter)
        .where(
            (FinancialCenter.user_id.is_(None)) |  # Shared centers
            (FinancialCenter.user_id == user_id)   # User's own centers
        )
        .offset(skip)
        .limit(limit)
        .order_by(FinancialCenter.name.asc())
    )
    result = await db.execute(stmt)
    centers = result.scalars().all()
    
    centers_data = [FinancialCenterPublic.from_db_model(center, current_user).dict() for center in centers]
    return success_response(data=centers_data, total=len(centers_data))


@router.get("/{center_id}", response_model=FinancialCenterPublic)
async def get_financial_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get financial center by ID (shared centers and user's own centers)."""
    user_id = current_user.get('user_id')

    # Show center if it's shared or belongs to current user
    stmt = select(FinancialCenter).where(
        FinancialCenter.id == center_id,
        (
            (FinancialCenter.user_id.is_(None)) |  # Shared centers
            (FinancialCenter.user_id == user_id)   # User's own centers
        )
    )
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Financial center not found or access denied")

    return success_response(data=FinancialCenterPublic.from_db_model(center, current_user).dict())


@router.post("/", response_model=FinancialCenterPublic)
async def create_financial_center(
    center_data: FinancialCenterCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new financial center. Admins can create shared centers (user_id=NULL)."""
    user_role = current_user.get('role', 'user')
    requested_user_id = center_data.user_id if hasattr(center_data, 'user_id') else None

    # Check admin access for shared centers
    if requested_user_id is None:  # Requesting to create shared center
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to create shared financial centers"
            )
    elif requested_user_id != current_user.get('user_id'):
        # Can't create centers for other users (unless admin)
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Cannot create financial centers for other users"
            )

    # Check for existing center with same code (global uniqueness)
    stmt = select(FinancialCenter).where(FinancialCenter.code == center_data.code)
    result = await db.execute(stmt)
    existing = result.scalar_one_or_none()

    if existing:
        return error_conflict(f"Financial center with code '{center_data.code}' already exists")

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
        center = FinancialCenter(
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

        return success_response(data=FinancialCenterPublic.from_db_model(center, current_user).dict(), status_code=201)
    except IntegrityError:
        await db.rollback()
        return error_conflict(f"Financial center with code '{center_data.code}' already exists")


@router.put("/{center_id}", response_model=FinancialCenterPublic)
async def update_financial_center(
    center_id: int,
    center_data: FinancialCenterUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update financial center. Admins can edit shared centers and any user centers."""
    user_role = current_user.get('role', 'user')
    user_id = current_user.get('user_id')

    # Get center without user restriction first
    stmt = select(FinancialCenter).where(FinancialCenter.id == center_id)
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Financial center not found")

    # Check permissions
    is_shared = center.user_id is None
    if is_shared:
        # Shared centers only editable by admins
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to edit shared financial centers"
            )
    else:
        # User centers editable by owner or admins
        if center.user_id != user_id and user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only edit your own financial centers"
            )
    
    # Update only provided fields (excluding user_id to prevent unauthorized changes)
    update_data = center_data.dict(exclude_unset=True)
    # Remove user_id from update data to prevent hijacking
    update_data.pop('user_id', None)

    # Check for code conflicts if code is being updated
    if 'code' in update_data and update_data['code']:
        stmt = select(FinancialCenter).where(
            FinancialCenter.code == update_data['code'],
            FinancialCenter.id != center_id
        )
        result = await db.execute(stmt)
        existing = result.scalar_one_or_none()

        if existing:
            return error_conflict(f"Financial center with code '{update_data['code']}' already exists")

    for field, value in update_data.items():
        setattr(center, field, value)

    try:
        await db.commit()
        await db.refresh(center)

        return success_response(data=FinancialCenterPublic.from_db_model(center, current_user).dict())
    except IntegrityError:
        await db.rollback()
        return error_conflict("Financial center with this code already exists")


@router.delete("/{center_id}")
async def delete_financial_center(
    center_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete financial center. Admins can delete shared centers and any user centers."""
    user_role = current_user.get('role', 'user')
    user_id = current_user.get('user_id')

    # Get center without user restriction first
    stmt = select(FinancialCenter).where(FinancialCenter.id == center_id)
    result = await db.execute(stmt)
    center = result.scalar_one_or_none()

    if not center:
        return error_not_found("Financial center not found")

    # Check permissions
    is_shared = center.user_id is None
    if is_shared:
        # Shared centers only deletable by admins
        if user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Admin access required to delete shared financial centers"
            )
    else:
        # User centers deletable by owner or admins
        if center.user_id != user_id and user_role != 'admin':
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: You can only delete your own financial centers"
            )

    await db.delete(center)
    await db.commit()

    return success_response(data={"message": "Financial center deleted successfully"})


@router.post("/bulk-delete")
async def bulk_delete_financial_centers(
    ids: List[int] = Body(...),
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete multiple financial centers. Admins can delete shared and any user centers."""
    user_role = current_user.get('role', 'user')
    user_id = current_user.get('user_id')

    # Get all centers that match the IDs
    stmt = select(FinancialCenter).where(FinancialCenter.id.in_(ids))
    result = await db.execute(stmt)
    centers = result.scalars().all()

    if not centers:
        return error_not_found("No financial centers found")

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
            detail="No financial centers can be deleted (permission denied)"
        )

    for center in deletable_centers:
        await db.delete(center)

    await db.commit()

    return success_response(data={"message": f"Deleted {len(deletable_centers)} financial centers"})