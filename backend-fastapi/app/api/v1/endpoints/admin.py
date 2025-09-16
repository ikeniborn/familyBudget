"""
Admin API endpoints for managing all user data.
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.core.security import require_admin_access
from app.models import (
    User, Nomenclature, CostCenter,
    FinancialCenter, Product, Registry, Period
)
from app.schemas.period import AdminPeriodResponse

router = APIRouter()


@router.get("/users", response_model=Dict[str, Any])
async def get_all_users(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get all users for admin."""
    # Use async query
    stmt = select(User).offset(skip).limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    # Count query
    count_stmt = select(User)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    return {
        "success": True,
        "data": [user.to_dict() for user in users],
        "total": total
    }


@router.get("/references/{resource_type}", response_model=Dict[str, Any])
async def get_all_references(
    resource_type: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[int] = Query(None, description="Filter by user ID")
):
    """Get all references of specified type for admin, grouped by users."""
    
    # Map resource types to models
    model_map = {
        "nomenclature": Nomenclature,
        "cost_center": CostCenter,
        "financial_center": FinancialCenter,
        "product": Product
    }
    
    if resource_type not in model_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid resource type"
        )
    
    model = model_map[resource_type]
    
    # Build async query
    stmt = select(model, User).join(User, model.user_id == User.id)
    
    if user_id:
        stmt = stmt.filter(model.user_id == user_id)
    
    stmt = stmt.offset(skip).limit(limit)
    result_set = await db.execute(stmt)
    references_with_users = result_set.all()
    
    # Count query
    count_stmt = select(model)
    if user_id:
        count_stmt = count_stmt.filter(model.user_id == user_id)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    # Group by user
    result = []
    for ref, user in references_with_users:
        ref_dict = ref.to_dict()
        ref_dict["user"] = user.to_dict() if user else None
        result.append(ref_dict)
    
    return {
        "success": True,
        "data": result,
        "total": total
    }


@router.put("/references/{resource_type}/{item_id}", response_model=Dict[str, Any])
async def update_reference(
    resource_type: str,
    item_id: int,
    request: Request,
    update_data: Dict[str, Any],
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access)
):
    """Update reference item for admin."""
    
    model_map = {
        "nomenclature": Nomenclature,
        "cost_center": CostCenter,
        "financial_center": FinancialCenter,
        "product": Product
    }
    
    if resource_type not in model_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid resource type"
        )
    
    model = model_map[resource_type]
    
    # Find item using async query
    stmt = select(model).filter(model.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_type.title()} not found"
        )
    
    # Update allowed fields
    allowed_fields = {
        "nomenclature": ["name", "description", "is_active"],
        "cost_center": ["name", "description", "is_active"],
        "financial_center": ["name", "description", "is_active"],
        "product": ["name", "description", "is_active", "unit"]
    }
    
    for field, value in update_data.items():
        if field in allowed_fields.get(resource_type, []):
            setattr(item, field, value)
    
    try:
        await db.commit()
        await db.refresh(item)
        return {
            "success": True,
            "data": item.to_dict()
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update {resource_type}: {str(e)}"
        )


@router.delete("/references/{resource_type}/{item_id}", response_model=Dict[str, Any])
async def delete_reference(
    resource_type: str,
    item_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access)
):
    """Delete reference item for admin."""
    
    model_map = {
        "nomenclature": Nomenclature,
        "cost_center": CostCenter,
        "financial_center": FinancialCenter,
        "product": Product
    }
    
    if resource_type not in model_map:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid resource type"
        )
    
    model = model_map[resource_type]
    
    # Find item using async query
    stmt = select(model).filter(model.id == item_id)
    result = await db.execute(stmt)
    item = result.scalar_one_or_none()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_type.title()} not found"
        )
    
    try:
        await db.delete(item)
        await db.commit()
        return {
            "success": True,
            "message": f"{resource_type.title()} deleted successfully"
        }
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete {resource_type}: {str(e)}"
        )


