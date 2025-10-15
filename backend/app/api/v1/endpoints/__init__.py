"""
API v1 endpoints package.

This package contains all API endpoint routers organized by domain:
- auth: Authentication endpoints (Telegram OAuth, JWT)
- articles: Articles/categories CRUD endpoints (TASK-015)
- financial_centers: Financial centers CRUD endpoints (TASK-007)
- cost_centers: Cost centers CRUD endpoints (TASK-007)
- facts: Budget facts CRUD endpoints (TASK-016)
- users: User management endpoints (TASK-017)
"""

from backend.app.api.v1.endpoints.articles import router as articles_router
from backend.app.api.v1.endpoints.auth import router as auth_router
from backend.app.api.v1.endpoints.cost_centers import router as cost_centers_router
from backend.app.api.v1.endpoints.facts import router as facts_router
from backend.app.api.v1.endpoints.financial_centers import (
    router as financial_centers_router,
)
from backend.app.api.v1.endpoints.users import router as users_router

__all__ = [
    "auth_router",
    "articles_router",
    "financial_centers_router",
    "cost_centers_router",
    "facts_router",
    "users_router",
]
