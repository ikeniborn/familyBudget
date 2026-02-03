"""
Client-side cache metrics aggregation service.

This service provides in-memory storage and aggregation of client-side cache
metrics (Service Worker cache, IndexedDB, localStorage, Storage Quota).

Features:
- In-memory storage with TTL (5 minutes)
- Auto-cleanup of expired metrics
- Aggregation across all active clients
- Thread-safe operations with asyncio.Lock

Architecture:
- Metrics are ephemeral (no persistence)
- Each client identified by unique client_id
- Memory-efficient (TTL cleanup prevents unbounded growth)
- Suitable for admin-only monitoring feature

Performance:
- Memory footprint: ~100KB per client
- Max retention: 5 minutes
- Expected scale: <100 concurrent clients

Version: 1.0.0
Date: 2025-12-27
"""

import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any

logger = logging.getLogger(__name__)


class CacheMetricsService:
    """
    In-memory storage and aggregation service for client-side cache metrics.

    Stores metrics from browser clients with automatic TTL-based cleanup.
    Provides aggregated statistics across all active clients.

    Thread Safety:
        All public methods use asyncio.Lock for thread-safe access.

    Memory Management:
        Automatic cleanup on every GET/POST removes metrics older than TTL.
    """

    def __init__(self):
        """Initialize cache metrics service with empty storage."""
        self._metrics: dict[str, dict[str, Any]] = {}
        self._lock = asyncio.Lock()
        self.TTL_SECONDS = 300  # 5 minutes
        logger.info("[CACHE_METRICS] Service initialized with TTL=%d seconds", self.TTL_SECONDS)

    async def store_metrics(self, metrics: dict[str, Any]) -> None:
        """
        Store metrics from a client with current timestamp.

        Args:
            metrics: Client cache metrics dict containing:
                - client_id: Unique client identifier
                - service_worker: SW cache stats
                - indexeddb: IDB stats
                - storage_quota: Browser storage quota
                - local_storage: localStorage stats
                - session_storage: sessionStorage stats
                - collected_at: ISO timestamp when metrics collected

        Side Effects:
            - Stores metrics in _metrics dict
            - Triggers cleanup of expired metrics
            - Logs storage operation

        Thread Safety:
            Protected by asyncio.Lock
        """
        async with self._lock:
            client_id = metrics.get("client_id", "unknown")
            metrics["stored_at"] = datetime.now(timezone.utc).isoformat()

            self._metrics[client_id] = metrics

            logger.info(
                "[CACHE_METRICS] Stored metrics from client_id=%s (collected_at=%s)",
                client_id,
                metrics.get("collected_at", "unknown")
            )

            # Cleanup expired metrics
            await self._cleanup_expired()

    async def get_aggregated_metrics(self) -> dict[str, Any]:
        """
        Get aggregated cache metrics from all active clients.

        Returns:
            Dict containing:
                - client_count: Number of active clients
                - last_updated: Timestamp of aggregation
                - clients: List of individual client snapshots
                - aggregated: Aggregated statistics (totals, averages)

        Side Effects:
            - Triggers cleanup of expired metrics
            - Logs aggregation operation

        Thread Safety:
            Protected by asyncio.Lock
        """
        async with self._lock:
            # Cleanup before aggregation
            await self._cleanup_expired()

            if not self._metrics:
                logger.debug("[CACHE_METRICS] No active clients, returning empty metrics")
                return {
                    "client_count": 0,
                    "last_updated": None,
                    "clients": [],
                    "aggregated": {}
                }

            # Aggregate metrics
            metrics_list = list(self._metrics.values())
            aggregated = self._aggregate(metrics_list)

            result = {
                "client_count": len(self._metrics),
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "clients": metrics_list,
                "aggregated": aggregated
            }

            logger.debug(
                "[CACHE_METRICS] Aggregated metrics: clients=%d, sw_total_size=%d",
                result["client_count"],
                aggregated.get("service_worker", {}).get("total_size_bytes", 0)
            )

            return result

    async def _cleanup_expired(self) -> None:
        """
        Remove metrics older than TTL.

        Internal method called by store_metrics() and get_aggregated_metrics().
        Removes client metrics where stored_at < (now - TTL).

        Side Effects:
            - Modifies _metrics dict
            - Logs cleanup operation if any metrics removed

        Thread Safety:
            Must be called within async with self._lock context
        """
        cutoff = datetime.now(timezone.utc) - timedelta(seconds=self.TTL_SECONDS)

        # Find expired client IDs
        expired_ids = [
            client_id
            for client_id, metrics in self._metrics.items()
            if datetime.fromisoformat(metrics["stored_at"]) < cutoff
        ]

        # Remove expired metrics
        for client_id in expired_ids:
            del self._metrics[client_id]

        if expired_ids:
            logger.warning(
                "[CACHE_METRICS] Cleanup removed %d expired clients (TTL=%ds): %s",
                len(expired_ids),
                self.TTL_SECONDS,
                expired_ids
            )

    def _aggregate(self, metrics_list: list[dict[str, Any]]) -> dict[str, Any]:
        """
        Calculate aggregated statistics from list of client metrics.

        Args:
            metrics_list: List of client metrics dicts

        Returns:
            Dict containing aggregated stats:
                - service_worker: Total size, avg size, total entries
                - indexeddb: Total pending, total facts, etc.
                - storage_quota: Avg usage percent, avg usage, avg quota
                - local_storage: Total size, total keys
                - session_storage: Total size, total keys

        Thread Safety:
            Pure function, no state modification
        """
        if not metrics_list:
            return {}

        client_count = len(metrics_list)

        # Service Worker aggregation
        sw_total_size = sum(
            m.get("service_worker", {}).get("total_size_bytes", 0)
            for m in metrics_list
        )
        sw_total_entries = sum(
            m.get("service_worker", {}).get("entries_count", 0)
            for m in metrics_list
        )

        # IndexedDB aggregation
        idb_total_pending = sum(
            m.get("indexeddb", {}).get("pending_count", 0)
            for m in metrics_list
        )
        idb_total_facts = sum(
            m.get("indexeddb", {}).get("store_stats", {}).get("facts", {}).get("total", 0)
            for m in metrics_list
        )

        # Storage Quota aggregation (average)
        quota_values = [
            m.get("storage_quota", {})
            for m in metrics_list
            if m.get("storage_quota", {}).get("supported", False)
        ]

        if quota_values:
            avg_quota = sum(q.get("quota", 0) for q in quota_values) / len(quota_values)
            avg_usage = sum(q.get("usage", 0) for q in quota_values) / len(quota_values)
            avg_usage_percent = sum(q.get("usage_percent", 0) for q in quota_values) / len(quota_values)
        else:
            avg_quota = 0
            avg_usage = 0
            avg_usage_percent = 0

        # localStorage aggregation
        ls_total_size = sum(
            m.get("local_storage", {}).get("total_size_bytes", 0)
            for m in metrics_list
        )
        ls_total_keys = sum(
            m.get("local_storage", {}).get("key_count", 0)
            for m in metrics_list
        )

        # sessionStorage aggregation
        ss_total_size = sum(
            m.get("session_storage", {}).get("total_size_bytes", 0)
            for m in metrics_list
        )
        ss_total_keys = sum(
            m.get("session_storage", {}).get("key_count", 0)
            for m in metrics_list
        )

        return {
            "service_worker": {
                "total_size_bytes": sw_total_size,
                "avg_size_bytes": sw_total_size // client_count if client_count > 0 else 0,
                "total_entries": sw_total_entries
            },
            "indexeddb": {
                "total_pending": idb_total_pending,
                "total_facts": idb_total_facts
            },
            "storage_quota": {
                "avg_quota": int(avg_quota),
                "avg_usage": int(avg_usage),
                "avg_usage_percent": round(avg_usage_percent, 2)
            },
            "local_storage": {
                "total_size_bytes": ls_total_size,
                "total_keys": ls_total_keys
            },
            "session_storage": {
                "total_size_bytes": ss_total_size,
                "total_keys": ss_total_keys
            }
        }
