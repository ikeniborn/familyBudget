"""
Authentication endpoints.
"""
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.database import get_db
from app.models.user import User
from app.core.security import SecurityUtils
from app.core.session import get_current_user_from_session, logout_user
from app.core.config import settings

router = APIRouter()


class LoginRequest(BaseModel):
    """Password login request."""
    username: str
    password: str


class RegisterRequest(BaseModel):
    """User registration request."""
    username: str
    password: str
    user_name: str
    email: Optional[str] = None


class TelegramAuthRequest(BaseModel):
    """Telegram authentication request."""
    id: int
    first_name: str
    last_name: Optional[str] = None
    username: Optional[str] = None
    photo_url: Optional[str] = None
    auth_date: int
    hash: str


class AuthResponse(BaseModel):
    """Authentication response."""
    user: dict
    message: str


@router.post("/register", response_model=AuthResponse)
async def register_user(
    request: Request,
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db)
):
    """Register a new user with username/password."""
    
    # Check if user already exists
    stmt = select(User).where(User.username == register_data.username)
    result = await db.execute(stmt)
    existing_user = result.scalar_one_or_none()
    
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Create new user
    password_hash = SecurityUtils.get_password_hash(register_data.password)
    user = User(
        username=register_data.username,
        user_name=register_data.user_name,
        user_email=register_data.email,
        password_hash=password_hash,
        auth_method="password",
        is_active=True
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    
    # Create session
    session = request.state.session
    session.set("user_id", user.id)
    session.set("username", user.username)
    session.set("user_name", user.user_name)
    session.set("auth_method", "password")
    session.set("role", user.role)
    
    return AuthResponse(
        user=user.to_dict(),
        message="User registered successfully"
    )


@router.post("/login", response_model=AuthResponse)
async def login_with_password(
    request: Request,
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user with username/password."""
    
    # Find user by username
    stmt = select(User).where(User.username == login_data.username)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    # Verify password
    if not user.password_hash or not SecurityUtils.verify_password(login_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid username or password"
        )
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )
    
    # Create session
    session = request.state.session
    session.set("user_id", user.id)
    session.set("username", user.username)
    session.set("user_name", user.user_name)
    session.set("auth_method", "password")
    session.set("role", user.role)
    
    return AuthResponse(
        user=user.to_dict(),
        message="Logged in successfully"
    )


@router.post("/telegram", response_model=AuthResponse)
async def login_with_telegram(
    request: Request,
    auth_data: TelegramAuthRequest,
    db: AsyncSession = Depends(get_db)
):
    """Authenticate user with Telegram."""
    
    # Verify Telegram authentication
    auth_dict = auth_data.dict()
    if not SecurityUtils.verify_telegram_auth(auth_dict, settings.TELEGRAM_BOT_TOKEN):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram authentication"
        )
    
    telegram_id = auth_data.id
    
    # Find or create user
    stmt = select(User).where(User.telegram_id == telegram_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        # Create new user
        user_name = f"{auth_data.first_name}"
        if auth_data.last_name:
            user_name += f" {auth_data.last_name}"
        
        user = User(
            user_name=user_name,
            username=auth_data.username,
            telegram_id=telegram_id,
            auth_method="telegram",
            is_active=True
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update user info
        user.user_name = f"{auth_data.first_name}"
        if auth_data.last_name:
            user.user_name += f" {auth_data.last_name}"
        user.username = auth_data.username
        await db.commit()
    
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account is disabled"
        )
    
    # Create session
    session = request.state.session
    session.set("user_id", user.id)
    session.set("username", user.username)
    session.set("user_name", user.user_name)
    session.set("auth_method", "telegram")
    session.set("telegram_id", str(user.telegram_id) if user.telegram_id else None)
    session.set("role", user.role)
    
    return AuthResponse(
        user=user.to_dict(),
        message="Logged in successfully"
    )


@router.post("/logout")
async def logout(request: Request):
    """Log out current user."""
    await logout_user(request)
    return {"message": "Logged out successfully"}


@router.get("/me")
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    """Get current authenticated user."""
    user_session = await get_current_user_from_session(request)
    if not user_session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Get full user data from database
    stmt = select(User).where(User.id == user_session["user_id"])
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return {
        "success": True,
        "user": user.to_dict(),
        "authenticated": True
    }


@router.get("/status")
async def auth_status(request: Request):
    """Check authentication status."""
    user = await get_current_user_from_session(request)
    
    return {
        "authenticated": user is not None,
        "user": user
    }


@router.get("/password-auth-enabled")
async def password_auth_enabled():
    """Check if password authentication is enabled."""
    return {"enabled": settings.PASSWORD_AUTH_ENABLED}