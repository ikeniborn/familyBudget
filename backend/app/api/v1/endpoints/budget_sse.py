"""
Budget SSE (Server-Sent Events) endpoint.

This module provides real-time push notifications for budget changes
(facts, plans, transfers) across the shared family budget.

Uses Server-Sent Events for one-way server-to-client communication.

Single-instance deployment: Uses in-memory ConnectionManager.

Security features:
    - Connection limits per user (DoS protection)
    - Periodic user status validation (deactivated users disconnected)
    - Security headers for SSE responses
    - Filtered data in broadcasts (no sensitive fields)

Events:
    - fact_created: New budget fact added
    - fact_updated: Budget fact modified
    - fact_deleted: Budget fact deleted
    - plan_created: New plan entry added
    - plan_updated: Plan entry modified
    - plan_deleted: Plan entry deleted
    - transfer_created: New transfer created
    - transfer_deleted: Transfer deleted
"""

import asyncio
import json
import logging
import time
import uuid
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
MAX_CONNECTIONS_PER_USER = 10  # Max SSE connections per user (increased for multiple devices/tabs)
MAX_TOTAL_CONNECTIONS = 500  # Max total SSE connections system-wide
USER_STATUS_CHECK_INTERVAL = timedelta(minutes=5)  # How often to verify user is active
STALE_CONNECTION_TIMEOUT = 60  # Seconds without activity before connection considered stale
SSE_KEEPALIVE_TIMEOUT = 10.0  # Seconds between ping/event cycles (reduced from 30 for faster stale detection)

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/budget",
    tags=["budget-sse"],
    responses=get_common_responses(),
)


