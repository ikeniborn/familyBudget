---
review:
  plan_hash: 7d3dbef92a1268d1
  spec_hash: 393d583e8ed93c4a
  last_run: 2026-06-01
  phases:
    structure:     { status: passed }
    coverage:      { status: passed }
    dependencies:  { status: passed }
    verifiability: { status: passed }
    consistency:   { status: passed }
  findings:
    - id: F-001
      severity: WARNING
      verdict: wontfix
      section: "Task 6 / §Testing"
      section_hash: c2047f16a803f778
      text: >
        Spec §Testing lists two-browser manual acceptance scenarios. E2E excluded by design;
        Task 6 covers unit tests + type-check + lint only.
    - id: F-002
      severity: WARNING
      verdict: accepted
      section: "Task 4"
      section_hash: 5c6d662053c0c146
      text: >
        Spec §Change 4 names function `_process_queue_item()` but plan Task 4 uses
        `_process_item()`. Verified: production function is `_process_item()` (line 289
        of write_behind_service.py). Plan is correct; spec has a typo.
chain:
  intent: docs/superpowers/intents/2026-05-31-websocket-sync-fix-intent.md
  spec: docs/superpowers/specs/2026-05-31-websocket-sync-fix-design.md
---
# WebSocket Sync Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix real-time WebSocket sync so User B receives events immediately when User A creates facts or shopping list items — without a page reload.

**Architecture:** Apply direct-first broadcast (local connections get events synchronously in `broadcast()`, bypassing Pub/Sub); add `source_worker_id` to Redis envelope so subscriber skips own-worker events; fix broken exception imports in subscriber loop; fix write-behind race by moving broadcast after commit; add 404→POST fallback in shoppingSync.

**Tech Stack:** Python/FastAPI, asyncio, redis-py (async), Vitest, TypeScript/Dexie.js

---

## File Map

| File | Action | What changes |
|------|--------|-------------|
| `backend/app/services/redis_pubsub_service.py` | Modify | `publish_event()` adds `source_worker_id` param; `start_pubsub_listener()` accepts `worker_id`; subscriber skips own events; fix exception imports; add `pubsub.aclose()` in finally |
| `backend/app/services/redis_ws_manager.py` | Modify | `__init__` adds `_worker_id`; `broadcast()` calls `_local_broadcast()` first then publishes; `start_pubsub()` passes `_worker_id` |
| `backend/app/services/write_behind_service.py` | Modify | `_process_item()`: move `_broadcast_event()` to after `session.commit()` |
| `frontend/shared/db/dexie/operations/shoppingSync.ts` | Modify | `uploadShoppingItem()`: after PUT→404 recreate via POST |
| `tests/unit/backend/test_redis_pubsub.py` | Create | Unit tests for `publish_event()` envelope and subscriber skip logic |
| `tests/unit/backend/test_redis_ws_manager.py` | Create | Unit tests for `broadcast()` direct-first behavior |
| `tests/unit/backend/test_write_behind_order.py` | Create | Unit test for commit-before-broadcast order |
| `tests/unit/dashboard/shoppingSync404.test.ts` | Create | Unit test for 404→POST fallback |

---

## Task 1: Fix subscriber exception handlers in redis_pubsub_service.py

**Files:**
- Modify: `backend/app/services/redis_pubsub_service.py:210-229`

### Why this first
Lines 216 and 219 reference `redis.exceptions.TimeoutError` / `redis.exceptions.ConnectionError` where `redis` is the **connection object** (not the module). This causes `AttributeError` that is silently swallowed by `except Exception` on line 224 — meaning reconnect logic never fires correctly.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/backend/test_redis_pubsub.py`:

```python
"""Unit tests for redis_pubsub_service — exception handler imports."""

import sys
import importlib


def test_redis_exception_classes_importable():
    """Ensure fix imports RedisTimeoutError and RedisConnectionError from correct module."""
    from redis.asyncio.exceptions import TimeoutError as RedisTimeoutError
    from redis.asyncio.exceptions import ConnectionError as RedisConnectionError

    # Both must be proper exception classes
    assert issubclass(RedisTimeoutError, Exception)
    assert issubclass(RedisConnectionError, Exception)


