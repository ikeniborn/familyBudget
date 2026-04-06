"""
Cache Service - Read-Through Cache Implementation

Provides caching layer for reference data (articles, financial centers, cost centers)
and dashboard data with configurable TTL.

Patterns:
- Read-Through Cache: On miss, fetch from DB and populate cache
- Cache Invalidation: Delete related keys on CRUD operations
- Graceful Degradation: Falls back to DB if Redis unavailable

Usage:
    from backend.app.services.cache_service import cache_service, CacheTTL

    # Get cached data or fetch from DB
    articles = await cache_service.get_or_set(
        key="articles:list",
        fetch_fn=lambda: article_service.get_all(session),
        ttl=CacheTTL.REFERENCE()
    )

    # Invalidate cache on changes
    await cache_service.invalidate_pattern("articles:*")
"""

import hashlib
import logging
from collections.abc import Callable
from dataclasses import dataclass
from typing import Any, TypeVar

from backend.app.core.config import Settings, get_settings
from backend.app.core.json_utils import (
    dumps as json_dumps,
)
from backend.app.core.json_utils import (
    dumps_for_cache,
)
from backend.app.core.json_utils import (
    loads as json_loads,
)
from backend.app.services.redis_service import get_redis, is_redis_available

logger = logging.getLogger(__name__)

T = TypeVar("T")


class CacheTTL:
    """
    Cache TTL values in seconds.

    Values are loaded from environment variables via Settings.
    Allows dynamic configuration without code changes.
    """

    @classmethod
    def REFERENCE(cls) -> int:
        """Reference data: Articles, Financial Centers, Cost Centers (default: 300s / 5 min)."""
        return get_settings().REDIS_CACHE_TTL_REFERENCE

    @classmethod
    def DASHBOARD(cls) -> int:
        """Dashboard data: Quick stats, account balances (default: 30s)."""
        return get_settings().REDIS_CACHE_TTL_DASHBOARD

    @classmethod
    def DYNAMIC(cls) -> int:
        """Dynamic data: Facts list, recent transactions (default: 60s / 1 min)."""
        return get_settings().REDIS_CACHE_TTL_DYNAMIC

    @classmethod
    def SHORT(cls) -> int:
        """Short-lived data: Recent HTML fragments (default: 10s)."""
        return get_settings().REDIS_CACHE_TTL_SHORT


@dataclass
class CacheKey:
    """Cache key builder with namespacing."""

    prefix: str
    parts: tuple[str, ...] = ()

    def __str__(self) -> str:
        if self.parts:
            return f"cache:{self.prefix}:{':'.join(str(p) for p in self.parts)}"
        return f"cache:{self.prefix}"

    @classmethod
    def articles_list(cls, filter_hash: str | None = None) -> "CacheKey":
        """Cache key for articles list."""
        if filter_hash:
            return cls(prefix="articles", parts=("list", filter_hash))
        return cls(prefix="articles", parts=("list",))

    @classmethod
    def article(cls, article_id: int) -> "CacheKey":
        """Cache key for single article."""
        return cls(prefix="articles", parts=(str(article_id),))

    @classmethod
    def articles_tree(cls) -> "CacheKey":
        """Cache key for articles tree structure."""
        return cls(prefix="articles", parts=("tree",))

    @classmethod
    def financial_centers_list(cls) -> "CacheKey":
        """Cache key for financial centers list."""
        return cls(prefix="financial_centers", parts=("list",))

    @classmethod
    def financial_center(cls, fc_id: int) -> "CacheKey":
        """Cache key for single financial center."""
        return cls(prefix="financial_centers", parts=(str(fc_id),))

    @classmethod
    def cost_centers_list(cls) -> "CacheKey":
        """Cache key for cost centers list."""
        return cls(prefix="cost_centers", parts=("list",))

    @classmethod
    def cost_center(cls, cc_id: int) -> "CacheKey":
        """Cache key for single cost center."""
        return cls(prefix="cost_centers", parts=(str(cc_id),))

    @classmethod
    def quick_stats(cls) -> "CacheKey":
        """Cache key for dashboard quick stats."""
        return cls(prefix="dashboard", parts=("quick_stats",))

    @classmethod
    def account_balances(cls) -> "CacheKey":
        """Cache key for account balances."""
        return cls(prefix="dashboard", parts=("account_balances",))

    @classmethod
    def recent_html(cls, limit: int = 10) -> "CacheKey":
        """Cache key for recent transactions HTML."""
        return cls(prefix="recent", parts=("html", str(limit)))

    @classmethod
    def recurring_plan_list(cls, user_id: int, filter_hash: str | None = None) -> "CacheKey":
        """Cache key for recurring plan list with optional filter hash."""
        if filter_hash:
            return cls(prefix="recurring_plans", parts=(str(user_id), "list", filter_hash))
        return cls(prefix="recurring_plans", parts=(str(user_id), "list"))

    @classmethod
    def recurring_plan_detail(cls, plan_id: int) -> "CacheKey":
        """Cache key for single recurring plan detail."""
        return cls(prefix="recurring_plans", parts=(str(plan_id),))

    @classmethod
    def recurring_plan_stats(cls, user_id: int) -> "CacheKey":
        """Cache key for recurring plan statistics."""
        return cls(prefix="recurring_plans", parts=(str(user_id), "stats"))


