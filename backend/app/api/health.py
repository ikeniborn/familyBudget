"""
Health Check API Endpoints.

Provides comprehensive health and readiness checks for monitoring systems.
"""

import platform
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import psutil
from fastapi import APIRouter, Depends, Response, status
from pydantic import BaseModel
from sqlmodel import func, select
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.core.config import get_settings
from backend.app.core.dependencies import get_session
from backend.app.db.health import check_db_connection
from backend.app.models.fact import BudgetFact as Fact
from backend.app.models.user import User

router = APIRouter(tags=["Health"])

# ============================================================================
# Response Models
# ============================================================================


class HealthStatus(BaseModel):
    """Basic health check response."""

    status: str  # "healthy" | "degraded" | "unhealthy"
    timestamp: str
    version: str


class ComponentHealth(BaseModel):
    """Health status of a single component."""

    status: str  # "up" | "down" | "degraded"
    message: str | None = None
    latency_ms: float | None = None


class DetailedHealthResponse(BaseModel):
    """Detailed health check with component breakdown."""

    status: str  # "healthy" | "degraded" | "unhealthy"
    timestamp: str
    version: str
    uptime_seconds: float
    components: dict[str, ComponentHealth]
    system: dict[str, Any]


class ReadinessResponse(BaseModel):
    """Readiness check response."""

    ready: bool
    timestamp: str
    checks: dict[str, bool]


# ============================================================================
# Global State
# ============================================================================

_startup_time = datetime.now(timezone.utc)


# ============================================================================
# Helper Functions
# ============================================================================


async def check_database_health(session: AsyncSession) -> ComponentHealth:
    """
    Check database health with latency measurement.

    Returns:
        ComponentHealth: Database health status
    """
    try:
        start_time = datetime.now()

        # Simple ping query
        result = await session.execute(select(func.count(User.id)))
        _ = result.scalar()

        latency_ms = (datetime.now() - start_time).total_seconds() * 1000

        return ComponentHealth(
            status="up", message="Database connection successful", latency_ms=latency_ms
        )
    except Exception as e:
        return ComponentHealth(
            status="down", message=f"Database connection failed: {str(e)}"
        )


async def check_database_stats(session: AsyncSession) -> dict[str, int]:
    """
    Get database statistics.

    Returns:
        dict: Database statistics
    """
    try:
        # Count users
        users_result = await session.execute(
            select(func.count(User.id)).where()  # noqa: E712
        )
        total_users = users_result.scalar() or 0

        # Count facts
        facts_result = await session.execute(select(func.count(Fact.id)))
        total_facts = facts_result.scalar() or 0

        return {"total_users": total_users, "total_facts": total_facts}
    except Exception:
        return {"total_users": 0, "total_facts": 0}


def get_system_info() -> dict[str, Any]:
    """
    Get system information.

    Returns:
        dict: System metrics
    """
    try:
        cpu_percent = psutil.cpu_percent(interval=0.1)
        memory = psutil.virtual_memory()
        disk = psutil.disk_usage("/")

        return {
            "platform": platform.system(),
            "platform_version": platform.release(),
            "python_version": sys.version.split()[0],
            "cpu_count": psutil.cpu_count(),
            "cpu_percent": cpu_percent,
            "memory_total_gb": round(memory.total / (1024**3), 2),
            "memory_used_gb": round(memory.used / (1024**3), 2),
            "memory_percent": memory.percent,
            "disk_total_gb": round(disk.total / (1024**3), 2),
            "disk_used_gb": round(disk.used / (1024**3), 2),
            "disk_percent": disk.percent,
        }
    except Exception:
        return {
            "platform": platform.system(),
            "python_version": sys.version.split()[0],
        }


async def check_redis_health_component() -> ComponentHealth:
    """
    Check Redis health with latency measurement.

    Returns:
        ComponentHealth: Redis health status with memory and hit ratio
    """
    try:
        from backend.app.services.redis_service import (
            check_redis_health,
            is_redis_available,
        )

        if not is_redis_available():
            return ComponentHealth(
                status="down",
                message="Redis not configured"
            )

        result = await check_redis_health()

        if not result.is_healthy:
            return ComponentHealth(
                status="down",
                message=f"Redis connection failed: {result.error}"
            )

        # Build message with stats
        message_parts = []
        if result.used_memory:
            message_parts.append(f"Memory: {result.used_memory}")
        if result.total_keys is not None:
            message_parts.append(f"Keys: {result.total_keys}")
        if result.hit_ratio is not None:
            message_parts.append(f"Hit ratio: {result.hit_ratio}%")

        message = ", ".join(message_parts) if message_parts else "Redis is healthy"

        return ComponentHealth(
            status="up",
            message=message,
            latency_ms=result.latency_ms
        )
    except ImportError:
        return ComponentHealth(
            status="down",
            message="Redis service not available"
        )
    except Exception as e:
        return ComponentHealth(
            status="down",
            message=f"Redis check failed: {str(e)}"
        )


