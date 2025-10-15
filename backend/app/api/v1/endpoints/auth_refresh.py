"""
JWT Refresh Token endpoint - TASK-020
"""
from fastapi import APIRouter, Depends, HTTPException, Cookie
from sqlmodel.ext.asyncio.session import AsyncSession
from backend.app.core.dependencies import get_session
from backend.app.services.jwt import create_access_token, verify_refresh_token
from backend.app.models.refresh_token import RefreshToken
from sqlmodel import select
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/refresh")
async def refresh_access_token(
    refresh_token: str = Cookie(None, alias="refresh_token"),
    session: AsyncSession = Depends(get_session)
):
    """Refresh access token using refresh token."""
    if not refresh_token:
        raise HTTPException(401, "Refresh token missing")
    
    # Verify refresh token
    payload = verify_refresh_token(refresh_token)
    if not payload:
        raise HTTPException(401, "Invalid refresh token")
    
    user_id = payload.get("user_id")
    
    # Check if token exists in database
    query = select(RefreshToken).where(
        RefreshToken.token == refresh_token,
        RefreshToken.is_revoked == False,
        RefreshToken.expires_at > datetime.utcnow()
    )
    result = await session.execute(query)
    db_token = result.scalar_one_or_none()
    
    if not db_token:
        raise HTTPException(401, "Refresh token expired or revoked")
    
    # Create new access token
    new_access_token = create_access_token({"user_id": user_id})
    
    return {
        "access_token": new_access_token,
        "token_type": "bearer",
        "expires_in": 3600
    }
