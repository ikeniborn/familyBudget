"""
Admin Logs API Endpoints

Endpoints:
- GET /api/v1/admin/logs - Retrieve filtered logs from all services (admin-only)
- POST /api/v1/admin/logs/browser - Receive browser logs from clients (all users)

Author: Claude Code
Date: 2025-12-27
"""

from datetime import datetime
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.util import get_remote_address

from backend.app.core.auth import CurrentAdmin, CurrentUser
from backend.app.core.logging import get_logger
from backend.app.services.logs_collector_service import LogsCollectorService
from backend.app.utils.timezone import get_system_timezone

logger = get_logger(__name__)

# Rate limiter
limiter = Limiter(key_func=get_remote_address)

router = APIRouter()


# ========== Pydantic Schemas ==========

class LogEntry(BaseModel):
    """Single log entry."""
    timestamp: str | None = Field(None, description="ISO 8601 timestamp")
    level: str = Field(..., description="Log level: info, warning, error")
    message: str = Field(..., description="Log message")
    module: str = Field(..., description="Module or service name")
    correlation_id: str | None = Field(None, description="Request correlation ID")
    user_id: int | None = Field(None, description="User ID (browser logs only)")


class LogsResponse(BaseModel):
    """Response with logs from all services."""
    browser: list[LogEntry] = Field(default_factory=list)
    backend: list[LogEntry] = Field(default_factory=list)
    bot: list[LogEntry] = Field(default_factory=list)
    postgres: list[LogEntry] = Field(default_factory=list)
    nginx: list[LogEntry] = Field(default_factory=list)
    total_count: int = Field(..., description="Total logs before filtering")
    filtered_count: int = Field(..., description="Total logs after filtering")
    filters_applied: dict[str, Any] = Field(..., description="Filters that were applied")


class BrowserLogBatch(BaseModel):
    """Batch of browser logs from client."""
    logs: list[LogEntry] = Field(..., description="Array of log entries")
    user_id: int = Field(..., description="User ID sending logs")
    session_id: str = Field(..., description="Browser session ID")


class BrowserLogResponse(BaseModel):
    """Response after receiving browser logs."""
    received: int = Field(..., description="Number of logs received")
    stored: int = Field(..., description="Number of logs stored")
    message: str = Field(..., description="Status message")


# ========== Endpoints ==========

