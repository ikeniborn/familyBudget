import aioredis
import json
import logging
from typing import Optional, Any, Union
import os
from contextlib import asynccontextmanager

logger = logging.getLogger(__name__)


class RedisClient:
    """Redis client for caching with async support"""
    
    def __init__(
        self,
        host: str = None,
        port: int = None,
        db: int = 0,
        password: str = None,
        default_ttl: int = 3600  # 1 hour default TTL
    ):
        self.host = host or os.getenv("REDIS_HOST", "redis")
        self.port = port or int(os.getenv("REDIS_PORT", "6379"))
        self.db = db
        self.password = password or os.getenv("REDIS_PASSWORD")
        self.default_ttl = default_ttl
        self.pool: Optional[aioredis.Redis] = None
        
    async def init_pool(self) -> None:
        """Initialize Redis connection pool"""
        try:
            self.pool = await aioredis.from_url(
                f"redis://{self.host}:{self.port}/{self.db}",
                password=self.password,
                encoding="utf-8",
                decode_responses=True,
                max_connections=20
            )
            # Test connection
            await self.pool.ping()
            logger.info(f"Redis connected to {self.host}:{self.port}")
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            self.pool = None
    
    async def close_pool(self) -> None:
        """Close Redis connection pool"""
        if self.pool:
            await self.pool.close()
            self.pool = None
            logger.info("Redis connection closed")
    
    def _serialize(self, data: Any) -> str:
        """Serialize data to JSON string"""
        return json.dumps(data, default=str, ensure_ascii=False)
    
    def _deserialize(self, data: str) -> Any:
        """Deserialize JSON string to data"""
        try:
            return json.loads(data)
        except (json.JSONDecodeError, TypeError):
            return data
    
    def _make_key(self, key: str, user_id: str = None) -> str:
        """Create a cache key with optional user isolation"""
        if user_id:
            return f"user:{user_id}:{key}"
        return key
    
    async def get(self, key: str, user_id: str = None) -> Optional[Any]:
        """Get value from cache"""
        if not self.pool:
            return None
        
        try:
            cache_key = self._make_key(key, user_id)
            value = await self.pool.get(cache_key)
            if value:
                return self._deserialize(value)
            return None
        except Exception as e:
            logger.error(f"Redis GET error for key '{key}': {e}")
            return None
    
    async def set(
        self, 
        key: str, 
        value: Any, 
        ttl: int = None, 
        user_id: str = None
    ) -> bool:
        """Set value in cache with TTL"""
        if not self.pool:
            return False
        
        try:
            cache_key = self._make_key(key, user_id)
            serialized_value = self._serialize(value)
            ttl = ttl or self.default_ttl
            
            await self.pool.setex(cache_key, ttl, serialized_value)
            return True
        except Exception as e:
            logger.error(f"Redis SET error for key '{key}': {e}")
            return False
    
    async def delete(self, key: str, user_id: str = None) -> bool:
        """Delete value from cache"""
        if not self.pool:
            return False
        
        try:
            cache_key = self._make_key(key, user_id)
            result = await self.pool.delete(cache_key)
            return result > 0
        except Exception as e:
            logger.error(f"Redis DELETE error for key '{key}': {e}")
            return False
    
    async def exists(self, key: str, user_id: str = None) -> bool:
        """Check if key exists in cache"""
        if not self.pool:
            return False
        
        try:
            cache_key = self._make_key(key, user_id)
            result = await self.pool.exists(cache_key)
            return result > 0
        except Exception as e:
            logger.error(f"Redis EXISTS error for key '{key}': {e}")
            return False
    
    async def invalidate_pattern(self, pattern: str, user_id: str = None) -> int:
        """Invalidate all keys matching a pattern"""
        if not self.pool:
            return 0
        
        try:
            cache_pattern = self._make_key(pattern, user_id)
            keys = await self.pool.keys(cache_pattern)
            if keys:
                return await self.pool.delete(*keys)
            return 0
        except Exception as e:
            logger.error(f"Redis INVALIDATE_PATTERN error for pattern '{pattern}': {e}")
            return 0
    
    async def increment(self, key: str, amount: int = 1, user_id: str = None) -> Optional[int]:
        """Increment a counter"""
        if not self.pool:
            return None
        
        try:
            cache_key = self._make_key(key, user_id)
            result = await self.pool.incrby(cache_key, amount)
            return result
        except Exception as e:
            logger.error(f"Redis INCREMENT error for key '{key}': {e}")
            return None
    
    async def set_if_not_exists(
        self, 
        key: str, 
        value: Any, 
        ttl: int = None, 
        user_id: str = None
    ) -> bool:
        """Set value only if key doesn't exist"""
        if not self.pool:
            return False
        
        try:
            cache_key = self._make_key(key, user_id)
            serialized_value = self._serialize(value)
            
            # Use SET with NX (only if not exists) and EX (expiration)
            ttl = ttl or self.default_ttl
            result = await self.pool.set(cache_key, serialized_value, nx=True, ex=ttl)
            return result is True
        except Exception as e:
            logger.error(f"Redis SET_IF_NOT_EXISTS error for key '{key}': {e}")
            return False


# Decorator for caching function results
def cache_result(
    key_template: str, 
    ttl: int = 3600, 
    use_user_id: bool = True
):
    """
    Decorator to cache function results
    
    Args:
        key_template: Template for cache key (can use {param_name} placeholders)
        ttl: Time to live in seconds
        use_user_id: Whether to include user_id in cache key
    """
    def decorator(func):
        async def wrapper(*args, **kwargs):
            # Get Redis client from global scope or kwargs
            redis_client = kwargs.get('redis_client') or getattr(func, '_redis_client', None)
            
            if not redis_client:
                # No Redis client available, execute function directly
                return await func(*args, **kwargs)
            
            # Build cache key from template and function arguments
            try:
                # Get function parameter names
                import inspect
                sig = inspect.signature(func)
                bound_args = sig.bind(*args, **kwargs)
                bound_args.apply_defaults()
                
                # Format key template with arguments
                cache_key = key_template.format(**bound_args.arguments)
                
                # Get user_id if needed
                user_id = bound_args.arguments.get('user_id') if use_user_id else None
                
                # Try to get from cache first
                cached_result = await redis_client.get(cache_key, user_id)
                if cached_result is not None:
                    logger.debug(f"Cache HIT for key: {cache_key}")
                    return cached_result
                
                # Execute function and cache result
                result = await func(*args, **kwargs)
                
                # Cache the result
                await redis_client.set(cache_key, result, ttl, user_id)
                logger.debug(f"Cache SET for key: {cache_key}")
                
                return result
            
            except Exception as e:
                logger.error(f"Cache decorator error: {e}")
                # Fallback to executing function without caching
                return await func(*args, **kwargs)
        
        return wrapper
    return decorator


# Global Redis client instance
redis_client = RedisClient()