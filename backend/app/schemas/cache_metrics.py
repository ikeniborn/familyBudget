"""
Pydantic schemas for client-side cache metrics API.

This module defines the request/response schemas for the cache metrics endpoints.

Schemas:
    - ClientCacheMetrics: Request schema for POST /api/v1/admin/cache-metrics
    - AggregatedCacheMetrics: Response schema for GET /api/v1/admin/cache-metrics
    - ServiceWorkerMetrics: SW cache information
    - IndexedDBMetrics: IndexedDB statistics
    - StorageQuotaMetrics: Browser storage quota
    - ClientCacheSnapshot: Single client's cache snapshot

Version: 1.0.0
Date: 2025-12-27
"""

from typing import Any

from pydantic import BaseModel, Field


class ServiceWorkerMetrics(BaseModel):
    """Service Worker cache metrics from a client."""

    version: str | None = Field(None, description="SW cache version (e.g., v20251225_1430)")
    cache_count: int = Field(description="Number of caches")
    total_size_bytes: int = Field(description="Total cache size in bytes")
    entries_count: int = Field(description="Number of cached entries")
    estimation_method: str | None = Field(None, description="Size estimation method (e.g., 'sampled')")


class IndexedDBMetrics(BaseModel):
    """IndexedDB metrics from a client."""

    db_version: int = Field(description="IndexedDB schema version")
    pending_count: int = Field(description="Total pending items across all stores")
    store_stats: dict[str, Any] = Field(description="Per-store statistics (facts, transfers, plans, etc.)")


class StorageQuotaMetrics(BaseModel):
    """Browser storage quota metrics from a client."""

    quota: int | None = Field(None, description="Total storage quota in bytes (null if unsupported)")
    usage: int | None = Field(None, description="Used storage in bytes (null if unsupported)")
    usage_percent: float | None = Field(None, description="Storage usage percentage (null if unsupported)")
    supported: bool = Field(description="Whether StorageManager API is supported")


class LocalStorageMetrics(BaseModel):
    """localStorage metrics from a client."""

    key_count: int = Field(description="Number of keys in localStorage")
    total_size_bytes: int = Field(description="Total size of localStorage in bytes")


class SessionStorageMetrics(BaseModel):
    """sessionStorage metrics from a client."""

    key_count: int = Field(description="Number of keys in sessionStorage")
    total_size_bytes: int = Field(description="Total size of sessionStorage in bytes")


class ClientCacheMetrics(BaseModel):
    """
    Client-side cache metrics submission schema.

    Submitted by browser clients via POST /api/v1/admin/cache-metrics.
    Contains metrics collected from various browser storage APIs.
    """

    service_worker: ServiceWorkerMetrics = Field(description="Service Worker cache metrics")
    indexeddb: IndexedDBMetrics = Field(description="IndexedDB metrics")
    storage_quota: StorageQuotaMetrics = Field(description="Storage quota metrics")
    local_storage: LocalStorageMetrics = Field(description="localStorage metrics")
    session_storage: SessionStorageMetrics = Field(description="sessionStorage metrics")
    client_id: str = Field(description="Unique client identifier (UUID)")
    collected_at: str = Field(description="ISO 8601 timestamp when metrics were collected")

    class Config:
        """Pydantic configuration."""
        json_schema_extra = {
            "example": {
                "client_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "collected_at": "2025-12-27T14:30:00.000Z",
                "service_worker": {
                    "version": "v20251225_1430",
                    "cache_count": 1,
                    "total_size_bytes": 1024000,
                    "entries_count": 42,
                    "estimation_method": "sampled"
                },
                "indexeddb": {
                    "db_version": 5,
                    "pending_count": 3,
                    "store_stats": {
                        "facts": {"total": 150, "pending": 2, "synced": 148},
                        "transfers": {"total": 20, "pending": 1, "synced": 19}
                    }
                },
                "storage_quota": {
                    "quota": 5368709120,
                    "usage": 2147483648,
                    "usage_percent": 40.0,
                    "supported": True
                },
                "local_storage": {
                    "key_count": 5,
                    "total_size_bytes": 2048
                },
                "session_storage": {
                    "key_count": 2,
                    "total_size_bytes": 512
                }
            }
        }


