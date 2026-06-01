"""
Redis Pub/Sub service for multi-worker WebSocket broadcasting.

This module provides Redis Pub/Sub functionality for synchronizing
WebSocket events across multiple uvicorn workers.

Architecture:
    Worker 1: [local WS connections] ─┬─> publish ─> Redis Pub/Sub
    Worker 2: [local WS connections] ─┼─> publish ─> Redis Pub/Sub
    Worker N: [local WS connections] ─┴─> publish ─> Redis Pub/Sub
                                          │
                                          ▼
    Redis Pub/Sub channel: budget:events
                                          │
                                          ▼
    Worker 1: subscribe ─> forward to local connections
    Worker 2: subscribe ─> forward to local connections
    Worker N: subscribe ─> forward to local connections

Usage:
    # On app startup:
    await start_pubsub_listener(local_broadcast_callback)

    # On app shutdown:
    await stop_pubsub_listener()

    # To broadcast (from any worker):
    await publish_event("fact_created", {"id": 123, ...})
"""

import asyncio
import logging
import time
from collections.abc import Callable, Coroutine
from datetime import datetime
from typing import Any

from redis.exceptions import ConnectionError as RedisConnectionError
from redis.exceptions import TimeoutError as RedisTimeoutError

from backend.app.core.json_utils import dumps as json_dumps
from backend.app.core.json_utils import loads as json_loads
from backend.app.services.redis_service import get_redis, is_redis_available

logger = logging.getLogger(__name__)

# Redis channel for budget events
BUDGET_EVENTS_CHANNEL = "budget:events"

# Redis key for event buffer (ZSET with timestamp as score)
EVENT_BUFFER_KEY = "budget:event_buffer"
EVENT_BUFFER_MAX_AGE = 60  # Seconds to keep events in buffer
EVENT_BUFFER_MAX_SIZE = 1000  # Maximum events in buffer

# Subscriber task reference
_subscriber_task: asyncio.Task | None = None
_local_broadcast_callback: Callable[[str, dict], Coroutine] | None = None
_this_worker_id: str | None = None


async def publish_event(event_type: str, data: dict[str, Any], source_worker_id: str | None = None) -> bool:
    """
    Publish event to Redis Pub/Sub channel and add to event buffer.

    This is called when a local worker creates/updates/deletes data.
    The event will be received by ALL workers (including this one).

    Args:
        event_type: Event type (fact_created, fact_updated, etc.)
        data: Event data
        source_worker_id: Worker ID that originated the event. Subscribers with
            the same worker ID will skip the event to avoid double-delivery.

    Returns:
        True if published successfully, False otherwise
    """
    if not is_redis_available():
        logger.debug("Redis not available, skipping publish")
        return False

    event = {
        "type": event_type,
        "data": data,
        "timestamp": datetime.utcnow().isoformat(),
        "ts": time.time(),  # Unix timestamp for sorting
        "source_worker_id": source_worker_id,
    }
    message = json_dumps(event)

    try:
        async with get_redis() as redis:
            # Publish to Pub/Sub channel
            await redis.publish(BUDGET_EVENTS_CHANNEL, message)

            # Add to event buffer (ZSET with timestamp as score)
            await redis.zadd(EVENT_BUFFER_KEY, {message: event["ts"]})

            # Trim old events from buffer
            cutoff = time.time() - EVENT_BUFFER_MAX_AGE
            await redis.zremrangebyscore(EVENT_BUFFER_KEY, "-inf", cutoff)

            # Also trim by size (keep only MAX_SIZE newest)
            buffer_size = await redis.zcard(EVENT_BUFFER_KEY)
            if buffer_size > EVENT_BUFFER_MAX_SIZE:
                # Remove oldest events
                to_remove = buffer_size - EVENT_BUFFER_MAX_SIZE
                await redis.zremrangebyrank(EVENT_BUFFER_KEY, 0, to_remove - 1)

        logger.debug("Published event: %s", event_type)
        return True

    except Exception as e:
        logger.error("Failed to publish event: %s", e)
        return False


async def get_events_since(since_timestamp: float) -> list[dict]:
    """
    Get events from Redis buffer since timestamp.

    Used by long polling fallback.

    Args:
        since_timestamp: Unix timestamp to get events since

    Returns:
        List of events with type, data, and timestamp
    """
    if not is_redis_available():
        return []

    try:
        async with get_redis() as redis:
            # Get events with score (timestamp) > since_timestamp
            # ZRANGEBYSCORE returns events ordered by timestamp
            events_raw = await redis.zrangebyscore(
                EVENT_BUFFER_KEY,
                min=since_timestamp,
                max="+inf",
                withscores=False
            )

            events = []
            for event_json in events_raw:
                try:
                    event = json_loads(event_json)
                    # Only include events after the requested timestamp
                    if event.get("ts", 0) > since_timestamp:
                        events.append({
                            "type": event["type"],
                            "data": event["data"],
                            "timestamp": event["ts"],
                        })
                except ValueError:
                    continue

            return events

    except Exception as e:
        logger.error("Failed to get events from buffer: %s", e)
        return []


