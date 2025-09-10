"""
Session management using Redis.
"""
import json
import uuid
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware
import redis.asyncio as redis

from app.core.config import settings


class SessionData:
    """Session data container."""
    
    def __init__(self, data: Dict[str, Any] = None):
        self.data = data or {}
    
    def get(self, key: str, default=None):
        return self.data.get(key, default)
    
    def set(self, key: str, value: Any):
        self.data[key] = value
    
    def delete(self, key: str):
        self.data.pop(key, None)
    
    def clear(self):
        self.data.clear()
    
    def to_dict(self) -> Dict[str, Any]:
        return self.data.copy()


class SessionStore:
    """Redis-based session store."""
    
    def __init__(self):
        self.redis: Optional[redis.Redis] = None
    
    async def init_redis(self, redis_client: redis.Redis):
        """Initialize Redis client."""
        self.redis = redis_client
    
    async def get_session(self, session_id: str) -> Optional[SessionData]:
        """Get session data from Redis."""
        if not self.redis:
            return None
        
        try:
            # Try express-session format first (used by SvelteKit)
            data = await self.redis.get(f"sess:{session_id}")
            if data:
                session_dict = json.loads(data)
                # Express-session format has nested user object
                if "user" in session_dict:
                    return SessionData(session_dict["user"])
                return SessionData(session_dict)
            
            # Fallback to old format
            data = await self.redis.get(f"session:{session_id}")
            if data:
                session_dict = json.loads(data)
                return SessionData(session_dict)
        except Exception as e:
            print(f"Session get error: {e}")
        
        return None
    
    async def save_session(self, session_id: str, session_data: SessionData):
        """Save session data to Redis."""
        if not self.redis:
            return
        
        try:
            # Save in express-session format for compatibility with SvelteKit
            session_obj = {
                "cookie": {
                    "originalMaxAge": settings.SESSION_EXPIRE_SECONDS * 1000,
                    "expires": (datetime.utcnow() + timedelta(seconds=settings.SESSION_EXPIRE_SECONDS)).isoformat(),
                    "secure": settings.ENVIRONMENT == "production",
                    "httpOnly": True,
                    "path": "/",
                    "sameSite": "lax"
                },
                "user": session_data.to_dict()
            }
            data = json.dumps(session_obj, default=str)
            await self.redis.setex(
                f"sess:{session_id}",
                settings.SESSION_EXPIRE_SECONDS,
                data
            )
        except Exception as e:
            print(f"Session save error: {e}")
    
    async def delete_session(self, session_id: str):
        """Delete session from Redis."""
        if not self.redis:
            return
        
        try:
            # Delete both formats
            await self.redis.delete(f"sess:{session_id}")
            await self.redis.delete(f"session:{session_id}")
        except Exception as e:
            print(f"Session delete error: {e}")


# Global session store instance
session_store = SessionStore()


class SessionMiddleware(BaseHTTPMiddleware):
    """Session middleware for FastAPI."""
    
    async def dispatch(self, request: Request, call_next):
        # Initialize Redis connection if not done
        if not session_store.redis and hasattr(request.app.state, "redis"):
            await session_store.init_redis(request.app.state.redis)
        
        # Get session ID from cookie
        session_id = request.cookies.get(settings.SESSION_COOKIE_NAME)
        
        # Load or create session
        if session_id:
            session_data = await session_store.get_session(session_id)
            if not session_data:
                session_id = generate_session_id()
                session_data = SessionData()
        else:
            session_id = generate_session_id()
            session_data = SessionData()
        
        # Attach session to request
        request.state.session = session_data
        request.state.session_id = session_id
        
        # Process request
        response = await call_next(request)
        
        # Save session and set cookie
        await session_store.save_session(session_id, session_data)
        
        # Set session cookie
        response.set_cookie(
            key=settings.SESSION_COOKIE_NAME,
            value=session_id,
            max_age=settings.SESSION_EXPIRE_SECONDS,
            httponly=True,
            secure=settings.ENVIRONMENT == "production",
            samesite="lax"
        )
        
        return response


def generate_session_id() -> str:
    """Generate a new session ID."""
    return str(uuid.uuid4())


async def get_current_user_from_session(request: Request) -> Optional[dict]:
    """Get current user from session."""
    session = getattr(request.state, "session", None)
    if not session:
        return None
    
    # Support both old format and express-session format
    user_id = session.get("user_id") or session.get("id")
    if not user_id:
        return None
    
    return {
        "user_id": user_id,
        "username": session.get("username"),
        "user_name": session.get("user_name") or session.get("name"),
        "auth_method": session.get("auth_method"),
        "telegram_id": session.get("telegram_id"),
        "role": session.get("role"),
    }


async def logout_user(request: Request) -> None:
    """Log out user by clearing session."""
    session = getattr(request.state, "session", None)
    if session:
        session.clear()
    
    session_id = getattr(request.state, "session_id", None)
    if session_id:
        await session_store.delete_session(session_id)