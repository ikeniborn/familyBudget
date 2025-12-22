# Family Budget - Architecture Dependency Graph

This directory contains a structured YAML-based dependency graph for the Family Budget project.
Use these files to understand component relationships when planning changes or onboarding.

## Quick Navigation

| Directory | Description | Files |
|-----------|-------------|-------|
| [functionality/](./functionality/) | Business logic modules | 13 |
| [web/](./web/) | Frontend components | 5 |
| [endpoints/](./endpoints/) | API endpoints | 13 |
| [database/](./database/) | Database objects | 9 |
| [flows/](./flows/) | Data flow diagrams | 6 |
| [guides/](./guides/) | Development guides | 5 |

**Total: 53 files**

## File Format

All files use YAML format with `$ref` links (JSON Reference style) for cross-file relationships:

```yaml
# Example: functionality/budget-management.yaml
module:
  name: budget_management
  models:
    - $ref: "../database/dimensions.yaml#/tables/t_d_article"
  endpoints:
    - $ref: "../endpoints/articles.yaml#/routes"
```

## How to Use

### 1. Finding Impact of Changes

Before modifying a component, check its dependencies:

```bash
# Find all references to Article model
grep -r "t_d_article" docs/architecture/
```

### 2. Understanding a Module

Read the module file and follow `$ref` links:

1. Open `functionality/budget-management.yaml`
2. Check `models` section for database dependencies
3. Check `endpoints` section for API routes
4. Check `used_by` section for frontend consumers

### 3. Planning New Features

1. Check `guides/change-checklist.yaml` for required steps
2. Identify affected modules in `functionality/`
3. Review database changes in `database/`
4. Update endpoints in `endpoints/`
5. Update frontend in `web/`

### 4. Code Review

Use dependency graph to verify:
- All affected components are updated
- No circular dependencies introduced
- Consistent naming across layers

## Directory Structure

```
docs/architecture/
├── README.md                    # This file
├── index.yaml                   # Main index with links to all sections
│
├── functionality/               # Business logic (12 modules)
│   ├── _index.yaml              # Module summary
│   ├── authentication.yaml      # Auth: JWT, Telegram, 2FA
│   ├── budget-management.yaml   # Articles, facts, hierarchy
│   ├── financial-centers.yaml   # Bank accounts, balances
│   ├── cost-centers.yaml        # Projects, departments
│   ├── transfers.yaml           # Inter-account transfers
│   ├── shopping-lists.yaml      # Lists, items, offline sync
│   ├── csv-import.yaml          # Multi-bank CSV import
│   ├── notifications.yaml       # Push, reminders, broadcast
│   ├── analytics.yaml           # Statistics, dashboards
│   ├── admin.yaml               # User management, bulk ops
│   ├── realtime.yaml            # WebSocket events
│   └── offline.yaml             # IndexedDB, sync queue
│
├── web/                         # Frontend components
│   ├── _index.yaml              # Component summary
│   ├── templates.yaml           # Jinja2 templates (16+)
│   ├── js-modules.yaml          # JavaScript modules (15+)
│   ├── css.yaml                 # CSS files
│   └── htmx-triggers.yaml       # HTMX → API mappings
│
├── endpoints/                   # API endpoints
│   ├── _index.yaml              # Endpoint summary
│   ├── auth.yaml                # /auth/*
│   ├── articles.yaml            # /articles/*
│   ├── facts.yaml               # /facts/*
│   ├── financial-centers.yaml   # /financial-centers/*
│   ├── cost-centers.yaml        # /cost-centers/*
│   ├── transfers.yaml           # /transfers/*
│   ├── shopping.yaml            # /shopping-lists/*, /stores/*
│   ├── import.yaml              # /import/*
│   ├── analytics.yaml           # /analytics/*
│   ├── admin.yaml               # /admin/*
│   ├── websocket.yaml           # /budget/ws, /poll, /status
│   └── health.yaml              # /health, /ready, /ping
│
├── database/                    # Database objects
│   ├── _index.yaml              # Table summary (36 tables)
│   ├── dimensions.yaml          # Dimension tables (t_d_*)
│   ├── facts.yaml               # Fact tables (t_f_*)
│   ├── history.yaml             # History tables (*_history)
│   ├── hierarchy.yaml           # Closure tables
│   ├── support.yaml             # Support tables
│   ├── indexes.yaml             # Index strategy
│   ├── constraints.yaml         # FK, CHECK, UNIQUE
│   └── fk-graph.yaml            # FK dependency graph
│
├── flows/                       # Data flow diagrams
│   ├── _index.yaml              # Flow summary
│   ├── create-transaction.yaml  # POST /facts flow
│   ├── telegram-oauth.yaml      # Auth flow
│   ├── ws-broadcast.yaml        # Real-time updates (WebSocket)
│   ├── offline-sync.yaml        # Offline → online sync
│   └── csv-import.yaml          # Import workflow
│
└── guides/                      # Development guides
    ├── _index.yaml              # Guide summary
    ├── change-checklist.yaml    # What to check when changing
    ├── critical-paths.yaml      # High-impact dependencies
    └── impact-analysis.yaml     # How to analyze changes
```