class ClientCacheSnapshot(BaseModel):
    """
    Single client's cache metrics snapshot.

    Returned as part of aggregated metrics to show individual client data.
    """

    client_id: str = Field(description="Unique client identifier")
    collected_at: str = Field(description="ISO timestamp when metrics were collected")
    stored_at: str = Field(description="ISO timestamp when metrics were stored in backend")
    service_worker: ServiceWorkerMetrics = Field(description="SW cache metrics")
    indexeddb: IndexedDBMetrics = Field(description="IndexedDB metrics")
    storage_quota: StorageQuotaMetrics = Field(description="Storage quota metrics")
    local_storage: LocalStorageMetrics = Field(description="localStorage metrics")
    session_storage: SessionStorageMetrics = Field(description="sessionStorage metrics")


class AggregatedServiceWorkerMetrics(BaseModel):
    """Aggregated Service Worker metrics across all clients."""

    total_size_bytes: int = Field(description="Total SW cache size across all clients")
    avg_size_bytes: int = Field(description="Average SW cache size per client")
    total_entries: int = Field(description="Total cached entries across all clients")


class AggregatedIndexedDBMetrics(BaseModel):
    """Aggregated IndexedDB metrics across all clients."""

    total_pending: int = Field(description="Total pending items across all clients")
    total_facts: int = Field(description="Total facts across all clients")


class AggregatedStorageQuotaMetrics(BaseModel):
    """Aggregated storage quota metrics across all clients."""

    avg_quota: int = Field(description="Average storage quota across clients (bytes)")
    avg_usage: int = Field(description="Average storage usage across clients (bytes)")
    avg_usage_percent: float = Field(description="Average storage usage percentage")


class AggregatedLocalStorageMetrics(BaseModel):
    """Aggregated localStorage metrics across all clients."""

    total_size_bytes: int = Field(description="Total localStorage size across all clients")
    total_keys: int = Field(description="Total localStorage keys across all clients")


class AggregatedSessionStorageMetrics(BaseModel):
    """Aggregated sessionStorage metrics across all clients."""

    total_size_bytes: int = Field(description="Total sessionStorage size across all clients")
    total_keys: int = Field(description="Total sessionStorage keys across all clients")


class AggregatedMetrics(BaseModel):
    """Aggregated metrics across all clients."""

    service_worker: AggregatedServiceWorkerMetrics = Field(description="Aggregated SW cache metrics")
    indexeddb: AggregatedIndexedDBMetrics = Field(description="Aggregated IndexedDB metrics")
    storage_quota: AggregatedStorageQuotaMetrics = Field(description="Aggregated storage quota metrics")
    local_storage: AggregatedLocalStorageMetrics = Field(description="Aggregated localStorage metrics")
    session_storage: AggregatedSessionStorageMetrics = Field(description="Aggregated sessionStorage metrics")


class AggregatedCacheMetrics(BaseModel):
    """
    Aggregated cache metrics response schema.

    Returned by GET /api/v1/admin/cache-metrics.
    Contains both individual client snapshots and aggregated statistics.
    """

    client_count: int = Field(description="Number of active clients (with metrics < 5 minutes old)")
    last_updated: str | None = Field(description="ISO timestamp of last aggregation (null if no clients)")
    clients: list[ClientCacheSnapshot] = Field(description="Individual client metrics snapshots")
    aggregated: AggregatedMetrics = Field(description="Aggregated statistics across all clients")

    class Config:
        """Pydantic configuration."""
        json_schema_extra = {
            "example": {
                "client_count": 2,
                "last_updated": "2025-12-27T14:35:00.000Z",
                "clients": [
                    {
                        "client_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                        "collected_at": "2025-12-27T14:30:00.000Z",
                        "stored_at": "2025-12-27T14:30:01.000Z",
                        "service_worker": {
                            "version": "v20251225_1430",
                            "cache_count": 1,
                            "total_size_bytes": 1024000,
                            "entries_count": 42,
                            "estimation_method": "sampled"
                        },
                        "indexeddb": {
                            "db_version": 5,
                            "pending_count": 3,
                            "store_stats": {}
                        },
                        "storage_quota": {
                            "quota": 5368709120,
                            "usage": 2147483648,
                            "usage_percent": 40.0,
                            "supported": True
                        },
                        "local_storage": {
                            "key_count": 5,
                            "total_size_bytes": 2048
                        },
                        "session_storage": {
                            "key_count": 2,
                            "total_size_bytes": 512
                        }
                    }
                ],
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


class CacheMetricsSubmitResponse(BaseModel):
    """Response schema for POST /api/v1/admin/cache-metrics."""

    status: str = Field(description="Submission status", default="accepted")
    message: str | None = Field(None, description="Optional message")

    class Config:
        """Pydantic configuration."""
        json_schema_extra = {
            "example": {
                "status": "accepted",
                "message": "Metrics stored successfully"
            }
        }
