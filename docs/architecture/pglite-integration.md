# PGlite Integration Architecture

**Status:** Planning Complete | **Version:** 1.0 | **Date:** 2026-01-20

---

## Обзор

PGlite WASM интеграция обеспечивает клиентскую PostgreSQL базу данных для снижения сетевой нагрузки на 70-80% и полной offline-функциональности.

**Ключевые метрики:**
- API requests: -70-80% (246 KB → 50 KB за сессию)
- Dashboard load: 85% faster (500-1000ms → 80-160ms)
- Offline coverage: 30% → 100%
- Bundle size: +2.6 MB gzipped

---

## Архитектура

### Hybrid Approach: PGlite + IndexedDB

```
┌─────────────────────────────────────────┐
│           Frontend Application          │
├─────────────────────────────────────────┤
│                                         │
│  ┌──────────────┐    ┌──────────────┐  │
│  │  DataLayer   │    │OfflineManager│  │
│  └──────┬───────┘    └──────┬───────┘  │
│         │                   │          │
│    ┌────┴──────────┬────────┴────┐     │
│    │               │             │     │
│ ┌──▼────────┐  ┌──▼──────┐  ┌──▼───┐  │
│ │ PGliteManager│ IndexedDB│ │Pending│  │
│ │  (SQL Queries)│(Queue/UI)│ │Queue │  │
│ └──┬────────┘  └─────────┘  └──────┘  │
│    │                                   │
│ ┌──▼────────────────────┐              │
│ │   PGlite WASM Engine  │              │
│ │   (PostgreSQL 16)     │              │
│ └──┬────────────────────┘              │
│    │                                   │
│ ┌──▼────────────────────┐              │
│ │   IndexedDB Backend   │              │
│ │   (Persistent Storage)│              │
│ └───────────────────────┘              │
└─────────────────────────────────────────┘
          │                │
          │ WebSocket      │ API Fallback
          │ (Sync)         │
          ▼                ▼
┌─────────────────────────────────────────┐
│         Backend (FastAPI)               │
│  ┌──────────────┐  ┌─────────────────┐ │
│  │WebSocket Sync│  │REST API Fallback│ │
│  └──────┬───────┘  └─────────────────┘ │
│         │                               │
│  ┌──────▼──────────────────┐            │
│  │ Redis Pub/Sub (Multi-Worker Sync) │  │
│  └──────┬──────────────────┘            │
│         │                               │
│  ┌──────▼──────┐                        │
│  │ PostgreSQL  │                        │
│  │  (Server DB)│                        │
│  └─────────────┘                        │
└─────────────────────────────────────────┘
```

### Data Responsibility Split

**PGlite (Client-side PostgreSQL):**
- ✅ Synced reference data (articles, financial centers, cost centers)
- ✅ Transactional data (budget facts, windowed 3 months)
- ✅ Shopping lists + items
- ✅ Recurring plans
- ✅ Complex queries (SQL WHERE, JOIN, GROUP BY)
- ✅ Closure table queries (hierarchy)

**IndexedDB (Native browser):**
- ✅ Pending operations queue (offline writes)
- ✅ User preferences (key-value)
- ✅ Binary data (images, files)
- ✅ Ephemeral data (form drafts)

---

## Database Schema

### Schema Versioning

```sql
-- Migration tracking (v1+)
CREATE TABLE local_schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);
```

### v1: Reference Data

```sql
-- Articles (categories)
CREATE TABLE local_articles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  parent_id INTEGER,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('income', 'expense')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Financial Centers (accounts)
CREATE TABLE local_financial_centers (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT CHECK (type IN ('account', 'wallet', 'card')),
  currency TEXT DEFAULT 'RUB',
  is_active BOOLEAN DEFAULT true
);

-- Cost Centers (projects)
CREATE TABLE local_cost_centers (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true
);

-- Closure Table (hierarchy)
CREATE TABLE local_article_hierarchy (
  ancestor_id INTEGER NOT NULL,
  descendant_id INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);

-- Sync Metadata
CREATE TABLE local_sync_metadata (
  entity_type TEXT PRIMARY KEY,
  last_sync_timestamp TIMESTAMP,
  sync_version INTEGER DEFAULT 1,
  total_records INTEGER DEFAULT 0
);
```

### v2: Transactional Data

