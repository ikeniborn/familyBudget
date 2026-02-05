"""
FastAPI dependency injection functions.

These dependencies will be used throughout the application for:
- Database session management
- User authentication and authorization
- Configuration access
"""

# Authentication dependencies (TASK-014)
from backend.app.core.auth import (
    CurrentAdmin,
    CurrentUser,
    CurrentUserOptional,
    get_current_admin,
    get_current_user,
    get_current_user_optional,
)
from backend.app.core.config import get_settings

# Internal API authentication
from backend.app.core.internal_auth import (
    InternalAPIKey,
    verify_internal_api_key,
)

# User isolation helpers (TASK-014)
from backend.app.core.user_isolation import (
    apply_user_filter,
    can_access_resource,
    ensure_user_owns_resource,
    get_user_id_for_create,
)
from backend.app.db.session import get_session

# Cache Metrics Service (Admin Monitoring)
from backend.app.services.cache_metrics_service import CacheMetricsService

_cache_metrics_service: CacheMetricsService | None = None


def get_cache_metrics_service() -> CacheMetricsService:
    """
    Get or create singleton CacheMetricsService instance.

    Returns:
        CacheMetricsService: Singleton service instance

    Thread Safety:
        Safe for concurrent access (service handles locking internally)
    """
    global _cache_metrics_service
    if _cache_metrics_service is None:
        _cache_metrics_service = CacheMetricsService()
    return _cache_metrics_service


__all__ = [
    # Configuration
    "get_settings",
    # Database
    "get_session",
    # Authentication
    "get_current_user",
    "get_current_user_optional",
    "get_current_admin",
    "CurrentUser",
    "CurrentUserOptional",
    "CurrentAdmin",
    # Internal API
    "InternalAPIKey",
    "verify_internal_api_key",
    # User isolation
    "apply_user_filter",
    "can_access_resource",
    "ensure_user_owns_resource",
    "get_user_id_for_create",
    # Cache Metrics
    "get_cache_metrics_service",
]
