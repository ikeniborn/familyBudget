"""
JWT Protected Endpoint Template
Family Budget Project - Authentication & Security Skill
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from backend.app.core.auth import get_current_user, get_current_active_admin
from backend.app.models.user import User
from backend.app.db.session import get_db

router = APIRouter()

# ===== Public Endpoint (No Auth) =====
@router.get("/public")
async def public_endpoint():
    """Public endpoint - no authentication required"""
    return {"message": "Public data"}

# ===== Protected Endpoint (User Auth) =====
@router.get("/protected")
async def protected_endpoint(
    current_user: User = Depends(get_current_user)
):
    """
    Protected endpoint - requires valid JWT token
    
    Current user automatically injected via Depends(get_current_user)
    """
    return {
        "message": "Protected data",
        "user_id": current_user.id,
        "username": current_user.username
    }

# ===== Admin-Only Endpoint =====
@router.post("/admin/create")
async def admin_create_endpoint(
    data: dict,
    session: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)  # Admin check
):
    """
    Admin-only endpoint
    
    Shared Budget Model:
    - Dimension CREATE/UPDATE/DELETE = Admin-only
    - Fact CREATE/UPDATE/DELETE = All users (shared family budget)
    """
    # Only admins can create dimensions
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    
    # Create logic here
    return {"message": "Created successfully"}
