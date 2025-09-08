"""
User management endpoints.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user import User
from app.core.security import SecurityUtils, require_admin_access
from app.core.session import get_current_user_from_session

router = APIRouter()


class UserCreate(BaseModel):
    """User creation schema."""
    user_name: str
    user_email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    auth_method: str = "password"


class UserUpdate(BaseModel):
    """User update schema."""
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    is_active: Optional[bool] = None


class UserResponse(BaseModel):
    """User response schema."""
    id: int
    user_name: str
    user_email: Optional[str]
    username: Optional[str]
    auth_method: str
    role: str
    is_active: bool


async def get_current_user(request: Request) -> dict:
    """Get current authenticated user or raise exception."""
    user = await get_current_user_from_session(request)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return user


@router.get("/", response_model=List[UserResponse])
async def get_users(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get all users (admin only - for now just return current user)."""
    # For now, only return current user's info
    stmt = select(User).where(User.id == current_user["user_id"])
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        return []
    
    return [UserResponse(**user.to_dict())]


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get current user information."""
    stmt = select(User).where(User.id == current_user["user_id"])
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(**user.to_dict())


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Get user by ID (only current user for now)."""
    if user_id != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    return UserResponse(**user.to_dict())


@router.post("/", response_model=UserResponse)
async def create_user(
    user_data: UserCreate,
    db: AsyncSession = Depends(get_db)
):
    """Create new user."""
    
    # Check if username already exists
    if user_data.username:
        stmt = select(User).where(User.username == user_data.username)
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
    
    # Create user
    user_dict = user_data.dict(exclude={"password"})
    if user_data.password:
        user_dict["password_hash"] = SecurityUtils.get_password_hash(user_data.password)
    
    user = User(**user_dict)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(**user.to_dict())


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: int,
    user_data: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Update user (only current user for now)."""
    if user_id != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update user fields
    update_data = user_data.dict(exclude_unset=True, exclude={"password"})
    for field, value in update_data.items():
        setattr(user, field, value)
    
    # Handle password separately
    if user_data.password:
        user.password_hash = SecurityUtils.get_password_hash(user_data.password)
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(**user.to_dict())


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(get_current_user)
):
    """Delete user (only current user for now)."""
    if user_id != current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Soft delete by deactivating
    user.is_active = False
    await db.commit()
    
    return {"message": "User deactivated successfully"}


# ========== ADMIN ENDPOINTS ==========

@router.get("/admin/all", response_model=List[UserResponse])
async def get_all_users_admin(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access)
):
    """Get all users (admin only)."""
    
    stmt = select(User).offset(skip).limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()
    
    return [UserResponse(**user.to_dict()) for user in users]


@router.post("/admin", response_model=UserResponse)
async def create_user_admin(
    user_data: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access)
):
    """Create new user (admin only)."""
    
    # Check if username already exists
    if user_data.username:
        stmt = select(User).where(User.username == user_data.username)
        result = await db.execute(stmt)
        existing_user = result.scalar_one_or_none()
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exists"
            )
    
    # Create user
    user_dict = user_data.dict(exclude={"password"})
    if user_data.password:
        user_dict["password_hash"] = SecurityUtils.get_password_hash(user_data.password)
    
    user = User(**user_dict)
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(**user.to_dict())


@router.put("/admin/{user_id}", response_model=UserResponse)
async def update_user_admin(
    user_id: int,
    user_data: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access)
):
    """Update any user (admin only)."""
    
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Update user fields
    update_data = user_data.dict(exclude_unset=True, exclude={"password"})
    for field, value in update_data.items():
        setattr(user, field, value)
    
    # Handle password separately
    if user_data.password:
        user.password_hash = SecurityUtils.get_password_hash(user_data.password)
    
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(**user.to_dict())


@router.patch("/admin/{user_id}/toggle-status", response_model=UserResponse)
async def toggle_user_status_admin(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access)
):
    """Toggle user active status (admin only)."""
    
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Toggle status
    user.is_active = not user.is_active
    await db.commit()
    await db.refresh(user)
    
    return UserResponse(**user.to_dict())


@router.delete("/admin/{user_id}")
async def delete_user_admin(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access)
):
    """Delete user (admin only)."""
    
    # Prevent admin from deleting themselves
    if user_id == current_user["user_id"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить собственную учетную запись"
        )
    
    # Find user to delete
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пользователь не найден"
        )
    
    # Prevent deletion of first user (main admin)
    if user.id == 1:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя удалить основного администратора"
        )
    
    # For now, perform soft delete by deactivating the user
    # In the future, you may want to implement cascade deletion of related data
    # or move user data to an archive table
    user.is_active = False
    user.user_name = f"[УДАЛЕН] {user.user_name}"  # Mark as deleted in name
    
    await db.commit()
    await db.refresh(user)
    
    return {
        "success": True,
        "message": f"Пользователь {user.user_name} успешно удален"
    }


@router.get("/admin/stats")
async def get_users_stats_admin(
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(require_admin_access)
):
    """Get users statistics (admin only)."""
    
    # Count all users
    total_stmt = select(User)
    total_result = await db.execute(total_stmt)
    all_users = total_result.scalars().all()
    
    total = len(all_users)
    active = len([u for u in all_users if u.is_active])
    inactive = total - active
    blocked = 0  # For now, inactive means blocked
    
    return {
        "total": total,
        "active": active,
        "inactive": inactive,
        "blocked": blocked
    }