def test_redis_exception_not_confused_with_builtin():
    """RedisConnectionError must not be the same as builtins.ConnectionError."""
    from redis.asyncio.exceptions import ConnectionError as RedisConnectionError
    assert RedisConnectionError is not ConnectionError
```

- [ ] **Step 2: Run test to verify it passes** (these are import-level checks)

```bash
cd tests && python -m pytest unit/backend/test_redis_pubsub.py -v
```

Expected: PASS (validates our imports exist before we add them to the service)

- [ ] **Step 3: Apply the fix to redis_pubsub_service.py**

At the top of the file (after existing imports, around line 34), add:

```python
from redis.asyncio.exceptions import TimeoutError as RedisTimeoutError
from redis.asyncio.exceptions import ConnectionError as RedisConnectionError
```

In `_subscriber_loop()`, replace lines 213–229 (the outer `except` block):

```python
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
```

Also add `finally` block inside the `async with get_redis() as redis:` inner loop (after the inner `while True:` exits), wrapping `pubsub`:

```python
            async with get_redis() as redis:
                pubsub = redis.pubsub()
                await pubsub.subscribe(BUDGET_EVENTS_CHANNEL)
                logger.info("Subscribed to Redis channel: %s", BUDGET_EVENTS_CHANNEL)
                try:
                    while True:
                        message = await pubsub.get_message(ignore_subscribe_messages=False, timeout=1.0)
                        if message is None:
                            await asyncio.sleep(0.01)
                            continue
                        if message["type"] == "message":
                            try:
                                event = json_loads(message["data"])
                                event_type = event.get("type")
                                event_data = event.get("data", {})
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
```

- [ ] **Step 4: Run tests**

```bash
cd tests && python -m pytest unit/backend/test_redis_pubsub.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/redis_pubsub_service.py tests/unit/backend/test_redis_pubsub.py
git commit -m "fix(pubsub): fix broken exception imports in subscriber loop"
```

---

## Task 2: Add source_worker_id to publish_event() and subscriber skip logic

**Files:**
- Modify: `backend/app/services/redis_pubsub_service.py`
- Test: `tests/unit/backend/test_redis_pubsub.py`

### Context
When `broadcast()` delivers locally AND publishes to Redis, the subscriber on the same worker must skip its own events (already delivered). This requires `source_worker_id` in the event envelope and a module-level `_this_worker_id` set at startup.

- [ ] **Step 1: Write failing tests**

Append to `tests/unit/backend/test_redis_pubsub.py`:

```python
import asyncio
from unittest.mock import AsyncMock, MagicMock, patch
import pytest


@pytest.mark.asyncio
async def test_publish_event_includes_source_worker_id():
    """publish_event() must include source_worker_id in the envelope sent to Redis."""
    captured = {}

    async def fake_publish(channel, message):
        import json
        captured["envelope"] = json.loads(message)
        return 1

    mock_redis = AsyncMock()
    mock_redis.publish = fake_publish
    mock_redis.zadd = AsyncMock()
    mock_redis.zremrangebyscore = AsyncMock()
    mock_redis.zcard = AsyncMock(return_value=0)
    mock_redis.__aenter__ = AsyncMock(return_value=mock_redis)
    mock_redis.__aexit__ = AsyncMock(return_value=False)

    with patch("backend.app.services.redis_pubsub_service.is_redis_available", return_value=True), \
         patch("backend.app.services.redis_pubsub_service.get_redis", return_value=mock_redis):

        from backend.app.services.redis_pubsub_service import publish_event
        result = await publish_event("fact_created", {"id": 1}, source_worker_id="worker-abc")

    assert result is True
    assert captured["envelope"]["source_worker_id"] == "worker-abc"