```sql
-- Budget Facts (transactions)
CREATE TABLE local_budget_facts (
  id INTEGER PRIMARY KEY,      -- Server ID
  temp_id TEXT UNIQUE,          -- Client temp ID (UUID)
  user_id INTEGER NOT NULL,
  article_id INTEGER NOT NULL,
  financial_center_id INTEGER NOT NULL,
  cost_center_id INTEGER,
  date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  record_type TEXT CHECK (record_type IN ('fact', 'plan')),
  comment TEXT,
  transfer_group_id TEXT,
  is_transfer BOOLEAN DEFAULT false,

  -- Sync tracking
  sync_status TEXT CHECK (sync_status IN ('synced', 'pending', 'conflict', 'deleted')) DEFAULT 'synced',
  sync_hash TEXT,
  content_hash TEXT,
  synced_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Pending Operations Queue
CREATE TABLE local_pending_operations (
  id SERIAL PRIMARY KEY,
  operation TEXT CHECK (operation IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL,
  temp_id TEXT,
  server_id INTEGER,
  payload JSONB NOT NULL,
  content_hash TEXT UNIQUE,
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Sync Conflicts Log
CREATE TABLE local_sync_conflicts (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  temp_id TEXT,
  local_version JSONB,
  server_version JSONB,
  resolution TEXT CHECK (resolution IN ('server', 'client', 'merged', 'pending')),
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Recurring Plans
CREATE TABLE local_recurring_plans (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  article_id INTEGER NOT NULL,
  financial_center_id INTEGER NOT NULL,
  cost_center_id INTEGER,
  amount NUMERIC(12, 2) NOT NULL,
  day_of_month INTEGER,
  frequency TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### v3: Shopping Lists

```sql
CREATE TABLE local_shopping_lists (
  id INTEGER PRIMARY KEY,
  temp_id TEXT UNIQUE,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE local_shopping_list_items (
  id INTEGER PRIMARY KEY,
  temp_id TEXT UNIQUE,
  list_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  quantity NUMERIC(10, 3) DEFAULT 1,
  position INTEGER NOT NULL,
  is_completed BOOLEAN DEFAULT false,
  sync_status TEXT DEFAULT 'synced',
  created_at TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (list_id) REFERENCES local_shopping_lists(id) ON DELETE CASCADE
);
```

---

## Sync Protocol

### Sync Types

**1. Initial Sync (First Launch):**
```typescript
WebSocket Event: sync_initial_request
Response: sync_initial_response
- Full data dump (all reference data)
- Bulk insert с chunking (1000 records/chunk)
- Progress tracking (0% → 100%)
```

**2. Incremental Sync (Every 5 minutes):**
```typescript
WebSocket Event: sync_incremental_request
Response: sync_incremental_response
- Delta changes (created, updated, deleted)
- Version tracking (last_sync_timestamp)
- Windowed data (facts: 3-month window)
```

**3. Client Upload (Pending Operations):**
```typescript
WebSocket Event: sync_client_changes
Response: sync_client_changes_response
- Batch upload (max 100 operations)
- temp_id → server_id mapping
- Retry logic (exponential backoff, max 3 attempts)
```

**4. Real-Time Events (Existing WebSocket):**
```typescript
Events: fact_created, fact_updated, fact_deleted, etc.
- Broadcast via Redis Pub/Sub (multi-worker)
- Immediate PGlite update
- UI refresh без reload
```

### Conflict Resolution

**Strategy: Last Write Wins (LWW):**
```
1. Compare updated_at timestamps
2. Winner: MAX(server_time, client_time)
3. Log conflict для debugging
4. Target conflict rate: <1%
```

**Advanced (Phase 3):**
- Shopping Lists: Position-based merge
- Completed status: OR logic
- Quantity: MAX value
- Manual resolution UI (modal)

---

## Performance Optimizations

### 1. Batch INSERT (PostgreSQL Syntax)

```sql
-- ❌ SLOW (N queries)
FOR each article:
  INSERT INTO local_articles VALUES (...)

-- ✅ FAST (1 query, 10-100x faster)
INSERT INTO local_articles (id, name, ...)
VALUES
  (1, 'Food', ...),
  (2, 'Transport', ...),
  ...
  (1000, 'Other', ...)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```

### 2. Chunking (Large Datasets)

```typescript
const CHUNK_SIZE = 1000;

for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
  const chunk = articles.slice(i, i + CHUNK_SIZE);
  await insertChunk(chunk);
  onProgress(i + chunk.length, articles.length);
}
```

### 3. Indexes

```sql
-- Dashboard query optimization
CREATE INDEX idx_facts_user_date ON local_budget_facts(user_id, date DESC);

-- Filter optimization
CREATE INDEX idx_facts_article ON local_budget_facts(article_id);

-- Sync query optimization
CREATE INDEX idx_facts_sync_status ON local_budget_facts(sync_status);

-- Hierarchy queries
CREATE INDEX idx_hierarchy_ancestor ON local_article_hierarchy(ancestor_id);
```

### 4. Query Time Tracking

```typescript
class PerformanceMonitor {
  private queryTimes: number[] = [];

  trackQuery(durationMs: number) {
    this.queryTimes.push(durationMs);
    if (this.queryTimes.length > 100) {
      this.queryTimes.shift(); // Keep last 100
    }
  }

  getAvgQueryTime(): number {
    return this.queryTimes.reduce((a, b) => a + b, 0) / this.queryTimes.length;
  }
}
```

---

## Feature Flags

### localStorage Configuration

```javascript
// Enable/Disable PGlite
localStorage.setItem('enablePGlite', 'true');

// Data window (days)
localStorage.setItem('pgliteFactsWindow', '90'); // 30, 90, 180, 365

// Auto-sync interval (ms)
localStorage.setItem('pgliteAutoSync', '300000'); // 5 minutes
```

### Graceful Fallback

```typescript
async getArticles(): Promise<Article[]> {
  // Try PGlite first
  if (FEATURE_FLAGS.ENABLE_PGLITE && pgliteManager.isReady()) {
    try {
      return await pgliteManager.queryArticles();
    } catch (err) {
      console.error('[DATA_LAYER] PGlite failed, fallback to API:', err);
    }
  }

  // Fallback to API
  return await fetchArticlesFromAPI();
}
```

---

## Data Pruning

### Automatic Weekly Cleanup

```javascript
// Service Worker periodic sync (7 days)
self.addEventListener('periodicsync', event => {
  if (event.tag === 'weekly-pruning') {
    event.waitUntil(pruneFacts());
  }
});

