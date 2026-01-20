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
