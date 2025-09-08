"""
Common dependencies for API endpoints.
"""
from typing import Generator, Optional
from fastapi import Depends, HTTPException, status, Request
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.core.session import get_current_user_from_session


def get_db() -> Generator:
    """Get database session."""
    try:
        db = SessionLocal()
        yield db
    finally:
        db.close()


async def get_current_user(request: Request) -> dict:
    """Get current authenticated user."""
    current_user = await get_current_user_from_session(request)
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    return current_user


async def get_current_active_user(request: Request) -> dict:
    """Get current active authenticated user."""
    current_user = await get_current_user(request)
    # Add additional checks if needed (e.g., is_active)
    return current_user