async function pruneFacts() {
  const windowStart = PGLITE_CONFIG.getFactsWindowStart();

  // NEVER delete pending operations
  await db.query(`
    DELETE FROM local_budget_facts
    WHERE date < $1 AND sync_status = 'synced'
  `, [windowStart]);
}
```

---

## Security Considerations

1. **No sensitive data in client DB**: Password hashes, API keys NEVER stored
2. **Content hash deduplication**: Prevent duplicate operations
3. **Sync hash integrity**: MD5 для conflict detection
4. **IndexedDB quota**: 10 MB max (monitor via diagnostic UI)

---

## Monitoring & Diagnostics

### Diagnostic Modal (Settings Page)

```typescript
interface DiagnosticData {
  isEnabled: boolean;
  isInitialized: boolean;
  dbSizeKB: number;
  lastSyncTimestamp: string;
  syncStatus: 'idle' | 'syncing' | 'error';
  tableStats: {
    articles: number;
    facts: number;
    pending_operations: number;
  };
  performanceMetrics: {
    avgQueryTimeMs: number;
    totalQueries: number;
  };
  conflicts: {
    total: number;
    server_wins: number;
    client_wins: number;
  };
}
```

### Performance Monitor

```javascript
// Console debugging
window.performanceMonitor.getStats();
// {
//   api: { count: 10, avgDurationMs: 450 },
//   pglite: { count: 70, avgDurationMs: 35 },
//   reductionPercent: 87.5,
//   speedupFactor: 12.9
// }

window.performanceMonitor.getDetailedStats();
// {
//   getArticles: { api: {...}, pglite: {...} },
//   loadRecentFacts: { api: {...}, pglite: {...} }
// }
```

---

## Implementation Phases

### Phase 1: Reference Data (1-2 weeks, Low Risk)
- ✅ task-001: PGlite Dependency Setup
- ✅ task-002: PGliteManager Core
- ✅ task-003: Initial Sync Protocol
- ✅ task-004: Feature Flag & Diagnostic UI
- ✅ task-005: Replace Reference API Calls

**Milestone:** 70% reduction в API calls для reference data

### Phase 2: Transactions (3-4 weeks, Medium Risk)
- ✅ task-006: Extend Schema for Facts
- ✅ task-007: Incremental Sync Protocol
- ✅ task-008: Client Upload Changes
- ✅ task-009: Conflict Resolution LWW
- ✅ task-010: Data Pruning Logic
- ✅ task-011: Dashboard Query Optimization

**Milestone:** Full offline fact creation + 50% faster dashboard

### Phase 3: Full Offline (4-6 weeks, High Risk)
- ✅ task-012: Shopping Lists Schema
- ✅ task-013: Conflict Resolution Modal UI
- ✅ task-014: Merge Conflict Logic
- ✅ task-015: Complete API Replacement
- ✅ task-016: Stress Testing (10k+ facts)
- ✅ task-017: User Acceptance Testing

**Milestone:** Full offline mode (all CRUD works) + 99.9% sync reliability

---

## Rollback Strategy

**Phase 1:** Feature flag disable (instant)
**Phase 2:** Gradual rollout (10% → 50% → 100%)
**Phase 3:** Per-feature disable + user opt-out

```javascript
// Emergency rollback
localStorage.setItem('enablePGlite', 'false');
window.location.reload();
```

---

## API-First Migration (v10.x)

**Status:** ✅ Implemented | **Version:** v10.0.0+ | **Date:** 2026-01-27

---

### Проблема (до v10.x)

**PGlite-First стратегия создавала проблемы:**

```typescript
// ❌ СТАРЫЙ ПОДХОД (v9.x и ниже)
async getFinancialCenters() {
  if (isPGliteEnabled()) {  // Проверяет только localStorage
    const pglite = await getPGlite();
    if (pglite.isReady()) {
      return pglite.queryFinancialCenters();  // Может вернуть []
    }
  }

  // API fallback только если PGlite disabled или not ready
  return await getFinancialCentersFromAPI();
}
```

**Последствия:**
- ❌ Медленная инициализация PGlite блокировала UI
- ❌ Пустая PGlite возвращала `[]` вместо запроса к API
- ❌ Пользователь не мог работать пока PGlite не готова
- ❌ Нет явного контроля над использованием PGlite

**Архитектурная проблема:**
Система пыталась использовать PGlite сразу после включения в settings, но данные еще не синхронизированы.

---

### Решение: API-First с Opt-In PGlite

**Новая архитектура (v10.x+):**

```
┌─────────────────────────────────────────────────────────────┐
│  PHASE 1: Initial State (User Login)                       │
│  - Работа через API (100% надежно)                         │
│  - PGlite инициализируется в фоне (lazy, non-blocking)     │
│  - Индикатор: желтый + пульсация (initializing)            │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 2: Background Initialization                         │
│  1. initializeDatabase() → IndexedDB                        │
│  2. runMigrations() → Schema setup                          │
│  3. syncReferenceData() → Load reference data               │
│  4. runValidationSuite() → Verify readiness                 │
│     ├─ Schema version check                                 │
│     ├─ Reference data loaded (articles, FCs, CCs)          │
│     ├─ Query tests (SELECT, JOIN)                          │
│     └─ Performance benchmarks                               │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 3: Ready Notification                                │
│  - Toast: "Локальная БД готова! Переключиться?"            │
│  - Кнопки: [Переключиться] [Позже] [Подробнее]             │
│  - Индикатор: зеленый (ready, но не активен)               │
└─────────────────────────────────────────────────────────────┘
                          ↓
                   [User clicks "Переключиться"]
                          ↓
