# PGlite Integration Module

**Version:** 1.3.0 (Task-004)
**Status:** ✅ Feature Flag & Diagnostic UI Complete

## Overview

PGlite WASM integration for client-side PostgreSQL database with WebSocket sync support.

**Capabilities (Phase 1):**
- ✅ PGlite dependency installed (@electric-sql/pglite@0.2.0)
- ✅ TypeScript configuration (path alias @db/*)
- ✅ Vite WASM support (loader + exclude)
- ✅ Build process configured (build-all.js entry point)
- ✅ Feature flags (localStorage-based)
- ✅ Schema initialization (v1 reference data)
- ✅ Migration system (schema versioning)
- ✅ PGliteManager class (high-level API)
- ✅ CRUD operations (articles, financial centers, cost centers)
- ✅ Bulk insert operations (chunked, with progress tracking)
- ✅ WebSocket sync protocol (initial sync)
- ✅ Feature flag system (setPGliteEnabled, setPGliteFactsWindow)
- ✅ Diagnostic UI (PGliteDiagnosticModal)
- ✅ Performance metrics tracking
- ✅ Settings page integration
- ✅ Unit tests (20 tests, 100% passed)
- ⏳ Incremental sync (task-005)

## Installation

Dependencies installed via `package.json`:
- `@electric-sql/pglite@0.2.0` (fixed version)
- `@types/pg@^8.11.0`

## Usage

### Basic Usage (PGliteManager)

```typescript
import { PGliteManager } from '@db/pglite';

// Create manager instance
const manager = new PGliteManager();

// Initialize database (runs migrations automatically)
await manager.init();

// Check if ready
if (manager.isReady()) {
  // Query articles for user
  const articles = await manager.queryArticles({ user_id: 1, type: 'expense' });
  console.log(articles);

  // Query financial centers
  const centers = await manager.queryFinancialCenters(1, true); // only active
  console.log(centers);

  // Bulk insert with progress tracking
  const newArticles = [ /* ... */ ];
  await manager.bulkInsertArticles(newArticles, (current, total) => {
    console.log(`Progress: ${current}/${total}`);
  });

  // Update sync metadata
  await manager.updateSyncMetadata('articles', {
    last_sync_timestamp: new Date(),
    total_records: articles.length
  });
}

// Close when done
await manager.close();
```

### WebSocket Sync Usage

```typescript
import { requestInitialSync } from '@db/pglite';

// Request initial sync from backend (via WebSocket)
requestInitialSync(userId);

// Sync will be handled automatically by budgetWSClient
// Progress updates available via:
// - window.updateSyncProgress(current, total)
// - window.onSyncComplete()
// - window.onSyncError(error)
```

### Feature Flags Usage

```typescript
import { setPGliteEnabled, setPGliteFactsWindow, isPGliteEnabled } from '@db/pglite';

// Check if enabled
if (isPGliteEnabled()) {
  console.log('PGlite is active');
}

// Enable PGlite (shows toast notification)
setPGliteEnabled(true);

// Set facts window to 180 days
setPGliteFactsWindow(180);
```

### Diagnostic Modal Usage

```typescript
import { openPGliteDiagnostic } from '@components';

// Open diagnostic modal
openPGliteDiagnostic();

// Or get diagnostic data programmatically
const pglite = getPGliteManager();
const diagnostics = await pglite.getDiagnosticData();
console.log('DB Size:', diagnostics.dbSizeKB, 'KB');
console.log('Articles:', diagnostics.tableStats.articles);
console.log('Avg Query Time:', diagnostics.performanceMetrics.avgQueryTimeMs, 'ms');
```

### Low-Level Usage (Direct DB Access)

```typescript
import { initializeDatabase, runMigrations } from '@db/pglite';

// Initialize database
const db = await initializeDatabase({ dataDir: 'pglite', debug: true });

// Run migrations
await runMigrations(db);

// Direct query
const result = await db.query('SELECT * FROM local_articles WHERE user_id = $1', [1]);
console.log(result.rows);
```

## Feature Flags

Enable PGlite in browser console:
```javascript
// Enable PGlite
localStorage.setItem('enablePGlite', 'true');

// Configure data window (30, 90, 180, 365 days)
localStorage.setItem('pgliteFactsWindow', '90');

// Configure auto-sync interval (ms)
localStorage.setItem('pgliteAutoSync', '300000'); // 5 minutes

// Enable debug logging (development only)
localStorage.setItem('pgliteDebug', 'true');

// Reload page
window.location.reload();
```

## Build

```bash
npm run bundle       # Production build
npm run bundle:dev   # Development build
```

**Output:** `frontend/shared/db/pglite.min.js` (IIFE bundle, globalName: PGlite)

## Testing

```bash
npm run test:run              # Run all tests
npm run test -- pglite        # Run PGlite tests only
```

**Test Results:**
```
✓ PGlite Integration (4 tests) - Basic integration
  ✓ should initialize PGlite instance
  ✓ should execute simple query
  ✓ should check feature flag disabled by default
  ✓ should enable PGlite via feature flag