@router.get("/periods", response_model=Dict[str, Any])
async def get_all_periods(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get all periods from all users for admin."""
    
    # Get all periods with JOIN to user table for user information using async
    stmt = (
        select(Period, User)
        .join(User, Period.user_id == User.id)
        .order_by(Period.date.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(stmt)
    periods_with_users = result.all()
    
    # Count query
    count_stmt = select(Period)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    # Convert to AdminPeriodResponse format
    admin_periods = []
    for period, user in periods_with_users:
        admin_period = AdminPeriodResponse.from_db_models(period, user)
        admin_periods.append(admin_period.dict())
    
    return {
        "success": True,
        "data": admin_periods,
        "total": total
    }




@router.get("/references/financial_center", response_model=Dict[str, Any])
async def get_admin_financial_centers(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[int] = Query(None, description="Filter by user ID")
):
    """Get all financial centers with user information for admin."""
    
    # Build query with JOIN to get user information
    stmt = select(FinancialCenter, User).join(User, FinancialCenter.user_id == User.id)
    
    if user_id:
        stmt = stmt.filter(FinancialCenter.user_id == user_id)
    
    stmt = stmt.offset(skip).limit(limit)
    result_set = await db.execute(stmt)
    financial_centers_with_users = result_set.all()
    
    # Count query
    count_stmt = select(FinancialCenter)
    if user_id:
        count_stmt = count_stmt.filter(FinancialCenter.user_id == user_id)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    # Format response with user information
    result = []
    for fc, user in financial_centers_with_users:
        fc_dict = fc.to_dict()
        fc_dict["user_name"] = user.user_name if user else "Unknown User"
        fc_dict["user_email"] = user.user_email if user else None
        fc_dict["username"] = user.username if user else None
        fc_dict["telegram_id"] = str(user.telegram_id) if user and user.telegram_id else None
        result.append(fc_dict)
    
    return {
        "success": True,
        "data": result,
        "total": total
    }


@router.get("/references/cost_center", response_model=Dict[str, Any])
async def get_admin_cost_centers(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[int] = Query(None, description="Filter by user ID")
):
    """Get all cost centers with user information for admin."""
    
    # Build query with JOIN to get user information
    stmt = select(CostCenter, User).join(User, CostCenter.user_id == User.id)
    
    if user_id:
        stmt = stmt.filter(CostCenter.user_id == user_id)
    
    stmt = stmt.offset(skip).limit(limit)
    result_set = await db.execute(stmt)
    cost_centers_with_users = result_set.all()
    
    # Count query
    count_stmt = select(CostCenter)
    if user_id:
        count_stmt = count_stmt.filter(CostCenter.user_id == user_id)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    # Format response with user information
    result = []
    for cc, user in cost_centers_with_users:
        cc_dict = cc.to_dict()
        cc_dict["user_name"] = user.user_name if user else "Unknown User"
        cc_dict["user_email"] = user.user_email if user else None
        cc_dict["username"] = user.username if user else None
        cc_dict["telegram_id"] = str(user.telegram_id) if user and user.telegram_id else None
        result.append(cc_dict)
    
    return {
        "success": True,
        "data": result,
        "total": total
    }


@router.get("/references/nomenclature", response_model=Dict[str, Any])
async def get_admin_nomenclatures(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user_id: Optional[int] = Query(None, description="Filter by user ID")
):
    """Get all nomenclatures with user information for admin."""
    
    # Build query with JOIN to get user information
    stmt = select(Nomenclature, User).join(User, Nomenclature.user_id == User.id)
    
    if user_id:
        stmt = stmt.filter(Nomenclature.user_id == user_id)
    
    stmt = stmt.offset(skip).limit(limit)
    result_set = await db.execute(stmt)
    nomenclatures_with_users = result_set.all()
    
    # Count query
    count_stmt = select(Nomenclature)
    if user_id:
        count_stmt = count_stmt.filter(Nomenclature.user_id == user_id)
    count_result = await db.execute(count_stmt)
    total = len(count_result.scalars().all())
    
    # Format response with user information
    result = []
    for n, user in nomenclatures_with_users:
        n_dict = n.to_dict()
        n_dict["user_name"] = user.user_name if user else "Unknown User"
        n_dict["user_email"] = user.user_email if user else None
        n_dict["username"] = user.username if user else None
        n_dict["telegram_id"] = str(user.telegram_id) if user and user.telegram_id else None
        result.append(n_dict)
    
    return {
        "success": True,
        "data": result,
        "total": total
    }