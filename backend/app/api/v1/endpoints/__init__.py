"""
API v1 endpoints package.

This package contains all API endpoint routers organized by domain:
- auth: Authentication endpoints (Telegram OAuth, JWT)
- articles: Articles/categories CRUD endpoints (TASK-015)
- financial_centers: Financial centers CRUD endpoints (TASK-007)
- cost_centers: Cost centers CRUD endpoints (TASK-007)
- facts: Budget facts CRUD endpoints (TASK-016)
- users: User management endpoints (TASK-017)
- notifications: Notification history endpoints (broadcast support)
- import_endpoints: Multi-bank CSV import endpoints (FR-080 Enhanced)
- transfers: Transfer between financial centers endpoints
- push: Push notification endpoints (PWA offline mode)
- consent: User consent endpoints (GDPR compliance)
"""

from backend.app.api.v1.endpoints.articles import router as articles_router
from backend.app.api.v1.endpoints.auth import router as auth_router
from backend.app.api.v1.endpoints.consent import router as consent_router
from backend.app.api.v1.endpoints.cost_centers import router as cost_centers_router
from backend.app.api.v1.endpoints.facts import router as facts_router
from backend.app.api.v1.endpoints.financial_centers import (
    router as financial_centers_router,
)
from backend.app.api.v1.endpoints.import_endpoints import router as import_router
from backend.app.api.v1.endpoints.notifications import (
    router as notifications_router,
)
from backend.app.api.v1.endpoints.push import router as push_router
from backend.app.api.v1.endpoints.transfers import router as transfers_router
from backend.app.api.v1.endpoints.users import router as users_router

__all__ = [
    "auth_router",
    "articles_router",
    "consent_router",
    "financial_centers_router",
    "cost_centers_router",
    "facts_router",
    "users_router",
    "notifications_router",
    "import_router",
    "transfers_router",
    "push_router",
]