✓ PGliteManager (9 tests) - Full functionality
  ✓ should initialize successfully
  ✓ should run migrations on init
  ✓ should track schema version
  ✓ should create all expected tables
  ✓ should query articles (empty result)
  ✓ should query financial centers (empty result)
  ✓ should query cost centers (empty result)
  ✓ should handle sync metadata
  ✓ should close database successfully

✓ Bulk Operations (7 tests) - Bulk insert with chunking
  ✓ bulkInsertArticles > should insert articles in bulk
  ✓ bulkInsertArticles > should handle empty array
  ✓ bulkInsertArticles > should update on conflict
  ✓ bulkInsertArticles > should report progress
  ✓ bulkInsertFinancialCenters > should insert financial centers in bulk
  ✓ bulkInsertCostCenters > should insert cost centers in bulk
  ✓ bulkInsertHierarchy > should insert hierarchy in bulk

Total: 20 tests, 20 passed (100%)
```

## Architecture

**Directory Structure:**
```
frontend/shared/db/pglite/
├── index.ts                    # Barrel export (public API)
├── PGliteManager.ts            # Main class (high-level API)
├── core/
│   ├── PGliteState.ts          # State definition (ZERO deps)
│   ├── stateManager.ts         # State accessors
│   ├── dbInitializer.ts        # Database initialization
│   └── migrationManager.ts     # Schema migrations
├── schemas/
│   └── v1_referenceData.sql    # Schema v1 (reference data)
├── operations/
│   ├── schemaOperations.ts     # CRUD operations
│   └── bulkOperations.ts       # Bulk insert with chunking (task-003)
├── features/
│   └── featureFlags.ts         # Feature flags (localStorage)
├── types/
│   ├── dependencies.ts         # DI types
│   ├── models.ts               # Data models (LocalArticle, etc.)
│   ├── errors.ts               # Custom errors
│   └── pglite.ts               # PGliteResult<T> type
├── utils/
│   └── logger.ts               # Configurable logger (task-002)
└── __tests__/
    ├── integration.test.ts     # Basic integration tests (4)
    ├── PGliteManager.test.ts   # PGliteManager tests (9)
    └── bulkOperations.test.ts  # Bulk operations tests (7)
