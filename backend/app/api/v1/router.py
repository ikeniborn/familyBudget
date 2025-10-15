"""
API v1 main router.

This module aggregates all v1 API endpoints and provides a single router
to be included in the main FastAPI application.
"""
from fastapi import APIRouter

from backend.app.api.v1.admin import router as admin_router
from backend.app.api.v1.admin_analytics import router as admin_analytics_router
from backend.app.api.v1.admin_export import router as admin_export_router
from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.endpoints import (
    articles_router,
    auth_router,
    cost_centers_router,
    facts_router,
    financial_centers_router,
    users_router,
)
from backend.app.api.v1.export import router as export_router

api_router = APIRouter(prefix="/api/v1")

# Authentication endpoints (TASK-012) ✅
api_router.include_router(auth_router)

# Articles endpoints (TASK-015) ✅
api_router.include_router(articles_router)

# Financial Centers endpoints (TASK-007) ✅
api_router.include_router(financial_centers_router)

# Cost Centers endpoints (TASK-007) ✅
api_router.include_router(cost_centers_router)

# Facts endpoints (TASK-016) ✅
api_router.include_router(facts_router)

# Users endpoints (TASK-017) ✅
api_router.include_router(users_router)

# Analytics endpoints (TASK-040) ✅
api_router.include_router(analytics_router)

# Admin endpoints (TASK-048) ✅
api_router.include_router(admin_router)

# Admin Analytics endpoints (TASK-021) ✅
api_router.include_router(admin_analytics_router)

# Export endpoints (TASK-022) ✅
api_router.include_router(export_router)

# Admin Export endpoints (TASK-022 Enhanced) ✅
api_router.include_router(admin_export_router)
