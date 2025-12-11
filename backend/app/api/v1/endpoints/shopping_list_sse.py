"""
Shopping List SSE (Server-Sent Events) endpoint.

This module provides real-time push notifications for shopping list changes.
Uses Server-Sent Events for one-way server-to-client communication.

Single-instance deployment: Uses in-memory ConnectionManager.

Events:
    - item_created: New item added to list
    - item_updated: Item modified (including completion)
    - item_deleted: Item soft-deleted
    - item_completed: Item marked as completed (subset of updated)
"""

import asyncio
import json
import logging
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from sse_starlette.sse import EventSourceResponse

from backend.app.core.dependencies import get_current_user
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/shopping-lists",
    tags=["shopping-list-sse"],
    responses=get_common_responses(),
)


class ConnectionManager:
    """
    In-memory connection manager for SSE.

    Single-instance deployment: All connections stored in memory.

    Structure:
        connections[list_id] = [(user_id, queue), ...]

    Each client gets an asyncio.Queue for receiving events.
    """

    def __init__(self):
        # list_id -> list of (user_id, queue) tuples
        self.connections: dict[int, list[tuple[int, asyncio.Queue]]] = {}
        self._lock = asyncio.Lock()

    async def connect(self, list_id: int, user_id: int) -> asyncio.Queue:
        """
        Register a new SSE connection.

        Args:
            list_id: Shopping list ID to subscribe to
            user_id: User ID making the connection

        Returns:
            asyncio.Queue for receiving events
        """
        queue: asyncio.Queue = asyncio.Queue()

        async with self._lock:
            if list_id not in self.connections:
                self.connections[list_id] = []

            self.connections[list_id].append((user_id, queue))

        logger.info(f"SSE connected: user {user_id} to list {list_id}")
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
            return

        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        async with self._lock:
            connections = list(self.connections.get(list_id, []))

        for user_id, queue in connections:
            if exclude_user_id and user_id == exclude_user_id:
                continue  # Don't send to sender

            try:
                queue.put_nowait(event)
            except asyncio.QueueFull:
                logger.warning(f"SSE queue full for user {user_id}, list {list_id}")

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
    last_event_id: str | None = Query(None, alias="Last-Event-ID"),
):
    """
    Server-Sent Events endpoint for shopping list updates.

    Clients connect to this endpoint to receive real-time updates:
    - item_created: New item added
    - item_updated: Item modified
    - item_deleted: Item soft-deleted
    - item_completed: Item marked as completed

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

    async def event_generator():
        """Generate SSE events from queue."""
        try:
            # Send initial connection event
            yield {
                "event": "connected",
                "data": json.dumps({
                    "list_id": list_id,
                    "user_id": current_user.id,
                    "timestamp": datetime.utcnow().isoformat(),
                }),
            }

            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break

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
            await manager.disconnect(list_id, current_user.id, queue)

    return EventSourceResponse(event_generator())


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


async def broadcast_item_created(
    list_id: int,
    item_data: dict,
    user_id: int | None = None,
):
    """Broadcast item created event."""
    await manager.broadcast(
        list_id=list_id,
        event_type="item_created",
        data=item_data,
        exclude_user_id=user_id,
    )


async def broadcast_item_updated(
    list_id: int,
    item_data: dict,
    user_id: int | None = None,
):
    """Broadcast item updated event."""
    await manager.broadcast(
        list_id=list_id,
        event_type="item_updated",
        data=item_data,
        exclude_user_id=user_id,
    )


async def broadcast_item_deleted(
    list_id: int,
    item_id: int,
    user_id: int | None = None,
):
    """Broadcast item deleted event."""
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
    await manager.broadcast(
        list_id=list_id,
        event_type="item_completed",
        data={"id": item_id, "is_completed": is_completed},
        exclude_user_id=user_id,
    )
