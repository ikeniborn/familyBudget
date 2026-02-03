"""
Redis-backed WebSocket Manager for multi-worker deployments.

This module provides a WebSocket connection manager that uses Redis
for cross-worker event broadcasting while keeping WebSocket connections
local to each worker (WebSocket objects cannot be serialized).

Architecture:
    ┌─────────────────────────────────────────────────────────────────────┐
    │                    UVICORN (N Workers)                               │
    │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │
    │  │  Worker 1   │  │  Worker 2   │  │  Worker N   │                 │
    │  │ LocalConns  │  │ LocalConns  │  │ LocalConns  │                 │
    │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘                 │
    │         │                │                │                         │
    │         └────────────────┴────────────────┘                         │
    │                          │                                          │
    │                          ▼                                          │
    │               ┌───────────────────┐                                 │
    │               │  Redis Pub/Sub    │                                 │
    │               │  budget:events    │                                 │
    │               └───────────────────┘                                 │
    └─────────────────────────────────────────────────────────────────────┘

Usage:
    # Get manager instance (uses Redis if available, in-memory otherwise)
    manager = get_ws_manager()

    # Connect/disconnect (local to worker)
    conn_id = await manager.connect(websocket, user_id)
    await manager.disconnect(user_id, websocket)

    # Broadcast (goes through Redis Pub/Sub)
    await manager.broadcast("fact_created", {...})
"""

import asyncio
import logging
import time
import uuid
from datetime import datetime
from typing import Any

from fastapi import HTTPException, WebSocket, status

from backend.app.core.json_utils import dumps as json_dumps
from backend.app.services.redis_pubsub_service import (
    get_events_since as redis_get_events_since,
    publish_event,
    start_pubsub_listener,
    stop_pubsub_listener,
)
from backend.app.services.redis_service import is_redis_available

logger = logging.getLogger(__name__)

# Security constants (same as original)
MAX_CONNECTIONS_PER_USER = 10
MAX_TOTAL_CONNECTIONS = 500
STALE_CONNECTION_TIMEOUT = 60


