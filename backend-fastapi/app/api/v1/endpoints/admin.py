"""
Admin API endpoints for managing all user data.
"""
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.core.security import require_admin_access
from app.models import (
    User, Sharing, Nomenclature, CostCenter, 
    FinancialCenter, Product, Registry, Period
)
from app.schemas.period import AdminPeriodResponse

router = APIRouter()


@router.get("/users", response_model=Dict[str, Any])
async def get_all_users(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin_access),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get all users for admin."""
    users = db.query(User).offset(skip).limit(limit).all()
    total = db.query(User).count()
    
    return {
        "success": True,
        "data": [user.to_dict() for user in users],
        "total": total
    }


@router.get("/references/{resource_type}", response_model=Dict[str, Any])
async def get_all_references(
    resource_type: str,
    request: Request,
    db: Session = Depends(get_db),
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
    query = db.query(model).join(User, model.user_id == User.id)
    
    if user_id:
        query = query.filter(model.user_id == user_id)
    
    references = query.offset(skip).limit(limit).all()
    total = query.count()
    
    # Group by user
    result = []
    for ref in references:
        ref_dict = ref.to_dict()
        # Add user info
        user = db.query(User).filter(User.id == ref.user_id).first()
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
    db: Session = Depends(get_db),
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
    item = db.query(model).filter(model.id == item_id).first()
    
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
        db.commit()
        db.refresh(item)
        return {
            "success": True,
            "data": item.to_dict()
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update {resource_type}: {str(e)}"
        )


@router.delete("/references/{resource_type}/{item_id}", response_model=Dict[str, Any])
async def delete_reference(
    resource_type: str,
    item_id: int,
    request: Request,
    db: Session = Depends(get_db),
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
    item = db.query(model).filter(model.id == item_id).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"{resource_type.title()} not found"
        )
    
    try:
        db.delete(item)
        db.commit()
        return {
            "success": True,
            "message": f"{resource_type.title()} deleted successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete {resource_type}: {str(e)}"
        )


@router.get("/periods", response_model=Dict[str, Any])
async def get_all_periods(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin_access),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get all periods from all users for admin."""
    
    # Get all periods with JOIN to user table for user information
    periods_with_users = (
        db.query(Period, User)
        .join(User, Period.user_id == User.id)
        .order_by(Period.date.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    total = db.query(Period).count()
    
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


@router.get("/sharing", response_model=Dict[str, Any])
async def get_all_sharing(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_admin_access),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get all sharing configurations for admin."""
    
    sharing_list = (
        db.query(Sharing)
        .join(User, Sharing.owner_user_id == User.id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    total = db.query(Sharing).count()
    
    return {
        "success": True,
        "data": [sharing.to_dict() for sharing in sharing_list],
        "total": total
    }