"""
Client-side cache metrics API endpoints.

This module provides endpoints for submitting and retrieving cache metrics
from browser clients (Service Worker, IndexedDB, localStorage, Storage Quota).

Endpoints:
    POST /api/v1/admin/cache-metrics - Submit client metrics
    GET /api/v1/admin/cache-metrics - Get aggregated metrics (admin only)

Architecture:
    - In-memory storage with 5-minute TTL
    - Metrics submitted by admin page clients only
    - Aggregation on-demand (no background jobs)

Security:
    - POST: Public endpoint (202 Accepted regardless of auth)
    - GET: Admin-only (CurrentAdmin dependency)

Version: 1.0.0
Date: 2025-12-27
"""

import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, status

from backend.app.core.dependencies import CurrentAdmin
from backend.app.schemas.cache_metrics import (
    AggregatedCacheMetrics,
    CacheMetricsSubmitResponse,
    ClientCacheMetrics,
)
from backend.app.services.cache_metrics_service import CacheMetricsService

logger = logging.getLogger(__name__)

# Router configuration
router = APIRouter(
    prefix="/admin/cache-metrics",
    tags=["Admin", "Monitoring", "Cache Metrics"]
)

# Singleton service instance (initialized in dependencies.py)
_cache_metrics_service: Optional[CacheMetricsService] = None


def get_cache_metrics_service() -> CacheMetricsService:
    """
    Dependency: Get or create singleton CacheMetricsService instance.

    Returns:
        CacheMetricsService: Singleton service instance

    Thread Safety:
        Safe for concurrent access (service handles locking internally)
    """
    global _cache_metrics_service
    if _cache_metrics_service is None:
        _cache_metrics_service = CacheMetricsService()
    return _cache_metrics_service


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=CacheMetricsSubmitResponse,
    summary="Submit client-side cache metrics",
    description=(
        "Submit cache metrics from a browser client. "
        "Metrics are stored in-memory with 5-minute TTL. "
        "Accepts all requests (202 Accepted) for simplicity. "
        "Only admin clients should call this endpoint."
    ),
    responses={
        202: {
            "description": "Metrics accepted and stored",
            "content": {
                "application/json": {
                    "example": {
                        "status": "accepted",
                        "message": "Metrics stored successfully"
                    }
                }
            }
        }
    }
)
async def submit_cache_metrics(
    metrics: ClientCacheMetrics,
    service: Annotated[CacheMetricsService, Depends(get_cache_metrics_service)]
) -> CacheMetricsSubmitResponse:
    """
    Submit client-side cache metrics.

    **Authentication:** None required (public endpoint)

    **Rate Limiting:** None (expected <100 requests/min from admin clients)

    **Processing:**
        - Stores metrics asynchronously
        - Auto-cleanup of expired metrics (TTL 5 minutes)
        - Idempotent (same client_id overwrites previous metrics)

    **Use Case:**
        Admin monitoring page calls this endpoint every 5 seconds while open.

    Args:
        metrics: Client cache metrics (SW, IDB, localStorage, Storage Quota)
        service: CacheMetricsService dependency

    Returns:
        CacheMetricsSubmitResponse: Acceptance confirmation

    Logs:
        - INFO: [CACHE_METRICS] Stored metrics from client_id=...
        - WARNING: [CACHE_METRICS] Cleanup removed N expired clients
    """
    try:
        # Store metrics (async fire-and-forget)
        await service.store_metrics(metrics.dict())

        return CacheMetricsSubmitResponse(
            status="accepted",
            message="Metrics stored successfully"
        )
    except Exception as e:
        logger.error(
            "[CACHE_METRICS] Failed to store metrics from client_id=%s: %s",
            metrics.client_id,
            str(e),
            exc_info=True
        )
        # Still return 202 Accepted (best-effort storage)
        return CacheMetricsSubmitResponse(
            status="accepted",
            message="Metrics processing failed (non-critical)"
        )


@router.get(
    "",
    response_model=AggregatedCacheMetrics,
    summary="Get aggregated cache metrics from all clients",
    description=(
        "Retrieve aggregated cache metrics from all active clients. "
        "Returns metrics from clients with data < 5 minutes old. "
        "Includes both individual client snapshots and aggregated statistics. "
        "**Admin only.**"
    ),
    responses={
        200: {
            "description": "Aggregated cache metrics",
            "content": {
                "application/json": {
                    "example": {
                        "client_count": 2,
                        "last_updated": "2025-12-27T14:35:00.000Z",
                        "clients": [],
                        "aggregated": {
                            "service_worker": {
                                "total_size_bytes": 2048000,
                                "avg_size_bytes": 1024000,
                                "total_entries": 84
                            },
                            "indexeddb": {
                                "total_pending": 6,
                                "total_facts": 300
                            },
                            "storage_quota": {
                                "avg_quota": 5368709120,
                                "avg_usage": 2147483648,
                                "avg_usage_percent": 40.0
                            },
                            "local_storage": {
                                "total_size_bytes": 4096,
                                "total_keys": 10
                            },
                            "session_storage": {
                                "total_size_bytes": 1024,
                                "total_keys": 4
                            }
                        }
                    }
                }
            }
        },
        401: {
            "description": "Not authenticated"
        },
        403: {
            "description": "Not authorized (admin only)"
        }
    }
)
async def get_aggregated_cache_metrics(
    current_admin: CurrentAdmin,
    service: Annotated[CacheMetricsService, Depends(get_cache_metrics_service)]
) -> AggregatedCacheMetrics:
    """
    Get aggregated cache metrics from all active clients.

    **Authentication:** Required (admin only)

    **Performance:**
        - O(N) where N = number of active clients (expected <100)
        - Cleanup runs before aggregation
        - In-memory operation (<10ms typical)

    **Data Freshness:**
        - Only includes metrics < 5 minutes old
        - Auto-cleanup removes stale data

    Args:
        current_admin: CurrentAdmin dependency (validates admin role)
        service: CacheMetricsService dependency

    Returns:
        AggregatedCacheMetrics: Client count, individual snapshots, aggregated stats

    Logs:
        - DEBUG: [CACHE_METRICS] Aggregated metrics: clients=N, sw_size=...
        - WARNING: [CACHE_METRICS] Cleanup removed N expired clients
    """
    try:
        # Get aggregated metrics (includes cleanup)
        result = await service.get_aggregated_metrics()

        # Convert to Pydantic model for validation
        return AggregatedCacheMetrics(**result)
    except Exception as e:
        logger.error(
            "[CACHE_METRICS] Failed to get aggregated metrics: %s",
            str(e),
            exc_info=True
        )
        # Return empty metrics on error (graceful degradation)
        return AggregatedCacheMetrics(
            client_count=0,
            last_updated=None,
            clients=[],
            aggregated={
                "service_worker": {
                    "total_size_bytes": 0,
                    "avg_size_bytes": 0,
                    "total_entries": 0
                },
                "indexeddb": {
                    "total_pending": 0,
                    "total_facts": 0
                },
                "storage_quota": {
                    "avg_quota": 0,
                    "avg_usage": 0,
                    "avg_usage_percent": 0.0
                },
                "local_storage": {
                    "total_size_bytes": 0,
                    "total_keys": 0
                },
                "session_storage": {
                    "total_size_bytes": 0,
                    "total_keys": 0
                }
            }
        )
