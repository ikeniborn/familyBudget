"""
Budget WebSocket endpoint.

This module provides real-time push notifications for budget changes
(facts, plans, transfers, shopping list items) across the shared family budget.

Uses WebSocket for bidirectional communication with Long Polling fallback.

Single-instance deployment: Uses in-memory ConnectionManager.
For multi-worker scaling, implement Redis Pub/Sub.

Security features:
    - Connection limits per user (DoS protection)
    - Periodic user status validation (deactivated users disconnected)
    - JWT authentication via query parameter
    - Filtered data in broadcasts (no sensitive fields)

Events (Server -> Client):
    - connected: Connection established
    - ping: Server keepalive
    - pong: Response to client ping
    - online_status: Response to check_online
    - fact_created, fact_updated, fact_deleted
    - plan_created, plan_updated, plan_deleted
    - transfer_created, transfer_deleted
    - item_created, item_updated, item_deleted, item_completed

Messages (Client -> Server):
    - ping: Client keepalive, server responds with pong
    - check_online: Check server availability for offline mode
"""

import asyncio
import json
import logging
import time
import uuid
from collections import deque
from datetime import datetime, timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, WebSocket, WebSocketDisconnect, status
from jose import JWTError, jwt
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import get_settings
from backend.app.db.session import get_session, get_session_context
from backend.app.models import User
from backend.app.schemas.errors import get_common_responses
from backend.app.core.dependencies import get_current_user
from backend.app.services.jwt import create_access_token

# Security constants
MAX_CONNECTIONS_PER_USER = 10  # Max WebSocket connections per user
MAX_TOTAL_CONNECTIONS = 500  # Max total WebSocket connections system-wide
USER_STATUS_CHECK_INTERVAL = timedelta(minutes=5)  # How often to verify user is active
STALE_CONNECTION_TIMEOUT = 60  # Seconds without activity before connection considered stale
WS_KEEPALIVE_INTERVAL = 10.0  # Seconds between server ping messages

# Long Polling constants
POLL_TIMEOUT_DEFAULT = 10  # Default long poll timeout in seconds
POLL_TIMEOUT_MAX = 30  # Maximum allowed poll timeout
EVENT_BUFFER_MAX_SIZE = 1000  # Max events in buffer
EVENT_BUFFER_MAX_AGE = 60  # Max age of events in seconds

logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/budget",
    tags=["budget-websocket"],
    responses=get_common_responses(),
)


# ==================== HTTP ENDPOINTS ====================


@router.post("/ws/token")
async def get_ws_token(current_user: User = Depends(get_current_user)):
    """
    Get a short-lived token for WebSocket connection.

    WebSocket doesn't support cookies, so client first obtains a token
    via this HTTP endpoint (with cookie auth), then uses the token
    to connect to the WebSocket endpoint.

    Returns:
        dict: {"token": "jwt_token_string"}
    """
    token = create_access_token(
        user_id=current_user.id,
        telegram_id=current_user.telegram_id
    )
    return {"token": token}


# ==================== WEBSOCKET MANAGER ====================