class BudgetConnectionManager:
    """
    In-memory connection manager for Budget SSE with security limits.

    Single-instance deployment: All connections stored in memory.

    Structure:
        connections = [(user_id, queue, connection_id, last_activity_timestamp), ...]

    Unlike shopping lists, budget SSE is global (shared family budget model).
    All users receive ALL budget events (no per-entity filtering).

    Security features:
        - MAX_CONNECTIONS_PER_USER: Limit connections per user (DoS protection)
        - MAX_TOTAL_CONNECTIONS: Limit total connections (resource protection)
        - Periodic cleanup of stale connections (zombie protection)
        - Active disconnect via connection_id (fast tab close handling)
    """

    def __init__(self):
        # List of (user_id, queue, connection_id, last_activity_timestamp) tuples
        self.connections: list[tuple[int, asyncio.Queue, str, float]] = []
        self._lock = asyncio.Lock()

    def _count_user_connections(self, user_id: int) -> int:
        """Count total connections for a user."""
        return sum(1 for uid, _, _, _ in self.connections if uid == user_id)

    async def connect(self, user_id: int) -> tuple[asyncio.Queue, str]:
        """
        Register a new SSE connection with security limits.

        Args:
            user_id: User ID making the connection

        Returns:
            Tuple of (asyncio.Queue for receiving events, connection_id)

        Raises:
            HTTPException: If connection limits exceeded
        """
        async with self._lock:
            # Check per-user limit
            user_conn_count = self._count_user_connections(user_id)

            # Log connection attempt for diagnostics
            logger.info(
                f"Budget SSE connect attempt: user={user_id}, "
                f"current_connections={user_conn_count}/{MAX_CONNECTIONS_PER_USER}"
            )

            if user_conn_count >= MAX_CONNECTIONS_PER_USER:
                logger.warning(
                    f"Budget SSE 429: user={user_id}, "
                    f"connections={user_conn_count}/{MAX_CONNECTIONS_PER_USER} - limit exceeded"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many SSE connections. Maximum {MAX_CONNECTIONS_PER_USER} allowed per user.",
                )

            # Check total limit
            total_conn_count = len(self.connections)
            if total_conn_count >= MAX_TOTAL_CONNECTIONS:
                logger.warning(
                    f"Budget SSE connection rejected: system limit exceeded "
                    f"({total_conn_count}/{MAX_TOTAL_CONNECTIONS})"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many active connections. Please try again later.",
                )

            # Create queue and register connection with unique ID and timestamp
            connection_id = str(uuid.uuid4())
            queue: asyncio.Queue = asyncio.Queue(maxsize=100)  # Limit queue size
            self.connections.append((user_id, queue, connection_id, time.time()))

        logger.info(
            f"Budget SSE connected: user={user_id}, conn_id={connection_id[:8]}... "
            f"(user_total={user_conn_count + 1}, system_total={total_conn_count + 1})"
        )
        return queue, connection_id

    async def disconnect(self, user_id: int, queue: asyncio.Queue, reason: str = "normal"):
        """
        Remove a SSE connection by queue reference.

        Args:
            user_id: User ID
            queue: The queue associated with this connection
            reason: Disconnect reason for diagnostics (normal, client_disconnect, user_inactive, error)
        """
        async with self._lock:
            prev_count = len(self.connections)
            self.connections = [
                (uid, q, cid, ts) for uid, q, cid, ts in self.connections
                if q is not queue
            ]
            new_count = len(self.connections)

        logger.info(
            f"Budget SSE disconnected: user={user_id}, reason={reason}, "
            f"connections_before={prev_count}, connections_after={new_count}"
        )

    async def disconnect_by_id(self, user_id: int, connection_id: str) -> bool:
        """
        Disconnect a specific connection by its ID (called from sendBeacon).

        Args:
            user_id: User ID (must match for security)
            connection_id: The connection UUID to disconnect

        Returns:
            True if connection was found and removed, False otherwise
        """
        async with self._lock:
            prev_count = len(self.connections)
            self.connections = [
                (uid, q, cid, ts) for uid, q, cid, ts in self.connections
                if not (uid == user_id and cid == connection_id)
            ]
            removed = len(self.connections) < prev_count

        if removed:
            logger.info(
                f"Budget SSE disconnect_by_id: user={user_id}, conn_id={connection_id[:8]}..."
            )
        else:
            logger.debug(
                f"Budget SSE disconnect_by_id: not found user={user_id}, conn_id={connection_id[:8]}..."
            )
        return removed

    def update_activity(self, connection_id: str):
        """
        Update last activity timestamp for a connection (called on each ping).

        Args:
            connection_id: The connection UUID to update
        """
        for i, (uid, q, cid, ts) in enumerate(self.connections):
            if cid == connection_id:
                self.connections[i] = (uid, q, cid, time.time())
                break

    async def cleanup_stale_connections(self) -> int:
        """
        Remove connections that haven't had activity for > STALE_CONNECTION_TIMEOUT seconds.

        This is the GUARANTEE that zombie connections will eventually be cleaned up,
        even if the client didn't send a proper disconnect signal.

        Returns:
            Number of removed connections
        """
        now = time.time()
        async with self._lock:
            prev_count = len(self.connections)
            stale = [
                (uid, cid) for uid, q, cid, ts in self.connections
                if now - ts > STALE_CONNECTION_TIMEOUT
            ]
            self.connections = [
                conn for conn in self.connections
                if now - conn[3] <= STALE_CONNECTION_TIMEOUT
            ]
            removed = prev_count - len(self.connections)

        for uid, cid in stale:
            logger.warning(
                f"Budget SSE cleanup_stale: user={uid}, conn_id={cid[:8]}... "
                f"(stale for >{STALE_CONNECTION_TIMEOUT}s)"
            )

        return removed

    async def broadcast(
        self,
        event_type: str,
        data: dict[str, Any],
    ):
        """
        Broadcast event to all connected clients.

        Shared Family Budget model: ALL users receive ALL events.
        No exclusions - all connected clients receive the event.

        Args:
            event_type: Event type (fact_created, fact_updated, etc.)
            data: Event data (will be JSON serialized)
        """
        if not self.connections:
            logger.debug(f"Budget SSE broadcast skipped: no connections")
            return

        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }

        async with self._lock:
            connections = list(self.connections)

        logger.info(
            f"Budget SSE broadcast: event={event_type}, "
            f"total_connections={len(connections)}"
        )

        sent_count = 0
        for user_id, queue, connection_id, last_activity in connections:
            try:
                queue.put_nowait(event)
                sent_count += 1
            except asyncio.QueueFull:
                logger.warning(f"Budget SSE queue full for user {user_id}")

        logger.debug(f"Budget SSE broadcast complete: sent to {sent_count} clients")

    def get_connection_count(self) -> int:
        """Get number of active connections."""
        return len(self.connections)

    def get_user_connection_count(self, user_id: int) -> int:
        """Get number of connections for a specific user."""
        return self._count_user_connections(user_id)


