# Realtime & Caching

Real-time fan-out for the shared family budget: a JWT-authed WebSocket with long-polling fallback, Redis Pub/Sub for multi-worker delivery, a write-behind queue, a read-through cache, in-app notifications, and Web Push for offline users. The browser WS client lives in the [[frontend]] bundles.

## WebSocket Endpoint & Token Handshake

WebSockets cannot send cookies, so the client first POSTs `/budget/ws/token` (cookie-authed) to mint a short-lived `type: ws` JWT (5 min), then connects to `wss://…/budget/ws?token=…`. Invalid tokens close with code 4001, over-limit with 4029.

- `backend/app/api/v1/endpoints/budget_ws.py:79` — `POST /budget/ws/token` via `create_ws_token`
- `backend/app/api/v1/endpoints/budget_ws.py:464` — `verify_ws_token` requires `decode_ws_token` (`type: ws` claim) and an `is_active` user
- `backend/app/api/v1/endpoints/budget_ws.py:501` — the `@router.websocket("/ws")` handler
- See [[auth#JWT Tokens]] and [[api#Realtime Endpoints]].

## Connection Lifecycle

After token verification the manager `accept()`s and registers the socket, returns a `connection_id` (UUID), and sends a `connected` event. A background task pings every 10s (`WS_KEEPALIVE_INTERVAL`); the receive loop wakes every 5 min (`USER_STATUS_CHECK_INTERVAL`) to re-check `is_active` and disconnect deactivated users.

- Client→server messages: `ping` (→ `pong`), `check_online` (→ `online_status`), both refresh activity.
- `budget_ws.py:566` ping task; `budget_ws.py:583` main loop; `budget_ws.py:617` periodic status check.
- `POST /budget/ws/disconnect` (`budget_ws.py:675`) lets the client `sendBeacon` a `connection_id` on tab close for fast cleanup.
- A 30s background task (`_periodic_cleanup`, `budget_ws.py:753`) closes connections idle > 60s (`STALE_CONNECTION_TIMEOUT`).

## Connection Manager & Limits

`RedisBudgetWebSocketManager` keeps WebSocket objects local to each worker (sockets aren't serializable) in a list of `(user_id, websocket, connection_id, last_activity)` tuples under an `asyncio.Lock`. Limits are per-worker: 10 connections/user, 500 total, raising 429 when exceeded.

- `backend/app/services/redis_ws_manager.py:65` — the manager; singleton via `get_ws_manager()` (`:384`)
- `backend/app/api/v1/endpoints/budget_ws.py:455` — `ws_manager` is bound to the Redis-backed singleton
- `backend/app/api/v1/endpoints/budget_ws.py:105` defines an in-memory `BudgetWebSocketManager`, but the live globals use the Redis-backed manager.
- `GET /budget/ws/status` (`budget_ws.py:647`) reports local/per-user counts and limits.

## Redis Pub/Sub Fan-out

`manager.broadcast()` always delivers to local sockets first, then publishes the event to the Redis channel `budget:events` tagged with this worker's UUID. Each worker runs a subscriber loop that forwards received events to its local sockets, skipping events whose `source_worker_id` is its own (avoids double-delivery).

- `backend/app/services/redis_ws_manager.py:214` — `broadcast()` = local + `publish_event`
- `backend/app/services/redis_pubsub_service.py:48` — `BUDGET_EVENTS_CHANNEL = "budget:events"`
- `redis_pubsub_service.py:164` — `_subscriber_loop` polls `get_message(timeout=1.0)`, reconnects on `RedisConnectionError`
- `redis_pubsub_service.py:204` — own-worker skip; `redis_ws_manager.py:297` — `start_pubsub` registers `_local_broadcast` as the callback
- Without Redis the manager runs single-worker (local delivery only). See [[architecture#Docker Topology]].

## Event Buffer & Long-Polling Fallback

Clients that cannot use WebSocket poll `GET /budget/poll?since=<ts>` (comet-style, default 5s / max 30s wait). Events are stored in a Redis ZSET `budget:event_buffer` (score = unix ts), trimmed to 60s age and 1000 entries; `get_events_since` returns rows newer than `since`. In-memory `deque` is used when Redis is down.

- `backend/app/api/v1/endpoints/budget_ws.py:694` — `poll_budget_events`
- `backend/app/services/redis_pubsub_service.py:51` — `EVENT_BUFFER_KEY`; `publish_event` (`:61`) writes both the channel and the ZSET
- `backend/app/services/redis_ws_manager.py:318` — `RedisEventBuffer`; `get_events_since_async` (`:363`) prefers Redis

## Event Catalog & Payload Filtering

All connected clients receive every event (shared-budget model, no channels); clients filter by entity on their side. Each event is `{type, data, timestamp}`. Outgoing `data` is filtered to whitelisted fields per entity so no sensitive columns leak. `_broadcast_and_buffer` (`budget_ws.py:910`) does broadcast + buffer in one call.

- Field whitelists: `SAFE_FACT_FIELDS`, `SAFE_TRANSFER_FIELDS`, `SAFE_ITEM_FIELDS`, `SAFE_PLAN_FIELDS`, `SAFE_SHOPPING_LIST_FIELDS` (`budget_ws.py:854`).
- Fact/plan: `fact_created|updated|deleted`, `plan_created|updated|deleted`, `recurring_plan_created|updated|deleted`, batch summaries `facts_batch_deleted` / `recurring_plans_batch_deleted` (`budget_ws.py:992`), `recurring_plan_facts_generated`.
- Transfer: `transfer_created` / `transfer_deleted`. Shopping: `item_created|updated|deleted|completed`, `shopping_list_created|updated|deleted`.
- Reference data: `financial_center_*`, `cost_center_*`, `store_*`, `product_group_*` (each created/updated/deleted, unfiltered).
- Medicine (Phase 1): `broadcast_medicine_changed(entity, data)` emits `medicine_catalog_changed`, `medicine_family_member_changed`, or `medicine_stock_changed` (`budget_ws.py:1119`). See [[medicine#Realtime Updates]].
- Medicine (Phase 2): `medicine_course_changed` — broadcast on course create/update/pause/complete; payload is full `MedicineCourseResponse` including `StockEstimate`. `medicine_intake_marked` — broadcast on take/skip; payload is full `IntakeResponse`. Both use no field whitelist (same pattern as Phase 1 medicine events). Helpers `broadcast_medicine_course_changed` / `broadcast_medicine_intake_marked` are imported from `budget_ws.py` into `medicine_courses.py`. See [[medicine#Realtime Updates (Phase 2)]].
- Security: `webauthn_credential_added|revoked|compromised` (`budget_ws.py:1211`) — see [[auth#WebAuthn Biometrics]].
- Producers are the domain services / endpoints in [[domain]] and [[api]].

## Write-Behind Queue

For fast writes, fact CRUD can be queued in Redis (`write_queue:facts`, LIST) and the API returns immediately using a pre-generated PostgreSQL id. A single background worker holds a Redis lock, `BLPOP`s items, writes the `BudgetFact` + SCD history rows, invalidates the dashboard cache, commits, then broadcasts the WS event.

- `backend/app/services/write_behind_service.py:143` — `WriteBehindService`; enabled only if `WRITE_BEHIND_ENABLED` and Redis up (`:161`)
- Keys: `QUEUE_KEY`, `DLQ_KEY`, `LOCK_KEY`, `STATS_KEY` (`write_behind_service.py:56`)
- `_process_item` (`:280`) commits before broadcasting; `_broadcast_event` (`:484`) mirrors the sync `SAFE_FACT_FIELDS` filter and chooses `fact_*` vs `plan_*` by `record_type`.
- Failures retry with exponential backoff (100ms → 5s) then land in the DLQ (`_retry_item` `:532`, `_move_to_dlq` `:567`), trimmed by size and TTL (`WRITE_BEHIND_DLQ_*`).
- Lifecycle: `start_write_behind_worker` / `stop_write_behind_worker` (`:797`). See [[database#SCD Type 1 + History-Table Pattern]] for the history rows it writes.

## Read-Through Cache

`CacheService` wraps Redis as a read-through cache: `get_or_set(key, fetch_fn, ttl)` returns the cached JSON or fetches from DB and stores it. Keys are namespaced `cache:{prefix}:{parts}` via the `CacheKey` builder; missing Redis degrades gracefully to the DB.

- `backend/app/services/cache_service.py:160` — `CacheService` (singleton `cache_service`, `:403`)
- `CacheKey` (`cache_service.py:78`) builds keys for articles, financial/cost centers, recurring plans, dashboard `quick_stats` / `account_balances`, `recent:html`.
- TTL tiers from settings (`CacheTTL`, `:49`): REFERENCE ~300s, DASHBOARD ~30s, DYNAMIC ~60s, SHORT ~10s.
- Invalidation: `invalidate_pattern` (`SCAN`, 1000-key safety cap, `:309`) plus helpers `invalidate_articles/financial_centers/cost_centers/recurring_plans/dashboard`.
- Mutations in [[domain]] call these helpers; write-behind calls `invalidate_dashboard()`.

## Redis Connection & Health

A single async connection pool (max 20, `decode_responses=True`, 5s timeouts) is created at startup from `REDIS_URL`. `get_redis()` is the async context manager used everywhere; `is_redis_available()` gates every Redis path so the app keeps working when Redis is absent.

- `backend/app/services/redis_service.py:36` — `init_redis_pool`; `get_redis` (`:80`); `is_redis_available` (`:108`)
- `check_redis_health` (`:130`) measures PING latency and hit ratio; `get_redis_stats` (`:199`) and `get_cache_breakdown` (`:243`, groups `cache:*` keys by category) feed monitoring. See [[api#Health Endpoints]].

## Server-Side Cache Metrics (Client Telemetry)

A separate admin-only telemetry feature aggregates *browser* cache stats (Service Worker, IndexedDB, Storage Quota, local/session storage). Clients POST snapshots keyed by `client_id`; the service holds them in memory with a 5-minute TTL and aggregates on demand. This is unrelated to the Redis cache above.

- `backend/app/services/cache_metrics_service.py:36` — `CacheMetricsService` (in-memory, `asyncio.Lock`, TTL 300s)
- `backend/app/api/v1/endpoints/cache_metrics.py` — `POST /admin/cache-metrics` (public, 202) and `GET /admin/cache-metrics` (`CurrentAdmin`)
- Schemas: `backend/app/schemas/cache_metrics.py`. The collectors live in the [[frontend]] Service Worker / IndexedDB layer.

## In-App Notifications

In-app notifications are budget-alert history rows in `t_notification`, supporting per-user or broadcast (`user_id=NULL`) records with a unique constraint preventing duplicate broadcasts per article/period. Scheduler jobs generate weekly reports and threshold checks, delivering them over the Telegram Bot API.

- Model: `backend/app/models/notification.py:13` (`Notification`, transactional — no SCD)
- Service: `backend/app/services/notification_service.py:27` — `send_weekly_reports` (Mon 09:00), `check_all_budget_thresholds` (daily 18:00, 90% default), filtered by `enable_telegram_notifications`
- API: `backend/app/api/v1/endpoints/notifications.py` — `POST /notifications` (`InternalAPIKey`), `GET /notifications/check-duplicate`, `GET /notifications` (no user isolation — shared model)
- Schemas: `backend/app/schemas/notification.py`. See [[bot#Scheduler & Weekly Report]].

## Web Push (VAPID)

Web Push reaches users without an open tab. Browsers fetch the public VAPID key, subscribe, and store the endpoint+keys in `t_push_subscription` (one row per device). `PushService` sends encrypted payloads via `pywebpush`, deletes subscriptions on HTTP 410 Gone, and is a no-op unless VAPID is configured.

- Model: `backend/app/models/push_subscription.py:12` (`endpoint`, `p256dh_key`, `auth_key`, CASCADE on user delete)
- Service: `backend/app/services/push_service.py:34` — `is_configured` (`:37`), `send_to_user`, `broadcast_except_connected` (`:177`), `broadcast_all`
- API: `backend/app/api/v1/endpoints/push.py` — `GET /push/vapid-key` (public), `POST /push/subscribe`, `/unsubscribe`, `/notify` (admin only)
- Schemas: `backend/app/schemas/push.py`.

## WS ↔ Push Bridge (Offline Delivery)

The WS layer bridges to Web Push: significant broadcasts (`fact_created`, `transfer_created`, `webauthn_credential_compromised`) also call `_send_push_for_offline_users`, which collects the set of currently-connected WS user ids and pushes only to users *not* in that set, debounced to one push every 30s.

- `backend/app/api/v1/endpoints/budget_ws.py:809` — `_send_push_for_offline_users` (uses `PushService.broadcast_except_connected`)
- `_get_connected_user_ids` (`:804`) reads `ws_manager.connections`; `set_push_db_session_factory` (`:795`) wires the DB session at startup.
- `PUSH_DEBOUNCE_SECONDS = 30` (`budget_ws.py:789`).
