"""
Sharing API endpoints for user data sharing functionality.
"""
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session

from app.api.deps import get_db, get_current_user
from app.models import User, Sharing, Nomenclature, CostCenter, FinancialCenter, Product
from app.schemas.sharing import (
    SharingCreate, SharingUpdate, Sharing as SharingResponse,
    SharingListResponse, AvailableUsersResponse, ResourceType
)

router = APIRouter()


@router.get("/my-shares", response_model=SharingListResponse)
async def get_my_shares(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get current user's sharing configurations."""
    
    user_id = current_user["user_id"]
    sharing_list = (
        db.query(Sharing)
        .filter(Sharing.owner_user_id == user_id)
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    total = db.query(Sharing).filter(Sharing.owner_user_id == user_id).count()
    
    return SharingListResponse(
        success=True,
        data=[SharingResponse.model_validate(sharing) for sharing in sharing_list],
        total=total
    )


@router.get("/shared-with-me", response_model=SharingListResponse)
async def get_shared_with_me(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000)
):
    """Get data shared with current user."""
    
    user_id = current_user["user_id"]
    sharing_list = (
        db.query(Sharing)
        .filter(
            Sharing.shared_with_user_id == user_id,
            Sharing.is_active == True
        )
        .offset(skip)
        .limit(limit)
        .all()
    )
    
    total = db.query(Sharing).filter(
        Sharing.shared_with_user_id == user_id,
        Sharing.is_active == True
    ).count()
    
    return SharingListResponse(
        success=True,
        data=[SharingResponse.model_validate(sharing) for sharing in sharing_list],
        total=total
    )


@router.post("/create", response_model=Dict[str, Any])
async def create_sharing(
    request: Request,
    sharing_data: SharingCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Create new sharing configuration."""
    
    user_id = current_user["user_id"]
    
    # Validate that target user exists
    target_user = db.query(User).filter(User.id == sharing_data.shared_with_user_id).first()
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Target user not found"
        )
    
    # Validate that user owns the resource (if specific resource_id provided)
    if sharing_data.resource_id:
        model_map = {
            ResourceType.nomenclature: Nomenclature,
            ResourceType.cost_center: CostCenter,
            ResourceType.financial_center: FinancialCenter,
            ResourceType.product: Product
        }
        
        model = model_map[sharing_data.resource_type]
        resource = db.query(model).filter(
            model.id == sharing_data.resource_id,
            model.user_id == user_id
        ).first()
        
        if not resource:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Resource not found or not owned by user"
            )
    
    # Check for existing sharing
    existing = db.query(Sharing).filter(
        Sharing.owner_user_id == user_id,
        Sharing.shared_with_user_id == sharing_data.shared_with_user_id,
        Sharing.resource_type == sharing_data.resource_type,
        Sharing.resource_id == sharing_data.resource_id
    ).first()
    
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Sharing already exists"
        )
    
    # Create sharing
    sharing = Sharing(
        owner_user_id=user_id,
        shared_with_user_id=sharing_data.shared_with_user_id,
        resource_type=sharing_data.resource_type,
        resource_id=sharing_data.resource_id,
        permission_type=sharing_data.permission_type,
        is_active=sharing_data.is_active
    )
    
    try:
        db.add(sharing)
        db.commit()
        db.refresh(sharing)
        
        return {
            "success": True,
            "data": SharingResponse.model_validate(sharing)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create sharing: {str(e)}"
        )


@router.put("/{sharing_id}", response_model=Dict[str, Any])
async def update_sharing(
    sharing_id: int,
    request: Request,
    sharing_data: SharingUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update sharing configuration."""
    
    user_id = current_user["user_id"]
    sharing = db.query(Sharing).filter(
        Sharing.id == sharing_id,
        Sharing.owner_user_id == user_id
    ).first()
    
    if not sharing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sharing not found"
        )
    
    # Update fields
    if sharing_data.permission_type is not None:
        sharing.permission_type = sharing_data.permission_type
    if sharing_data.is_active is not None:
        sharing.is_active = sharing_data.is_active
    
    try:
        db.commit()
        db.refresh(sharing)
        
        return {
            "success": True,
            "data": SharingResponse.model_validate(sharing)
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to update sharing: {str(e)}"
        )


@router.delete("/{sharing_id}", response_model=Dict[str, Any])
async def delete_sharing(
    sharing_id: int,
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete sharing configuration."""
    
    user_id = current_user["user_id"]
    sharing = db.query(Sharing).filter(
        Sharing.id == sharing_id,
        Sharing.owner_user_id == user_id
    ).first()
    
    if not sharing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Sharing not found"
        )
    
    try:
        db.delete(sharing)
        db.commit()
        
        return {
            "success": True,
            "message": "Sharing deleted successfully"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete sharing: {str(e)}"
        )


@router.get("/available-users", response_model=AvailableUsersResponse)
async def get_available_users(
    request: Request,
    db: Session = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get list of users available for sharing (excluding current user)."""
    
    user_id = current_user["user_id"]
    users = db.query(User).filter(
        User.id != user_id,
        User.is_active == True
    ).all()
    
    return AvailableUsersResponse(
        success=True,
        data=[{
            "id": user.id,
            "user_name": user.user_name,
            "user_email": user.user_email,
            "username": user.username
        } for user in users]
    )