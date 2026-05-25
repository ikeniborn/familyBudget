# Realtime

WebSocket + Redis Pub/Sub for real-time event delivery across multiple Uvicorn workers.

## WebSocket Protocol

Client connects to `/api/v1/budget_ws` with JWT auth. Server sends JSON events on budget changes (fact created/updated/deleted, sync events). Client uses events to trigger HTMX partial refreshes or incremental DOM updates.

Event format: `{"event": "fact_created", "data": {...}}`. Handlers registered via `wsEventHandlers` pattern in frontend TypeScript bundles.

## Redis Pub/Sub

WebSocket connections are local to each Uvicorn worker. When one worker produces an event (e.g., fact created), it publishes to Redis channel `budget:events`. All workers subscribe and forward to their local WebSocket connections.

This decouples horizontal scaling from event delivery — adding workers does not require any routing changes.

Manager: `backend/app/services/redis_ws_manager.py`. Falls back to in-memory if Redis unavailable (single-worker dev mode).

## Event Broadcasting

```python
manager = get_ws_manager()
await manager.broadcast("fact_created", {"id": fact.id, ...})
```

`broadcast()` publishes to Redis; each worker's Pub/Sub listener receives and pushes to local connections for the target user.

## Write-Behind Cache

High-frequency writes buffer in Redis, flushed to PostgreSQL asynchronously. Reduces DB write pressure for sync batches and real-time updates. Service: `backend/app/services/write_behind_service.py`.

Invariant: data in Redis is authoritative until flushed. Flush failures must be retried — not silently dropped.

## SSE Broadcasting

Server-Sent Events alternative for clients that cannot maintain WebSocket. Used for push notifications. Service: `backend/app/services/redis_pubsub_service.py` exposes `get_events_since()` for reconnect catch-up.

## Connection Lifecycle

On connect: authenticate JWT, register `conn_id` per worker. On disconnect: deregister local connection. Worker crash: Redis TTL cleans orphaned subscriptions. Reconnect: client sends `last_event_id` to catch up via `get_events_since()`.