┌─────────────────────────────────────────────────────────────┐
│  PHASE 4: Opt-In Activation                                 │
│  - setPGliteActive(true) → localStorage                     │
│  - Страница перезагружается                                 │
│  - DataLayer переключается: API → PGlite                   │
│  - Индикатор: зеленый active (idle)                        │
└─────────────────────────────────────────────────────────────┘
```

---

### Ключевые принципы

**1. API-First by Default**
Система ВСЕГДА использует API пока пользователь не подтвердит переход на PGlite.

**2. Non-Blocking Initialization**
PGlite инициализируется в фоне, не блокирует UI. Пользователь может работать сразу после login.

**3. User Consent Required**
Переход на PGlite требует явного подтверждения через notification или settings.

**4. Validation Before Switch**
Переключение только если PGlite полностью готова (validation suite passed).

**5. Graceful Degradation**
Fallback на API если PGlite вернула пустой результат или ошибку.

**6. Visual Feedback**
Индикатор показывает статус инициализации (5 состояний).

---

### Feature Flags Architecture

**v10.x вводит два независимых флага:**

```typescript
// featureFlags.ts

// Флаг 1: Разрешение на инициализацию (controlled by user in Settings)
export function isPGliteEnabled(): boolean {
  return localStorage.getItem('enablePGlite') === 'true';
}

export function setPGliteEnabled(enabled: boolean): void {
  localStorage.setItem('enablePGlite', enabled ? 'true' : 'false');
}

// Флаг 2: Активное использование (controlled by opt-in notification)
export function isPGliteActive(): boolean {
  return localStorage.getItem('pgliteActive') === 'true';
}

export function setPGliteActive(active: boolean): void {
  localStorage.setItem('pgliteActive', active ? 'true' : 'false');

  // Dispatch event для обновления UI
  window.dispatchEvent(new CustomEvent('pglite:active:changed', {
    detail: { active }
  }));
}
```

**Таблица состояний:**

| `enablePGlite` | `pgliteActive` | Поведение |
|----------------|----------------|-----------|
| `false` | `false` | PGlite отключен полностью. Только API, нет инициализации. |
| `true` | `false` | Инициализация в фоне. API используется, PGlite готовится. |
| `true` | `true` | Активное использование. PGlite используется, API fallback. |

**Important:**
`enablePGlite` НЕ означает что PGlite используется для запросов. Это только разрешение на background initialization.

---

### State Management

**InitializationStatus enum:**

```typescript
// PGliteState.ts

export type InitializationStatus =
  | 'not_started'    // enablePGlite=false
  | 'initializing'   // Background init в процессе
  | 'validating'     // Запуск validation suite
  | 'ready'          // Готов к использованию (но не активен)
  | 'active'         // Пользователь подтвердил и использует
  | 'error';         // Ошибка инициализации

export interface PGliteState {
  db: PGliteDatabase | null;
  isInitialized: boolean;
  connectionStatus: ConnectionStatus;
  initializationStatus: InitializationStatus;  // NEW in v10.x
  validationResults: ValidationResults | null; // NEW in v10.x
  lastError: Error | null;
}
```

**State transitions:**

```
not_started → initializing → validating → ready → active
            ↓                ↓               ↓
            error ──────────→ error ────────→ error
```

**Event-driven updates:**

```typescript
// updateState() dispatches events
export function updateState(updates: Partial<PGliteState>): void {
  Object.assign(state, updates);

  // Dispatch event для UI updates
  window.dispatchEvent(new CustomEvent('pglite:state:changed', {
    detail: state
  }));
}
```

---

### DataLayer API-First Pattern

**Новая реализация (v10.x+):**

```typescript
// DataLayer.ts

class DataLayer {
  private shouldUsePGlite(): boolean {
    // Проверяет что пользователь АКТИВИРОВАЛ PGlite (не просто enabled)
    return isPGliteActive();
  }