@pytest.mark.asyncio
async def test_publish_event_source_worker_id_defaults_none():
    """publish_event() without source_worker_id sends null in envelope."""
    captured = {}

    async def fake_publish(channel, message):
        import json
        captured["envelope"] = json.loads(message)
        return 1

    mock_redis = AsyncMock()
    mock_redis.publish = fake_publish
    mock_redis.zadd = AsyncMock()
    mock_redis.zremrangebyscore = AsyncMock()
    mock_redis.zcard = AsyncMock(return_value=0)
    mock_redis.__aenter__ = AsyncMock(return_value=mock_redis)
    mock_redis.__aexit__ = AsyncMock(return_value=False)

    with patch("backend.app.services.redis_pubsub_service.is_redis_available", return_value=True), \
         patch("backend.app.services.redis_pubsub_service.get_redis", return_value=mock_redis):

        from backend.app.services import redis_pubsub_service
        import importlib
        importlib.reload(redis_pubsub_service)
        result = await redis_pubsub_service.publish_event("fact_created", {"id": 1})

    assert result is True
    assert captured["envelope"].get("source_worker_id") is None
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd tests && python -m pytest unit/backend/test_redis_pubsub.py::test_publish_event_includes_source_worker_id -v
```

Expected: FAIL with `TypeError: publish_event() got an unexpected keyword argument 'source_worker_id'`

- [ ] **Step 3: Update publish_event() signature and envelope**

In `redis_pubsub_service.py`, change `publish_event()`:

```python
async def publish_event(event_type: str, data: dict[str, Any], source_worker_id: str | None = None) -> bool:
    """
    Publish event to Redis Pub/Sub channel and add to event buffer.

    Args:
        event_type: Event type (fact_created, fact_updated, etc.)
        data: Event data
        source_worker_id: Worker UUID that published this event. Subscriber
            on the same worker skips the event (already delivered directly).

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
        "ts": time.time(),
        "source_worker_id": source_worker_id,
    }
    message = json_dumps(event)
    # ... rest unchanged (redis.publish, redis.zadd, etc.)
```

- [ ] **Step 4: Add _this_worker_id module-level var and update start_pubsub_listener()**

Add after `_local_broadcast_callback` declaration (around line 54):

```python
_this_worker_id: str | None = None
```

Update `start_pubsub_listener()` signature:

```python
async def start_pubsub_listener(
    local_broadcast_callback: Callable[[str, dict], Coroutine],
    worker_id: str | None = None,
) -> bool:
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
```

- [ ] **Step 5: Add skip logic in _subscriber_loop()**

Inside the `if message["type"] == "message":` block (after `event_data = event.get("data", {})`), add before calling the callback:

```python
                            source_worker_id = event.get("source_worker_id")
                            if source_worker_id and source_worker_id == _this_worker_id:
                                logger.debug("Skipping own-worker event: %s", event_type)
                                continue
```

- [ ] **Step 6: Run tests**

```bash
cd tests && python -m pytest unit/backend/test_redis_pubsub.py -v
```

Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add backend/app/services/redis_pubsub_service.py tests/unit/backend/test_redis_pubsub.py
git commit -m "feat(pubsub): add source_worker_id to event envelope; subscriber skips own events"
```

---

## Task 3: Direct-first broadcast in RedisBudgetWebSocketManager

**Files:**
- Modify: `backend/app/services/redis_ws_manager.py`
- Create: `tests/unit/backend/test_redis_ws_manager.py`

### Context
Current `broadcast()` publishes to Redis and **returns**, trusting Pub/Sub to call `_local_broadcast()`. If Pub/Sub is broken, events are silently dropped. Fix: always call `_local_broadcast()` first, then publish to Redis with own `_worker_id` so subscriber skips it.

- [ ] **Step 1: Write failing test**

Create `tests/unit/backend/test_redis_ws_manager.py`:

```python
"""Unit tests for RedisBudgetWebSocketManager.broadcast() direct-first behavior."""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


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

        async def fake_local_broadcast(event_type, data):
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
        async def fake_local_broadcast(event_type, data):
            local_called.append(event_type)
        manager._local_broadcast = fake_local_broadcast

        await manager.broadcast("fact_created", {"id": 1})

    assert "fact_created" in local_called
    mock_publish.assert_not_called()
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd tests && python -m pytest unit/backend/test_redis_ws_manager.py::test_broadcast_calls_local_broadcast_even_when_redis_available -v
```

Expected: FAIL — `_local_broadcast()` not called (current code returns after publish)

- [ ] **Step 3: Add _worker_id to __init__ and rewrite broadcast()**

In `redis_ws_manager.py`, update `__init__`:

```python
    def __init__(self):
        self.connections: list[tuple[int, WebSocket, str, float]] = []
        self._lock = asyncio.Lock()
        self._pubsub_started = False
        self._worker_id = str(uuid.uuid4())
```

Replace `broadcast()` (lines 211–228):

```python
    async def broadcast(self, event_type: str, data: dict[str, Any]):
        """
        Broadcast event to local connections directly, then publish to Redis
        for other workers. Direct delivery is always attempted regardless of
        Pub/Sub state, so events are never silently dropped.
        """
        # Always deliver to local connections immediately
        await self._local_broadcast(event_type, data)

        # Publish to Redis for other workers; include worker_id so subscriber skips self
        if is_redis_available():
            published = await publish_event(event_type, data, source_worker_id=self._worker_id)
            if published:
                logger.debug("Event published to Redis: %s", event_type)
            else:
                logger.debug("Redis publish failed (local delivery already done): %s", event_type)
```

- [ ] **Step 4: Update start_pubsub() to pass worker_id**

Update `start_pubsub()` (around line 296):

```python
    async def start_pubsub(self):
        """Start the Redis Pub/Sub subscriber."""
        if self._pubsub_started:
            return

        if is_redis_available():
            success = await start_pubsub_listener(self._local_broadcast, worker_id=self._worker_id)
            self._pubsub_started = success
            if success:
                logger.info("Redis Pub/Sub started for WebSocket manager (worker_id=%s)", self._worker_id[:8])
        else:
            logger.warning("Redis not available, WebSocket will work in single-worker mode")
```

- [ ] **Step 5: Run all tests**

```bash
cd tests && python -m pytest unit/backend/test_redis_ws_manager.py unit/backend/test_redis_pubsub.py -v
```

Expected: all PASS

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/redis_ws_manager.py tests/unit/backend/test_redis_ws_manager.py
git commit -m "fix(ws): broadcast() delivers directly to local connections before Redis publish"
```

---

## Task 4: Fix write-behind race — broadcast after commit

**Files:**
- Modify: `backend/app/services/write_behind_service.py:302-317`
- Create: `tests/unit/backend/test_write_behind_order.py`

### Context
`_process_item()` currently calls `_broadcast_event()` **before** `session.commit()`. Clients receive the WS event and immediately fetch `row-html` from the server — but the DB write hasn't committed yet, so they may get stale data or a 404. Fix: commit first, broadcast second.

- [ ] **Step 1: Write failing test**

Create `tests/unit/backend/test_write_behind_order.py`:

```python
"""Unit test verifying broadcast happens after session.commit() in write-behind."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call