class RedisBudgetWebSocketManager:
    """
    Redis-backed WebSocket manager for multi-worker deployments.

    Each worker maintains its own local WebSocket connections.
    Events are broadcast via Redis Pub/Sub to all workers.

    Local connections: [(user_id, websocket, connection_id, last_activity), ...]
    """

    def __init__(self):
        # Local connections for this worker only
        self.connections: list[tuple[int, WebSocket, str, float]] = []
        self._lock = asyncio.Lock()
        self._pubsub_started = False

    def _count_user_connections(self, user_id: int) -> int:
        """Count LOCAL connections for a user (this worker only)."""
        return sum(1 for uid, _, _, _ in self.connections if uid == user_id)

    async def connect(self, websocket: WebSocket, user_id: int) -> str:
        """
        Register a new WebSocket connection (local to this worker).

        Note: Connection limits are per-worker in multi-worker mode.
        For true global limits, use Redis to track all connections.
        """
        async with self._lock:
            # Check per-user limit (local to this worker)
            user_conn_count = self._count_user_connections(user_id)

            logger.info(
                f"Budget WS connect attempt: user={user_id}, "
                f"local_connections={user_conn_count}/{MAX_CONNECTIONS_PER_USER}"
            )

            if user_conn_count >= MAX_CONNECTIONS_PER_USER:
                logger.warning(
                    f"Budget WS 429: user={user_id}, "
                    f"connections={user_conn_count}/{MAX_CONNECTIONS_PER_USER}"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many WebSocket connections per worker. Maximum {MAX_CONNECTIONS_PER_USER} allowed.",
                )

            # Check total limit (local to this worker)
            total_conn_count = len(self.connections)
            if total_conn_count >= MAX_TOTAL_CONNECTIONS:
                logger.warning(
                    f"Budget WS 429: worker limit exceeded ({total_conn_count}/{MAX_TOTAL_CONNECTIONS})"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many connections on this worker. Please try again.",
                )

            # Accept and register
            await websocket.accept()
            connection_id = str(uuid.uuid4())
            self.connections.append((user_id, websocket, connection_id, time.time()))

        logger.info(
            f"Budget WS connected: user={user_id}, conn_id={connection_id[:8]}... "
            f"(worker_total={total_conn_count + 1})"
        )
        return connection_id

    async def disconnect(self, user_id: int, websocket: WebSocket, reason: str = "normal"):
        """Remove a WebSocket connection from local connections."""
        async with self._lock:
            prev_count = len(self.connections)
            self.connections = [
                (uid, ws, cid, ts) for uid, ws, cid, ts in self.connections
                if ws is not websocket
            ]
            new_count = len(self.connections)

        logger.info(
            f"Budget WS disconnected: user={user_id}, reason={reason}, "
            f"before={prev_count}, after={new_count}"
        )

    async def disconnect_by_id(self, user_id: int, connection_id: str) -> bool:
        """Disconnect a specific connection by its ID."""
        websocket_to_close = None
        async with self._lock:
            prev_count = len(self.connections)
            for uid, ws, cid, ts in self.connections:
                if uid == user_id and cid == connection_id:
                    websocket_to_close = ws
                    break
            self.connections = [
                (uid, ws, cid, ts) for uid, ws, cid, ts in self.connections
                if not (uid == user_id and cid == connection_id)
            ]
            removed = len(self.connections) < prev_count

        if websocket_to_close:
            try:
                await websocket_to_close.close()
            except Exception:
                pass

        if removed:
            logger.info(f"Budget WS disconnect_by_id: user={user_id}, conn_id={connection_id[:8]}...")

        return removed

    async def update_activity(self, connection_id: str):
        """Update last activity timestamp for a connection."""
        async with self._lock:
            for i, (uid, ws, cid, ts) in enumerate(self.connections):
                if cid == connection_id:
                    self.connections[i] = (uid, ws, cid, time.time())
                    break

    async def cleanup_stale_connections(self) -> int:
        """Remove stale connections."""
        now = time.time()
        websockets_to_close = []
        async with self._lock:
            prev_count = len(self.connections)
            stale = [
                (uid, ws, cid) for uid, ws, cid, ts in self.connections
                if now - ts > STALE_CONNECTION_TIMEOUT
            ]
            self.connections = [
                conn for conn in self.connections
                if now - conn[3] <= STALE_CONNECTION_TIMEOUT
            ]
            removed = prev_count - len(self.connections)
            websockets_to_close = [ws for _, ws, _ in stale]

        for ws in websockets_to_close:
            try:
                await ws.close(code=1000, reason="stale_connection")
            except Exception:
                pass

        for uid, _, cid in stale:
            logger.warning(f"Budget WS cleanup_stale: user={uid}, conn_id={cid[:8]}...")

        return removed

    async def broadcast(self, event_type: str, data: dict[str, Any]):
        """
        Broadcast event to ALL workers via Redis Pub/Sub.

        If Redis is not available, falls back to local broadcast only.
        """
        # Try Redis Pub/Sub first
        if is_redis_available():
            published = await publish_event(event_type, data)
            if published:
                # Event will be received by all workers (including this one)
                # via the Pub/Sub subscriber, so we don't need to broadcast locally
                logger.debug(f"Event published to Redis: {event_type}")
                return

        # Fallback: local broadcast only (single worker mode)
        logger.debug(f"Redis unavailable, local broadcast only: {event_type}")
        await self._local_broadcast(event_type, data)

    async def _local_broadcast(self, event_type: str, data: dict[str, Any]):
        """
        Broadcast event to LOCAL WebSocket connections only.

        This is called either:
        1. By the Pub/Sub subscriber when receiving events from Redis
        2. Directly when Redis is not available (fallback mode)
        """
        if not self.connections:
            logger.debug("Local broadcast skipped: no connections")
            return

        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        message = json_dumps(event)

        async with self._lock:
            connections = list(self.connections)

        logger.info(f"Local broadcast: event={event_type}, connections={len(connections)}")

        sent_count = 0
        failed_websockets = []
        for user_id, websocket, connection_id, last_activity in connections:
            try:
                await websocket.send_text(message)
                sent_count += 1
            except Exception as e:
                logger.warning(f"WS send failed for user {user_id}: {e}")
                failed_websockets.append((user_id, websocket))

        # Remove failed connections
        for user_id, websocket in failed_websockets:
            await self.disconnect(user_id, websocket, reason="send_failed")

        logger.debug(f"Local broadcast complete: sent to {sent_count} clients")

    async def send_to_connection(self, connection_id: str, event_type: str, data: dict[str, Any]):
        """Send event to a specific local connection."""
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        message = json_dumps(event)

        async with self._lock:
            for user_id, websocket, cid, last_activity in self.connections:
                if cid == connection_id:
                    try:
                        await websocket.send_text(message)
                    except Exception as e:
                        logger.warning(f"WS send failed for connection {connection_id[:8]}: {e}")
                    break

    def get_connection_count(self) -> int:
        """Get number of LOCAL connections (this worker only)."""
        return len(self.connections)

    def get_user_connection_count(self, user_id: int) -> int:
        """Get number of LOCAL connections for a user."""
        return self._count_user_connections(user_id)

    async def start_pubsub(self):
        """Start the Redis Pub/Sub subscriber."""
        if self._pubsub_started:
            return

        if is_redis_available():
            success = await start_pubsub_listener(self._local_broadcast)
            self._pubsub_started = success
            if success:
                logger.info("Redis Pub/Sub started for WebSocket manager")
        else:
            logger.warning("Redis not available, WebSocket will work in single-worker mode")

    async def stop_pubsub(self):
        """Stop the Redis Pub/Sub subscriber."""
        if self._pubsub_started:
            await stop_pubsub_listener()
            self._pubsub_started = False
            logger.info("Redis Pub/Sub stopped")


