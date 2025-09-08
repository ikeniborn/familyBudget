"""
Main API router for v1 endpoints.
"""
from fastapi import APIRouter

from app.api.v1.endpoints import (
    auth,
    periods,
    financial_centers,
    cost_centers,
    nomenclatures,
    registry,
    products,
    reports,
    users,
    admin,
    sharing
)

# Main API router
api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(users.router, prefix="/users", tags=["Users"]) 
api_router.include_router(periods.router, prefix="/periods", tags=["Periods"])
api_router.include_router(financial_centers.router, prefix="/financial_centers", tags=["Financial Centers"])
api_router.include_router(cost_centers.router, prefix="/cost_centers", tags=["Cost Centers"])
api_router.include_router(nomenclatures.router, prefix="/nomenclatures", tags=["Nomenclatures"])
api_router.include_router(registry.router, prefix="/registry", tags=["Registry"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(reports.router, prefix="/reports", tags=["Reports"])
api_router.include_router(admin.router, prefix="/admin", tags=["Admin"])
api_router.include_router(sharing.router, prefix="/sharing", tags=["Sharing"])