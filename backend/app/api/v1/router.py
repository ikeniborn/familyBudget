"""
API v1 main router.

This module aggregates all v1 API endpoints and provides a single router
to be included in the main FastAPI application.
"""
from fastapi import APIRouter

from backend.app.api.v1.admin import router as admin_router
from backend.app.api.v1.admin_analytics import router as admin_analytics_router
from backend.app.api.v1.admin_export import router as admin_export_router
from backend.app.api.v1.admin_staging import router as admin_staging_router
from backend.app.api.v1.analytics import router as analytics_router
from backend.app.api.v1.endpoints import (
    articles_router,
    auth_router,
    budget_ws_router,
    cache_metrics_router,
    consent_router,
    cost_centers_router,
    facts_partials_router,
    facts_router,
    financial_centers_router,
    google_sheets_import_router,
    import_router,
    import_templates_router,
    notifications_router,
    product_groups_router,
    push_router,
    recurring_plans_router,
    reminders_router,
    shopping_csv_import_router,
    shopping_list_items_router,
    shopping_lists_router,
    staging_router,
    stores_router,
    sync_router,
    transfers_router,
    users_router,
    webauthn_router,
)
from backend.app.api.v1.endpoints.admin_logs import router as admin_logs_router
from backend.app.api.v1.export import router as export_router
from backend.app.api.v1.webapp import router as webapp_router

api_router = APIRouter(prefix="/api/v1")

# Authentication endpoints (TASK-012) ✅
api_router.include_router(auth_router)

# WebAuthn Biometric Authentication endpoints (v6.5.0+) ✅
api_router.include_router(webauthn_router)

# Web Apps endpoints (Telegram Web Apps Migration) ✅
api_router.include_router(webapp_router)

# Articles endpoints (TASK-015) ✅
api_router.include_router(articles_router)

# Financial Centers endpoints (TASK-007) ✅
api_router.include_router(financial_centers_router)

# Cost Centers endpoints (TASK-007) ✅
api_router.include_router(cost_centers_router)

# Facts HTMX Partials endpoints (Phase 2: Server-side rendering) ✅
# ВАЖНО: Partials должны быть ПЕРЕД основным facts router,
# иначе /{fact_id} перехватывает /table, /stats, /pagination
api_router.include_router(facts_partials_router)

# Facts endpoints (TASK-016) ✅
api_router.include_router(facts_router)

# Users endpoints (TASK-017) ✅
api_router.include_router(users_router)

# Notifications endpoints (broadcast support) ✅
api_router.include_router(notifications_router)

# Analytics endpoints (TASK-040) ✅
api_router.include_router(analytics_router)

# Admin endpoints (TASK-048) ✅
api_router.include_router(admin_router)

# Admin Logs endpoints (System Logs Viewer) ✅
api_router.include_router(admin_logs_router, prefix="/admin/logs", tags=["admin-logs"])

# Admin Staging endpoints (FR-080 Enhanced - Multi-Bank CSV Import) ✅
api_router.include_router(admin_staging_router)

# Admin Analytics endpoints (TASK-021) ✅
api_router.include_router(admin_analytics_router)

# Export endpoints (TASK-022) ✅
api_router.include_router(export_router)

# Admin Export endpoints (TASK-022 Enhanced) ✅
api_router.include_router(admin_export_router)

# Import endpoints (FR-080 Enhanced - Multi-Bank CSV Import) ✅
api_router.include_router(import_router)

# User Staging endpoints (FR-080 - User-level staging access) ✅
api_router.include_router(staging_router)

# Transfers endpoints (Transfer Feature) ✅
api_router.include_router(transfers_router)

# Push Notification endpoints (PWA Offline Mode) ✅
api_router.include_router(push_router)

# User Consent endpoints (GDPR Compliance) ✅
api_router.include_router(consent_router)

# Scheduled Reminders endpoints (Plan Reminders Feature) ✅
api_router.include_router(reminders_router)

# Recurring Plans endpoints (Recurring Payments Feature) ✅
api_router.include_router(recurring_plans_router)

# Stores endpoints (Shopping Lists Feature) ✅
api_router.include_router(stores_router)

# Product Groups endpoints (Shopping Lists Feature) ✅
api_router.include_router(product_groups_router)

# Shopping Lists endpoints (Shopping Lists Feature) ✅
api_router.include_router(shopping_lists_router)

# Shopping List Items endpoints (Shopping Lists Feature) ✅
api_router.include_router(shopping_list_items_router)

# Shopping Lists CSV Import endpoints (Shopping Lists Feature) ✅
api_router.include_router(shopping_csv_import_router)

# Google Sheets Import endpoints (Shopping Lists Feature) ✅
api_router.include_router(google_sheets_import_router)

# Import Templates endpoints (Shopping Lists Feature) ✅
api_router.include_router(import_templates_router)

# Sync endpoints (PGlite Offline-First - task-012) ✅
api_router.include_router(sync_router)

# Budget WebSocket endpoints (Real-time Updates with Long Polling fallback) ✅
# Primary: WebSocket (bidirectional, no buffering)
# Fallback: Long Polling (10 sec interval)
api_router.include_router(budget_ws_router)

# Cache Metrics endpoints (Admin Monitoring - Client-Side Cache) ✅
api_router.include_router(cache_metrics_router)