# Global connection manager (single-instance deployment)
manager = BudgetConnectionManager()


def get_budget_sse_manager() -> BudgetConnectionManager:
    """Dependency to get the Budget SSE manager."""
    return manager


@router.get(
    "/events",
    summary="Subscribe to budget events",
    description="SSE endpoint for real-time budget updates (facts, plans, transfers)",
)
async def budget_events(
    request: Request,
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_session),
    last_event_id: str | None = Query(None, alias="Last-Event-ID"),
):
    """
    Server-Sent Events endpoint for budget updates.

    Shared Family Budget model: All authenticated users receive ALL budget events.

    Events:
    - fact_created: New budget fact added
    - fact_updated: Budget fact modified
    - fact_deleted: Budget fact deleted
    - plan_created: New plan entry added
    - plan_updated: Plan entry modified
    - plan_deleted: Plan entry deleted
    - transfer_created: New transfer created
    - transfer_deleted: Transfer deleted

    **Security:**
    - Requires valid JWT authentication
    - Connection limits enforced (per-user and system-wide)
    - Periodic user status validation (disconnects deactivated users)

    **Reconnection:**
    - Client should reconnect on connection loss
    - Use exponential backoff (1s, 2s, 4s, max 30s)
    - Last-Event-ID header for resumption (not implemented yet)

    **Example client code:**
    ```javascript
    const eventSource = new EventSource('/api/v1/budget/events');
    eventSource.addEventListener('fact_created', (event) => {
        const data = JSON.parse(event.data);
        console.log('New fact:', data);
    });
    ```
    """
    queue, connection_id = await manager.connect(current_user.id)
    user_id = current_user.id  # Capture for use in generator

    async def event_generator():
        """Generate SSE events from queue with security checks."""
        last_user_check = datetime.utcnow()
        disconnect_reason = "normal"

        try:
            # Send initial connection event with connection_id for client to track
            yield {
                "event": "connected",
                "data": json.dumps({
                    "user_id": user_id,
                    "connection_id": connection_id,
                    "timestamp": datetime.utcnow().isoformat(),
                }),
            }

            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    disconnect_reason = "client_disconnect"
                    break

                # Periodic user status check (security: disconnect deactivated users)
                now = datetime.utcnow()
                if now - last_user_check > USER_STATUS_CHECK_INTERVAL:
                    try:
                        user = await session.get(User, user_id)
                        if not user or not getattr(user, "is_active", True):
                            logger.warning(
                                f"Budget SSE disconnecting inactive user {user_id}"
                            )
                            disconnect_reason = "user_inactive"
                            break
                        last_user_check = now
                    except Exception as e:
                        logger.error(f"Budget SSE user status check failed: {e}")
                        # Continue on DB errors, don't disconnect

                try:
                    # Wait for event with reduced timeout for faster stale detection
                    event = await asyncio.wait_for(queue.get(), timeout=SSE_KEEPALIVE_TIMEOUT)

                    yield {
                        "event": event["type"],
                        "data": json.dumps(event["data"], default=str),
                    }

                except asyncio.TimeoutError:
                    # Send keepalive ping and update activity timestamp
                    manager.update_activity(connection_id)
                    yield {
                        "event": "ping",
                        "data": json.dumps({"timestamp": datetime.utcnow().isoformat()}),
                    }

        except asyncio.CancelledError:
            disconnect_reason = "cancelled"
        except Exception as e:
            disconnect_reason = f"error:{type(e).__name__}"
            logger.error(f"Budget SSE error for user {user_id}: {e}")
        finally:
            await manager.disconnect(user_id, queue, reason=disconnect_reason)

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
    "/events/status",
    summary="Get budget SSE connection status",
    description="Get number of active SSE connections",
)
async def get_budget_sse_status(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get Budget SSE connection status.

    Returns number of active connections (total and per-user).
    """
    return {
        "total_connections": manager.get_connection_count(),
        "user_connections": manager.get_user_connection_count(current_user.id),
        "limits": {
            "max_per_user": MAX_CONNECTIONS_PER_USER,
            "max_total": MAX_TOTAL_CONNECTIONS,
        },
    }


@router.post(
    "/events/disconnect",
    summary="Actively disconnect SSE connection",
    description="Called by client via sendBeacon when tab is hidden/closed",
)
async def disconnect_sse_connection(
    request: Request,
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Actively disconnect an SSE connection by its ID.

    Called by the client's sendBeacon() when the tab is hidden or closed.
    This allows immediate cleanup of the connection slot, rather than
    waiting for the server to detect the disconnect via timeout.

    Request body:
        {"connection_id": "uuid-string"}

    Returns:
        {"status": "disconnected"} if connection was found and removed
        {"status": "not_found"} if connection was not found (already closed)
    """
    try:
        body = await request.json()
        connection_id = body.get("connection_id")
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid JSON body",
        )

    if not connection_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="connection_id required",
        )

    removed = await manager.disconnect_by_id(current_user.id, connection_id)
    return {"status": "disconnected" if removed else "not_found"}


