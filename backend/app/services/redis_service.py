"""
Redis Service.

Provides Redis connection management and utility functions.

This module handles:
- Connection pool management with async context manager
- Health check utilities
- Stats retrieval for monitoring

Usage:
    from backend.app.services.redis_service import get_redis, check_redis_health

    async with get_redis() as redis:
        await redis.set("key", "value")
        value = await redis.get("key")

    # Or for health checks:
    health = await check_redis_health()
"""
import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from dataclasses import dataclass

import redis.asyncio as redis
from backend.app.core.config import get_settings
from redis.asyncio import ConnectionPool, Redis

logger = logging.getLogger(__name__)

# Global connection pool
_redis_pool: ConnectionPool | None = None


async def init_redis_pool() -> None:
    """
    Initialize Redis connection pool.

    Called during application startup to create the connection pool.
    Uses settings from config.py (REDIS_URL environment variable).
    """
    global _redis_pool

    settings = get_settings()
    redis_url = getattr(settings, "REDIS_URL", None)

    if not redis_url:
        logger.warning("REDIS_URL not configured - Redis will be unavailable")
        return

    try:
        _redis_pool = redis.ConnectionPool.from_url(
            redis_url,
            max_connections=20,
            decode_responses=True,
            socket_timeout=5.0,
            socket_connect_timeout=5.0,
        )
        logger.info("Redis connection pool initialized")
    except Exception as e:
        logger.error(f"Failed to initialize Redis pool: {e}")
        _redis_pool = None


async def close_redis_pool() -> None:
    """
    Close Redis connection pool.

    Called during application shutdown to cleanup connections.
    """
    global _redis_pool

    if _redis_pool:
        await _redis_pool.disconnect()
        _redis_pool = None
        logger.info("Redis connection pool closed")


@asynccontextmanager
async def get_redis() -> AsyncIterator[Redis]:
    """
    Get Redis connection from pool.

    Async context manager that provides a Redis connection.
    Connection is automatically returned to pool on exit.

    Yields:
        Redis: Redis client instance

    Raises:
        RuntimeError: If Redis pool is not initialized

    Example:
        async with get_redis() as redis:
            await redis.set("key", "value")
    """
    if not _redis_pool:
        raise RuntimeError("Redis pool not initialized. Call init_redis_pool() first.")

    client = Redis(connection_pool=_redis_pool)
    try:
        yield client
    finally:
        await client.aclose()


def is_redis_available() -> bool:
    """
    Check if Redis is configured and available.

    Returns:
        bool: True if Redis pool is initialized
    """
    return _redis_pool is not None


@dataclass
class RedisHealthResult:
    """Redis health check result."""

    is_healthy: bool
    latency_ms: float | None = None
    used_memory: str | None = None
    total_keys: int | None = None
    hit_ratio: float | None = None
    error: str | None = None


async def check_redis_health() -> RedisHealthResult:
    """
    Check Redis health with latency measurement.

    Performs PING test and retrieves memory/stats info.

    Returns:
        RedisHealthResult: Health check result with stats
    """
    if not is_redis_available():
        return RedisHealthResult(
            is_healthy=False,
            error="Redis not configured"
        )

    try:
        from datetime import datetime

        async with get_redis() as client:
            start_time = datetime.now()

            # PING test
            await client.ping()

            latency_ms = (datetime.now() - start_time).total_seconds() * 1000

            # Get Redis INFO
            try:
                memory_info = await client.info("memory")
                stats_info = await client.info("stats")
                keyspace_info = await client.info("keyspace")

                used_memory = memory_info.get("used_memory_human", "N/A")

                # Calculate total keys from all databases
                total_keys = 0
                for key, value in keyspace_info.items():
                    if key.startswith("db") and isinstance(value, dict):
                        total_keys += value.get("keys", 0)

                # Calculate cache hit ratio
                hits = stats_info.get("keyspace_hits", 0)
                misses = stats_info.get("keyspace_misses", 0)
                hit_ratio = None
                if hits + misses > 0:
                    hit_ratio = round(hits / (hits + misses) * 100, 1)

                return RedisHealthResult(
                    is_healthy=True,
                    latency_ms=latency_ms,
                    used_memory=used_memory,
                    total_keys=total_keys,
                    hit_ratio=hit_ratio
                )
            except Exception:
                # PING worked but INFO failed - still healthy
                return RedisHealthResult(
                    is_healthy=True,
                    latency_ms=latency_ms
                )

    except Exception as e:
        logger.error(f"Redis health check failed: {e}")
        return RedisHealthResult(
            is_healthy=False,
            error=str(e)
        )


async def get_redis_stats() -> dict:
    """
    Get Redis statistics for monitoring.

    Returns:
        dict: Redis stats or empty dict if unavailable
    """
    if not is_redis_available():
        return {}

    try:
        async with get_redis() as client:
            memory_info = await client.info("memory")
            stats_info = await client.info("stats")
            keyspace_info = await client.info("keyspace")
            server_info = await client.info("server")

            # Calculate total keys
            total_keys = 0
            for key, value in keyspace_info.items():
                if key.startswith("db") and isinstance(value, dict):
                    total_keys += value.get("keys", 0)

            # Calculate hit ratio
            hits = stats_info.get("keyspace_hits", 0)
            misses = stats_info.get("keyspace_misses", 0)
            hit_ratio = (hits / (hits + misses) * 100) if (hits + misses) > 0 else 0

            return {
                "redis_version": server_info.get("redis_version"),
                "used_memory": memory_info.get("used_memory_human"),
                "used_memory_peak": memory_info.get("used_memory_peak_human"),
                "total_keys": total_keys,
                "keyspace_hits": hits,
                "keyspace_misses": misses,
                "hit_ratio_percent": round(hit_ratio, 1),
                "connected_clients": stats_info.get("connected_clients", 0),
                "uptime_days": server_info.get("uptime_in_days", 0),
            }
    except Exception as e:
        logger.error(f"Failed to get Redis stats: {e}")
        return {"error": str(e)}


async def get_cache_breakdown() -> dict:
    """
    Get cache breakdown by category.

    Analyzes cache keys and groups them by prefix/category.

    Returns:
        dict: Cache breakdown with counts and categories
    """
    if not is_redis_available():
        return {}

    try:
        async with get_redis() as client:
            # Get all cache keys matching pattern
            keys = await client.keys("cache:*")

            # Breakdown by category
            breakdown = {
                "articles": 0,
                "financial_centers": 0,
                "cost_centers": 0,
                "recurring_plans": 0,
                "dashboard": 0,
                "recent": 0,
                "other": 0,
            }

            for key in keys:
                key_str = key.decode() if isinstance(key, bytes) else key
                # Extract category from key pattern: cache:{category}:...
                parts = key_str.split(":")
                if len(parts) >= 2:
                    category = parts[1]
                    if category in breakdown:
                        breakdown[category] += 1
                    else:
                        breakdown["other"] += 1

            return {
                "total_cache_keys": len(keys),
                "by_category": breakdown,
            }
    except Exception as e:
        logger.error(f"Failed to get cache breakdown: {e}")
        return {"error": str(e)}