async def check_write_behind_health() -> ComponentHealth:
    """
    Check Write-Behind queue health.

    Returns:
        ComponentHealth: Write-behind status with queue stats
    """
    try:
        from backend.app.services.write_behind_service import write_behind_service

        stats = await write_behind_service.get_queue_stats()

        if not stats.get("enabled"):
            return ComponentHealth(
                status="up",  # "up" because disabled is valid state
                message="Write-behind disabled"
            )

        if not stats.get("running"):
            return ComponentHealth(
                status="down",
                message="Write-behind worker not running"
            )

        # Build message with stats
        queue_len = stats.get("queue_length", 0)
        dlq_len = stats.get("dlq_length", 0)
        processed = stats.get("processed", 0)
        failed = stats.get("failed", 0)

        # Status is degraded if DLQ has items
        status = "up" if dlq_len == 0 else "degraded"

        message = f"Queue: {queue_len}, Processed: {processed}, Failed: {failed}, DLQ: {dlq_len}"

        return ComponentHealth(
            status=status,
            message=message
        )
    except ImportError:
        return ComponentHealth(
            status="up",
            message="Write-behind service not available"
        )
    except Exception as e:
        return ComponentHealth(
            status="down",
            message=f"Write-behind check failed: {str(e)}"
        )


def check_backup_status() -> ComponentHealth:
    """
    Check backup status by scanning backup directory.

    Pure Python implementation - no bash scripts or Docker CLI needed.

    Returns:
        ComponentHealth: Backup status with latest backup info
    """
    try:
        backup_dir = Path("/app/backups")

        # Check if backup directory exists
        if not backup_dir.exists():
            return ComponentHealth(
                status="down",
                message=f"Backup directory not found: {backup_dir}"
            )

        # Find all backup files (backup_YYYYMMDD_HHMMSS.sql.gz)
        backup_files = list(backup_dir.glob("backup_*.sql.gz"))

        if not backup_files:
            return ComponentHealth(
                status="down",
                message="No backups found"
            )

        # Sort by filename (contains timestamp) and get latest
        backup_files.sort(reverse=True)
        latest_backup = backup_files[0]

        # Parse filename: backup_YYYYMMDD_HHMMSS.sql.gz
        filename = latest_backup.name
        parts = filename.split("_")

        if len(parts) >= 3:
            date_str = parts[1]  # YYYYMMDD
            time_str = parts[2].replace(".sql.gz", "")  # HHMMSS

            formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            formatted_time = f"{time_str[:2]}:{time_str[2:4]}:{time_str[4:6]}"
            backup_datetime = f"{formatted_date} {formatted_time}"
        else:
            backup_datetime = filename

        # Get file size
        backup_size_mb = latest_backup.stat().st_size / (1024 * 1024)

        # Check if backup is recent (< 26 hours old)
        backup_age_seconds = time.time() - latest_backup.stat().st_mtime
        backup_age_hours = backup_age_seconds / 3600

        # Status: up if backup is recent and size > 10KB (gzip compressed)
        status = "up" if (backup_age_hours < 26 and backup_size_mb > 0.01) else "down"

        return ComponentHealth(
            status=status,
            message=f"Latest: {backup_datetime}, File: {filename}, Size: {backup_size_mb:.2f} MB, Total backups: {len(backup_files)}"
        )

    except Exception as e:
        return ComponentHealth(
            status="down",
            message=f"Backup check error: {str(e)}"
        )


def calculate_uptime() -> float:
    """
    Calculate application uptime in seconds.

    Returns:
        float: Uptime in seconds
    """
    return (datetime.now(timezone.utc) - _startup_time).total_seconds()


def determine_overall_status(components: dict[str, ComponentHealth]) -> str:
    """
    Determine overall health status based on components.

    Args:
        components: Component health statuses

    Returns:
        str: "healthy" | "degraded" | "unhealthy"
    """
    statuses = [comp.status for comp in components.values()]

    if all(s == "up" for s in statuses):
        return "healthy"
    elif any(s == "down" for s in statuses):
        return "unhealthy"
    else:
        return "degraded"


# ============================================================================
# Endpoints
# ============================================================================