async def _subscriber_loop():
    """
    Background task that subscribes to Redis Pub/Sub and forwards events.

    This runs in each worker and forwards received events to local
    WebSocket connections via the registered callback.
    """
    global _local_broadcast_callback, _this_worker_id

    logger.info("Starting Redis Pub/Sub subscriber...")

    while True:
        try:
            if not is_redis_available():
                logger.warning("Redis not available, waiting...")
                await asyncio.sleep(5)
                continue

            async with get_redis() as redis:
                pubsub = redis.pubsub()
                await pubsub.subscribe(BUDGET_EVENTS_CHANNEL)
                logger.info("Subscribed to Redis channel: %s", BUDGET_EVENTS_CHANNEL)
                # Use get_message() in a loop instead of listen() — prevents blocking
                # and allows proper context manager handling with timeout control
                try:
                    while True:
                        message = await pubsub.get_message(ignore_subscribe_messages=False, timeout=1.0)

                        if message is None:
                            # No message within timeout - continue
                            await asyncio.sleep(0.01)
                            continue

                        if message["type"] == "message":
                            try:
                                event = json_loads(message["data"])
                                event_type = event.get("type")
                                event_data = event.get("data", {})

                                source_worker_id = event.get("source_worker_id")
                                if source_worker_id and source_worker_id == _this_worker_id:
                                    logger.debug("Skipping own-worker event: %s", event_type)
                                    continue

                                logger.debug("Received Pub/Sub event: %s", event_type)

                                if _local_broadcast_callback:
                                    await _local_broadcast_callback(event_type, event_data)
                                else:
                                    logger.warning("No callback registered, event %s dropped", event_type)

                            except ValueError as e:
                                logger.warning("Invalid JSON in Pub/Sub message: %s", e)
                            except Exception as e:
                                logger.error("Error processing Pub/Sub message: %s", e, exc_info=True)
                finally:
                    try:
                        await pubsub.aclose()
                    except Exception:
                        pass

        except asyncio.CancelledError:
            logger.info("Redis Pub/Sub subscriber cancelled")
            raise
        except (asyncio.TimeoutError, RedisTimeoutError):
            continue
        except RedisConnectionError as e:
            logger.warning("Redis connection lost, reconnecting in 5s: %s", e)
            await asyncio.sleep(5)
        except Exception as e:
            error_msg = str(e)
            if "Timeout" in error_msg or "timeout" in error_msg:
                continue
            logger.error("Redis Pub/Sub error: %s", e)
            await asyncio.sleep(5)


async def start_pubsub_listener(
    local_broadcast_callback: Callable[[str, dict], Coroutine],
    worker_id: str | None = None,
) -> bool:
    """
    Start the Redis Pub/Sub subscriber background task.

    Args:
        local_broadcast_callback: Async function to call when event received.
            Signature: async def callback(event_type: str, data: dict)
        worker_id: Unique ID for this worker. Events published with this
            source_worker_id will be skipped to avoid double-delivery.

    Returns:
        True if started successfully, False otherwise
    """
    global _subscriber_task, _local_broadcast_callback, _this_worker_id

    if not is_redis_available():
        logger.warning("Redis not available, Pub/Sub listener not started")
        return False

    if _subscriber_task is not None:
        logger.warning("Pub/Sub listener already running")
        return True

    _local_broadcast_callback = local_broadcast_callback
    _this_worker_id = worker_id
    _subscriber_task = asyncio.create_task(_subscriber_loop())

    logger.info("Redis Pub/Sub listener started")
    return True


async def stop_pubsub_listener() -> None:
    """Stop the Redis Pub/Sub subscriber background task."""
    global _subscriber_task, _local_broadcast_callback

    if _subscriber_task is not None:
        _subscriber_task.cancel()
        try:
            await _subscriber_task
        except asyncio.CancelledError:
            pass
        _subscriber_task = None

    _local_broadcast_callback = None
    logger.info("Redis Pub/Sub listener stopped")


def is_pubsub_running() -> bool:
    """Check if Pub/Sub listener is running."""
    return _subscriber_task is not None and not _subscriber_task.done()
