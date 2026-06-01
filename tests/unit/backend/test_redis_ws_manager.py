"""Unit tests for RedisBudgetWebSocketManager.broadcast() direct-first behavior."""

import pytest
from unittest.mock import AsyncMock, patch


@pytest.mark.asyncio
async def test_broadcast_calls_local_broadcast_even_when_redis_available():
    """
    broadcast() must call _local_broadcast() directly regardless of Redis availability.
    Previously it returned early after publishing to Redis, skipping local delivery.
    """
    with patch("backend.app.services.redis_ws_manager.is_redis_available", return_value=True), \
         patch("backend.app.services.redis_ws_manager.publish_event", new_callable=AsyncMock) as mock_publish:

        from backend.app.services.redis_ws_manager import RedisBudgetWebSocketManager
        manager = RedisBudgetWebSocketManager()

        local_called = []

        async def fake_local_broadcast(event_type, data):  # noqa: ARG001
            local_called.append(event_type)

        manager._local_broadcast = fake_local_broadcast
        mock_publish.return_value = True

        await manager.broadcast("fact_created", {"id": 1})

    assert "fact_created" in local_called, "_local_broadcast() must be called even when Redis is available"


@pytest.mark.asyncio
async def test_broadcast_publishes_with_worker_id():
    """
    broadcast() must pass source_worker_id=self._worker_id to publish_event().
    """
    with patch("backend.app.services.redis_ws_manager.is_redis_available", return_value=True), \
         patch("backend.app.services.redis_ws_manager.publish_event", new_callable=AsyncMock) as mock_publish:

        from backend.app.services.redis_ws_manager import RedisBudgetWebSocketManager
        manager = RedisBudgetWebSocketManager()
        manager._local_broadcast = AsyncMock()
        mock_publish.return_value = True

        await manager.broadcast("fact_created", {"id": 1})

        mock_publish.assert_called_once_with(
            "fact_created", {"id": 1}, source_worker_id=manager._worker_id
        )


@pytest.mark.asyncio
async def test_broadcast_local_only_when_redis_unavailable():
    """
    broadcast() must still call _local_broadcast() when Redis is unavailable.
    """
    with patch("backend.app.services.redis_ws_manager.is_redis_available", return_value=False), \
         patch("backend.app.services.redis_ws_manager.publish_event", new_callable=AsyncMock) as mock_publish:

        from backend.app.services.redis_ws_manager import RedisBudgetWebSocketManager
        manager = RedisBudgetWebSocketManager()

        local_called = []
        async def fake_local_broadcast(event_type, data):  # noqa: ARG001
            local_called.append(event_type)
        manager._local_broadcast = fake_local_broadcast

        await manager.broadcast("fact_created", {"id": 1})

    assert "fact_created" in local_called
    mock_publish.assert_not_called()
