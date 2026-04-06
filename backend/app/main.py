from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.exceptions import HTTPException, RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from pydantic import ValidationError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from sqlalchemy.exc import SQLAlchemyError

from backend.app.api.health import router as health_router
from backend.app.api.v1.endpoints.budget_ws import (
    set_push_db_session_factory,
    start_ws_cleanup_task,
    stop_ws_cleanup_task,
)
from backend.app.api.v1.router import api_router
from backend.app.api.web.router import web_router
from backend.app.core.config import get_settings
from backend.app.core.exceptions import APIException
from backend.app.core.json_utils import ORJSONResponse, is_orjson_available
from backend.app.core.logging import get_logger, setup_logging
from backend.app.core.paths import FrontendPaths
from backend.app.db.session import close_db, get_session, init_db
from backend.app.middleware import JWTAuthMiddleware, limiter
from backend.app.middleware.csp_middleware import CSPMiddleware
from backend.app.middleware.error_handler import (
    api_exception_handler,
    database_exception_handler,
    generic_exception_handler,
    http_exception_handler,
)
from backend.app.middleware.logging_middleware import LoggingMiddleware
from backend.app.middleware.static_cache_middleware import StaticCacheMiddleware
from backend.app.middleware.validation_error_handler import (
    validation_exception_handler,
    value_error_handler,
)
from backend.app.scheduler import start_scheduler, stop_scheduler
from backend.app.utils.template_filters import register_filters