## Legend

### Reference Syntax

| Syntax | Meaning |
|--------|---------|
| `$ref: "./file.yaml#/path"` | Same directory |
| `$ref: "../dir/file.yaml#/path"` | Parent directory |
| `#/tables/t_d_article` | JSON Pointer to specific element |

### FK Relationships

| Symbol | Meaning |
|--------|---------|
| `→` | Required foreign key |
| `⊗` | Optional foreign key (nullable) |
| `↔` | Self-reference |

### Patterns

| Pattern | Description |
|---------|-------------|
| SCD Type 1 | In-place updates (stable PK) |
| SCD Type 2 | Full history with versioning |
| Closure Table | Efficient hierarchical queries |
| Star Schema | Fact table with dimension FKs |

## Service Worker + WebSocket Integration

The application uses both Service Worker (for offline support) and WebSocket (for real-time updates).
All browser requests pass through the Service Worker, which applies different caching strategies.
WebSocket connection is established directly (not through Service Worker).

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BROWSER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────┐   ┌─────────────────┐   ┌──────────────────────────┐   │
│  │  HTMX Widgets  │   │ BudgetWSClient  │   │  IncrementalUpdates      │   │
│  │  (quick-stats, │   │ (WebSocket)     │   │  (direct DOM updates)    │   │
│  │  balances,     │   │                 │   │                          │   │
│  │  transactions) │   │  Multi-tab:     │   │  Cache:                  │   │
│  └───────┬────────┘   │  Web Locks +    │   │  - articles Map          │   │
│          │            │  BroadcastChannel│   │  - financial_centers Map │   │
│          │            │                 │   │                          │   │
│          │            │  Fallback:      │   │                          │   │
│          │            │  Long Polling   │   │                          │   │
│          │            └────────┬────────┘   └────────────┬─────────────┘   │
│          │                     │                         │                  │
│          │    WS event         │    onFactCreated()      │                  │
│          │    ◄────────────────┤────────────────────────►│                  │
│          │                     │    (uses cache for      │                  │
│          │                     │     article names)      │                  │
│          │                     │                         │                  │
│          │    fallback refresh │                         │                  │
│          │◄────────────────────┼─────────────────────────┤                  │
│          │    (debounced)      │                         │                  │
│          ▼                     │                         │                  │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │                        SERVICE WORKER                                  │  │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────────────┐ │  │
│  │  │  Network First  │  │  Cache First    │  │  Background Sync       │ │  │
│  │  │  (API requests) │  │  + SWR          │  │  (offline operations)  │ │  │
│  │  │                 │  │  (static files) │  │                        │ │  │
│  │  │  /api/v1/*      │  │  *.css, *.js    │  │  syncQueue in IDB      │ │  │
│  │  └────────┬────────┘  └────────┬────────┘  └───────────┬────────────┘ │  │
│  └───────────│────────────────────│───────────────────────│──────────────┘  │
│              │                    │                       │                  │
└──────────────│────────────────────│───────────────────────│──────────────────┘
               │                    │                       │
               ▼                    ▼                       ▼
       ┌───────────────────────────────────────────────────────────┐
       │                         BACKEND                            │
       │  /api/v1/* (REST)  +  /health  +  WebSocket (/budget/ws)  │
       └───────────────────────────────────────────────────────────┘
```

### Request Flow Optimization

| Event | Before (HTTP refresh) | After (WebSocket) |
|-------|----------------------|-------------------|
| fact_created | WS → refreshAll() → 3 GET | WS → IncrementalUpdates → 0 GET |
| fact_updated | WS → refreshAll() → 3 GET | WS → debounced refresh → 3 GET (batched) |
| fact_deleted | WS → refreshAll() → 3 GET | WS → DOM remove + debounced → 3 GET (batched) |

**Result**: HTTP requests reduced by 75% (4→1 per transaction), UI latency <100ms.

### Key Files

| File | Purpose |
|------|---------|
| `sw.js` | Service Worker with caching strategies |
| `frontend/web/static/js/budget/budgetWSClient.js` | WebSocket connection manager (with Long Polling fallback) |
| `frontend/web/static/js/budget/incrementalUpdates.js` | Direct DOM updates from WebSocket events |
| `frontend/web/static/js/htmxWidgets.js` | HTMX widget refresh with debouncing |

### Documentation

- **WebSocket Events**: [flows/ws-broadcast.yaml](./flows/ws-broadcast.yaml)
- **Realtime Module**: [functionality/realtime.yaml](./functionality/realtime.yaml)
- **JS Modules**: [web/js-modules.yaml](./web/js-modules.yaml)

## Updating This Documentation

When adding new components:

1. Add entry to appropriate `_index.yaml`
2. Create new YAML file with `$ref` links
3. Update related files' `used_by` sections
4. Run validation (if available)

## Generated

- **Date**: 2025-12-19
- **Version**: 1.0.1
- **Project**: Family Budget

## Recent Changes

- **2025-12-22**: Plan page: moved User column after Description
  - Reordered table columns in facts table (desktop view)
  - New order: ID, Date, Account, Cost Center, Category, Amount, **Description, User**, Reminder, Recurring, Offline, Actions
  - Files: `frontend/web/templates/plan.html:2003-2006,2049-2052`
- **2025-12-22**: Fixed article_type filter on plan page:
  - **Problem**: `filter-article-type` dropdown did not filter facts table
  - **Root Cause #1**: Frontend handler only called `reloadArticleFilter()`, missing `loadFacts()` and sync to analytics
  - **Root Cause #2**: Backend `/admin/facts` and `/admin/facts/count` endpoints did not support `article_type` parameter
  - **Fix (Frontend)**: Updated handler to: 1) update `filters.article_type`, 2) reset category dropdown, 3) reload facts table, 4) sync to analytics
  - **Fix (Backend)**: Added `article_type` query parameter with validation `^(income|expense|debit|credit)$` and filter by `Article.type`
  - Files: `frontend/web/templates/plan.html:1202-1230`, `backend/app/api/v1/admin.py:1949,2069,1999-2000,2107-2108`
- **2025-12-22**: PWA Splash Screen - Instant Display Fix:
  - **Problem**: Splash appeared after ~2s delay due to render-blocking CSS (174KB tailwind-daisyui.min.css)
  - **iOS Native Splash**: Added 10 `apple-touch-startup-image` links for iPhone 7+ (instant display before HTML loads)
  - **Simplified UI**: Removed loader animation, only icon remains on splash
  - **Service Worker**: Added 5 most common iPhone splash images to STATIC_CACHE for precaching
  - **Icon Generator**: Added `generate_splash()` function to `scripts/generate_pwa_icons.sh`
  - **Note**: Deferred CSS loading (rel=preload) was tested but caused FOUC in Safari, reverted to blocking
  - Files: `base.html`, `sw.js`, `generate_pwa_icons.sh`, `templates.yaml`
  - Generated: `frontend/web/static/icons/splash/` (10 PNG files, 40-88KB each)
- **2025-12-22**: Fixed deploy script regex for Alembic head revision detection
  - Bug: regex `[a-f0-9]{12}` expected only hex chars, but Alembic uses full alphabet `[a-z0-9]`
  - Fix: Changed to `[a-zA-Z0-9]{12}` to match all valid revision IDs
  - Files: `scripts/lib/migrations.sh:67`
- **2025-12-22**: Transfer modal: removed cost center fields from both sections
  - Removed `from_cost_center` from FROM (debit) section
  - Removed `to_cost_center` from TO (credit) section
  - Cost center fields not needed for transfers - both always null in database
  - Files: `modal_transfer.html`, `transfer.js`, `endpoints/transfers.yaml`
- **2025-12-21**: Bidirectional Filter Synchronization (plan.html):
  - Implemented automatic bidirectional sync between Analytics Section (charts) and Filters Section (facts table)
  - Added mutex-based loop prevention (`isSyncInProgress`) for safe concurrent updates
  - Created date conversion utilities: `monthToDateRange()` (YYYY-MM → full month range), `dateRangeToMonth()` (range → month if complete)
  - Implemented `syncFiltersToAnalytics()` and `syncAnalyticsToFilters()` functions with needsReload optimization
  - Modified 6 JavaScript handlers to async: `applyFilters()`, `resetFilters()`, `selectAnalyticsMonth()`, `onAnalyticsArticleTypeChange()`, `onAnalyticsArticleChange()`, new `onAnalyticsCFOChange()`
  - Updated CalendarWidget callback and analytics-cfo-filter HTML to trigger synchronization
  - **User Experience**: Selecting month in Analytics automatically updates Filters date range and reloads facts table; selecting full month via calendar automatically highlights corresponding month button in Analytics
  - **Filter Mapping**: date_from/date_to ↔ currentAnalyticsMonth (full month only), article_type/article/financial_center (direct copy), cost_center/user/search (Filters-only)
  - **Reset Button**: Now resets BOTH sections to defaults (current month + empty filters) and reloads both table and charts in parallel
  - Files: `frontend/web/templates/plan.html` (+320 lines)
- **2025-12-21**: Redis Caching Infrastructure (Phase 1):
  - Added Redis service to docker-compose.yml (redis:7-alpine with AOF persistence)
  - Created `backend/app/services/redis_service.py` - connection pool management
  - Added Redis health check to `/health/detailed` endpoint
  - Added Redis Statistics card to `/admin/monitoring` page
  - Created `scripts/lib/redis.sh` - bash module for Redis management
  - Updated `setup.sh` with `configure_redis()` function for interactive setup
  - Updated `deploy.sh` to source redis.sh and verify Redis health
  - Added `guides/redis-caching.yaml` documentation
  - Files: redis_service.py, health.py, config.py, main.py, admin_monitoring.html, setup.sh, deploy.sh, redis.sh
- **2025-12-21**: CSV/Google Sheets import improvements:
  - Fixed "Create missing references" option - now correctly creates stores/product groups during import
  - Added "Aggregate duplicates" option - sums quantity and merges comments for duplicate rows
  - Root cause: validation blocked import with "reference" errors before create_missing_references could take effect
  - Files: `shopping_csv_import.py`, `csv_validator.py`, `csvImporter.js`, `csv_import.py` schema
- **2025-12-21**: Import page optimization: removed redundant bulk-toolbar, replaced category selects with ChoicesCategoryTree (fuzzy search), replaced modal with floating category picker for table cells, removed keyboard-hints, optimized bulk-panel-filtered layout (category select 50% wider)
- **2025-12-21**: Import Step 4 UX cleanup: removed workflow steps indicator (3-step visual), bulk-panel-filtered always visible, filter sidebar collapsed by default
- **2025-12-20**: Import Step 4 Spreadsheet Enhancement: Excel-like cell selection, Fill Down (Ctrl+D), Copy/Paste (Ctrl+C/V), resizable columns with localStorage, context menu, keyboard shortcuts, status bar
- **2025-12-20**: Import page UX improvements: collapsible filter sidebar, filter elements height 3rem, bulk-panel-filtered selects height 3rem
- **2025-12-20**: Fixed critical WebSocket issues (see Known Issues & Fixes section below)
- **2025-12-19**: Added Mobile Quick Actions (Mini Cards Row pattern) - responsive 4-column grid for mobile, preserving 3-column desktop layout (index.html:55-117)
- **2025-12-19**: Updated shopping lists documentation to reflect soft delete pattern and item count filtering (commit 6aa943bf)

## Known Issues & Fixes (2025-12-22)

### Fixed Issues

| Issue | Severity | Status | File |
|-------|----------|--------|------|
| Undefined `sse` variable in facts.py | 🔴 CRITICAL | ✅ Fixed | `backend/app/api/v1/endpoints/facts.py` |
| Race condition in `send_to_connection()` | 🟠 HIGH | ✅ Fixed | `backend/app/api/v1/endpoints/budget_ws.py` |
| Race condition in `update_activity()` | 🟠 HIGH | ✅ Fixed | `backend/app/api/v1/endpoints/budget_ws.py` |
| Missing jitter in WebSocket reconnect | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/budget/budgetWSClient.js` |
| Long polling no exponential backoff | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/budget/budgetWSClient.js` |
| iOS badge flickers yellow/green every 3s | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/budget/budgetWSClient.js` |
| 409 Conflict при создании факта (FK violation) | 🟠 HIGH | ✅ Fixed | `backend/app/api/v1/endpoints/facts.py` |
| 409 Conflict для дат вне 2010-2040 (нет партиции) | 🟠 HIGH | ✅ Fixed | Migration `20251220_*_fix_auto_partition_trigger.py` |
| Дублирование магазинов в Choices.js dropdown | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/lists/listsManager.js` |
| Excessive console errors in offline mode | 🟡 MEDIUM | ✅ Fixed | `budgetWSClient.js`, `offlineManager.js` |
| iOS WebSocket reconnection loop after wake | 🟡 MEDIUM | ✅ Fixed | `frontend/web/static/js/budget/budgetWSClient.js` |

### Issue Details

**1. Undefined `sse` variable (CRITICAL)**
- **Problem**: Plan broadcasts used undefined `sse` variable instead of `ws`
- **Root cause**: Remnant from SSE → WebSocket migration
- **Fix**: Changed `sse.broadcast_plan_*` to `ws.broadcast_plan_*` (lines 244, 1020, 1111, 1218)
- **Result**: Plan operations now broadcast correctly

**2. Race conditions in connection manager (HIGH)**
- **Problem**: `send_to_connection()` and `update_activity()` had no lock protection
- **Root cause**: `broadcast()` correctly used `async with self._lock`, but other methods didn't
- **Fix**: Added async lock to both methods, made `update_activity()` async
- **Result**: No IndexError or duplicate/missed messages during concurrent operations

**3. Missing jitter in reconnect (MEDIUM)**
- **Problem**: Exponential backoff without jitter caused thundering herd
- **Root cause**: All disconnected clients retry at exact same intervals
- **Fix**: Added ±10% jitter to reconnect delay
- **Result**: Distributed reconnection load on server

**4. Long polling without backoff (MEDIUM)**
- **Problem**: Fixed 10s retry interval on errors
- **Root cause**: No exponential backoff implementation
- **Fix**: Added exponential backoff with jitter (1s → 30s max, 10 retries)
- **Result**: Reduced server load on persistent failures

**5. iOS badge flickers yellow/green every 3s (MEDIUM)**
- **Problem**: WebSocket status badge rapidly cycles between yellow (reconnecting) and green (connected) on iOS devices
- **Root cause**: Two issues combined:
  1. `_detectSafariIOS()` only detected Safari and Yandex, missing Chrome iOS (CriOS), Firefox iOS (FxiOS), Edge iOS (EdgiOS)
  2. Rapid WebSocket disconnect/reconnect cycles on iOS caused visible badge flickering
- **Fix**: Three changes in `budgetWSClient.js`:
  1. Renamed `_detectSafariIOS()` to `_detectIOSDevice()` - detects ALL iOS browsers (all use WebKit)
  2. Added status indicator debouncing (500ms) to prevent visual flickering
  3. Increased client ping frequency on iOS (8s vs 15s default) to keep connections alive
- **Result**: Stable green badge on iOS (Safari, Chrome, Firefox, Yandex, PWA)

**6. 409 Conflict при создании факта (HIGH)**
- **Problem**: При FK violation возвращался 409 без информации о причине ошибки
- **Root cause**: IntegrityError ловился middleware и конвертировался в 409 с общим сообщением "Database constraint violation"
- **Fix**: Добавлена явная проверка FK (financial_center_id, cost_center_id) ДО INSERT с понятными ошибками 422
- **Validation added**:
  - `financial_center_id`: обязательное поле, проверка exists + is_active
  - `cost_center_id`: опциональное поле, если указано - проверка exists + is_active
- **Result**: Понятные 422 ошибки вида "Счёт 'Name' архивирован. Выберите активный счёт."

**7. 409 Conflict для дат вне 2023-2030 (HIGH)**
- **Problem**: Попытка создать транзакцию с датой 2020 года вызывает 409 Conflict
- **Root cause**: Таблица `t_f_budget_fact` партиционирована по месяцам, партиции созданы только для 2023-2030
- **PostgreSQL error**: `no partition of relation "t_f_budget_fact" found for row`
- **Initial attempt (FAILED)**: BEFORE INSERT trigger на партиционированной таблице
  - **Почему не работает**: PostgreSQL сначала определяет целевую партицию, потом вызывает триггер
  - Если партиции нет → ошибка ДО вызова триггера
- **Fix**: Pre-create партиции для широкого диапазона дат (2010-2040)
  - Функция `ensure_budget_fact_partition(DATE)` для создания партиций
  - Удаление неэффективных триггеров с партиций
  - Создание партиций на 30 лет (360 партиций)
- **Migrations**:
  - `20251220_y0a1b2c3d4e5_add_auto_partition_creation.py` - функция (содержит ошибочный триггер)
  - `20251220_z1b2c3d4e5f6_fix_auto_partition_trigger.py` - удаляет триггеры, создаёт партиции
- **Result**: Транзакции с датами 2010-2040 создаются успешно

**8. Дублирование магазинов в Choices.js dropdown (MEDIUM)**
- **Problem**: На странице `/lists` в модальном окне добавления товара магазины дублируются в выпадающем списке
- **Root cause**: При reinitialize Choices.js, `destroy()` восстанавливает оригинальный HTML `<select>` со статическими `<option>` элементами. Затем `new Choices()` читает и DOM options и `choices[]` параметр, что приводит к дубликатам
- **Fix**: Добавлен `select.innerHTML = ''` после `destroy()` в функциях `initStoreChoices()` и `initProductGroupChoices()`
- **Files**: `frontend/web/static/js/lists/listsManager.js`
- **Result**: Магазины и группы товаров отображаются без дубликатов

**9. Excessive console errors in offline mode (MEDIUM)**
- **Problem**: При включении офлайн-режима в консоли появляется много ERROR-сообщений: `ERR_INTERNET_DISCONNECTED`, `[BudgetWS] Token fetch: Failed`, `Poll: HTTP 503`
- **Root cause**:
  1. `budgetWSClient.js` использовал `console.error` для штатного fallback-поведения (переход на long polling)
  2. WS клиент пытался подключиться даже когда браузер сообщал об отсутствии сети
  3. `offlineManager.js` вызывал `reconnectWS()` без проверки реального статуса сети
- **Fix**:
  1. Заменили `console.error` на `console.warn` для fallback-сообщений
  2. Добавили проверку `navigator.onLine` перед попыткой подключения в `_createConnection()` и `_startLongPolling()`
  3. Добавили проверку `isOnline` в `reconnectWS()` перед включением WS клиента
  4. HTTP 503 ошибки логируются как `console.warn` вместо `console.error`
- **Files**: `frontend/web/static/js/budget/budgetWSClient.js`, `frontend/web/static/js/offline/offlineManager.js`
- **Result**: В офлайн-режиме нет лишних ERROR-сообщений, только предупреждения для ожидаемого поведения

**10. iOS WebSocket reconnection loop after wake from sleep (MEDIUM)**
- **Problem**: After screen wake from sleep (2+ minutes), badge flickers indefinitely between yellow and green every ~3 seconds. Diagnostics show `ws_connected` → `token_fetch_start` → `ws_closed_code=1005` → cycle repeats.
- **Root cause**: Race condition during wake from sleep:
  1. iOS kills TCP connections while screen is off to save battery
  2. Multiple `visibilitychange` events fire in quick succession when screen wakes
  3. No guard against parallel reconnection attempts leads to overlapping connections
  4. Network not fully stabilized leads to code 1005 (No Status Received) and immediate retry
- **Fix**: Five changes in `budgetWSClient.js`:
  1. Added `_reconnecting` flag to prevent parallel reconnection attempts in `_forceReconnect()`
  2. Added 2-second visibility change debounce for iOS devices
  3. Added iOS wake recovery mode (`_iosWakeRecoveryMode`) with 3-second minimum delay after code 1005
  4. Improved status indicator debouncing: 1s for iOS (vs 500ms), debounce ALL states including 'connected'
  5. Updated `_isConnectionStale()` to check WebSocket readyState
- **Related**: This is a more specific case of issue #5 (iOS badge flickers) that occurs specifically after wake from sleep
- **Files**: `frontend/web/static/js/budget/budgetWSClient.js`
- **Result**: Stable reconnection after wake from sleep with no flickering

### Known Limitations (Deferred)

| Issue | Status | Notes |
|-------|--------|-------|
| IncrementalUpdates cache invalidation | ⏳ Deferred | Requires `article_created/updated` events on backend (not implemented) |

### Documentation

- **Realtime module**: [functionality/realtime.yaml](./functionality/realtime.yaml)
- **WebSocket broadcast flow**: [flows/ws-broadcast.yaml](./flows/ws-broadcast.yaml)
