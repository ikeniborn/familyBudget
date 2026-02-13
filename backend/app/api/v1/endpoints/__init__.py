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
- stores: Stores CRUD endpoints (Shopping Lists Feature)
- product_groups: ProductGroups CRUD endpoints with hierarchy (Shopping Lists Feature)
- shopping_lists: ShoppingLists CRUD endpoints (Shopping Lists Feature)
- shopping_list_items: ShoppingListItems CRUD endpoints with batch ops (Shopping Lists Feature)
- shopping_csv_import: Shopping Lists CSV import endpoints (Shopping Lists Feature)
- import_templates: Import templates CRUD endpoints (Shopping Lists Feature)
"""

from backend.app.api.v1.endpoints.articles import router as articles_router
from backend.app.api.v1.endpoints.auth import router as auth_router
from backend.app.api.v1.endpoints.budget_ws import router as budget_ws_router
from backend.app.api.v1.endpoints.cache_metrics import router as cache_metrics_router
from backend.app.api.v1.endpoints.consent import router as consent_router
from backend.app.api.v1.endpoints.cost_centers import router as cost_centers_router
from backend.app.api.v1.endpoints.facts import router as facts_router
from backend.app.api.v1.endpoints.facts_partials import router as facts_partials_router
from backend.app.api.v1.endpoints.financial_centers import (
    router as financial_centers_router,
)
from backend.app.api.v1.endpoints.google_sheets_import import router as google_sheets_import_router
from backend.app.api.v1.endpoints.import_endpoints import router as import_router
from backend.app.api.v1.endpoints.import_templates import router as import_templates_router
from backend.app.api.v1.endpoints.notifications import (
    router as notifications_router,
)
from backend.app.api.v1.endpoints.product_groups import (
    router as product_groups_router,
)
from backend.app.api.v1.endpoints.push import router as push_router
from backend.app.api.v1.endpoints.recurring_plans import router as recurring_plans_router
from backend.app.api.v1.endpoints.reminders import router as reminders_router
from backend.app.api.v1.endpoints.shopping_csv_import import router as shopping_csv_import_router
from backend.app.api.v1.endpoints.shopping_list_items import (
    router as shopping_list_items_router,
)
from backend.app.api.v1.endpoints.shopping_lists import (
    router as shopping_lists_router,
)
from backend.app.api.v1.endpoints.staging import router as staging_router
from backend.app.api.v1.endpoints.stores import router as stores_router
from backend.app.api.v1.endpoints.sync import router as sync_router
from backend.app.api.v1.endpoints.transfers import router as transfers_router
from backend.app.api.v1.endpoints.users import router as users_router
from backend.app.api.v1.endpoints.webauthn import router as webauthn_router

__all__ = [
    "auth_router",
    "articles_router",
    "budget_ws_router",
    "cache_metrics_router",
    "consent_router",
    "cost_centers_router",
    "facts_router",
    "facts_partials_router",
    "financial_centers_router",
    "google_sheets_import_router",
    "import_router",
    "import_templates_router",
    "notifications_router",
    "product_groups_router",
    "push_router",
    "recurring_plans_router",
    "reminders_router",
    "shopping_csv_import_router",
    "shopping_list_items_router",
    "shopping_lists_router",
    "staging_router",
    "stores_router",
    "sync_router",
    "transfers_router",
    "users_router",
    "webauthn_router",
]
