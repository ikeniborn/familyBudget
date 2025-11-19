"""
Health Check API Endpoints.

Provides comprehensive health and readiness checks for monitoring systems.
"""

import json
import platform
import subprocess
import sys
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
            select(func.count(User.id)).where(User.is_current == True)  # noqa: E712
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


def check_backup_status() -> ComponentHealth:
    """
    Check backup status using check_backup_health.sh script.

    Returns:
        ComponentHealth: Backup status with latest backup info
    """
    try:
        possible_paths = [
            Path(__file__).parent.parent.parent.parent / "scripts" / "check_backup_health.sh",
            Path("/opt/budget/scripts/check_backup_health.sh"),
        ]

        script_path = None
        for path in possible_paths:
            if path.exists():
                script_path = path
                break

        if not script_path:
            searched_paths = ", ".join(str(p) for p in possible_paths)
            return ComponentHealth(
                status="down",
                message=f"Backup health check script not found. Searched: {searched_paths}"
            )

        result = subprocess.run(
            [str(script_path), "--json"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False
        )

        if result.returncode not in [0, 1, 2]:
            return ComponentHealth(
                status="down",
                message=f"Backup health check failed with exit code {result.returncode}. stderr: {result.stderr[:200]}"
            )

        if not result.stdout or result.stdout.strip() == "":
            return ComponentHealth(
                status="down",
                message=f"Backup health check returned empty output. stderr: {result.stderr[:200]}, returncode: {result.returncode}"
            )

        backup_data = json.loads(result.stdout)

        latest_backup = backup_data.get("backups", {}).get("latest", "")
        backup_count = backup_data.get("backups", {}).get("count", 0)
        overall_status = backup_data.get("status", {}).get("overall", "unhealthy")

        if latest_backup and latest_backup != "":
            parts = latest_backup.split("_")
            if len(parts) >= 3:
                date_str = parts[1]
                time_str = parts[2].replace(".sql.gz", "")
                formatted_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
                formatted_time = f"{time_str[:2]}:{time_str[2:4]}:{time_str[4:6]}"
                backup_datetime = f"{formatted_date} {formatted_time}"
            else:
                backup_datetime = latest_backup

            backup_path = Path(backup_data.get("backups", {}).get("directory", "")) / latest_backup
            if backup_path.exists():
                backup_size_mb = backup_path.stat().st_size / (1024 * 1024)
                size_info = f", Size: {backup_size_mb:.2f} MB"
            else:
                size_info = ""

            status_map = {
                "healthy": "up",
                "unhealthy": "down"
            }

            return ComponentHealth(
                status=status_map.get(overall_status, "down"),
                message=f"Latest: {backup_datetime}, File: {latest_backup}{size_info}, Total backups: {backup_count}"
            )
        else:
            return ComponentHealth(
                status="down",
                message="No backups found"
            )

    except subprocess.TimeoutExpired:
        return ComponentHealth(
            status="down",
            message="Backup health check timed out"
        )
    except json.JSONDecodeError as e:
        return ComponentHealth(
            status="down",
            message=f"Failed to parse backup health check output: {str(e)}"
        )
    except Exception as e:
        return ComponentHealth(
            status="down",
            message=f"Backup health check error: {str(e)}"
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
    """
    settings = get_settings()
    db_connected = await check_db_connection()

    health_status = "healthy" if db_connected else "unhealthy"

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
    # Check database
    db_health = await check_database_health(session)
    db_ready = db_health.status == "up"

    # Add more checks here as needed (Redis, external APIs, etc.)

    checks = {"database": db_ready}

    ready = all(checks.values())

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

    components = {
        "database": db_health,
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