  async getFinancialCenters(
    userId: number,
    includeGlobal: boolean = true
  ): Promise<LocalFinancialCenter[]> {
    const startTime = performance.now();

    // API-FIRST: используем API если PGlite не активирован
    if (!this.shouldUsePGlite()) {
      const result = await this.getFinancialCentersFromAPI(includeGlobal);
      performanceMonitor.trackAPICall('getFinancialCenters', performance.now() - startTime);
      console.info('[DATA_LAYER] API returned', {
        count: result.length,
        source: 'API'
      });
      return result;
    }

    // OPT-IN: пользователь активировал PGlite
    const pglite = await this.getPGlite();

    // Wait for readiness (max 5s)
    if (!pglite.isReady()) {
      const waitStartTime = Date.now();
      while (!pglite.isReady() && (Date.now() - waitStartTime) < 5000) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      if (!pglite.isReady()) {
        console.warn('[DATA_LAYER] PGlite timeout, using API fallback');
        return await this.getFinancialCentersFromAPI(includeGlobal);
      }
    }

    // Query PGlite
    const result = await pglite.queryFinancialCenters(userId, includeGlobal);

    // КРИТИЧНО: Fallback на API если PGlite вернул пустой результат
    if (result.length === 0) {
      console.warn('[DATA_LAYER] PGlite returned empty, using API fallback');
      return await this.getFinancialCentersFromAPI(includeGlobal);
    }

    performanceMonitor.trackPGliteCall('getFinancialCenters', performance.now() - startTime);
    console.info('[DATA_LAYER] PGlite returned', {
      count: result.length,
      source: 'PGlite',
      durationMs: (performance.now() - startTime).toFixed(2)
    });
    return result;
  }
}
```

**Применяется ко всем методам:**
- `getArticles()`
- `getFinancialCenters()`
- `getCostCenters()`
- `getFacts()`
- `getRecurringPlans()`
- `getShoppingLists()`
- `getShoppingListItems()`
- `getArticleHierarchy()`
- `getStores()`
- `getProductGroups()`

---

### Background Initialization

**Entry point (base.html DOMContentLoaded):**

```typescript
document.addEventListener('DOMContentLoaded', function() {
  // Проверяем что enablePGlite=true
  const enablePGlite = localStorage.getItem('enablePGlite') === 'true';

  if (enablePGlite && typeof window.PGlite !== 'undefined') {
    // Запускаем background init (non-blocking)
    window.PGlite.initializeDatabaseInBackground().catch(error => {
      console.warn('[APP] Background PGlite init failed (non-critical):', error);
    });
  }
});
```

**Initialization flow (dbInitializer.ts):**

```typescript
export async function initializeDatabaseInBackground(): Promise<void> {
  // Guard: не запускаем если disabled или уже активен
  if (!isPGliteEnabled() || isPGliteActive()) {
    console.info('[DB_INIT] Background init skipped');
    return;
  }

  console.info('[DB_INIT] Starting background initialization...');
  updateState({ initializationStatus: 'initializing' });

  try {
    // Step 1: Initialize database
    console.info('[DB_INIT] Step 1/5: Initialize database');
    const db = await initializeDatabase();

    // Step 2: Run migrations
    console.info('[DB_INIT] Step 2/5: Run migrations');
    await runMigrations(db);

    // Step 3: Initialize ConflictManager (optional)
    // await initializeConflictManager();

    // Step 4: Sync reference data (optional, can be lazy)
    // await syncReferenceData();

    // Step 5: Run validation suite
    console.info('[DB_INIT] Step 5/5: Validate readiness');
    updateState({ initializationStatus: 'validating' });

    const pgliteManager = getPGliteManager();
    const validationResults = await runValidationSuite(pgliteManager);

    if (!validationResults.allPassed) {
      throw new Error('Validation failed: ' + JSON.stringify(validationResults.errors));
    }

    // SUCCESS: Готово к использованию
    updateState({
      initializationStatus: 'ready',
      isInitialized: true,
      validationResults
    });

    console.info('[DB_INIT] Background initialization complete', validationResults);

    // Показать notification пользователю
    // NOTE: notification показывается только если не было показано ранее
    const { showPGliteReadyNotification } = await import(
      '/static/js/notifications/pgliteReadyNotification.js'
    );
    showPGliteReadyNotification(validationResults);

  } catch (error) {
    console.error('[DB_INIT] Background initialization failed', error);
    updateState({
      initializationStatus: 'error',
      lastError: error as Error
    });

    // Показать тост об ошибке (но не блокировать UI)
    window.showToast(
      'Не удалось инициализировать локальную БД. Работа продолжается через сервер.',
      'warning'
    );
  }
}
```

**Important notes:**
- Initialization НЕ блокирует UI
- Пользователь может работать через API сразу после login
- Ошибки инициализации НЕ критичны (graceful degradation)
- Notification показывается только один раз (localStorage flag)

---

### Validation Suite

**Purpose:**
Проверить что PGlite полностью готова перед активацией.

**4 теста:**

```typescript
// validationSuite.ts

export interface ValidationResults {
  allPassed: boolean;
  schemaValid: boolean;            // Test 1: Schema version
  referenceDataLoaded: boolean;    // Test 2: Reference data
  queryTestsPassed: boolean;       // Test 3: Query tests
  performanceAcceptable: boolean;  // Test 4: Performance
  timestamp: Date;
  details: {
    schemaVersion: number;
    expectedSchemaVersion: number;
    articleCount: number;
    financialCenterCount: number;
    costCenterCount: number;
    hierarchyCount: number;
    avgQueryTimeMs: number;
    maxQueryTimeMs: number;
  };
  errors: string[];
}

