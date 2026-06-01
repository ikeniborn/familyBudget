# Graph Report - .  (2026-06-01)

## Corpus Check
- 8 files · ~6,743 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 815 nodes · 1427 edges · 54 communities (43 shown, 11 thin omitted)
- Extraction: 96% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 25 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Write-Behind & Order Tests|Write-Behind & Order Tests]]
- [[_COMMUNITY_Plan UI Buttons|Plan UI Buttons]]
- [[_COMMUNITY_Facts WS Event Handlers|Facts WS Event Handlers]]
- [[_COMMUNITY_Dashboard State & Delete|Dashboard State & Delete]]
- [[_COMMUNITY_Pending Records & Locks|Pending Records & Locks]]
- [[_COMMUNITY_Plan Period Controls|Plan Period Controls]]
- [[_COMMUNITY_Facts API Endpoint|Facts API Endpoint]]
- [[_COMMUNITY_Docs & Browser Workarounds|Docs & Browser Workarounds]]
- [[_COMMUNITY_Dashboard Transactions|Dashboard Transactions]]
- [[_COMMUNITY_Facts Manager|Facts Manager]]
- [[_COMMUNITY_Hints & Add Flows|Hints & Add Flows]]
- [[_COMMUNITY_Redis PubSub Broadcast|Redis Pub/Sub Broadcast]]
- [[_COMMUNITY_Frontend Types & Globals|Frontend Types & Globals]]
- [[_COMMUNITY_WS Manager Rationale|WS Manager Rationale]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 48|Community 48]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 52|Community 52]]

