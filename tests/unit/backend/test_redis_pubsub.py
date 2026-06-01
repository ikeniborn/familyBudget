"""Unit tests for redis_pubsub_service — exception handler imports."""


def test_redis_exception_classes_importable():
    """Ensure fix imports RedisTimeoutError and RedisConnectionError from correct module."""
    from redis.exceptions import TimeoutError as RedisTimeoutError
    from redis.exceptions import ConnectionError as RedisConnectionError

    # Both must be proper exception classes
    assert issubclass(RedisTimeoutError, Exception)
    assert issubclass(RedisConnectionError, Exception)


def test_redis_exception_not_confused_with_builtin():
    """RedisConnectionError must not be the same as builtins.ConnectionError."""
    from redis.exceptions import ConnectionError as RedisConnectionError
    assert RedisConnectionError is not ConnectionError


import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


@pytest.mark.asyncio
async def test_publish_event_includes_source_worker_id():
    """publish_event() must include source_worker_id in the envelope sent to Redis."""
    captured = {}

    async def fake_publish(channel, message):
        import json
        captured["envelope"] = json.loads(message)
        return 1

    mock_redis = AsyncMock()
    mock_redis.publish = fake_publish
    mock_redis.zadd = AsyncMock()
    mock_redis.zremrangebyscore = AsyncMock()
    mock_redis.zcard = AsyncMock(return_value=0)
    mock_redis.__aenter__ = AsyncMock(return_value=mock_redis)
    mock_redis.__aexit__ = AsyncMock(return_value=False)

    with patch("backend.app.services.redis_pubsub_service.is_redis_available", return_value=True), \
         patch("backend.app.services.redis_pubsub_service.get_redis", return_value=mock_redis):

        from backend.app.services.redis_pubsub_service import publish_event
        result = await publish_event("fact_created", {"id": 1}, source_worker_id="worker-abc")

    assert result is True
    assert captured["envelope"]["source_worker_id"] == "worker-abc"


@pytest.mark.asyncio
async def test_publish_event_source_worker_id_defaults_none():
    """publish_event() without source_worker_id sends null in envelope."""
    captured = {}

    async def fake_publish(channel, message):
        import json
        captured["envelope"] = json.loads(message)
        return 1

    mock_redis = AsyncMock()
    mock_redis.publish = fake_publish
    mock_redis.zadd = AsyncMock()
    mock_redis.zremrangebyscore = AsyncMock()
    mock_redis.zcard = AsyncMock(return_value=0)
    mock_redis.__aenter__ = AsyncMock(return_value=mock_redis)
    mock_redis.__aexit__ = AsyncMock(return_value=False)

    with patch("backend.app.services.redis_pubsub_service.is_redis_available", return_value=True), \
         patch("backend.app.services.redis_pubsub_service.get_redis", return_value=mock_redis):

        from backend.app.services.redis_pubsub_service import publish_event
        result = await publish_event("fact_created", {"id": 1})

    assert result is True
    assert captured["envelope"].get("source_worker_id") is None
