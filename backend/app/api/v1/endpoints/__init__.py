"""
API v1 endpoints package.

This package contains all API endpoint routers organized by domain:
- auth: Authentication endpoints (Telegram OAuth, JWT)
- facts: Budget facts CRUD endpoints
- articles: Articles/categories CRUD endpoints
- users: User management endpoints
"""

from backend.app.api.v1.endpoints.auth import router as auth_router

__all__ = [
    "auth_router",
]
