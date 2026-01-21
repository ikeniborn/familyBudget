# PGlite Integration Module

**Version:** 1.1.0 (Task-002)
**Status:** ✅ PGliteManager Core Complete

## Overview

PGlite WASM integration for client-side PostgreSQL database.

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
- ✅ Unit tests (13 tests, 100% passed)
- ⏳ Sync protocol (task-003)

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

  // Update sync metadata
  await manager.updateSyncMetadata('articles', {
    last_sync_timestamp: new Date(),
    total_records: articles.length
  });
}

// Close when done
await manager.close();
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

Total: 13 tests, 13 passed (100%)
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
│   └── schemaOperations.ts     # CRUD operations
├── features/
│   └── featureFlags.ts         # Feature flags (localStorage)
├── types/
│   ├── dependencies.ts         # DI types
│   ├── models.ts               # Data models (LocalArticle, etc.)
│   └── errors.ts               # Custom errors
└── __tests__/
    ├── integration.test.ts     # Basic integration tests (4)
    └── PGliteManager.test.ts   # PGliteManager tests (9)
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
- Integration tests

### Task-002: PGliteManager Core ✅
- Database initialization (dbInitializer.ts)
- Schema migrations (migrationManager.ts)
- Schema v1 reference data (articles, financial_centers, cost_centers, article_hierarchy)
- CRUD operations (schemaOperations.ts)
- PGliteManager class (high-level API)
- 9 unit tests (100% passed)

## Next Steps (Task-003)

**Task-003: Sync Protocol**

1. Создать `sync/syncManager.ts` - sync orchestration
2. Добавить `sync/syncOperations.ts` - sync helpers
3. Реализовать differential sync (только изменённые записи)
4. Добавить conflict resolution (last-write-wins)
5. Integration test: sync + query after sync

## Known Issues

**Build warning:** "Generated an empty chunk: pglite"
- **Reason:** PGlite package not imported in code yet (only types exported)
- **Impact:** None (bundle still works, just very small)
- **Resolution:** Will be resolved in task-002 when we import PGlite

## Support

**Issues:** https://github.com/electric-sql/pglite/issues
**Documentation:** https://pglite.dev/
