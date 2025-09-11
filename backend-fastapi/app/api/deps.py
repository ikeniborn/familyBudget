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
    # Debug logging to understand the session issue
    import logging
    logger = logging.getLogger(__name__)
    
    # Check if session exists in request.state
    if not hasattr(request.state, 'session'):
        logger.error("No session found in request.state")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session not initialized"
        )
    
    # Get user from session
    current_user = await get_current_user_from_session(request)
    
    if not current_user:
        logger.error("No user found in session")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    # Ensure user_id is present
    if 'user_id' not in current_user or current_user['user_id'] is None:
        logger.error(f"Invalid user session data: {current_user}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid session data"
        )
    
    return current_user


async def get_current_active_user(request: Request) -> dict:
    """Get current active authenticated user."""
    current_user = await get_current_user(request)
    # Add additional checks if needed (e.g., is_active)
    return current_user


# Alias for backward compatibility
require_auth = get_current_user