@router.get("/", response_model=LogsResponse)
@limiter.limit("20/minute")
async def get_logs(
    request: Request,
    current_admin: CurrentAdmin,
    service: str | None = "all",
    level: str | None = "all",
    since: str | None = None,
    until: str | None = None,
    limit: int = 50
) -> LogsResponse:
    """
    Retrieve filtered logs from all services (admin-only).

    Args:
        request: FastAPI request object (for rate limiting)
        current_admin: Current admin user (dependency injection)
        service: Service filter (browser, backend, bot, postgres, nginx, all)
        level: Log level filter (info, warning, error, all)
        since: Start datetime filter (ISO 8601)
        until: End datetime filter (ISO 8601)
        limit: Max logs per service (1-500)

    Returns:
        LogsResponse with filtered logs

    Raises:
        HTTPException 400: Invalid parameters
        HTTPException 500: Error collecting logs
    """
    logger.info(
        "[ADMIN_LOGS_API] GET /api/v1/admin/logs called by user_id=%s, "
        "service=%s, level=%s, since=%s, until=%s, limit=%s",
        current_admin.id, service, level, since, until, limit
    )

    # Validate parameters
    if limit < 1 or limit > 500:
        logger.warning("[ADMIN_LOGS_API] Invalid limit=%s, must be 1-500", limit)
        raise HTTPException(status_code=400, detail="Limit must be between 1 and 500")

    if service not in ["all", "browser", "backend", "bot", "postgres", "nginx"]:
        logger.warning("[ADMIN_LOGS_API] Invalid service=%s", service)
        raise HTTPException(
            status_code=400,
            detail="Service must be one of: all, browser, backend, bot, postgres, nginx"
        )

    if level not in ["all", "info", "warning", "error"]:
        logger.warning("[ADMIN_LOGS_API] Invalid level=%s", level)
        raise HTTPException(
            status_code=400,
            detail="Level must be one of: all, info, warning, error"
        )

    # Parse datetime filters
    since_dt = None
    until_dt = None

    if since:
        try:
            since_dt = datetime.fromisoformat(since.replace('Z', '+00:00'))
            # Make timezone-aware if naive (assume system timezone)
            if since_dt.tzinfo is None:
                since_dt = since_dt.replace(tzinfo=get_system_timezone())
        except ValueError:
            logger.warning("[ADMIN_LOGS_API] Invalid since datetime=%s", since)
            raise HTTPException(status_code=400, detail="Invalid since datetime format (use ISO 8601)")

    if until:
        try:
            until_dt = datetime.fromisoformat(until.replace('Z', '+00:00'))
            # Make timezone-aware if naive (assume system timezone)
            if until_dt.tzinfo is None:
                until_dt = until_dt.replace(tzinfo=get_system_timezone())
        except ValueError:
            logger.warning("[ADMIN_LOGS_API] Invalid until datetime=%s", until)
            raise HTTPException(status_code=400, detail="Invalid until datetime format (use ISO 8601)")

    # Collect logs
    try:
        collector = LogsCollectorService()
        result = await collector.get_all_logs(
            service=service,
            level=level,
            since=since_dt,
            until=until_dt,
            limit=limit
        )

        logger.info(
            "[ADMIN_LOGS_API] Returning %s logs (from %s total)",
            result['filtered_count'], result['total_count']
        )

        return LogsResponse(**result)

    except Exception as e:
        logger.error("[ADMIN_LOGS_API] Error collecting logs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error collecting logs: {str(e)}")


@router.post("/browser", response_model=BrowserLogResponse)
@limiter.limit("100/minute")
async def receive_browser_logs(
    request: Request,
    data: BrowserLogBatch,
    current_user: CurrentUser
) -> BrowserLogResponse:
    """
    Receive browser logs from clients (all authenticated users).

    Args:
        request: FastAPI request object (for rate limiting)
        data: Batch of browser logs
        current_user: Current authenticated user (dependency injection)

    Returns:
        BrowserLogResponse with status

    Raises:
        HTTPException 400: Invalid batch size or user mismatch
        HTTPException 500: Error storing logs
    """
    logger.info(
        "[BROWSER_LOGS_API] POST /api/v1/admin/logs/browser called by user_id=%s, "
        "batch_size=%s, session_id=%s",
        current_user.id, len(data.logs), data.session_id
    )

    # Validate user_id matches current_user
    if data.user_id != current_user.id:
        logger.warning(
            "[BROWSER_LOGS_API] User ID mismatch: data.user_id=%s, current_user.id=%s",
            data.user_id, current_user.id
        )
        raise HTTPException(status_code=400, detail="User ID mismatch")

    # Validate batch size
    if len(data.logs) > 500:
        logger.warning("[BROWSER_LOGS_API] Batch size too large: %s logs", len(data.logs))
        raise HTTPException(status_code=400, detail="Batch size must not exceed 500 logs")

    if len(data.logs) == 0:
        logger.warning("[BROWSER_LOGS_API] Empty batch received")
        raise HTTPException(status_code=400, detail="Batch must contain at least 1 log")

    # Store logs
    try:
        collector = LogsCollectorService()

        # Convert Pydantic models to dicts
        logs_dicts = [log.model_dump() for log in data.logs]

        stored_count = collector.collect_browser_logs(
            logs=logs_dicts,
            user_id=current_user.id
        )

        logger.info(
            "[BROWSER_LOGS_API] Stored %s browser logs from user_id=%s",
            stored_count, current_user.id
        )

        return BrowserLogResponse(
            received=len(data.logs),
            stored=stored_count,
            message=f"Successfully stored {stored_count} browser logs"
        )

    except Exception as e:
        logger.error("[BROWSER_LOGS_API] Error storing browser logs: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error storing logs: {str(e)}")