# ==================== Background Cleanup Task ====================
# Periodic cleanup of stale connections (zombie protection)

_cleanup_task: asyncio.Task | None = None


async def _periodic_cleanup():
    """
    Background task that cleans up stale SSE connections every 30 seconds.

    This is the GUARANTEE that zombie connections will be cleaned up,
    even in edge cases like:
    - Browser force-quit
    - Network drop without graceful close
    - Client crash
    """
    logger.info("Budget SSE cleanup task started")
    while True:
        await asyncio.sleep(30)  # Run every 30 seconds
        try:
            removed = await manager.cleanup_stale_connections()
            if removed > 0:
                logger.info(f"Budget SSE cleanup: removed {removed} stale connections")
        except Exception as e:
            logger.error(f"Budget SSE cleanup error: {e}")


def start_cleanup_task():
    """Start the background cleanup task (call from app startup)."""
    global _cleanup_task
    if _cleanup_task is None:
        _cleanup_task = asyncio.create_task(_periodic_cleanup())
        logger.info("Budget SSE cleanup task scheduled")


def stop_cleanup_task():
    """Stop the background cleanup task (call from app shutdown)."""
    global _cleanup_task
    if _cleanup_task is not None:
        _cleanup_task.cancel()
        _cleanup_task = None
        logger.info("Budget SSE cleanup task stopped")


# Helper functions for broadcasting from other endpoints

# Fields safe to broadcast for facts (no sensitive internal data)
SAFE_FACT_FIELDS = {
    "id",
    "article_id",
    "financial_center_id",
    "cost_center_id",
    "amount",
    "fact_date",
    "description",
    "record_type",
    "transfer_id",
    # Exclude: user_id (creator), sync_hash, is_offline_sync (internal)
}

# Fields safe to broadcast for transfers
SAFE_TRANSFER_FIELDS = {
    "id",
    "source_fact_id",
    "target_fact_id",
    "amount",
    "transfer_date",
    "description",
}


def _filter_fact_data(fact_data: dict) -> dict:
    """
    Filter fact data to include only safe fields for broadcast.

    Security: Prevents information disclosure of sensitive fields.
    """
    return {k: v for k, v in fact_data.items() if k in SAFE_FACT_FIELDS}


def _filter_transfer_data(transfer_data: dict) -> dict:
    """
    Filter transfer data to include only safe fields for broadcast.

    Security: Prevents information disclosure of sensitive fields.
    """
    return {k: v for k, v in transfer_data.items() if k in SAFE_TRANSFER_FIELDS}


# Fact broadcast functions

async def broadcast_fact_created(fact_data: dict):
    """
    Broadcast fact created event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    All connected clients receive the event (shared family budget model).
    """
    filtered_data = _filter_fact_data(fact_data)
    logger.debug(f"broadcast_fact_created: fact_id={fact_data.get('id')}")
    await manager.broadcast(
        event_type="fact_created",
        data=filtered_data,
    )


async def broadcast_fact_updated(fact_data: dict):
    """
    Broadcast fact updated event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    All connected clients receive the event (shared family budget model).
    """
    filtered_data = _filter_fact_data(fact_data)
    logger.debug(f"broadcast_fact_updated: fact_id={fact_data.get('id')}")
    await manager.broadcast(
        event_type="fact_updated",
        data=filtered_data,
    )


async def broadcast_fact_deleted(fact_id: int):
    """Broadcast fact deleted event to all connected clients."""
    logger.debug(f"broadcast_fact_deleted: fact_id={fact_id}")
    await manager.broadcast(
        event_type="fact_deleted",
        data={"id": fact_id},
    )