export async function runValidationSuite(
  pglite: PGliteManager
): Promise<ValidationResults> {
  const errors: string[] = [];

  // Test 1: Schema version check
  const schemaValid = await validateSchema(pglite, errors);
  // Expected: currentVersion === 3 (or current schema version)

  // Test 2: Reference data loaded
  const referenceDataLoaded = await validateReferenceData(pglite, errors);
  // Expected: articles > 0, financialCenters > 0, costCenters > 0

  // Test 3: Query tests (SELECT, JOIN)
  const queryTestsPassed = await validateQueries(pglite, errors);
  // Expected: basic queries работают, JOIN queries работают

  // Test 4: Performance benchmarks
  const { performanceAcceptable, avgQueryTimeMs, maxQueryTimeMs } =
    await validatePerformance(pglite, errors);
  // Expected: avgQueryTime < 10ms, maxQueryTime < 50ms

  const details = await collectDiagnosticDetails(pglite, avgQueryTimeMs, maxQueryTimeMs);
  const allPassed = schemaValid && referenceDataLoaded && queryTestsPassed && performanceAcceptable;

  return {
    allPassed,
    schemaValid,
    referenceDataLoaded,
    queryTestsPassed,
    performanceAcceptable,
    timestamp: new Date(),
    details,
    errors
  };
}
```

**Performance thresholds:**
- Average query time: < 10ms
- Max query time: < 50ms
- Значительно быстрее API (300-500ms)

---

### Ready Notification System

**Purpose:**
Уведомить пользователя что PGlite готова + запросить подтверждение.

**Toast UI (pgliteReadyNotification.ts):**

```typescript
export function showPGliteReadyNotification(
  validationResults: ValidationResults
): void {
  // Guard: показываем только один раз
  if (localStorage.getItem('pgliteReadyNotificationShown') === 'true') {
    console.info('[NOTIFICATION] PGlite ready notification already shown');
    return;
  }

  const { details } = validationResults;

  // Создаем toast с кнопками
  const toastHtml = `
    <div class="flex flex-col gap-2">
      <div class="font-semibold">🚀 Локальная база данных готова!</div>
      <div class="text-sm opacity-80">
        Загружено: ${details.articleCount} статей,
        ${details.financialCenterCount} счетов,
        ${details.costCenterCount} мест затрат
      </div>
      <div class="text-sm opacity-80">
        Производительность: ${details.avgQueryTimeMs.toFixed(1)}ms
        среднее время запроса
      </div>
      <div class="flex gap-2 mt-2">
        <button id="pglite-activate-btn" class="btn btn-primary btn-sm">
          Переключиться
        </button>
        <button id="pglite-dismiss-btn" class="btn btn-ghost btn-sm">
          Позже
        </button>
        <button id="pglite-details-btn" class="btn btn-ghost btn-sm">
          Подробнее
        </button>
      </div>
    </div>
  `;

  // Показываем toast
  window.showToast(toastHtml, 'success');

  // Event handlers для кнопок
  setTimeout(() => {
    // Кнопка "Переключиться"
    document.getElementById('pglite-activate-btn')?.addEventListener('click', async () => {
      console.info('[NOTIFICATION] User clicked "Переключиться"');

      // Активируем PGlite
      setPGliteActive(true);

      // Помечаем что notification показан
      localStorage.setItem('pgliteReadyNotificationShown', 'true');

      // Показываем confirmation
      window.showToast(
        'Переключение на локальную БД выполнено. Страница будет перезагружена.',
        'success'
      );

      // Перезагружаем страницу
      setTimeout(() => window.location.reload(), 1500);
    });

    // Кнопка "Позже"
    document.getElementById('pglite-dismiss-btn')?.addEventListener('click', () => {
      console.info('[NOTIFICATION] User dismissed notification');
      // Toast закрывается автоматически
    });

    // Кнопка "Подробнее"
    document.getElementById('pglite-details-btn')?.addEventListener('click', () => {
      console.info('[NOTIFICATION] User clicked "Подробнее"');
      // TODO: Открыть diagnostic modal
      console.info('[NOTIFICATION] Validation Results:', validationResults);
    });
  }, 100);
}
```

**User flow:**
1. Background init завершается → `initializationStatus = 'ready'`
2. Notification показывается автоматически
3. Пользователь кликает "Переключиться" → `setPGliteActive(true)`
4. Страница перезагружается
5. DataLayer начинает использовать PGlite

---

### UI Components

**1. PGlite Indicator (Navbar, base.html)**

**5 состояний индикатора:**

```html
<!-- Not Started: Hidden -->
<div id="pglite-indicator-wrapper" class="hidden">

  <!-- Initializing: Yellow + Pulse -->
  <svg id="pglite-icon-initializing" class="h-5 w-5 text-warning pglite-pulse hidden">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 6v6l4 2"/>
  </svg>

  <!-- Ready: Green (clickable for activation) -->
  <svg id="pglite-icon-ready" class="h-5 w-5 text-success cursor-pointer hidden">
    <circle cx="12" cy="12" r="9"/>
    <path d="M5 13l4 4L19 7"/>
  </svg>

  <!-- Active: Green (idle) -->
  <svg id="pglite-icon-active" class="h-5 w-5 text-success hidden">
    <!-- Database icon -->
  </svg>

  <!-- Syncing: Blue + Pulse -->
  <svg id="pglite-icon-syncing" class="h-5 w-5 text-info pglite-pulse hidden">
    <!-- Sync icon -->
  </svg>

  <!-- Error: Red -->
  <svg id="pglite-icon-error" class="h-5 w-5 text-error hidden">
    <!-- Error icon -->
  </svg>

