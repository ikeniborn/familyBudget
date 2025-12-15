"""
Shopping List SSE (Server-Sent Events) endpoint.

This module provides real-time push notifications for shopping list changes.
Uses Server-Sent Events for one-way server-to-client communication.

Single-instance deployment: Uses in-memory ConnectionManager.

Security features:
    - Connection limits per user and per list (DoS protection)
    - Periodic user status validation (deactivated users disconnected)
    - Security headers for SSE responses
    - Filtered data in broadcasts (no sensitive fields)

Events:
    - item_created: New item added to list
    - item_updated: Item modified (including completion)
    - item_deleted: Item soft-deleted
    - item_completed: Item marked as completed (subset of updated)
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from backend.app.core.dependencies import get_current_user
from backend.app.db.session import get_session
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses

# Security constants
MAX_CONNECTIONS_PER_USER = 5  # Max SSE connections per user across all lists
MAX_CONNECTIONS_PER_LIST = 100  # Max SSE connections per shopping list
USER_STATUS_CHECK_INTERVAL = timedelta(minutes=5)  # How often to verify user is active

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/shopping-lists",
    tags=["shopping-list-sse"],
    responses=get_common_responses(),
)


class ConnectionManager:
    """
    In-memory connection manager for SSE with security limits.

    Single-instance deployment: All connections stored in memory.

    Structure:
        connections[list_id] = [(user_id, queue), ...]

    Security features:
        - MAX_CONNECTIONS_PER_USER: Limit connections per user (DoS protection)
        - MAX_CONNECTIONS_PER_LIST: Limit connections per list (resource protection)

    Each client gets an asyncio.Queue for receiving events.
    """

    def __init__(self):
        # list_id -> list of (user_id, queue) tuples
        self.connections: dict[int, list[tuple[int, asyncio.Queue]]] = {}
        self._lock = asyncio.Lock()

    def _count_user_connections(self, user_id: int) -> int:
        """Count total connections for a user across all lists."""
        count = 0
        for conns in self.connections.values():
            count += sum(1 for uid, _ in conns if uid == user_id)
        return count

    async def connect(self, list_id: int, user_id: int) -> asyncio.Queue:
        """
        Register a new SSE connection with security limits.

        Args:
            list_id: Shopping list ID to subscribe to
            user_id: User ID making the connection

        Returns:
            asyncio.Queue for receiving events

        Raises:
            HTTPException: If connection limits exceeded
        """
        async with self._lock:
            # Check per-user limit
            user_conn_count = self._count_user_connections(user_id)
            if user_conn_count >= MAX_CONNECTIONS_PER_USER:
                logger.warning(
                    f"SSE connection rejected: user {user_id} exceeded limit "
                    f"({user_conn_count}/{MAX_CONNECTIONS_PER_USER})"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many SSE connections. Maximum {MAX_CONNECTIONS_PER_USER} allowed per user.",
                )

            # Check per-list limit
            list_conn_count = len(self.connections.get(list_id, []))
            if list_conn_count >= MAX_CONNECTIONS_PER_LIST:
                logger.warning(
                    f"SSE connection rejected: list {list_id} exceeded limit "
                    f"({list_conn_count}/{MAX_CONNECTIONS_PER_LIST})"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many SSE connections for this list. Please try again later.",
                )

            # Create queue and register connection
            queue: asyncio.Queue = asyncio.Queue(maxsize=100)  # Limit queue size

            if list_id not in self.connections:
                self.connections[list_id] = []

            self.connections[list_id].append((user_id, queue))

        logger.info(
            f"SSE connected: user {user_id} to list {list_id} "
            f"(user_total={user_conn_count + 1}, list_total={list_conn_count + 1})"
        )
        return queue

    async def disconnect(self, list_id: int, user_id: int, queue: asyncio.Queue):
        """
        Remove a SSE connection.

        Args:
            list_id: Shopping list ID
            user_id: User ID
            queue: The queue associated with this connection
        """
        async with self._lock:
            if list_id in self.connections:
                self.connections[list_id] = [
                    (uid, q) for uid, q in self.connections[list_id]
                    if q is not queue
                ]

                # Clean up empty lists
                if not self.connections[list_id]:
                    del self.connections[list_id]

        logger.info(f"SSE disconnected: user {user_id} from list {list_id}")

    async def broadcast(
        self,
        list_id: int,
        event_type: str,
        data: dict[str, Any],
        exclude_user_id: int | None = None,
    ):
        """
        Broadcast event to all connected clients for a list.

        Args:
            list_id: Shopping list ID
            event_type: Event type (item_created, item_updated, etc.)
            data: Event data (will be JSON serialized)
            exclude_user_id: Optional user ID to exclude (sender)
        """
        if list_id not in self.connections:
            logger.debug(f"SSE broadcast skipped: no connections for list {list_id}")
            return

        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        async with self._lock:
            connections = list(self.connections.get(list_id, []))

        # Подсчет получателей (исключая отправителя)
        recipient_count = sum(1 for uid, _ in connections if uid != exclude_user_id)
        logger.info(
            f"SSE broadcast: event={event_type}, list={list_id}, "
            f"total_connections={len(connections)}, recipients={recipient_count}, "
            f"exclude_user={exclude_user_id}"
        )

        sent_count = 0
        for user_id, queue in connections:
            if exclude_user_id and user_id == exclude_user_id:
                continue  # Don't send to sender

            try:
                queue.put_nowait(event)
                sent_count += 1
            except asyncio.QueueFull:
                logger.warning(f"SSE queue full for user {user_id}, list {list_id}")

        logger.debug(f"SSE broadcast complete: sent to {sent_count} clients for list {list_id}")

    def get_connection_count(self, list_id: int) -> int:
        """Get number of active connections for a list."""
        return len(self.connections.get(list_id, []))

    def get_total_connections(self) -> int:
        """Get total number of active connections."""
        return sum(len(conns) for conns in self.connections.values())


# Global connection manager (single-instance deployment)
manager = ConnectionManager()


def get_sse_manager() -> ConnectionManager:
    """Dependency to get the SSE manager."""
    return manager


@router.get(
    "/{list_id}/events",
    summary="Subscribe to shopping list events",
    description="SSE endpoint for real-time shopping list updates",
)
async def shopping_list_events(
    list_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    last_event_id: str | None = Query(None, alias="Last-Event-ID"),
):
    """
    Server-Sent Events endpoint for shopping list updates.

    Clients connect to this endpoint to receive real-time updates:
    - item_created: New item added
    - item_updated: Item modified
    - item_deleted: Item soft-deleted
    - item_completed: Item marked as completed

    **Security:**
    - Requires valid JWT authentication
    - Connection limits enforced (per-user and per-list)
    - Periodic user status validation (disconnects deactivated users)

    **Reconnection:**
    - Client should reconnect on connection loss
    - Use exponential backoff (1s, 2s, 4s, max 30s)
    - Last-Event-ID header for resumption (not implemented yet)

    **Example client code:**
    ```javascript
    const eventSource = new EventSource(`/api/v1/shopping-lists/${listId}/events`);
    eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        console.log(data.type, data.data);
    };
    ```
    """
    queue = await manager.connect(list_id, current_user.id)
    user_id = current_user.id  # Capture for use in generator

    async def event_generator():
        """Generate SSE events from queue with security checks."""
        last_user_check = datetime.utcnow()

        try:
            # Send initial connection event
            yield {
                "event": "connected",
                "data": json.dumps({
                    "list_id": list_id,
                    "user_id": user_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }),
            }

            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break

                # Periodic user status check (security: disconnect deactivated users)
                now = datetime.utcnow()
                if now - last_user_check > USER_STATUS_CHECK_INTERVAL:
                    try:
                        user = await session.get(User, user_id)
                        if not user or not getattr(user, "is_active", True):
                            logger.warning(
                                f"SSE disconnecting inactive user {user_id} from list {list_id}"
                            )
                            break
                        last_user_check = now
                    except Exception as e:
                        logger.error(f"SSE user status check failed: {e}")
                        # Continue on DB errors, don't disconnect

                try:
                    # Wait for event with timeout (for keepalive)
                    event = await asyncio.wait_for(queue.get(), timeout=30.0)

                    yield {
                        "event": event["type"],
                        "data": json.dumps(event["data"], default=str),
                    }

                except asyncio.TimeoutError:
                    # Send keepalive ping
                    yield {
                        "event": "ping",
                        "data": json.dumps({"timestamp": datetime.utcnow().isoformat()}),
                    }

        except asyncio.CancelledError:
            pass
        finally:
            await manager.disconnect(list_id, user_id, queue)

    # Return SSE response with security headers
    return EventSourceResponse(
        event_generator(),
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "X-Content-Type-Options": "nosniff",
            "X-Accel-Buffering": "no",  # Disable nginx buffering for SSE
        },
    )


@router.get(
    "/{list_id}/events/status",
    summary="Get SSE connection status",
    description="Get number of active connections for a list",
)
async def get_sse_status(
    list_id: int,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get SSE connection status for a shopping list.

    Returns number of active connections.
    """
    return {
        "list_id": list_id,
        "connection_count": manager.get_connection_count(list_id),
        "total_connections": manager.get_total_connections(),
    }


