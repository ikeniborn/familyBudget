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
MAX_CONNECTIONS_PER_USER = 3  # Max SSE connections per user (lower than lists - one per tab)
MAX_TOTAL_CONNECTIONS = 500  # Max total SSE connections system-wide
USER_STATUS_CHECK_INTERVAL = timedelta(minutes=5)  # How often to verify user is active

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
        connections = [(user_id, queue), ...]

    Unlike shopping lists, budget SSE is global (shared family budget model).
    All users receive ALL budget events (no per-entity filtering).

    Security features:
        - MAX_CONNECTIONS_PER_USER: Limit connections per user (DoS protection)
        - MAX_TOTAL_CONNECTIONS: Limit total connections (resource protection)
    """

    def __init__(self):
        # List of (user_id, queue) tuples - global, not per-entity
        self.connections: list[tuple[int, asyncio.Queue]] = []
        self._lock = asyncio.Lock()

    def _count_user_connections(self, user_id: int) -> int:
        """Count total connections for a user."""
        return sum(1 for uid, _ in self.connections if uid == user_id)

    async def connect(self, user_id: int) -> asyncio.Queue:
        """
        Register a new SSE connection with security limits.

        Args:
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
                    f"Budget SSE connection rejected: user {user_id} exceeded limit "
                    f"({user_conn_count}/{MAX_CONNECTIONS_PER_USER})"
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

            # Create queue and register connection
            queue: asyncio.Queue = asyncio.Queue(maxsize=100)  # Limit queue size
            self.connections.append((user_id, queue))

        logger.info(
            f"Budget SSE connected: user {user_id} "
            f"(user_total={user_conn_count + 1}, system_total={total_conn_count + 1})"
        )
        return queue

    async def disconnect(self, user_id: int, queue: asyncio.Queue):
        """
        Remove a SSE connection.

        Args:
            user_id: User ID
            queue: The queue associated with this connection
        """
        async with self._lock:
            self.connections = [
                (uid, q) for uid, q in self.connections
                if q is not queue
            ]

        logger.info(f"Budget SSE disconnected: user {user_id}")

    async def broadcast(
        self,
        event_type: str,
        data: dict[str, Any],
        exclude_user_id: int | None = None,
    ):
        """
        Broadcast event to all connected clients.

        Shared Family Budget model: ALL users receive ALL events.

        Args:
            event_type: Event type (fact_created, fact_updated, etc.)
            data: Event data (will be JSON serialized)
            exclude_user_id: Optional user ID to exclude (sender)
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

        # Count recipients (excluding sender)
        recipient_count = sum(1 for uid, _ in connections if uid != exclude_user_id)
        logger.info(
            f"Budget SSE broadcast: event={event_type}, "
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
    queue = await manager.connect(current_user.id)
    user_id = current_user.id  # Capture for use in generator

    async def event_generator():
        """Generate SSE events from queue with security checks."""
        last_user_check = datetime.utcnow()

        try:
            # Send initial connection event
            yield {
                "event": "connected",
                "data": json.dumps({
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
                                f"Budget SSE disconnecting inactive user {user_id}"
                            )
                            break
                        last_user_check = now
                    except Exception as e:
                        logger.error(f"Budget SSE user status check failed: {e}")
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
            await manager.disconnect(user_id, queue)

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

async def broadcast_fact_created(
    fact_data: dict,
    user_id: int | None = None,
):
    """
    Broadcast fact created event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    """
    filtered_data = _filter_fact_data(fact_data)
    logger.debug(f"broadcast_fact_created: fact_id={fact_data.get('id')}")
    await manager.broadcast(
        event_type="fact_created",
        data=filtered_data,
        exclude_user_id=user_id,
    )


async def broadcast_fact_updated(
    fact_data: dict,
    user_id: int | None = None,
):
    """
    Broadcast fact updated event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    """
    filtered_data = _filter_fact_data(fact_data)
    logger.debug(f"broadcast_fact_updated: fact_id={fact_data.get('id')}")
    await manager.broadcast(
        event_type="fact_updated",
        data=filtered_data,
        exclude_user_id=user_id,
    )


async def broadcast_fact_deleted(
    fact_id: int,
    user_id: int | None = None,
):
    """Broadcast fact deleted event."""
    logger.debug(f"broadcast_fact_deleted: fact_id={fact_id}")
    await manager.broadcast(
        event_type="fact_deleted",
        data={"id": fact_id},
        exclude_user_id=user_id,
    )


# Plan broadcast functions (same as facts, different event type)

async def broadcast_plan_created(
    plan_data: dict,
    user_id: int | None = None,
):
    """
    Broadcast plan created event with filtered data.

    Plans use the same BudgetFact model with record_type='plan'.
    """
    filtered_data = _filter_fact_data(plan_data)
    logger.debug(f"broadcast_plan_created: plan_id={plan_data.get('id')}")
    await manager.broadcast(
        event_type="plan_created",
        data=filtered_data,
        exclude_user_id=user_id,
    )


async def broadcast_plan_updated(
    plan_data: dict,
    user_id: int | None = None,
):
    """
    Broadcast plan updated event with filtered data.
    """
    filtered_data = _filter_fact_data(plan_data)
    logger.debug(f"broadcast_plan_updated: plan_id={plan_data.get('id')}")
    await manager.broadcast(
        event_type="plan_updated",
        data=filtered_data,
        exclude_user_id=user_id,
    )


async def broadcast_plan_deleted(
    plan_id: int,
    user_id: int | None = None,
):
    """Broadcast plan deleted event."""
    logger.debug(f"broadcast_plan_deleted: plan_id={plan_id}")
    await manager.broadcast(
        event_type="plan_deleted",
        data={"id": plan_id},
        exclude_user_id=user_id,
    )


# Transfer broadcast functions

async def broadcast_transfer_created(
    transfer_data: dict,
    user_id: int | None = None,
):
    """
    Broadcast transfer created event with filtered data.

    Security: Only safe fields are broadcast to prevent information disclosure.
    """
    filtered_data = _filter_transfer_data(transfer_data)
    logger.debug(f"broadcast_transfer_created: transfer_id={transfer_data.get('id')}")
    await manager.broadcast(
        event_type="transfer_created",
        data=filtered_data,
        exclude_user_id=user_id,
    )


async def broadcast_transfer_deleted(
    transfer_id: int,
    user_id: int | None = None,
):
    """Broadcast transfer deleted event."""
    logger.debug(f"broadcast_transfer_deleted: transfer_id={transfer_id}")
    await manager.broadcast(
        event_type="transfer_deleted",
        data={"id": transfer_id},
        exclude_user_id=user_id,
    )