class BudgetWebSocketManager:
    """
    In-memory connection manager for Budget WebSocket with security limits.

    Single-instance deployment: All connections stored in memory.

    Structure:
        connections = [(user_id, websocket, connection_id, last_activity_timestamp), ...]

    Shared family budget model: All users receive ALL budget events.

    Security features:
        - MAX_CONNECTIONS_PER_USER: Limit connections per user (DoS protection)
        - MAX_TOTAL_CONNECTIONS: Limit total connections (resource protection)
        - Periodic cleanup of stale connections (zombie protection)
        - Active disconnect via connection_id (fast tab close handling)
    """

    def __init__(self):
        # List of (user_id, websocket, connection_id, last_activity_timestamp) tuples
        self.connections: list[tuple[int, WebSocket, str, float]] = []
        self._lock = asyncio.Lock()

    def _count_user_connections(self, user_id: int) -> int:
        """Count total connections for a user."""
        return sum(1 for uid, _, _, _ in self.connections if uid == user_id)

    async def connect(self, websocket: WebSocket, user_id: int) -> str:
        """
        Register a new WebSocket connection with security limits.

        Args:
            websocket: WebSocket connection
            user_id: User ID making the connection

        Returns:
            connection_id (UUID string)

        Raises:
            HTTPException: If connection limits exceeded
        """
        async with self._lock:
            # Check per-user limit
            user_conn_count = self._count_user_connections(user_id)

            logger.info(
                f"Budget WS connect attempt: user={user_id}, "
                f"current_connections={user_conn_count}/{MAX_CONNECTIONS_PER_USER}"
            )

            if user_conn_count >= MAX_CONNECTIONS_PER_USER:
                logger.warning(
                    f"Budget WS 429: user={user_id}, "
                    f"connections={user_conn_count}/{MAX_CONNECTIONS_PER_USER} - limit exceeded"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Too many WebSocket connections. Maximum {MAX_CONNECTIONS_PER_USER} allowed per user.",
                )

            # Check total limit
            total_conn_count = len(self.connections)
            if total_conn_count >= MAX_TOTAL_CONNECTIONS:
                logger.warning(
                    f"Budget WS connection rejected: system limit exceeded "
                    f"({total_conn_count}/{MAX_TOTAL_CONNECTIONS})"
                )
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Too many active connections. Please try again later.",
                )

            # Accept WebSocket and register connection
            await websocket.accept()
            connection_id = str(uuid.uuid4())
            self.connections.append((user_id, websocket, connection_id, time.time()))

        logger.info(
            f"Budget WS connected: user={user_id}, conn_id={connection_id[:8]}... "
            f"(user_total={user_conn_count + 1}, system_total={total_conn_count + 1})"
        )
        return connection_id

    async def disconnect(self, user_id: int, websocket: WebSocket, reason: str = "normal"):
        """
        Remove a WebSocket connection by websocket reference.

        Args:
            user_id: User ID
            websocket: The WebSocket associated with this connection
            reason: Disconnect reason for diagnostics
        """
        async with self._lock:
            prev_count = len(self.connections)
            self.connections = [
                (uid, ws, cid, ts) for uid, ws, cid, ts in self.connections
                if ws is not websocket
            ]
            new_count = len(self.connections)

        logger.info(
            f"Budget WS disconnected: user={user_id}, reason={reason}, "
            f"connections_before={prev_count}, connections_after={new_count}"
        )

    async def disconnect_by_id(self, user_id: int, connection_id: str) -> bool:
        """
        Disconnect a specific connection by its ID.

        Args:
            user_id: User ID (must match for security)
            connection_id: The connection UUID to disconnect

        Returns:
            True if connection was found and removed, False otherwise
        """
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
                pass  # Already closed

        if removed:
            logger.info(
                f"Budget WS disconnect_by_id: user={user_id}, conn_id={connection_id[:8]}..."
            )
        return removed

    def update_activity(self, connection_id: str):
        """
        Update last activity timestamp for a connection.

        Args:
            connection_id: The connection UUID to update
        """
        for i, (uid, ws, cid, ts) in enumerate(self.connections):
            if cid == connection_id:
                self.connections[i] = (uid, ws, cid, time.time())
                break

    async def cleanup_stale_connections(self) -> int:
        """
        Remove connections that haven't had activity for > STALE_CONNECTION_TIMEOUT seconds.

        Returns:
            Number of removed connections
        """
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

        # Close stale websockets outside the lock
        for ws in websockets_to_close:
            try:
                await ws.close(code=1000, reason="stale_connection")
            except Exception:
                pass

        for uid, _, cid in stale:
            logger.warning(
                f"Budget WS cleanup_stale: user={uid}, conn_id={cid[:8]}... "
                f"(stale for >{STALE_CONNECTION_TIMEOUT}s)"
            )

        return removed

    async def broadcast(self, event_type: str, data: dict[str, Any]):
        """
        Broadcast event to all connected WebSocket clients.

        Shared Family Budget model: ALL users receive ALL events.

        Args:
            event_type: Event type (fact_created, fact_updated, etc.)
            data: Event data (will be JSON serialized)
        """
        if not self.connections:
            logger.debug(f"Budget WS broadcast skipped: no connections")
            return

        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        message = json.dumps(event)

        async with self._lock:
            connections = list(self.connections)

        logger.info(
            f"Budget WS broadcast: event={event_type}, "
            f"total_connections={len(connections)}"
        )

        sent_count = 0
        failed_websockets = []
        for user_id, websocket, connection_id, last_activity in connections:
            try:
                await websocket.send_text(message)
                sent_count += 1
            except Exception as e:
                logger.warning(f"Budget WS send failed for user {user_id}: {e}")
                failed_websockets.append((user_id, websocket))

        # Remove failed connections
        for user_id, websocket in failed_websockets:
            await self.disconnect(user_id, websocket, reason="send_failed")

        logger.debug(f"Budget WS broadcast complete: sent to {sent_count} clients")

    async def send_to_connection(self, connection_id: str, event_type: str, data: dict[str, Any]):
        """
        Send event to a specific connection.

        Args:
            connection_id: Target connection ID
            event_type: Event type
            data: Event data
        """
        event = {
            "type": event_type,
            "data": data,
            "timestamp": datetime.utcnow().isoformat(),
        }
        message = json.dumps(event)

        for user_id, websocket, cid, last_activity in self.connections:
            if cid == connection_id:
                try:
                    await websocket.send_text(message)
                except Exception as e:
                    logger.warning(f"Budget WS send failed for connection {connection_id[:8]}: {e}")
                break

    def get_connection_count(self) -> int:
        """Get number of active connections."""
        return len(self.connections)

    def get_user_connection_count(self, user_id: int) -> int:
        """Get number of connections for a specific user."""
        return self._count_user_connections(user_id)


