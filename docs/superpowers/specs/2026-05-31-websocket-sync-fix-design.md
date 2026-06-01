---
review:
  spec_hash: 393d583e8ed93c4a
  last_run: 2026-05-31
  phases:
    structure: { status: passed }
    coverage: { status: passed }
    clarity: { status: passed }
    consistency: { status: passed }
  findings: []
chain:
  intent: docs/superpowers/intents/2026-05-31-websocket-sync-fix-intent.md
---
# Design: WebSocket Sync Fix

**Date:** 2026-05-31  
**Status:** approved  
**Intent:** docs/superpowers/intents/2026-05-31-websocket-sync-fix-intent.md

## Problem

Real-time WebSocket synchronization is broken: User A creates a transaction or shopping list item — User B never sees it without a page reload. Zero WS frames received by User B despite an active WS connection (green status badge).

### Diagnostic findings

- **WS connection:** established correctly (URL visible in DevTools, green badge).
- **Zero WS frames:** no frames arrive on User B's connection when User A creates data — confirmed via DevTools Network → WS → Frames.
- **Both facts and shopping lists broken** — shopping list items use a direct broadcast path (no write-behind), ruling out write-behind as the sole cause.
- **Root cause:** `broadcast()` publishes to Redis and returns, trusting the Pub/Sub subscriber to call `_local_broadcast()`. If the subscriber is broken (crashed, callback is None, connection lost), events are silently dropped — no fallback exists for local connections.
- **Secondary issues:** broken exception handlers in subscriber loop (`redis.exceptions.*` evaluated on connection object → `AttributeError`), write-behind broadcasts before `session.commit()` (race: client fetches row-html before DB write), shopping item Dexie sync crashes on 404 for PUT updates.

## Architecture

### Change 1 — Direct-first broadcast (primary fix)

**File:** `backend/app/services/redis_ws_manager.py`

Change `broadcast()` to deliver to local connections immediately, then publish to Redis for cross-worker delivery:

```python
async def broadcast(self, event_type: str, data: dict[str, Any]):
    # Always deliver to local connections immediately (robust regardless of Pub/Sub state)
    await self._local_broadcast(event_type, data)
    # Publish to Redis for other workers; include worker_id so subscriber skips self
    if is_redis_available():
        await publish_event(event_type, data, source_worker_id=self._worker_id)
```

`_worker_id` is a UUID generated at `RedisBudgetWebSocketManager.__init__`.

**Single-worker deployment:** direct delivery always works; Redis Pub/Sub subscriber skips own events.  
**Multi-worker deployment:** local connections get direct delivery; other workers' connections get Redis delivery.

### Change 2 — Subscriber skips own-worker events

**File:** `backend/app/services/redis_pubsub_service.py`

Add `source_worker_id` to published event envelope:

```python
# In publish_event():
event = {
    "type": event_type,
    "data": data,
    "timestamp": datetime.utcnow().isoformat(),
    "ts": time.time(),
    "source_worker_id": source_worker_id,  # new parameter, default None
}
```

In subscriber loop, skip events from own worker:

```python
source_worker_id = event.get("source_worker_id")
if source_worker_id and source_worker_id == _this_worker_id:
    continue  # Already delivered directly by broadcast()
if _local_broadcast_callback:
    await _local_broadcast_callback(event_type, event_data)
```

`_this_worker_id` is a module-level UUID set when `start_pubsub_listener()` is called (same UUID as `RedisBudgetWebSocketManager._worker_id`, passed in).

`publish_event()` signature: `async def publish_event(event_type, data, source_worker_id=None) -> bool`.

### Change 3 — Fix subscriber exception handlers

**File:** `backend/app/services/redis_pubsub_service.py`

Lines 216–222 reference `redis.exceptions.TimeoutError` / `redis.exceptions.ConnectionError` where `redis` is the connection object (not the module) — evaluates to `AttributeError`, swallowed by `except Exception`.

Fix:
```python
from redis.asyncio.exceptions import TimeoutError as RedisTimeoutError
from redis.asyncio.exceptions import ConnectionError as RedisConnectionError
```

Replace handlers:
```python
except (asyncio.TimeoutError, RedisTimeoutError):
    continue
except RedisConnectionError as e:
    logger.warning("Redis connection lost, reconnecting in 5s: %s", e)
    await asyncio.sleep(5)
```

Also add explicit cleanup when inner loop exits:
```python
finally:
    try:
        await pubsub.aclose()
    except Exception:
        pass
```

### Change 4 — Write-behind: broadcast after commit

**File:** `backend/app/services/write_behind_service.py`

Swap order in `_process_queue_item()`:

```python
# Before (race: client fetches row-html before DB write completes)
await self._broadcast_event(item)
await session.commit()

# After
await session.commit()
await self._broadcast_event(item)
```

### Change 5 — Shopping item 404 fallback

**File:** `frontend/shared/db/dexie/operations/shoppingSync.ts`

In `uploadShoppingItem()`, after PUT returns 404, recreate via POST:

```typescript
if (!response.ok) {
  if (response.status === 404 && method === 'PUT') {
    // Item was deleted server-side — recreate via POST
    const createResp = await fetchWithTimeout('/api/v1/shopping-list-items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...apiPayload, shopping_list_id: item.shopping_list_id ?? shoppingListServerId }),
      credentials: 'include'
    });
    if (createResp.ok) {
      const result = await createResp.json();
      await db.shoppingListItems.where('temp_id').equals(item.temp_id).modify({
        id: result.id,
        sync_status: 'synced'
      });
      return;
    }
  }
  throw new Error(`Server error: ${response.status}`);
}
```

## Files Changed

| File | Change |
|------|--------|
| `backend/app/services/redis_ws_manager.py` | `broadcast()` direct-first + `_worker_id` field |
| `backend/app/services/redis_pubsub_service.py` | `publish_event()` accepts `source_worker_id`; subscriber skips own events; fix exception handlers; pubsub cleanup |
| `backend/app/services/write_behind_service.py` | Move `_broadcast_event` after `session.commit()` |
| `frontend/shared/db/dexie/operations/shoppingSync.ts` | Handle 404 on PUT with POST fallback |

## Constraints Respected

- No Redis configuration changes
- No JWT authentication changes
- No WS event schema changes (payload unchanged; `source_worker_id` is envelope-only, not in `data`)
- Deploy via CI/CD only
- Existing offline mode (Dexie) not affected

## Testing

- Two browsers as different users: User A creates fact → User B sees row without reload
- User A creates shopping list item → User B sees it without reload
- Offline mode still works (Dexie sync, no WS dependency)
- Shopping item with local `id` that returns 404 on PUT → item recreated on server