# Plan broadcast functions (same as facts, different event type)

async def broadcast_plan_created(plan_data: dict):
    """
    Broadcast plan created event with filtered data.

    Plans use the same BudgetFact model with record_type='plan'.
    All connected clients receive the event (shared family budget model).
    """
    filtered_data = _filter_fact_data(plan_data)
    logger.debug(f"broadcast_plan_created: plan_id={plan_data.get('id')}")
    await manager.broadcast(
        event_type="plan_created",
        data=filtered_data,
    )


async def broadcast_plan_updated(plan_data: dict):
    """
    Broadcast plan updated event with filtered data.
    All connected clients receive the event (shared family budget model).
    """
    filtered_data = _filter_fact_data(plan_data)
    logger.debug(f"broadcast_plan_updated: plan_id={plan_data.get('id')}")
    await manager.broadcast(
        event_type="plan_updated",
        data=filtered_data,
    )


async def broadcast_plan_deleted(plan_id: int):
    """Broadcast plan deleted event to all connected clients."""
    logger.debug(f"broadcast_plan_deleted: plan_id={plan_id}")
    await manager.broadcast(
        event_type="plan_deleted",
        data={"id": plan_id},
    )


# Transfer broadcast functions

async def broadcast_transfer_created(transfer_data: dict):
    """
    Broadcast transfer created event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    All connected clients receive the event (shared family budget model).
    """
    filtered_data = _filter_transfer_data(transfer_data)
    logger.debug(f"broadcast_transfer_created: transfer_id={transfer_data.get('id')}")
    await manager.broadcast(
        event_type="transfer_created",
        data=filtered_data,
    )


async def broadcast_transfer_deleted(transfer_id: int):
    """Broadcast transfer deleted event to all connected clients."""
    logger.debug(f"broadcast_transfer_deleted: transfer_id={transfer_id}")
    await manager.broadcast(
        event_type="transfer_deleted",
        data={"id": transfer_id},
    )


# ==================== Shopping List Item Broadcasts ====================
# Consolidated from shopping_list_sse.py for unified SSE endpoint

# Fields safe to broadcast for shopping list items (no sensitive data)
SAFE_ITEM_FIELDS = {
    "id",
    "shopping_list_id",  # Needed for client-side filtering
    "product_name",
    "quantity",
    "unit",
    "is_completed",
    "store_id",
    "product_group_id",
    "sort_order",
    # Exclude: created_by_id (creator), comment (personal), created_at, updated_at (internal)
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


async def broadcast_item_created(item_data: dict):
    """
    Broadcast item created event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    Note: item_data must contain shopping_list_id for client-side filtering.
    All connected clients receive the event (shared family budget model).
    """
    filtered_data = _filter_item_data(item_data)
    logger.debug(f"broadcast_item_created: item_id={item_data.get('id')}, list_id={item_data.get('shopping_list_id')}")
    await manager.broadcast(
        event_type="item_created",
        data=filtered_data,
    )


async def broadcast_item_updated(item_data: dict):
    """
    Broadcast item updated event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    All connected clients receive the event (shared family budget model).
    """
    filtered_data = _filter_item_data(item_data)
    logger.debug(f"broadcast_item_updated: item_id={item_data.get('id')}, list_id={item_data.get('shopping_list_id')}")
    await manager.broadcast(
        event_type="item_updated",
        data=filtered_data,
    )


async def broadcast_item_deleted(item_id: int, shopping_list_id: int):
    """
    Broadcast item deleted event to all connected clients.

    Note: shopping_list_id is required for client-side filtering.
    """
    logger.debug(f"broadcast_item_deleted: item_id={item_id}, list_id={shopping_list_id}")
    await manager.broadcast(
        event_type="item_deleted",
        data={"id": item_id, "shopping_list_id": shopping_list_id},
    )


async def broadcast_item_completed(item_id: int, shopping_list_id: int, is_completed: bool):
    """
    Broadcast item completed event to all connected clients.

    Note: shopping_list_id is required for client-side filtering.
    """
    logger.debug(f"broadcast_item_completed: item_id={item_id}, list_id={shopping_list_id}, completed={is_completed}")
    await manager.broadcast(
        event_type="item_completed",
        data={"id": item_id, "shopping_list_id": shopping_list_id, "is_completed": is_completed},
    )
