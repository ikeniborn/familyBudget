"""
API v1 main router.

This module aggregates all v1 API endpoints and provides a single router
to be included in the main FastAPI application.
"""
from fastapi import APIRouter

from backend.app.api.v1.endpoints import (
    articles_router,
    auth_router,
    facts_router,
    users_router,
)

api_router = APIRouter()

# Authentication endpoints (TASK-012) ✅
api_router.include_router(auth_router)

# Articles endpoints (TASK-015) ✅
api_router.include_router(articles_router)

# Facts endpoints (TASK-016) ✅
api_router.include_router(facts_router)

# Users endpoints (TASK-017) ✅
api_router.include_router(users_router)
