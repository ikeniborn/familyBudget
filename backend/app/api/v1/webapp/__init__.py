"""
Web Apps API Router.

This module provides dedicated endpoints for Telegram Web Apps.

Features:
    - initData validation (Telegram's secure authentication method for Web Apps)
    - Statistics endpoints for charts and summaries (Phase 2+)

Note:
    - Facts and Articles use existing /api/v1/facts and /api/v1/articles endpoints
    - No duplication of CRUD logic - Web Apps use same endpoints as Web UI
    - JWT Bearer token authentication supported by JWTAuthMiddleware

Authentication:
    - POST /api/v1/webapp/validate - Returns JWT token from initData
    - All other endpoints use existing /api/v1/* with Bearer token
"""

from fastapi import APIRouter

from backend.app.api.v1.webapp import stats, validate

# Create webapp router
router = APIRouter(prefix="/webapp", tags=["Web Apps"])

# Include sub-routers
router.include_router(validate.router)  # /api/v1/webapp/validate (unique for Web Apps)
router.include_router(stats.router)  # /api/v1/webapp/stats (Phase 2+)

__all__ = ["router"]