## God Nodes (most connected - your core abstractions)
1. `WriteBehindService` - 22 edges
2. `getState()` - 21 edges
3. `DashboardFactsManager` - 20 edges
4. `RedisBudgetWebSocketManager` - 20 edges
5. `loadFacts()` - 14 edges
6. `openModalPlan()` - 13 edges
7. `updateState()` - 13 edges
8. `openModalFact()` - 12 edges
9. `loadPendingRecords()` - 11 edges
10. `savePlanModal()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `RedisBudgetWebSocketManager` --calls--> `test_broadcast_calls_local_broadcast_even_when_redis_available()`  [INFERRED]
  backend/app/services/redis_ws_manager.py → tests/unit/backend/test_redis_ws_manager.py
- `RedisBudgetWebSocketManager` --calls--> `test_broadcast_publishes_with_worker_id()`  [INFERRED]
  backend/app/services/redis_ws_manager.py → tests/unit/backend/test_redis_ws_manager.py
- `RedisBudgetWebSocketManager` --calls--> `test_broadcast_local_only_when_redis_unavailable()`  [INFERRED]
  backend/app/services/redis_ws_manager.py → tests/unit/backend/test_redis_ws_manager.py
- `savePlan()` --calls--> `setButtonLoading()`  [INFERRED]
  frontend/web/static/js/dashboard/features/addPlan/planForm.ts → frontend/web/static/js/dashboard/shared/utils/buttonState.ts
- `savePlanOffline()` --calls--> `setButtonLoading()`  [INFERRED]
  frontend/web/static/js/dashboard/features/addPlan/planForm.ts → frontend/web/static/js/dashboard/shared/utils/buttonState.ts

## Hyperedges (group relationships)
- **Redis Pub/Sub Multi-Worker WebSocket Sync** — redis_pubsub_service_publish_event, redis_pubsub_service_subscriber_loop, redis_ws_manager_local_broadcast, redis_pubsub_budget_events_channel, multi_worker_ws_broadcast_pattern [EXTRACTED 1.00]
- **Write-Behind Pipeline: Queue → Process → Commit → Broadcast** — write_behind_service_writebehindservice, write_behind_service_writequeueitem, write_behind_service_process_item, write_behind_service_process_fact, write_behind_service_broadcast_event, write_behind_service_commit_before_broadcast, redis_ws_manager_broadcast [EXTRACTED 1.00]
- **Shopping Offline Sync Pipeline** — shopping_sync_upload_pending_items, shopping_sync_upload_item, shopping_sync_download_lists, shopping_sync_upload_pending_lists, shopping_sync_404_fallback, dexie_offline_sync_pattern [EXTRACTED 1.00]
- **WebSocket Sync Fix — Test Coverage** — test_redis_pubsub_module, test_redis_ws_manager_module, test_write_behind_order_module, test_shopping_sync_404_module, redis_ws_manager_direct_local_delivery, write_behind_service_commit_before_broadcast, shopping_sync_404_fallback [INFERRED 0.95]

## Communities (54 total, 11 thin omitted)

### Community 0 - "Write-Behind & Order Tests"
Cohesion: 0.05
Nodes (43): Unit test verifying broadcast happens after session.commit() in write-behind., _process_item() must call session.commit() before _broadcast_event().     Order, test_broadcast_called_after_commit(), Enum, from_json(), _get_batch_size(), _get_dlq_max_size(), _get_dlq_ttl_seconds() (+35 more)

### Community 1 - "Plan UI Buttons"
Cohesion: 0.07
Nodes (45): setupPlanPeriodButtons(), setupTransferPeriodButtons(), openContextModal(), PAGE_CONTEXT_MAP, CacheEntry, closeModalFact(), formatDateYYYYMMDD(), hideSkeleton() (+37 more)

### Community 3 - "Facts WS Event Handlers"
Cohesion: 0.08
Nodes (48): adjustStatTotal(), animateAndRemoveRow(), debouncedReloadFacts(), fetchRowHtml(), handleArticleUpdated(), handleBatchDeleteCompleted(), handleFactCreated(), handleFactDeleted() (+40 more)

### Community 4 - "Dashboard State & Delete"
Cohesion: 0.1
Nodes (36): setCacheData(), deleteFactFromDashboard(), deleteFromEditModal(), refreshDashboardWidgets(), showRecurringDeleteDialog(), loadCategoriesForEdit(), loadEditCostCenters(), loadEditFinancialCenters() (+28 more)

### Community 5 - "Pending Records & Locks"
Cohesion: 0.09
Nodes (32): loadPendingRecords(), getPendingLock(), incrementPendingCallCount(), setPendingLock(), formatAmount(), generateFactPlanHTML(), generateHTMLAsync(), generateHTMLSync() (+24 more)

### Community 6 - "Plan Period Controls"
Cohesion: 0.12
Nodes (24): syncHiddenFromActive(), syncPlanPeriodFromActive(), saveFactModal(), saveFactTransaction(), saveFactTransfer(), extractRecurringSettings(), extractReminderSettings(), savePlanModal() (+16 more)

### Community 7 - "Facts API Endpoint"
Cohesion: 0.07
Nodes (34): batch_delete_facts(), _build_fact_response(), create_fact(), delete_fact(), _format_updated_at(), _get_budget_ws_broadcast(), get_fact(), _get_fact_date() (+26 more)

### Community 8 - "Docs & Browser Workarounds"
Cohesion: 0.07
Nodes (33): Backup Operations Documentation, Browser Testing Workarounds Documentation, Cache Busting via PLACEHOLDER, Cache Busting Documentation, Caching Strategy Documentation, CI/CD Build and Deploy Documentation, CI/CD Optimization Documentation, CI/CD Setup Documentation (+25 more)

### Community 9 - "Dashboard Transactions"
Cohesion: 0.13
Nodes (12): buildRecentTransactionsHTML(), loadRecentTransactions(), RecentTransaction, buildAccountBalancesHTML(), buildQuickStatsHTML(), formatMoneyDesktop(), formatMoneyMobile(), isOfflineMode() (+4 more)

### Community 10 - "Facts Manager"
Cohesion: 0.14
Nodes (6): AggregationRow, BalanceRow, DashboardFactsManager, FactRow, factsManager, FinancialCenterRow

### Community 11 - "Hints & Add Flows"
Cohesion: 0.11
Nodes (16): loadPlanHints(), updateState(), Article, CacheEntry, Category, EditFactData, EditPlanData, FactHintsData (+8 more)

### Community 12 - "Redis Pub/Sub Broadcast"
Cohesion: 0.12
Nodes (19): Multi-worker WebSocket broadcast via Redis Pub/Sub, budget:events Redis Channel, budget:event_buffer Redis ZSET, publish_event(), _subscriber_loop(), RedisBudgetWebSocketManager.broadcast(), Direct-first local delivery pattern, get_ws_manager() singleton (+11 more)

### Community 13 - "Frontend Types & Globals"
Cohesion: 0.11
Nodes (17): FinancialCenter, RecordType, BudgetSharedNamespace, BudgetWSClient, CalendarWidgetOptions, CategoryTreeSelectOptions, DashboardExports, DateFormatterStatic (+9 more)

### Community 14 - "WS Manager Rationale"
Cohesion: 0.12
Nodes (10): Disconnect a specific connection by its ID., Update last activity timestamp for a connection., Remove stale connections., Send event to a specific local connection., Get number of LOCAL connections (this worker only)., Get number of LOCAL connections for a user., Redis-backed WebSocket manager for multi-worker deployments.      Each worker ma, Count LOCAL connections for a user (this worker only). (+2 more)

### Community 15 - "Community 15"
Cohesion: 0.25
Nodes (14): getCurrentTimeRounded(), initReminderCalendarWidget(), prefillReminderDateTime(), resetReminderFields(), togglePlanMode(), toggleReminderSettings(), updateReminderDatetime(), initializeRecurringDefaults() (+6 more)

### Community 16 - "Community 16"
Cohesion: 0.18
Nodes (13): loadPlanCategories(), createDefaultState(), DashboardState, resetState(), setEditCategoryTreeSelect(), setPlanCategoryTreeSelect(), setTransactionCategoryTreeSelect(), state (+5 more)

### Community 17 - "Community 17"
Cohesion: 0.19
Nodes (8): invalidateCache(), refreshAccountBalances(), refreshDashboard(), refreshDashboardWidgets(), refreshQuickStats(), refreshRecentTransactions(), BatchDeleteEventData, FactEventData

### Community 18 - "Community 18"
Cohesion: 0.15
Nodes (14): categoryWidget.ts (syncFactTypeHidden), amount input (Сумма), article_id select (Категория, filtered by financial_center_id), cost_center_id select (Место затрат), description textarea (Описание/Комментарий), fact_date input field, fact-hints-container (План/Факт за месяц), fact_type hidden input (synced with record_type) (+6 more)

### Community 19 - "Community 19"
Cohesion: 0.18
Nodes (10): tabManager, TRANSACTION_FIELDS, TRANSFER_FIELDS, tabManager, TRANSACTION_FIELDS, TRANSFER_FIELDS, createTabManager(), TabCache (+2 more)

### Community 20 - "Community 20"
Cohesion: 0.24
Nodes (5): setPlanPeriod(), setPlanTransferPeriod(), DateSetterConfig, setDateWithOffset(), updateButtonActiveState()

### Community 21 - "Community 21"
Cohesion: 0.2
Nodes (8): DAY_NAMES, resetRecurringSettings(), updateDurationFields(), updateFrequencyFields(), updateRecurringPreview(), DurationType, FrequencyType, RecurringSettings

### Community 22 - "Community 22"
Cohesion: 0.18
Nodes (10): get_events_since(), is_pubsub_running(), Redis Pub/Sub service for multi-worker WebSocket broadcasting.  This module prov, Get events from Redis buffer since timestamp.      Used by long polling fallback, Background task that subscribes to Redis Pub/Sub and forwards events.      This, Start the Redis Pub/Sub subscriber background task.      Args:         local_bro, Check if Pub/Sub listener is running., start_pubsub_listener() (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.18
Nodes (11): Unit tests for redis_pubsub_service — exception handler imports., RedisConnectionError must not be the same as builtins.ConnectionError., publish_event() must include source_worker_id in the envelope sent to Redis., Ensure fix imports RedisTimeoutError and RedisConnectionError from correct modul, publish_event() without source_worker_id sends null in envelope., test_publish_event_includes_source_worker_id(), test_publish_event_source_worker_id_defaults_none(), test_redis_exception_classes_importable() (+3 more)

### Community 24 - "Community 24"
Cohesion: 0.2
Nodes (6): Redis-backed event buffer for long polling.      Uses Redis ZSET for cross-worke, Add event (handled by publish_event in Redis mode)., Get events since timestamp (sync version for compatibility)., Get events since timestamp (async, uses Redis if available)., Wait for a new event or timeout., RedisEventBuffer

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (7): enableDisableCategoryAndCostCenter(), loadCostCenters(), loadFinancialCenters(), loadTransactionCategories(), safeShowToast(), setupFinancialCenterListeners(), CostCenter

### Community 26 - "Community 26"
Cohesion: 0.24
Nodes (9): close_redis_ws(), get_event_buffer(), get_ws_manager(), init_redis_ws(), Redis-backed WebSocket Manager for multi-worker deployments.  This module provid, Get the Redis-backed WebSocket manager (singleton)., Get the Redis-backed event buffer (singleton)., Initialize Redis WebSocket manager (call from app startup). (+1 more)

### Community 27 - "Community 27"
Cohesion: 0.33
Nodes (5): applyAccountBalancesState(), applyQuickStatsState(), handleHtmxAfterSwap(), toggleAccountBalances(), toggleQuickStats()

### Community 28 - "Community 28"
Cohesion: 0.25
Nodes (4): saveTransaction(), saveTransactionOffline(), getState(), TransactionFormData

### Community 29 - "Community 29"
Cohesion: 0.32
Nodes (6): openAddPlanModal(), savePlan(), savePlanOffline(), isCacheValid(), PlanFormData, showModalWithSkeleton()

### Community 30 - "Community 30"
Cohesion: 0.25
Nodes (7): Unit tests for RedisBudgetWebSocketManager.broadcast() direct-first behavior., broadcast() must pass source_worker_id=self._worker_id to publish_event()., broadcast() must still call _local_broadcast() when Redis is unavailable., broadcast() must call _local_broadcast() directly regardless of Redis availabili, test_broadcast_calls_local_broadcast_even_when_redis_available(), test_broadcast_local_only_when_redis_unavailable(), test_broadcast_publishes_with_worker_id()

### Community 31 - "Community 31"
Cohesion: 0.32
Nodes (5): fetchMock, uploadPendingShoppingLists(), uploadPendingShoppingOperations(), uploadShoppingItem(), uploadShoppingList()

### Community 32 - "Community 32"
Cohesion: 0.33
Nodes (3): Integration tests for GET /api/v1/facts/{id}/row-html. Ensures server-rendered f, Plan branch keeps original 13-column structure., test_row_html_plan_branch_unchanged()

### Community 33 - "Community 33"
Cohesion: 0.33
Nodes (3): Remove a WebSocket connection from local connections., Broadcast event to local connections directly, then publish to Redis         for, Broadcast event to LOCAL WebSocket connections only.          This is called eit

### Community 34 - "Community 34"
Cohesion: 0.6
Nodes (4): dashboardExports, initWindowExports(), setInitialized(), initModule()

### Community 35 - "Community 35"
Cohesion: 0.4
Nodes (5): init(), initializeForms(), setupFormInitialization(), setupPendingRecordsListeners(), defineReactiveProperties()

### Community 36 - "Community 36"
Cohesion: 0.5
Nodes (3): PUT 404 → POST recreate fallback pattern, uploadShoppingItem(), uploadPendingShoppingOperations()

### Community 37 - "Community 37"
Cohesion: 0.5
Nodes (3): AccountBalance, QuickStats, RecentFact

### Community 38 - "Community 38"
Cohesion: 0.5
Nodes (3): Stop the Redis Pub/Sub subscriber background task., stop_pubsub_listener(), Stop the Redis Pub/Sub subscriber.

### Community 39 - "Community 39"
Cohesion: 0.5
Nodes (4): Write-Behind Queue for async PostgreSQL writes, Dead Letter Queue (write_queue:facts:failed), WriteBehindService, WriteQueueItem

## Knowledge Gaps
- **174 isolated node(s):** `FactEventData`, `BatchDeleteEventData`, `FactRow`, `AggregationRow`, `BalanceRow` (+169 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `loadRecentTransactions()` connect `Dashboard Transactions` to `Window Exports Adapter`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **Why does `getState()` connect `Community 28` to `Plan UI Buttons`, `Window Exports Adapter`, `Dashboard State & Delete`, `Pending Records & Locks`, `Hints & Add Flows`, `Community 15`, `Community 16`, `Community 21`, `Community 25`, `Community 27`, `Community 29`?**
  _High betweenness centrality (0.030) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `RedisBudgetWebSocketManager` (e.g. with `test_broadcast_calls_local_broadcast_even_when_redis_available()` and `test_broadcast_publishes_with_worker_id()`) actually correct?**
  _`RedisBudgetWebSocketManager` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `FactEventData`, `BatchDeleteEventData`, `FactRow` to the rest of the system?**
  _174 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Write-Behind & Order Tests` be split into smaller, more focused modules?**
  _Cohesion score 0.05 - nodes in this community are weakly interconnected._
- **Should `Plan UI Buttons` be split into smaller, more focused modules?**
  _Cohesion score 0.07 - nodes in this community are weakly interconnected._
- **Should `Window Exports Adapter` be split into smaller, more focused modules?**
  _Cohesion score 0.04 - nodes in this community are weakly interconnected._