</div>
```

**State mapping (pglite-indicator-manager.html):**

```typescript
function updatePGliteIndicator(state: string) {
  switch (state) {
    case 'not_started':
      hidePGliteIndicator();
      break;

    case 'initializing':
    case 'validating':
      showIcon('initializing'); // Yellow pulse
      break;

    case 'ready':
      showIcon('ready'); // Green clickable
      // Click handler открывает notification
      break;

    case 'active':
      if (connectionStatus === 'syncing') {
        showIcon('syncing'); // Blue pulse
      } else {
        showIcon('active'); // Green idle
      }
      break;

    case 'error':
      showIcon('error'); // Red
      break;
  }
}
```

**Polling (every 2 seconds):**

```typescript
setInterval(async () => {
  if (localStorage.getItem('enablePGlite') === 'true' && window.PGliteManager) {
    try {
      const { getState } = await import('/static/js/dist/pglite-operations.bundle.js');
      const state = getState();
      const initStatus = state.initializationStatus || 'not_started';

      updatePGliteIndicator(initStatus);
    } catch (error) {
      // Silent failure (PGliteManager not ready)
    }
  }
}, 2000);
```

**Event listeners:**

```typescript
// Listen for state changes
window.addEventListener('pglite:state:changed', async (event) => {
  const state = getState();
  updatePGliteIndicator(state.initializationStatus);
});

// Listen for activation changes
window.addEventListener('pglite:active:changed', (event) => {
  initPGliteIndicator();
});
```

**2. Settings UI (settings.html)**

**Status indicator:**

```html
<div class="form-control">
  <label class="label cursor-pointer">
    <span class="label-text">
      <span class="font-semibold">Включить PGlite</span>
      <p class="text-sm opacity-70">
        Локальная база данных для offline режима
      </p>

      <!-- NEW: Status indicator -->
      <div id="pglite-settings-status" class="mt-2 hidden">
        <div class="alert alert-info text-sm">
          <svg class="w-4 h-4"><!-- Icon --></svg>
          <span id="pglite-settings-status-text">Инициализация в фоне...</span>
        </div>
      </div>
    </span>

    <input type="checkbox" id="enablePGliteCheckbox" class="toggle toggle-primary" />
  </label>
</div>
```

**Activate section (показывается когда ready):**

```html
<div id="pglite-activate-section" class="hidden mt-4">
  <div class="alert alert-success">
    <svg class="w-5 h-5"><!-- Icon --></svg>
    <div>
      <h3 class="font-bold">Локальная БД готова к использованию!</h3>
      <div class="text-sm">
        Нажмите кнопку ниже для переключения на локальную базу данных.
      </div>
      <div id="pglite-activate-details" class="text-sm mt-1">
        <!-- Загружено данных... -->
      </div>
    </div>
  </div>

  <button id="pglite-activate-settings-btn" class="btn btn-primary mt-2 w-full">
    Активировать локальную БД
  </button>
</div>
```

**Status update logic:**

```typescript
async function updateSettingsPGliteStatus() {
  const state = getState();
  const initStatus = state.initializationStatus;

  switch (initStatus) {
    case 'initializing':
      statusDiv.classList.remove('hidden');
      statusText.textContent = 'Инициализация в фоне...';
      activateSection.classList.add('hidden');
      break;

    case 'validating':
      statusDiv.classList.remove('hidden');
      statusText.textContent = 'Проверка готовности...';
      activateSection.classList.add('hidden');
      break;

    case 'ready':
      statusDiv.classList.add('hidden');
      activateSection.classList.remove('hidden');

      // Показываем diagnostics
      if (state.validationResults) {
        const details = state.validationResults.details;
        activateDetails.textContent =
          `Загружено: ${details.articleCount} статей, ` +
          `${details.financialCenterCount} счетов, ` +
          `${details.costCenterCount} мест затрат. ` +
          `Производительность: ${details.avgQueryTimeMs.toFixed(1)}ms`;
      }
      break;

    case 'active':
      statusDiv.classList.add('hidden');
      activateSection.classList.add('hidden');
      // Можно показать alert "PGlite активна"
      break;

    case 'error':
      statusDiv.classList.remove('hidden');
      statusDiv.querySelector('.alert').classList.replace('alert-info', 'alert-error');
      statusText.textContent = 'Ошибка инициализации. Работа через сервер.';
      activateSection.classList.add('hidden');
      break;
  }
}

// Polling every second
setInterval(updateSettingsPGliteStatus, 1000);
```

---

### Performance Metrics

**Target metrics (v10.x):**

| Метрика | Target | Измерение |
|---------|--------|-----------|
| Background init time | < 15s | `[DB_INIT] Background initialization complete` timestamp |
| Validation suite time | < 3s | `runValidationSuite()` duration |
| API request time (baseline) | < 300ms | `performanceMonitor.trackAPICall()` |
| PGlite query time | < 10ms | `performanceMonitor.trackPGliteCall()` |
| UI blocking time | 0ms | Пользователь может работать сразу после login |

**Console measurement:**

```javascript
// В Console после init
window.performanceMonitor.getStats();
// {
//   api: { count: 10, avgDurationMs: 450 },
//   pglite: { count: 0, avgDurationMs: 0 },  // Until activated
//   reductionPercent: 0,
//   speedupFactor: 1.0
// }