class EventBuffer:
    """
    Ring buffer for long polling events.

    Stores recent events for clients that fall back to long polling.
    Events are timestamped and automatically expire after max_age_seconds.
    """

    def __init__(self, max_events: int = EVENT_BUFFER_MAX_SIZE, max_age_seconds: int = EVENT_BUFFER_MAX_AGE):
        self.events: deque[tuple[float, str, dict]] = deque(maxlen=max_events)
        self.max_age = max_age_seconds
        self._lock = asyncio.Lock()
        self._new_event = asyncio.Event()

    async def add_event(self, event_type: str, data: dict):
        """Add event to buffer with current timestamp."""
        async with self._lock:
            timestamp = time.time()
            self.events.append((timestamp, event_type, data))
            self._new_event.set()  # Signal waiting pollers

    def get_events_since(self, since_timestamp: float) -> list[dict]:
        """
        Get events since timestamp.

        Args:
            since_timestamp: Unix timestamp to get events since

        Returns:
            List of events with type, data, and timestamp
        """
        now = time.time()
        cutoff = now - self.max_age

        result = []
        for ts, event_type, data in self.events:
            # Skip old events
            if ts < cutoff:
                continue
            # Return events after the requested timestamp
            if ts > since_timestamp:
                result.append({
                    "type": event_type,
                    "data": data,
                    "timestamp": ts,
                })

        return result

    async def wait_for_event(self, timeout: float) -> bool:
        """
        Wait for a new event or timeout.

        Args:
            timeout: Maximum seconds to wait

        Returns:
            True if event received, False if timeout
        """
        self._new_event.clear()
        try:
            await asyncio.wait_for(self._new_event.wait(), timeout=timeout)
            return True
        except asyncio.TimeoutError:
            return False


# Global instances (single-instance deployment)
ws_manager = BudgetWebSocketManager()
event_buffer = EventBuffer()


def get_budget_ws_manager() -> BudgetWebSocketManager:
    """Dependency to get the Budget WebSocket manager."""
    return ws_manager


