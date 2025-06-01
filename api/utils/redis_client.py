import os
import json
import redis.asyncio as redis
from typing import Optional, Any
from datetime import timedelta
from functools import wraps
import hashlib
import asyncio

# Redis configuration
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_DB = int(os.getenv("REDIS_DB", 0))

# Default TTL values (in seconds)
DEFAULT_TTL = 300  # 5 minutes
LONG_TTL = 3600   # 1 hour
SHORT_TTL = 60    # 1 minute


class RedisClient:
    """Async Redis client for caching."""
    
    _instance = None
    _redis = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(RedisClient, cls).__new__(cls)
        return cls._instance
    
    async def connect(self):
        """Connect to Redis."""
        if self._redis is None:
            self._redis = await redis.Redis(
                host=REDIS_HOST,
                port=REDIS_PORT,
                db=REDIS_DB,
                decode_responses=True
            )
        return self._redis
    
    async def get(self, key: str) -> Optional[Any]:
        """Get value from cache."""
        try:
            redis_client = await self.connect()
            value = await redis_client.get(key)
            if value:
                return json.loads(value)
            return None
        except Exception as e:
            print(f"Redis get error: {e}")
            return None
    
    async def set(self, key: str, value: Any, ttl: int = DEFAULT_TTL):
        """Set value in cache with TTL."""
        try:
            redis_client = await self.connect()
            await redis_client.set(
                key, 
                json.dumps(value), 
                ex=ttl
            )
        except Exception as e:
            print(f"Redis set error: {e}")
    
    async def delete(self, key: str):
        """Delete key from cache."""
        try:
            redis_client = await self.connect()
            await redis_client.delete(key)
        except Exception as e:
            print(f"Redis delete error: {e}")
    
    async def delete_pattern(self, pattern: str):
        """Delete all keys matching pattern."""
        try:
            redis_client = await self.connect()
            async for key in redis_client.scan_iter(match=pattern):
                await redis_client.delete(key)
        except Exception as e:
            print(f"Redis delete pattern error: {e}")
    
    async def close(self):
        """Close Redis connection."""
        if self._redis:
            await self._redis.close()
            self._redis = None


# Global Redis client instance
redis_client = RedisClient()


def cache_key_wrapper(*args, **kwargs) -> str:
    """Generate cache key from function arguments."""
    key_parts = []
    
    # Add args to key
    for arg in args:
        if hasattr(arg, '__dict__'):
            # Skip self/cls arguments
            continue
        key_parts.append(str(arg))
    
    # Add kwargs to key
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}:{v}")
    
    # Create hash of all parts
    key_string = ":".join(key_parts)
    return hashlib.md5(key_string.encode()).hexdigest()


def cache_result(prefix: str, ttl: int = DEFAULT_TTL):
    """
    Decorator to cache function results in Redis.
    
    Args:
        prefix: Cache key prefix
        ttl: Time to live in seconds
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Generate cache key
            cache_key = f"{prefix}:{cache_key_wrapper(*args, **kwargs)}"
            
            # Try to get from cache
            cached_value = await redis_client.get(cache_key)
            if cached_value is not None:
                return cached_value
            
            # Call function and cache result
            result = await func(*args, **kwargs)
            await redis_client.set(cache_key, result, ttl)
            
            return result
        return wrapper
    return decorator


def invalidate_cache(pattern: str):
    """
    Decorator to invalidate cache after function execution.
    
    Args:
        pattern: Cache key pattern to invalidate
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Call function
            result = await func(*args, **kwargs)
            
            # Invalidate cache
            await redis_client.delete_pattern(pattern)
            
            return result
        return wrapper
    return decorator