// После активации (pgliteActive=true)
window.performanceMonitor.getStats();
// {
//   api: { count: 2, avgDurationMs: 450 },   // Only fallbacks
//   pglite: { count: 70, avgDurationMs: 8 },
//   reductionPercent: 97.1,
//   speedupFactor: 56.3
// }
```

---

### Troubleshooting Guide

**Problem 1: Индикатор застрял на "initializing" (желтый + пульсация)**

**Причина:** Validation suite не проходит или зависает

**Диагностика:**
```javascript
// В Console
const { getState } = await import('/static/js/dist/pglite-operations.bundle.js');
const state = getState();
console.log('Init status:', state.initializationStatus);
console.log('Validation results:', state.validationResults);
console.log('Last error:', state.lastError);
```

**Решение:**
1. Проверить Console на ошибки `[DB_INIT]` или `[VALIDATION]`
2. Если schema version mismatch → очистить IndexedDB и перезагрузить
3. Если reference data не загружена → проверить WebSocket sync

**Problem 2: Селекты пустые при pgliteActive=false**

**Причина:** DataLayer пытается использовать PGlite вместо API

**Диагностика:**
```javascript
localStorage.getItem('enablePGlite');  // должно быть 'true' или 'false'
localStorage.getItem('pgliteActive');  // должно быть 'false'
```

**Решение:**
Проверить что `shouldUsePGlite()` возвращает `false` при `pgliteActive=false`

**Problem 3: PGlite вернула пустой результат**

**Причина:** Данные не синхронизированы или пусты

**Диагностика:**
```javascript
// В Console
const pglite = await window.DataLayer.getPGlite();
const fcs = await pglite.queryFinancialCenters(0, true);
console.log('PGlite FCs:', fcs);
```

**Решение:**
1. DataLayer должна fallback на API автоматически (см. код выше)
2. Если fallback не работает → проверить `if (result.length === 0)` условие
3. Запустить sync вручную: `window.PGlite.syncReferenceData()`

**Problem 4: Notification не показывается**

**Причина:** localStorage flag уже установлен

**Диагностика:**
```javascript
localStorage.getItem('pgliteReadyNotificationShown');  // должно быть null
```

**Решение:**
```javascript
// Сбросить flag для повторного показа
localStorage.removeItem('pgliteReadyNotificationShown');
// Перезагрузить страницу
location.reload();
```

**Problem 5: Validation suite failed**

**Причина:** Schema version mismatch, пустые таблицы, медленные запросы

**Диагностика:**
```javascript
const { getState } = await import('/static/js/dist/pglite-operations.bundle.js');
const state = getState();
console.log('Validation errors:', state.validationResults?.errors);
```

**Решение:**
1. Schema version mismatch → обновить `EXPECTED_SCHEMA_VERSION` в `validationSuite.ts`
2. Пустые таблицы → запустить sync: `window.PGlite.syncReferenceData()`
3. Медленные запросы → проверить indexes: `CREATE INDEX ...`

---

### Migration Checklist

**Перед внедрением v10.x:**

- [ ] Все методы DataLayer используют API-first pattern
- [ ] `isPGliteActive()` и `isPGliteEnabled()` работают независимо
- [ ] Background init не блокирует UI
- [ ] Validation suite проходит все 4 теста
- [ ] Notification показывается когда PGlite ready
- [ ] Индикатор имеет 5 состояний (not_started, initializing, ready, active, error)
- [ ] Settings показывают статус инициализации
- [ ] Activate button работает и перезагружает страницу
- [ ] Fallback на API если PGlite вернул `[]`
- [ ] Graceful degradation при ошибках PGlite
- [ ] Performance metrics соответствуют target

**Testing scenarios:**

1. **Scenario 1:** Первый запуск (enablePGlite=false) → Только API, индикатор скрыт
2. **Scenario 2:** Background init (enablePGlite=true, pgliteActive=false) → API используется, индикатор желтый
3. **Scenario 3:** Opt-in активация → Notification → Activate → Reload → PGlite используется
4. **Scenario 4:** PGlite пустая, но активна → Fallback на API (graceful degradation)
5. **Scenario 5:** Validation failed → Error toast, работа через API

**См. также:**
`docs/testing/api-first-migration-testing-plan.md` для полного тестового плана.

---

### Files Modified (v10.x)

**Core Logic:**
1. `frontend/shared/db/pglite/features/featureFlags.ts` - Added `isPGliteActive()`, `setPGliteActive()`
2. `frontend/shared/db/pglite/core/PGliteState.ts` - Added `InitializationStatus`, `ValidationResults`
3. `frontend/web/static/js/data/DataLayer.ts` - Rewrote all 11 methods to API-first
4. `frontend/shared/db/pglite/core/dbInitializer.ts` - Added `initializeDatabaseInBackground()`
5. `frontend/shared/db/pglite/core/stateManager.ts` - Event dispatching in `updateState()`

**Validation:**
6. `frontend/shared/db/pglite/validation/validationSuite.ts` (NEW) - 4-test validation suite

**Notifications:**
7. `frontend/web/static/js/notifications/pgliteReadyNotification.ts` (NEW) - Opt-in notification

**UI:**
8. `frontend/web/templates/base.html` - Added initializing/ready icons, DOMContentLoaded handler
9. `frontend/web/templates/scripts/pglite-indicator-manager.html` - 5-state indicator logic
10. `frontend/web/templates/settings.html` - Status indicator + activate button

---

## Related Documentation

- [PGlite Official Docs](https://pglite.dev/)
- [WebSocket Architecture](websocket.md)
- [PWA Architecture](pwa.md)
- [Main Plan](/home/.../async-humming-thimble.md)
- [Effectiveness Analysis](/3_backlog/pglite/EFFECTIVENESS_ANALYSIS.md)
- [Task Backlog](/3_backlog/pglite/README.md)

---

**Last Updated:** 2026-01-20
**Status:** ✅ Planning Complete, Ready for Implementation
**Version:** 1.0