@router.get(
    "/health",
    response_model=HealthStatus,
    summary="Basic Health Check",
    description="""
    **Lightweight health check endpoint.**

    Returns basic application health status.
    Suitable for container orchestration (Docker, Kubernetes).

    **Status Codes:**
    - `200 OK` - Application is healthy
    - `503 Service Unavailable` - Application is unhealthy

    **Response Statuses:**
    - `healthy` - All systems operational
    - `degraded` - Some non-critical issues detected
    - `unhealthy` - Critical issues detected
    """,
)
async def health_check(response: Response) -> HealthStatus:
    """
    Basic health check endpoint.

    Returns:
        HealthStatus: Basic health information

    Health status logic:
        - unhealthy: Database is down (critical)
        - degraded: Database up, but Redis down when WRITE_BEHIND_ENABLED=true
        - healthy: All configured components are up
    """
    settings = get_settings()
    db_connected = await check_db_connection()

    if not db_connected:
        health_status = "unhealthy"
    else:
        # Check Redis if Write-Behind is enabled (Redis becomes important)
        if settings.WRITE_BEHIND_ENABLED:
            redis_health = await check_redis_health_component()
            if redis_health.status != "up":
                health_status = "degraded"
            else:
                health_status = "healthy"
        else:
            health_status = "healthy"

    # Set HTTP status code
    if health_status == "unhealthy":
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return HealthStatus(
        status=health_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        version=settings.VERSION,
    )


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    summary="Readiness Check",
    description="""
    **Readiness probe for load balancers.**

    Checks if the application is ready to accept traffic.
    Used by Kubernetes readiness probes and load balancers.

    **Status Codes:**
    - `200 OK` - Application is ready
    - `503 Service Unavailable` - Application is not ready

    **Checks:**
    - Database connectivity
    - Critical dependencies availability
    """,
)
async def readiness_check(
    response: Response, session: AsyncSession = Depends(get_session)
) -> ReadinessResponse:
    """
    Readiness check endpoint.

    Verifies that the application is ready to accept traffic.

    Args:
        response: FastAPI response object
        session: Database session

    Returns:
        ReadinessResponse: Readiness status
    """
    settings = get_settings()

    # Check database (always required)
    db_health = await check_database_health(session)
    db_ready = db_health.status == "up"

    # Check Redis
    redis_health = await check_redis_health_component()
    redis_ready = redis_health.status == "up"

    checks = {
        "database": db_ready,
        "redis": redis_ready,
    }

    # Redis is required when WRITE_BEHIND_ENABLED=true
    if settings.WRITE_BEHIND_ENABLED:
        ready = db_ready and redis_ready
    else:
        ready = db_ready  # Redis is optional when Write-Behind disabled

    # Set HTTP status code
    if not ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return ReadinessResponse(
        ready=ready, timestamp=datetime.now(timezone.utc).isoformat(), checks=checks
    )


@router.get(
    "/health/detailed",
    response_model=DetailedHealthResponse,
    summary="Detailed Health Check",
    description="""
    **Comprehensive health check with component breakdown.**

    Provides detailed health information for each component:
    - Database (connectivity, latency, statistics)
    - System resources (CPU, memory, disk)
    - Application metrics (uptime, version)

    **Use Cases:**
    - Monitoring dashboards
    - Detailed diagnostics
    - Performance analysis

    **Status Codes:**
    - `200 OK` - Always returns 200 (check `status` field in response)
    """,
)
async def detailed_health_check(
    session: AsyncSession = Depends(get_session),
) -> DetailedHealthResponse:
    """
    Detailed health check with component breakdown.

    Args:
        session: Database session

    Returns:
        DetailedHealthResponse: Detailed health information
    """
    settings = get_settings()

    # Check components
    db_health = await check_database_health(session)
    db_stats = await check_database_stats(session)

    # Add database stats to message
    if db_health.status == "up":
        db_health.message = f"Database operational. Users: {db_stats['total_users']}, Facts: {db_stats['total_facts']}"

    backup_health = check_backup_status()
    redis_health = await check_redis_health_component()
    write_behind_health = await check_write_behind_health()

    components = {
        "database": db_health,
        "redis": redis_health,
        "deferred_operations": write_behind_health,
        "backup": backup_health
    }

    # Determine overall status
    overall_status = determine_overall_status(components)

    # Get system info
    system_info = get_system_info()

    return DetailedHealthResponse(
        status=overall_status,
        timestamp=datetime.now(timezone.utc).isoformat(),
        version=settings.VERSION,
        uptime_seconds=calculate_uptime(),
        components=components,
        system=system_info,
    )


@router.get(
    "/ping",
    summary="Simple Ping",
    description="""
    **Minimal ping endpoint.**

    Ultra-lightweight endpoint that always returns 200 OK.
    Used for basic availability checks.

    **Use Cases:**
    - Container liveness probes
    - Simple uptime monitoring
    - Network connectivity tests
    """,
)
async def ping() -> dict[str, str]:
    """
    Simple ping endpoint.

    Returns:
        dict: Pong message
    """
    return {"message": "pong", "timestamp": datetime.now(timezone.utc).isoformat()}