class CacheService:
    """
    Read-Through Cache Service.

    Provides caching with automatic fallback to database
    when Redis is unavailable or cache miss occurs.
    """

    def __init__(self):
        self._settings = None

    @property
    def settings(self) -> "Settings":
        """Lazy load settings."""
        if self._settings is None:
            self._settings = get_settings()
        return self._settings

    def _get_ttl(self, ttl: int | CacheTTL | None) -> int:
        """Get TTL value, using defaults from settings if needed."""
        if ttl is not None:
            return int(ttl)
        return self.settings.REDIS_CACHE_TTL_DEFAULT

    @staticmethod
    def hash_filter(filters: dict[str, Any]) -> str:
        """Create hash from filter parameters for cache key."""
        # Sort keys for consistent hashing
        sorted_filters = dumps_for_cache(filters)
        return hashlib.md5(sorted_filters.encode()).hexdigest()[:12]

    async def get(self, key: str | CacheKey) -> Any | None:
        """
        Get value from cache.

        Args:
            key: Cache key (string or CacheKey object)

        Returns:
            Cached value or None if not found/error
        """
        if not is_redis_available():
            return None

        cache_key = str(key)

        try:
            async with get_redis() as redis:
                value = await redis.get(cache_key)
                if value:
                    logger.debug("Cache HIT: %s", cache_key)
                    return json_loads(value)
                logger.debug("Cache MISS: %s", cache_key)
                return None
        except Exception as e:
            logger.warning("Cache get error for %s: %s", cache_key, e)
            return None

    async def set(
        self,
        key: str | CacheKey,
        value: Any,
        ttl: int | CacheTTL | None = None,
    ) -> bool:
        """
        Set value in cache.

        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time to live in seconds

        Returns:
            True if successful, False otherwise
        """
        if not is_redis_available():
            return False

        cache_key = str(key)
        ttl_seconds = self._get_ttl(ttl)

        try:
            # Serialize value
            serialized = json_dumps(value)

            async with get_redis() as redis:
                await redis.set(cache_key, serialized, ex=ttl_seconds)
                logger.debug("Cache SET: %s (TTL: %ss)", cache_key, ttl_seconds)
                return True
        except Exception as e:
            logger.warning("Cache set error for %s: %s", cache_key, e)
            return False

    async def get_or_set(
        self,
        key: str | CacheKey,
        fetch_fn: Callable[[], Any],
        ttl: int | CacheTTL | None = None,
    ) -> Any:
        """
        Get from cache or fetch and cache.

        This is the main read-through cache method.

        Args:
            key: Cache key
            fetch_fn: Async function to fetch data if cache miss
            ttl: Time to live in seconds

        Returns:
            Cached or freshly fetched data
        """
        # Try cache first
        cached = await self.get(key)
        if cached is not None:
            return cached

        # Cache miss - fetch from source
        data = await fetch_fn()

        # Store in cache (async, don't wait)
        await self.set(key, data, ttl)

        return data

    async def delete(self, key: str | CacheKey) -> bool:
        """
        Delete a specific key from cache.

        Args:
            key: Cache key to delete

        Returns:
            True if deleted, False otherwise
        """
        if not is_redis_available():
            return False

        cache_key = str(key)

        try:
            async with get_redis() as redis:
                result = await redis.delete(cache_key)
                logger.debug("Cache DELETE: %s (deleted: %s)", cache_key, result)
                return result > 0
        except Exception as e:
            logger.warning("Cache delete error for %s: %s", cache_key, e)
            return False

    async def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys matching a pattern.

        Args:
            pattern: Redis glob pattern (e.g., "cache:articles:*")

        Returns:
            Number of keys deleted

        Note:
            Safety limit of 1000 keys to prevent slow scans blocking the response.
            In practice, cache keys rarely exceed this limit.
        """
        if not is_redis_available():
            return 0

        # Ensure pattern has cache prefix
        if not pattern.startswith("cache:"):
            pattern = f"cache:{pattern}"

        try:
            async with get_redis() as redis:
                # Find all matching keys with safety limit
                keys = []
                async for key in redis.scan_iter(match=pattern, count=100):
                    keys.append(key)
                    if len(keys) >= 1000:  # Safety limit to prevent slow scans
                        logger.warning(
                            "Cache invalidate: hit 1000 key limit for %s, "
                            "some keys may not be invalidated",
                            pattern,
                        )
                        break

                if not keys:
                    logger.debug("Cache invalidate: no keys match %s", pattern)
                    return 0

                # Delete all matching keys
                deleted = await redis.delete(*keys)
                logger.debug("Cache invalidate: deleted %s keys matching %s", deleted, pattern)
                return deleted
        except Exception as e:
            logger.warning("Cache invalidate error for %s: %s", pattern, e)
            return 0

    async def invalidate_articles(self) -> int:
        """Invalidate all article-related cache."""
        return await self.invalidate_pattern("articles:*")

    async def invalidate_financial_centers(self) -> int:
        """Invalidate all financial center cache."""
        return await self.invalidate_pattern("financial_centers:*")

    async def invalidate_cost_centers(self) -> int:
        """Invalidate all cost center cache."""
        return await self.invalidate_pattern("cost_centers:*")

    async def invalidate_recurring_plans(self, user_id: int | None = None) -> int:
        """
        Invalidate recurring plan cache.

        Called after mutations: create, update, delete, activate.
        Ensures fresh data on next request.

        Args:
            user_id: If specified, invalidate only this user's cache.
                     If None, invalidate ALL recurring plan caches (admin operation).

        Returns:
            Number of keys invalidated
        """
        if user_id:
            pattern = f"recurring_plans:{user_id}:*"
        else:
            pattern = "recurring_plans:*"

        count = await self.invalidate_pattern(pattern)
        logger.info("[RECURRING_PLAN_CACHE] Invalidated %s keys: pattern=%s", count, pattern)
        return count

    async def invalidate_dashboard(self) -> int:
        """Invalidate dashboard cache (quick stats, balances)."""
        count = await self.invalidate_pattern("dashboard:*")
        count += await self.invalidate_pattern("recent:*")
        return count

    async def invalidate_all(self) -> int:
        """Invalidate all cache keys."""
        return await self.invalidate_pattern("*")


# Singleton instance
cache_service = CacheService()


# Convenience functions for common patterns
async def cached_list(
    key: CacheKey,
    fetch_fn: Callable[[], Any],
    ttl: int | None = None,
) -> list:
    """
    Cache a list of items.

    Convenience wrapper for caching list endpoints.

    Args:
        key: Cache key
        fetch_fn: Function to fetch data on cache miss
        ttl: TTL in seconds (default: REFERENCE category TTL)
    """
    if ttl is None:
        ttl = CacheTTL.REFERENCE()
    return await cache_service.get_or_set(key, fetch_fn, ttl)


async def invalidate_on_change(entity_type: str) -> int:
    """
    Invalidate cache based on entity type.

    Call this after CREATE, UPDATE, DELETE operations.

    Args:
        entity_type: One of "articles", "financial_centers", "cost_centers", "facts"

    Returns:
        Number of keys invalidated
    """
    if entity_type == "articles":
        return await cache_service.invalidate_articles()
    elif entity_type == "financial_centers":
        return await cache_service.invalidate_financial_centers()
    elif entity_type == "cost_centers":
        return await cache_service.invalidate_cost_centers()
    elif entity_type == "facts":
        return await cache_service.invalidate_dashboard()
    else:
        logger.warning("Unknown entity type for cache invalidation: %s", entity_type)
        return 0
