"""
API v1 main router.

This module aggregates all v1 API endpoints and provides a single router
to be included in the main FastAPI application.
"""
from fastapi import APIRouter

from backend.app.api.v1.endpoints import auth_router

api_router = APIRouter()

# Authentication endpoints (TASK-012) ✅
api_router.include_router(auth_router)

# Facts endpoints (TASK-016)
# from backend.app.api.v1 import facts
# api_router.include_router(facts.router, prefix="/facts", tags=["Facts"])

# Articles endpoints (TASK-015)
# from backend.app.api.v1 import articles
# api_router.include_router(articles.router, prefix="/articles", tags=["Articles"])

# Users endpoints (TASK-017)
# from backend.app.api.v1 import users
# api_router.include_router(users.router, prefix="/users", tags=["Users"])