# Setup structured logging (using settings for level and format)
_settings = get_settings()
setup_logging(level=_settings.LOG_LEVEL, log_format=_settings.LOG_FORMAT)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events.

    Startup:
        - Initialize database connection
        - Auto-fetch bot username if not configured
    Shutdown:
        - Clean up database connections
    """
    # Startup
    logger.info("Application starting up")

    # Log orjson status
    if is_orjson_available():
        logger.info("orjson enabled - high-performance JSON serialization active")
    else:
        logger.warning("orjson not available - using stdlib json (slower)")

    # Initialize database
    await init_db()
    logger.info("Database initialized successfully")

    # Initialize Redis connection pool (optional, used for caching)
    try:
        from backend.app.services.redis_service import init_redis_pool, is_redis_available
        await init_redis_pool()
        if is_redis_available():
            logger.info("Redis connection pool initialized successfully")
        else:
            logger.warning("Redis not configured - caching will be unavailable")
    except Exception as e:
        logger.warning("Failed to initialize Redis: %s - caching will be unavailable", e)

    # Warmup Redis connection (ensure pool is ready before first user request)
    try:
        if is_redis_available():
            from backend.app.services.cache_service import CacheKey, cache_service
            # Simple warmup call to ensure connection is established
            await cache_service.get(CacheKey.quick_stats())
            logger.info("Redis connection warmed up")
    except Exception as e:
        logger.warning("Redis warmup failed (non-critical): %s", e)

    # Initialize Redis WebSocket Pub/Sub (for multi-worker support)
    try:
        from backend.app.services.redis_ws_manager import init_redis_ws
        await init_redis_ws()
        logger.info("Redis WebSocket Pub/Sub initialized (multi-worker support enabled)")
    except Exception as e:
        logger.warning("Failed to initialize Redis WebSocket Pub/Sub: %s - single-worker mode", e)

    # Start Write-Behind worker (optional, enabled via WRITE_BEHIND_ENABLED)
    try:
        from backend.app.services.write_behind_service import start_write_behind_worker
        await start_write_behind_worker()
        # Log message is inside the function (checks if enabled)
    except Exception as e:
        logger.warning("Failed to start Write-Behind worker: %s", e)

    # Initialize push notification session factory (WebSocket)
    set_push_db_session_factory(get_session)
    logger.info("Push notification session factory initialized")

    # Start background scheduler (cron jobs)
    await start_scheduler()
    logger.info("Background scheduler started successfully")

    # Start WebSocket cleanup background task (zombie connection protection)
    start_ws_cleanup_task()
    logger.info("WebSocket cleanup task started successfully")

    # Auto-fetch Telegram bot username if not configured
    if settings.TELEGRAM_BOT_USERNAME is None:
        logger.info("TELEGRAM_BOT_USERNAME not configured, fetching from Telegram API...")
        from backend.app.services.telegram_auth import get_bot_username

        try:
            bot_username = await get_bot_username()
            if bot_username:
                # Update settings with fetched username
                settings.TELEGRAM_BOT_USERNAME = bot_username
                logger.info("Bot username auto-configured: @%s", bot_username)
            else:
                logger.warning(
                    "Failed to auto-fetch bot username. "
                    "Please set TELEGRAM_BOT_USERNAME in .env file for web login to work."
                )
        except Exception as e:
            logger.error("Error fetching bot username: %s", e)
            logger.warning(
                "Please set TELEGRAM_BOT_USERNAME in .env file for web login to work."
            )
    else:
        logger.info("Using configured bot username: @%s", settings.TELEGRAM_BOT_USERNAME)

    yield

    # Shutdown
    logger.info("Application shutting down")

    # Stop WebSocket cleanup background task
    stop_ws_cleanup_task()
    logger.info("WebSocket cleanup task stopped")

    # Stop background scheduler
    await stop_scheduler()
    logger.info("Background scheduler stopped")

    # Stop Write-Behind worker
    try:
        from backend.app.services.write_behind_service import stop_write_behind_worker
        await stop_write_behind_worker()
        # Log message is inside the function
    except Exception as e:
        logger.warning("Error stopping Write-Behind worker: %s", e)

    # Stop Redis WebSocket Pub/Sub
    try:
        from backend.app.services.redis_ws_manager import close_redis_ws
        await close_redis_ws()
        logger.info("Redis WebSocket Pub/Sub stopped")
    except Exception as e:
        logger.warning("Error stopping Redis WebSocket Pub/Sub: %s", e)

    # Close Redis connection pool
    try:
        from backend.app.services.redis_service import close_redis_pool
        await close_redis_pool()
        logger.info("Redis connection pool closed")
    except Exception as e:
        logger.warning("Error closing Redis pool: %s", e)

    await close_db()
    logger.info("Database connections closed")


settings = get_settings()

# OpenAPI Tags Metadata
tags_metadata = [
    {
        "name": "Authentication",
        "description": """
        **Telegram OAuth authentication endpoints.**

        Handles user authentication via Telegram Login Widget with HMAC-SHA256 hash validation.
        JWT tokens are issued as httpOnly cookies for security.

        **Security:** Critical endpoints with hash validation and SCD Type 2 user versioning.
        """,
    },
    {
        "name": "Articles",
        "description": """
        **Budget category management (CRUD operations).**

        Articles represent hierarchical budget categories (income/expense).
        Supports parent-child relationships via closure table for efficient queries.

        **Features:**
        - SCD Type 2 versioning for audit trail
        - User data isolation (users see own + global articles)
        - Admin-only global articles
        - Hierarchy operations (subtree, ancestors, breadcrumbs)
        """,
    },
    {
        "name": "Facts",
        "description": """
        **Budget transaction management (CRUD operations).**

        Facts represent actual income/expense transactions.
        Simple transactional records without SCD Type 2 versioning.

        **Features:**
        - User data isolation
        - Date range filtering for reports
        - Aggregation endpoint for income/expense summaries
        - Validation: no future dates, positive amounts only
        """,
    },
    {
        "name": "Users",
        "description": """
        **User management endpoints (admin-focused).**

        User data comes from Telegram OAuth and cannot be manually edited.
        Admins can promote/demote users via role updates.

        **Features:**
        - SCD Type 2 versioning for role changes
        - Admin-only list all users
        - Regular users can view own profile
        - Role management (promote/demote admins)
        """,
    },
]

# Create FastAPI application
app = FastAPI(
    title="Family Budget API",
    default_response_class=ORJSONResponse,  # High-performance JSON via orjson
    description="""
    **Production-ready REST API for family budget management.**

    ## Features

    - 🔐 **Telegram OAuth Authentication** - Secure login via Telegram Login Widget
    - 📊 **Hierarchical Budget Categories** - Flexible category organization with parent-child relationships
    - 💰 **Transaction Tracking** - Record and manage income/expense transactions
    - 👥 **Multi-User Support** - User data isolation with admin capabilities
    - 📈 **Reporting** - Aggregated summaries and date range filtering
    - 🔄 **Audit Trail** - SCD Type 2 versioning for articles and users
    - 🛡️ **Security** - JWT tokens, httpOnly cookies, HMAC-SHA256 validation
    - 🚀 **Performance** - Efficient hierarchy queries via closure table

    ## Architecture

    - **FastAPI** - Modern async web framework
    - **PostgreSQL** - Reliable ACID-compliant database
    - **SQLModel** - Type-safe ORM with Pydantic integration
    - **JWT** - Stateless authentication with httpOnly cookies
    - **SCD Type 2** - Slowly Changing Dimension pattern for audit trails

    ## Authentication

    All endpoints (except `/health` and `/auth/telegram`) require authentication via JWT token in cookie.
    Use `/auth/telegram` endpoint to obtain access token.
    """,
    version="4.0.0",
    lifespan=lifespan,
    tags_metadata=tags_metadata,
    contact={
        "name": "Family Budget API Support",
        "url": "https://github.com/yourusername/familyBudget",
        "email": "support@familybudget.example.com",
    },
    license_info={
        "name": "MIT License",
        "url": "https://opensource.org/licenses/MIT",
    },
    openapi_tags=tags_metadata,
)

# Rate limiter setup (must be set before adding exception handler)
# Attach limiter to app.state for use in endpoint decorators
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files cache middleware (Cache-Control headers for versioned assets)
app.add_middleware(StaticCacheMiddleware)

# Security middleware (CSP, XSS protection, etc.)
app.add_middleware(CSPMiddleware)

# Logging middleware (before JWT for request tracing)
app.add_middleware(LoggingMiddleware)

# JWT Authentication middleware
app.add_middleware(JWTAuthMiddleware)

# Exception handlers (order matters: specific before generic)
# 1. Validation errors (most specific)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(ValidationError, validation_exception_handler)

# 2. Custom API exceptions
app.add_exception_handler(APIException, api_exception_handler)

# 3. FastAPI HTTP exceptions
app.add_exception_handler(HTTPException, http_exception_handler)

# 4. Database exceptions
app.add_exception_handler(SQLAlchemyError, database_exception_handler)

# 5. Generic value errors
app.add_exception_handler(ValueError, value_error_handler)

# 6. Catch-all for any unhandled exceptions (most generic)
app.add_exception_handler(Exception, generic_exception_handler)


# Configure static files and templates using centralized paths
# Mount static files
app.mount("/static", StaticFiles(directory=str(FrontendPaths.WEB_STATIC)), name="static")

# Mount webapp files (Telegram Web Apps)
# Serves HTML, JS, CSS for Web Apps at /webapp/*
app.mount("/webapp", StaticFiles(directory=str(FrontendPaths.WEBAPP), html=True), name="webapp")

# Mount shared files (Common JS/CSS modules for web and webapp)
app.mount("/shared", StaticFiles(directory=str(FrontendPaths.SHARED)), name="shared")

# Setup Jinja2 templates
templates = Jinja2Templates(directory=str(FrontendPaths.WEB_TEMPLATES))

# Register custom Jinja2 filters for HTMX partials
register_filters(templates.env)

# Add config as global template variable (for feature flags)
templates.env.globals["config"] = get_settings()

# PWA endpoints (must be before web_router to avoid being caught by catch-all routes)
# Support both GET and HEAD methods - browsers use HEAD to check for Service Worker updates
@app.api_route("/sw.min.js", methods=["GET", "HEAD"], include_in_schema=False)
async def service_worker():
    """
    Serve minified Service Worker for PWA (v6.8.0+)

    CRITICAL: Service Worker must NEVER be cached by browser
    - Cache-Control: no-cache forces revalidation on every request
    - ETag: enables browser to detect file changes (304 Not Modified)
    - Service Worker update detection depends on file content changes

    Architecture: nginx proxies /sw.min.js to this backend endpoint
    - No static file serving in nginx (avoids Docker bind mount inode issues)
    - Backend reads directly from /app/sw.min.js volume mount
    - Auto-updates after deployment without container restart
    """
    from fastapi.responses import FileResponse

    sw_path = Path("/app/sw.min.js")
    if not sw_path.exists():
        raise HTTPException(status_code=404, detail="Service Worker not found")

    return FileResponse(
        str(sw_path),
        media_type="application/javascript; charset=utf-8",
        headers={
            # CRITICAL: Never cache Service Worker
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",  # HTTP/1.0 compatibility
            "Service-Worker-Allowed": "/",
            "Access-Control-Allow-Origin": "*"
        }
        # ETag automatically added by FileResponse based on file mtime
    )

@app.api_route("/manifest.json", methods=["GET", "HEAD"], include_in_schema=False)
async def pwa_manifest():
    """Serve PWA Manifest"""
    from fastapi.responses import FileResponse

    manifest_path = Path("/app/manifest.json")
    if not manifest_path.exists():
        raise HTTPException(status_code=404, detail="Manifest not found")

    return FileResponse(
        str(manifest_path),
        media_type="application/manifest+json",
        headers={"Cache-Control": "public, max-age=604800"}  # 7 days
    )

# Include routers
app.include_router(health_router)  # Health endpoints at /health, /ready, /ping
app.include_router(api_router)  # API endpoints at /api/v1
app.include_router(web_router)  # Web pages at /