class RedisEventBuffer:
    """
    Redis-backed event buffer for long polling.

    Uses Redis ZSET for cross-worker event storage.
    Falls back to in-memory buffer when Redis is not available.
    """

    def __init__(self, max_events: int = 1000, max_age_seconds: int = 60):
        from collections import deque
        # Fallback in-memory buffer
        self._local_events: deque[tuple[float, str, dict]] = deque(maxlen=max_events)
        self._local_lock = asyncio.Lock()
        self._new_event = asyncio.Event()
        self.max_age = max_age_seconds

    async def add_event(self, event_type: str, data: dict):
        """Add event (handled by publish_event in Redis mode)."""
        # In Redis mode, events are added via publish_event()
        # This is for fallback/local mode
        if not is_redis_available():
            async with self._local_lock:
                timestamp = time.time()
                self._local_events.append((timestamp, event_type, data))
                self._new_event.set()

    def get_events_since(self, since_timestamp: float) -> list[dict]:
        """Get events since timestamp (sync version for compatibility)."""
        # This is called synchronously, so we can't use async Redis
        # In multi-worker mode, long polling should use the async version
        now = time.time()
        cutoff = now - self.max_age

        result = []
        for ts, event_type, data in self._local_events:
            if ts < cutoff:
                continue
            if ts > since_timestamp:
                result.append({
                    "type": event_type,
                    "data": data,
                    "timestamp": ts,
                })
        return result

    async def get_events_since_async(self, since_timestamp: float) -> list[dict]:
        """Get events since timestamp (async, uses Redis if available)."""
        if is_redis_available():
            return await redis_get_events_since(since_timestamp)
        return self.get_events_since(since_timestamp)

    async def wait_for_event(self, timeout: float) -> bool:
        """Wait for a new event or timeout."""
        self._new_event.clear()
        try:
            await asyncio.wait_for(self._new_event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False


# Global instances
_redis_ws_manager: RedisBudgetWebSocketManager | None = None
_redis_event_buffer: RedisEventBuffer | None = None


def get_ws_manager() -> RedisBudgetWebSocketManager:
    """Get the Redis-backed WebSocket manager (singleton)."""
    global _redis_ws_manager
    if _redis_ws_manager is None:
        _redis_ws_manager = RedisBudgetWebSocketManager()
    return _redis_ws_manager


def get_event_buffer() -> RedisEventBuffer:
    """Get the Redis-backed event buffer (singleton)."""
    global _redis_event_buffer
    if _redis_event_buffer is None:
        _redis_event_buffer = RedisEventBuffer()
    return _redis_event_buffer


async def init_redis_ws():
    """Initialize Redis WebSocket manager (call from app startup)."""
    manager = get_ws_manager()
    await manager.start_pubsub()


async def close_redis_ws():
    """Close Redis WebSocket manager (call from app shutdown)."""
    manager = get_ws_manager()
    await manager.stop_pubsub()