async def verify_ws_token(token: str) -> User | None:
    """
    Verify JWT token from WebSocket query parameter.

    WebSocket doesn't support cookies, so JWT is passed via query param.

    Args:
        token: JWT token string

    Returns:
        User object if valid, None otherwise
    """
    try:
        settings = get_settings()
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM]
        )
        user_id: int = payload.get("sub")
        if user_id is None:
            return None

        # Get user from database
        async with get_session_context() as session:
            user = await session.get(User, user_id)
            if user and getattr(user, "is_active", True):
                return user

        return None
    except JWTError as e:
        logger.warning(f"Budget WS JWT verification failed: {e}")
        return None
    except Exception as e:
        logger.error(f"Budget WS token verification error: {e}")
        return None


@router.websocket("/ws")
async def budget_websocket_endpoint(
    websocket: WebSocket,
    token: str = Query(..., description="JWT access token"),
):
    """
    WebSocket endpoint for real-time budget updates.

    Authentication: JWT token passed via query parameter.

    Shared Family Budget model: All authenticated users receive ALL budget events.

    Server -> Client events:
        - connected: Initial connection confirmation with connection_id
        - ping: Server keepalive (every 10 seconds)
        - pong: Response to client ping
        - online_status: Response to check_online
        - fact_created/updated/deleted: Budget fact changes
        - plan_created/updated/deleted: Plan changes
        - transfer_created/deleted: Transfer changes
        - item_created/updated/deleted/completed: Shopping list item changes

    Client -> Server messages:
        - {"type": "ping"}: Client keepalive, server responds with pong
        - {"type": "check_online"}: Check server availability

    Example client code:
        const ws = new WebSocket(`wss://domain/api/v1/budget/ws?token=${jwt}`);
        ws.onmessage = (event) => {
            const msg = JSON.parse(event.data);
            console.log(msg.type, msg.data);
        };
    """
    # Verify JWT token
    user = await verify_ws_token(token)
    if not user:
        await websocket.close(code=4001, reason="Invalid or expired token")
        return

    user_id = user.id

    # Check connection limits and accept
    try:
        connection_id = await ws_manager.connect(websocket, user_id)
    except HTTPException as e:
        await websocket.close(code=4029, reason=e.detail)
        return

    # Send connected event
    await ws_manager.send_to_connection(connection_id, "connected", {
        "user_id": user_id,
        "connection_id": connection_id,
    })

    disconnect_reason = "normal"
    ping_task = None

    async def send_pings():
        """Background task to send periodic pings."""
        while True:
            await asyncio.sleep(WS_KEEPALIVE_INTERVAL)
            try:
                await ws_manager.send_to_connection(connection_id, "ping", {
                    "timestamp": datetime.utcnow().isoformat(),
                })
                ws_manager.update_activity(connection_id)
            except Exception:
                break

    try:
        # Start ping task
        ping_task = asyncio.create_task(send_pings())

        # Main message loop
        while True:
            try:
                # Wait for client message with timeout for user status check
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=USER_STATUS_CHECK_INTERVAL.total_seconds()
                )

                # Parse and handle client message
                try:
                    msg = json.loads(message)
                    msg_type = msg.get("type")

                    if msg_type == "ping":
                        # Client ping - respond with pong
                        ws_manager.update_activity(connection_id)
                        await ws_manager.send_to_connection(connection_id, "pong", {
                            "timestamp": datetime.utcnow().isoformat(),
                        })

                    elif msg_type == "check_online":
                        # Check online status for offline mode
                        ws_manager.update_activity(connection_id)
                        await ws_manager.send_to_connection(connection_id, "online_status", {
                            "online": True,
                            "timestamp": datetime.utcnow().isoformat(),
                        })

                    else:
                        logger.debug(f"Budget WS unknown message type: {msg_type}")

                except json.JSONDecodeError:
                    logger.warning(f"Budget WS invalid JSON from user {user_id}")

            except asyncio.TimeoutError:
                # Periodic user status check
                async with get_session_context() as session:
                    db_user = await session.get(User, user_id)
                    if not db_user or not getattr(db_user, "is_active", True):
                        logger.warning(f"Budget WS disconnecting inactive user {user_id}")
                        disconnect_reason = "user_inactive"
                        break  # Exit outer while loop
                # User still active, continue loop

    except WebSocketDisconnect:
        disconnect_reason = "client_disconnect"
    except asyncio.CancelledError:
        disconnect_reason = "cancelled"
    except Exception as e:
        disconnect_reason = f"error:{type(e).__name__}"
        logger.error(f"Budget WS error for user {user_id}: {e}")
    finally:
        # Cancel ping task
        if ping_task:
            ping_task.cancel()
            try:
                await ping_task
            except asyncio.CancelledError:
                pass

        # Disconnect
        await ws_manager.disconnect(user_id, websocket, reason=disconnect_reason)