```

**Frontend WebSocket Integration:**
```
frontend/web/static/js/budget/budgetWSClient/
├── types/
│   └── events.ts               # Added SyncInitialRequest, SyncInitialResponse
├── integration/
│   ├── syncHandler.ts          # PGlite sync handler (task-003)
│   └── eventHandlers.ts        # Updated with sync_initial handler
```

**Backend Sync Handlers:**
```
backend/app/api/v1/endpoints/
├── sync_handlers.py            # PGlite sync handlers (task-003)
└── budget_ws.py                # Updated with sync_initial handler
```

**State Management Pattern:**
- ZERO dependencies в core/PGliteState.ts предотвращает circular deps
- Следует паттерну offlineManager (core/types/operations)
- State accessors в stateManager.ts для удобства

## Configuration

**TypeScript (tsconfig.json):**
- Path alias: `@db/*` → `frontend/shared/db/*`
- Include: `frontend/shared/db/**/*.ts`

**Vite (vite.config.ts):**
- Alias: `@db` → `resolve(__dirname, 'frontend/shared/db')`
- WASM loader: `loader: { '.wasm': 'binary' }`
- Exclude: `['@electric-sql/pglite']` (для pre-bundling)

**Build (build-all.js):**
- Entry point: `frontend/shared/db/pglite/index.ts`
- Output: `frontend/shared/db/pglite.min.js`
- Global name: `PGlite`
- Position: After network module (ZERO deps requirement)

## Completed Tasks

### Task-001: Dependency Setup ✅
- PGlite dependency installed (@electric-sql/pglite@0.2.0)
- TypeScript configuration (path alias @db/*)
- Vite WASM support
- Build process configured
- Feature flags
- Integration tests (4 tests)

### Task-002: PGliteManager Core ✅
- Database initialization (dbInitializer.ts)
- Schema migrations (migrationManager.ts)
- Schema v1 reference data (articles, financial_centers, cost_centers, article_hierarchy)
- CRUD operations (schemaOperations.ts)
- PGliteManager class (high-level API)
- Configurable logger (utils/logger.ts)
- Type-safe query results (types/pglite.ts)
- Unit tests (9 tests, 100% passed)

### Task-003: Initial Sync Protocol ✅
- Bulk insert operations (operations/bulkOperations.ts)
  - Chunked inserts (1000 records per chunk)
  - Progress tracking callbacks
  - ON CONFLICT handling (idempotency)
- WebSocket event types (SyncInitialRequest, SyncInitialResponse)
- Frontend sync handler (budgetWSClient/integration/syncHandler.ts)
- Backend sync handlers (sync_handlers.py, budget_ws.py)
- Unit tests (7 bulk operations tests, 100% passed)

### Task-004: Feature Flag & Diagnostic UI ✅
- Feature flag setters (features/featureFlags.ts)
  - setPGliteEnabled() - enable/disable with notification
  - setPGliteFactsWindow() - configure data window
  - setPGliteAutoSyncInterval() - configure auto-sync
- PGliteManager diagnostic methods
  - getDiagnosticData() - collect DB stats, performance metrics
  - Query time tracking (last 100 queries)
  - DB size calculation via pg_database_size()
- Diagnostic Modal (PGliteDiagnosticModal.ts)
  - Real-time stats display
  - Table counts (articles, financial_centers, cost_centers)
  - Performance metrics (avg query time)
- Settings page integration (settings.html)
  - Enable/disable toggle
  - Facts window slider (30-365 days)
  - Diagnostic button

### Task-005: Replace Reference API Calls ✅
**Date:** 2026-01-21
**Goal:** Replace API calls with PGlite queries (70%+ reduction target)

**Created Components:**
- PerformanceMonitor (monitoring/PerformanceMonitor.ts)
  - trackAPICall() / trackPGliteCall() - duration tracking
  - getStats() - reductionPercent + speedupFactor
  - Circular buffer (last 100 queries per method)
  - Global singleton with window exposure
- DataLayer (data/DataLayer.ts)
  - PGlite-first with graceful API fallback
  - getArticles() / getFinancialCenters() / getCostCenters() / getArticleHierarchy()
  - Automatic performance tracking
  - Global singleton with window exposure

**Extended PGliteManager:**
- Added queryArticleHierarchy() - closure table queries
- Added queryFilteredCostCenters() - FC-filtered cost centers

**Replaced API Calls (9 endpoints):**
1. dashboard/categoryLoader.ts (3 endpoints)
   - loadFinancialCenters() - /api/v1/financial-centers
   - loadCostCenters() - /api/v1/cost-centers
   - filterCostCenterDropdown() - /api/v1/cost-centers?financial_center_id=X
2. facts/integration/dropdownAPI.ts (3 endpoints)
   - loadArticles() - /api/v1/articles
   - loadFinancialCenters() - /api/v1/financial-centers
   - loadCostCenters() - /api/v1/cost-centers
3. plan/helpers.ts (3 endpoints)
   - loadArticles() - /api/v1/articles
   - loadFinancialCenters() - /api/v1/financial-centers
   - loadCostCenters() - /api/v1/cost-centers

**Build Configuration:**
- Added PerformanceMonitor entry point (build-all.js)
- Added DataLayer entry point (build-all.js)

**TypeScript Validation:**
- Type-safe conversions (as unknown as Type)
- Zero TypeScript errors

### Code Review Improvements ✅
**Date:** 2026-01-21
**Score:** 82/100 → 95/100 (after fixes)

**Fixed Warnings:**
1. ✅ Architecture Compliance (+5 points)
   - Added PGlite components to `docs/architecture/overview.yaml`
   - Documented pglite, pgliteDiagnosticModal, settingsPage
   - Updated layers (infrastructure + presentation)
   - Added recent_changes for task-004

2. ✅ Type Safety (+3 points)
   - Created typed interfaces: `CountResult`, `SizeResult` (types/pglite.ts)
   - Replaced `as any` with type-safe assertions
   - Type-safe diagnostic queries with proper type guards
   - Global window types: `ToastType`, `window.showToast` (types/globals.d.ts)

3. ✅ Code Quality - Magic Numbers (+7 points)
   - Extracted constants to features/featureFlags.ts:
     - `MIN_FACTS_WINDOW_DAYS = 30`
     - `MAX_FACTS_WINDOW_DAYS = 365`
     - `DEFAULT_FACTS_WINDOW_DAYS = 90`
     - `MIN_AUTO_SYNC_INTERVAL_MS = 60000`
     - `DEFAULT_AUTO_SYNC_INTERVAL_MS = 300000`
     - `DEFAULT_TOAST_DURATION_MS = 10000`
   - Updated all functions to use constants

**Remaining Suggestions (Non-blocking):**
- Deep nesting in template literals (conditional, acceptable)
- TODO comment for sync state tracking (planned for task-005)

**Final Score:** 95/100
- Architecture: 25/25
- Security: 25/25
- Code Quality: 25/25
- Error Handling: 15/15
- Type Safety: 10/10 (was 7/10)

## Next Steps (Task-005)

**Task-005: Incremental Sync**

1. Добавить timestamp-based sync (последние изменения)
2. Реализовать conflict resolution (last-write-wins)
3. Добавить sync version tracking
4. Background auto-sync с configurable interval
5. Integration test: incremental sync

## Known Issues

**Build warning:** "Generated an empty chunk: pglite"
- **Reason:** PGlite package not imported in code yet (only types exported)
- **Impact:** None (bundle still works, just very small)
- **Resolution:** Will be resolved in task-002 when we import PGlite

## Support

**Issues:** https://github.com/electric-sql/pglite/issues
**Documentation:** https://pglite.dev/