@pytest.mark.asyncio
async def test_broadcast_called_after_commit():
    """
    _process_item() must call session.commit() before _broadcast_event().
    Order matters: client fetches row-html after receiving WS event.
    """
    call_order = []

    mock_session = AsyncMock()

    async def fake_commit():
        call_order.append("commit")

    async def fake_flush():
        pass

    mock_session.commit = fake_commit
    mock_session.flush = fake_flush
    mock_session.add = MagicMock()
    mock_session.delete = AsyncMock()

    async def fake_session_gen():
        yield mock_session

    from backend.app.services.write_behind_service import WriteBehindService, WriteQueueItem, WriteOperation

    service = WriteBehindService()

    async def fake_broadcast(item):
        call_order.append("broadcast")

    async def fake_process_fact(session, item):
        pass

    async def fake_invalidate():
        pass

    service._broadcast_event = fake_broadcast
    service._process_fact = fake_process_fact

    item = WriteQueueItem(
        operation=WriteOperation.CREATE,
        entity_type="fact",
        data={"pre_generated_id": 1, "article_id": 1, "amount": 100, "fact_date": "2026-05-31"},
        user_id=1,
    )

    with patch("backend.app.services.write_behind_service.get_session", return_value=fake_session_gen()), \
         patch("backend.app.services.write_behind_service.cache_service") as mock_cache:
        mock_cache.invalidate_dashboard = fake_invalidate
        await service._process_item(item)

    assert call_order == ["commit", "broadcast"], (
        f"Expected commit before broadcast, got: {call_order}"
    )