@router.get(
    "/ws/status",
    summary="Get budget WebSocket connection status",
    description="Get number of active WebSocket connections",
)
async def get_budget_ws_status(
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Get Budget WebSocket connection status.

    Returns number of active connections (total and per-user).
    """
    return {
        "total_connections": ws_manager.get_connection_count(),
        "user_connections": ws_manager.get_user_connection_count(current_user.id),
        "limits": {
            "max_per_user": MAX_CONNECTIONS_PER_USER,
            "max_total": MAX_TOTAL_CONNECTIONS,
        },
    }


@router.post(
    "/ws/disconnect",
    summary="Actively disconnect WebSocket connection",
    description="Called by client via sendBeacon when tab is hidden/closed",
)
async def disconnect_ws_connection(
    connection_id: str = Query(..., description="Connection ID to disconnect"),
    current_user: User = Depends(get_current_user),
) -> dict:
    """
    Actively disconnect a WebSocket connection by its ID.

    Called by the client's sendBeacon() when the tab is hidden or closed.
    """
    removed = await ws_manager.disconnect_by_id(current_user.id, connection_id)
    return {"status": "disconnected" if removed else "not_found"}


@router.get(
    "/poll",
    summary="Long polling fallback for WebSocket",
    description="Fallback endpoint for clients that can't use WebSocket",
)
async def poll_budget_events(
    current_user: User = Depends(get_current_user),
    since: float = Query(0, description="Unix timestamp to get events since"),
    timeout: int = Query(POLL_TIMEOUT_DEFAULT, le=POLL_TIMEOUT_MAX, description="Long poll timeout in seconds"),
) -> dict:
    """
    Long polling fallback for WebSocket events.

    This endpoint is used as a fallback when WebSocket is not available.
    The client should poll this endpoint every 10 seconds.

    Comet-style: If no events are available, waits up to timeout seconds
    for new events before returning empty.

    Args:
        since: Unix timestamp to get events since
        timeout: Maximum seconds to wait for new events (default 10, max 30)

    Returns:
        {
            "events": [...],  // Events since timestamp
            "server_time": 1234567890.123,  // Current server time for next poll
        }
    """
    # Check for existing events first
    events = event_buffer.get_events_since(since)

    if events:
        # Return immediately if events are available
        return {
            "events": events,
            "server_time": time.time(),
        }

    # Wait for new events (comet-style long polling)
    got_event = await event_buffer.wait_for_event(timeout)

    if got_event:
        # Get events that arrived while waiting
        events = event_buffer.get_events_since(since)

    return {
        "events": events,
        "server_time": time.time(),
    }


# ==================== Background Cleanup Task ====================

_cleanup_task: asyncio.Task | None = None


async def _periodic_cleanup():
    """
    Background task that cleans up stale WebSocket connections every 30 seconds.
    """
    logger.info("Budget WS cleanup task started")
    while True:
        await asyncio.sleep(30)
        try:
            removed = await ws_manager.cleanup_stale_connections()
            if removed > 0:
                logger.info(f"Budget WS cleanup: removed {removed} stale connections")
        except Exception as e:
            logger.error(f"Budget WS cleanup error: {e}")


def start_ws_cleanup_task():
    """Start the background cleanup task (call from app startup)."""
    global _cleanup_task
    if _cleanup_task is None:
        _cleanup_task = asyncio.create_task(_periodic_cleanup())
        logger.info("Budget WS cleanup task scheduled")


def stop_ws_cleanup_task():
    """Stop the background cleanup task (call from app shutdown)."""
    global _cleanup_task
    if _cleanup_task is not None:
        _cleanup_task.cancel()
        _cleanup_task = None
        logger.info("Budget WS cleanup task stopped")


# ==================== Push Notification Integration ====================

# Global debounce state for push notifications
_last_push_time: float = 0
PUSH_DEBOUNCE_SECONDS = 30

# Database session factory for push notifications
_db_session_factory = None


def set_push_db_session_factory(factory):
    """
    Set the database session factory for push notifications.
    Called from app startup (main.py).
    """
    global _db_session_factory
    _db_session_factory = factory


def _get_connected_user_ids() -> set[int]:
    """Get set of user IDs with active WebSocket connections."""
    return {uid for uid, _, _, _ in ws_manager.connections}


async def _send_push_for_offline_users(title: str, body: str, data: dict | None = None):
    """
    Send push notification to users WITHOUT active WebSocket connections.
    """
    global _last_push_time

    now = time.time()
    if now - _last_push_time < PUSH_DEBOUNCE_SECONDS:
        logger.debug(f"[Push] Debounce: skipping push (last was {now - _last_push_time:.1f}s ago)")
        return

    if _db_session_factory is None:
        logger.debug("[Push] No session factory - push disabled")
        return

    from backend.app.services.push_service import PushService

    if not PushService.is_configured():
        logger.debug("[Push] VAPID not configured - push disabled")
        return

    connected_user_ids = _get_connected_user_ids()

    try:
        async for session in _db_session_factory():
            sent_count = await PushService.broadcast_except_connected(
                session=session,
                connected_user_ids=connected_user_ids,
                title=title,
                body=body,
                data=data
            )

            if sent_count > 0:
                _last_push_time = now
                logger.info(f"[Push] Sent to {sent_count} offline users: {title}")
            break

    except Exception as e:
        logger.error(f"[Push] Error sending push notifications: {e}")


# ==================== Broadcast Helper Functions ====================

# Fields safe to broadcast (no sensitive internal data)
SAFE_FACT_FIELDS = {
    "id", "article_id", "financial_center_id", "cost_center_id",
    "amount", "fact_date", "description", "record_type", "transfer_id",
}

SAFE_TRANSFER_FIELDS = {
    "id", "source_fact_id", "target_fact_id",
    "amount", "transfer_date", "description",
}

SAFE_ITEM_FIELDS = {
    "id", "shopping_list_id", "product_name", "quantity", "unit",
    "is_completed", "store_id", "product_group_id", "sort_order",
}


def _filter_fact_data(fact_data: dict) -> dict:
    """Filter fact data to include only safe fields."""
    return {k: v for k, v in fact_data.items() if k in SAFE_FACT_FIELDS}


def _filter_transfer_data(transfer_data: dict) -> dict:
    """Filter transfer data to include only safe fields."""
    return {k: v for k, v in transfer_data.items() if k in SAFE_TRANSFER_FIELDS}


def _filter_item_data(item_data: dict) -> dict:
    """Filter item data to include only safe fields."""
    return {k: v for k, v in item_data.items() if k in SAFE_ITEM_FIELDS}


async def _broadcast_and_buffer(event_type: str, data: dict):
    """Broadcast to WebSocket and add to event buffer for long polling."""
    await ws_manager.broadcast(event_type, data)
    await event_buffer.add_event(event_type, data)


# Fact broadcast functions

async def broadcast_fact_created(fact_data: dict):
    """Broadcast fact created event."""
    filtered_data = _filter_fact_data(fact_data)
    logger.debug(f"broadcast_fact_created: fact_id={fact_data.get('id')}")
    await _broadcast_and_buffer("fact_created", filtered_data)

    # Send push to offline users
    description = fact_data.get("description", "Новая запись")
    amount = fact_data.get("amount", 0)
    type_label = "Доход" if amount > 0 else "Расход"
    await _send_push_for_offline_users(
        title=f"💰 {type_label}: {abs(amount):,.0f}".replace(",", " "),
        body=description[:100] if description else "Добавлена новая запись",
        data={"type": "fact_created", "id": fact_data.get("id"), "url": "/"}
    )


async def broadcast_fact_updated(fact_data: dict):
    """Broadcast fact updated event."""
    filtered_data = _filter_fact_data(fact_data)
    logger.debug(f"broadcast_fact_updated: fact_id={fact_data.get('id')}")
    await _broadcast_and_buffer("fact_updated", filtered_data)


async def broadcast_fact_deleted(fact_id: int):
    """Broadcast fact deleted event."""
    logger.debug(f"broadcast_fact_deleted: fact_id={fact_id}")
    await _broadcast_and_buffer("fact_deleted", {"id": fact_id})


# Plan broadcast functions

async def broadcast_plan_created(plan_data: dict):
    """Broadcast plan created event."""
    filtered_data = _filter_fact_data(plan_data)
    logger.debug(f"broadcast_plan_created: plan_id={plan_data.get('id')}")
    await _broadcast_and_buffer("plan_created", filtered_data)


async def broadcast_plan_updated(plan_data: dict):
    """Broadcast plan updated event."""
    filtered_data = _filter_fact_data(plan_data)
    logger.debug(f"broadcast_plan_updated: plan_id={plan_data.get('id')}")
    await _broadcast_and_buffer("plan_updated", filtered_data)


async def broadcast_plan_deleted(plan_id: int):
    """Broadcast plan deleted event."""
    logger.debug(f"broadcast_plan_deleted: plan_id={plan_id}")
    await _broadcast_and_buffer("plan_deleted", {"id": plan_id})


# Transfer broadcast functions

async def broadcast_transfer_created(transfer_data: dict):
    """Broadcast transfer created event."""
    filtered_data = _filter_transfer_data(transfer_data)
    logger.debug(f"broadcast_transfer_created: transfer_id={transfer_data.get('id')}")
    await _broadcast_and_buffer("transfer_created", filtered_data)

    # Send push to offline users
    amount = transfer_data.get("amount", 0)
    description = transfer_data.get("description", "Перевод между счетами")
    await _send_push_for_offline_users(
        title=f"↔️ Перевод: {abs(amount):,.0f}".replace(",", " "),
        body=description[:100] if description else "Перевод между счетами",
        data={"type": "transfer_created", "id": transfer_data.get("id"), "url": "/"}
    )


async def broadcast_transfer_deleted(transfer_id: int):
    """Broadcast transfer deleted event."""
    logger.debug(f"broadcast_transfer_deleted: transfer_id={transfer_id}")
    await _broadcast_and_buffer("transfer_deleted", {"id": transfer_id})


# Shopping list item broadcast functions

async def broadcast_item_created(item_data: dict):
    """Broadcast item created event."""
    filtered_data = _filter_item_data(item_data)
    logger.debug(f"broadcast_item_created: item_id={item_data.get('id')}, list_id={item_data.get('shopping_list_id')}")
    await _broadcast_and_buffer("item_created", filtered_data)


async def broadcast_item_updated(item_data: dict):
    """Broadcast item updated event."""
    filtered_data = _filter_item_data(item_data)
    logger.debug(f"broadcast_item_updated: item_id={item_data.get('id')}, list_id={item_data.get('shopping_list_id')}")
    await _broadcast_and_buffer("item_updated", filtered_data)


async def broadcast_item_deleted(item_id: int, shopping_list_id: int):
    """Broadcast item deleted event."""
    logger.debug(f"broadcast_item_deleted: item_id={item_id}, list_id={shopping_list_id}")
    await _broadcast_and_buffer("item_deleted", {"id": item_id, "shopping_list_id": shopping_list_id})


async def broadcast_item_completed(item_id: int, shopping_list_id: int, is_completed: bool):
    """Broadcast item completed event."""
    logger.debug(f"broadcast_item_completed: item_id={item_id}, list_id={shopping_list_id}, completed={is_completed}")
    await _broadcast_and_buffer("item_completed", {"id": item_id, "shopping_list_id": shopping_list_id, "is_completed": is_completed})