# Helper functions for broadcasting from other endpoints

# Fields safe to broadcast (no sensitive data)
SAFE_ITEM_FIELDS = {
    "id",
    "shopping_list_id",
    "product_name",
    "quantity",
    "unit",
    "is_completed",
    "store_id",
    "product_group_id",
    "sort_order",
    # Exclude: created_by_id, comment (personal), created_at, updated_at (internal)
}


def _filter_item_data(item_data: dict) -> dict:
    """
    Filter item data to include only safe fields for broadcast.

    Security: Prevents information disclosure of sensitive fields
    like creator_id, personal comments, and internal timestamps.

    Args:
        item_data: Full item data dictionary

    Returns:
        Filtered dictionary with only safe fields
    """
    return {k: v for k, v in item_data.items() if k in SAFE_ITEM_FIELDS}


async def broadcast_item_created(
    list_id: int,
    item_data: dict,
    user_id: int | None = None,
):
    """
    Broadcast item created event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    """
    filtered_data = _filter_item_data(item_data)
    logger.debug(f"broadcast_item_created: list={list_id}, item_id={item_data.get('id')}")
    await manager.broadcast(
        list_id=list_id,
        event_type="item_created",
        data=filtered_data,
        exclude_user_id=user_id,
    )


async def broadcast_item_updated(
    list_id: int,
    item_data: dict,
    user_id: int | None = None,
):
    """
    Broadcast item updated event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    """
    filtered_data = _filter_item_data(item_data)
    logger.debug(f"broadcast_item_updated: list={list_id}, item_id={item_data.get('id')}")
    await manager.broadcast(
        list_id=list_id,
        event_type="item_updated",
        data=filtered_data,
        exclude_user_id=user_id,
    )


async def broadcast_item_deleted(
    list_id: int,
    item_id: int,
    user_id: int | None = None,
):
    """Broadcast item deleted event."""
    logger.debug(f"broadcast_item_deleted: list={list_id}, item_id={item_id}")
    await manager.broadcast(
        list_id=list_id,
        event_type="item_deleted",
        data={"id": item_id},
        exclude_user_id=user_id,
    )


async def broadcast_item_completed(
    list_id: int,
    item_id: int,
    is_completed: bool,
    user_id: int | None = None,
):
    """Broadcast item completed event."""
    logger.debug(f"broadcast_item_completed: list={list_id}, item={item_id}, completed={is_completed}")
    await manager.broadcast(
        list_id=list_id,
        event_type="item_completed",
        data={"id": item_id, "is_completed": is_completed},
        exclude_user_id=user_id,
    )