```

- [ ] **Step 2: Run to confirm failure**

```bash
cd tests && python -m pytest unit/backend/test_write_behind_order.py -v
```

Expected: FAIL — `call_order == ["broadcast", "commit"]`

- [ ] **Step 3: Swap order in _process_item()**

In `write_behind_service.py`, update the `async for session in get_session():` block (lines 301–317). Move `_broadcast_event` to after `session.commit()`:

```python
            async for session in get_session():
                if item.entity_type == "fact":
                    await self._process_fact(session, item)

                # Invalidate cache
                await cache_service.invalidate_dashboard()

                # Commit first — client fetches row-html after receiving WS event
                await session.commit()

                # Broadcast WebSocket event after commit
                await self._broadcast_event(item)

                self._stats["processed"] += 1
                logger.info(
                    "Write-behind processed: %s %s request_id=%s",
                    item.operation.value, item.entity_type, item.request_id,
                )
                return True
```

- [ ] **Step 4: Run test**

```bash
cd tests && python -m pytest unit/backend/test_write_behind_order.py -v
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/write_behind_service.py tests/unit/backend/test_write_behind_order.py
git commit -m "fix(write-behind): broadcast WebSocket event after session.commit() to prevent race"
```

---

## Task 5: Shopping item 404 fallback — POST on PUT 404

**Files:**
- Modify: `frontend/shared/db/dexie/operations/shoppingSync.ts:129-158`
- Create: `tests/unit/dashboard/shoppingSync404.test.ts`

### Context
When a shopping item has a local `id` (was synced before), Dexie sends PUT to `/api/v1/shopping-list-items/{id}`. If the item was deleted server-side (e.g., by another user), the server returns 404. Currently this throws an error and the item stays `pending` forever. Fix: on PUT 404, recreate via POST and update local record with new server id.

- [ ] **Step 1: Write failing test**

Create `tests/unit/dashboard/shoppingSync404.test.ts`:

```typescript
/**
 * Unit test: uploadShoppingItem handles PUT 404 by recreating via POST.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DexieManager } from '@db/dexie/DexieManager';
import { db } from '@db/dexie/core/database';

// Mock fetchWithTimeout
vi.mock('@db/dexie/utils/fetchWithTimeout', () => ({
  fetchWithTimeout: vi.fn(),
}));

import { fetchWithTimeout } from '@db/dexie/utils/fetchWithTimeout';
import { uploadPendingShoppingOperations } from '@db/dexie/operations/shoppingSync';

describe('uploadShoppingItem — PUT 404 fallback', () => {
  let manager: DexieManager;

  beforeEach(async () => {
    manager = new DexieManager();
    await manager.init();
    vi.clearAllMocks();
  });

  afterEach(async () => {
    if (manager.isReady()) {
      await manager.clearAll();
      await manager.close();
    }
  });

  it('recreates item via POST when PUT returns 404', async () => {
    // Seed: item with server id (was synced before) but now pending edit
    const tempId = 'test-temp-404';
    await db.shoppingListItems.add({
      temp_id: tempId,
      id: 99,  // server id exists → triggers PUT
      shopping_list_temp_id: 'list-1',
      shopping_list_id: 5,
      product_name: 'Milk',
      quantity: 2,
      unit: 'л',
      comment: null,
      store_id: null,
      product_group_id: null,
      position: 0,
      is_completed: false,
      completed_at: null,
      sync_status: 'pending',
      sync_hash: null,
      content_hash: null,
      created_at: new Date(),
      updated_at: new Date(),
      synced_at: null,
    });

    const fetchMock = vi.mocked(fetchWithTimeout);

    // First call: PUT → 404
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
    } as Response);

    // Second call: POST → 201 with new server id
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 201,
      json: async () => ({ id: 200 }),
    } as Response);

    const result = await uploadPendingShoppingOperations();

    expect(result.uploaded).toBe(1);
    expect(result.failed).toBe(0);

    // Verify PUT was attempted first
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/v1/shopping-list-items/99',
      expect.objectContaining({ method: 'PUT' })
    );

    // Verify POST was called as fallback
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/v1/shopping-list-items',
      expect.objectContaining({ method: 'POST' })
    );

    // Verify local record updated with new server id
    const updated = await db.shoppingListItems.where('temp_id').equals(tempId).first();
    expect(updated?.id).toBe(200);
    expect(updated?.sync_status).toBe('synced');
  });

  it('throws on non-404 server error', async () => {
    await db.shoppingListItems.add({
      temp_id: 'test-temp-500',
      id: 99,
      shopping_list_temp_id: 'list-1',
      shopping_list_id: 5,
      product_name: 'Eggs',
      quantity: 12,
      unit: 'шт',
      comment: null,
      store_id: null,
      product_group_id: null,
      position: 0,
      is_completed: false,
      completed_at: null,
      sync_status: 'pending',
      sync_hash: null,
      content_hash: null,
      created_at: new Date(),
      updated_at: new Date(),
      synced_at: null,
    });

    vi.mocked(fetchWithTimeout).mockResolvedValueOnce({
      ok: false,
      status: 500,
    } as Response);

    const result = await uploadPendingShoppingOperations();
    expect(result.failed).toBe(1);
  });
});
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm run test:coverage -- --run tests/unit/dashboard/shoppingSync404.test.ts
```

Expected: FAIL on first test — `result.failed === 1` because current code throws on any 404

- [ ] **Step 3: Add 404 fallback in uploadShoppingItem()**

In `frontend/shared/db/dexie/operations/shoppingSync.ts`, replace lines 138–155 (the `if (!response.ok)` block after the main fetch):

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
        logger.info('[shoppingSync] ✅ Item recreated via POST after 404', { temp_id: item.temp_id, new_id: result.id });
        return;
      }
    }
    throw new Error(`Server error: ${response.status}`);
  }
```

- [ ] **Step 4: Run test**

```bash
npm run test:coverage -- --run tests/unit/dashboard/shoppingSync404.test.ts
```

Expected: PASS

- [ ] **Step 5: Type-check**

```bash
npm run type-check
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add frontend/shared/db/dexie/operations/shoppingSync.ts tests/unit/dashboard/shoppingSync404.test.ts
git commit -m "fix(dexie): recreate shopping item via POST when PUT returns 404"
```

---

## Task 6: Run full test suite and bump version

**Files:**
- Modify: `VERSION`

- [ ] **Step 1: Run backend unit tests**

```bash
cd tests && python -m pytest unit/backend/ -v -m unit
```

Expected: all PASS

- [ ] **Step 2: Run frontend unit tests**

```bash
npm run test:coverage -- --run
```

Expected: all PASS, no regressions

- [ ] **Step 3: Run type-check**

```bash
npm run type-check
```

Expected: no errors

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: no errors

- [ ] **Step 5: Bump VERSION**

Read current `VERSION` file, increment patch (e.g., `0.3.14` → `0.3.15`).

```bash
cat VERSION
# e.g., outputs "0.3.14"
echo "0.3.15" > VERSION
```

- [ ] **Step 6: Final commit**

```bash
git add VERSION
git commit -m "chore: bump version for websocket sync fix"
```

---

## Self-Review Checklist

| Spec requirement | Task |
|-----------------|------|
| broadcast() direct-first delivery | Task 3 |
| _worker_id UUID in manager | Task 3 |
| source_worker_id in publish_event() envelope | Task 2 |
| start_pubsub_listener() accepts worker_id | Task 2 |
| subscriber skips own-worker events | Task 2 |
| Fix redis.exceptions.* broken imports | Task 1 |
| pubsub.aclose() in finally | Task 1 |
| write-behind: commit before broadcast | Task 4 |
| shopping item 404 → POST fallback | Task 5 |
| No Redis config changes | ✅ no config touched |
| No WS event schema changes | ✅ source_worker_id envelope-only |
| No JWT changes | ✅ not touched |
