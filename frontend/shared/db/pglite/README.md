# PGlite Integration

**Version:** 2.0 (task-007)
**Status:** ✅ Incremental Sync Protocol Ready

## Обзор

PGlite WASM интеграция для клиентской PostgreSQL базы данных с offline-first поддержкой и WebSocket синхронизацией.

**Реализовано:**
- ✅ Schema v2 (Reference Data + Budget Facts)
- ✅ Initial Sync (reference data)
- ✅ Incremental Sync (delta updates для facts)
- ✅ Auto-sync каждые 5 минут (configurable)
- ✅ Soft delete pattern (sync_status='deleted')
- ✅ Server fact prefix \`srv-{id}\` для избежания UUID конфликтов
- ✅ Bulk operations (insert/update/delete)

**Следующие шаги (task-008+):**
- ⏳ Offline create/update/delete с pending queue
- ⏳ Conflict resolution (LWW strategy)
- ⏳ Manual sync button UI

---

## Incremental Sync Protocol (task-007)

### Workflow

1. **Initial Sync** (первый запуск):
   - Frontend: \`requestInitialSync(userId)\`
   - Backend: \`handle_sync_initial()\` → articles, financial_centers, cost_centers, hierarchy
   - Frontend: \`handleSyncInitial()\` → bulkInsertArticles/FinancialCenters/CostCenters/Hierarchy

2. **Incremental Sync** (delta updates):
   - Auto-sync каждые 5 минут (настройка: \`pgliteAutoSyncInterval\`)
   - Frontend: \`requestIncrementalSync(userId)\` с \`last_sync_timestamp\`
   - Backend: \`handle_sync_incremental_request()\` → delta queries:
     - **Created**: \`WHERE created_at > last_sync_timestamp\`
     - **Updated**: \`WHERE updated_at > last_sync_timestamp AND created_at <= last_sync_timestamp\`
     - **Deleted**: FROM \`t_f_budget_fact_history WHERE change_type='DELETE' AND valid_from > last_sync_timestamp\`
   - Frontend: \`handleSyncIncremental()\` → bulkInsertFacts/bulkUpdateFacts/bulkSoftDeleteFacts

3. **UI Update**:
   - CustomEvent \`pglite:sync:complete\` для обновления UI
   - DataLayer cache invalidation

### SyncHandler Class

Auto-sync инициализируется автоматически после login через \`initSyncHandler(userId)\`.

**Manual sync:**
\`\`\`typescript
import { getSyncHandler } from '@web/budget/budgetWSClient/integration/syncHandler';

const handler = getSyncHandler();
if (handler) {
  await handler.performIncrementalSync();
}
\`\`\`

**Auto-sync interval** (default: 5 minutes):
\`\`\`javascript
localStorage.setItem('pgliteAutoSyncInterval', '300000'); // ms
\`\`\`

---

## Feature Flags

Enable/disable PGlite и configure параметры через localStorage:

\`\`\`javascript
// Enable PGlite
localStorage.setItem('enablePGlite', 'true');

// Data window (days to keep in local DB)
localStorage.setItem('pgliteFactsWindow', '90'); // 30, 90, 180, 365

// Auto-sync interval (ms)
localStorage.setItem('pgliteAutoSync', '300000'); // 5 minutes default

// Debug logging (development only)
localStorage.setItem('pgliteDebug', 'true');

// Reload page to apply
window.location.reload();
\`\`\`

---

## Testing

### Run Tests

\`\`\`bash
# All PGlite tests
npm run test -- pglite

# Specific test file
npm run test -- incrementalSync.test.ts

# Watch mode
npm run test:watch -- pglite
\`\`\`

### Test Coverage

- ✅ Schema migrations (v1 → v2)
- ✅ Fact CRUD operations
- ✅ Bulk insert/update/delete
- ✅ Incremental sync workflow
- ✅ Soft delete pattern
- ✅ UPSERT deduplication

---

## Related Documentation

- **Schema:** \`frontend/shared/db/pglite/schemas/v2_transactional.sql\`
- **Backend Handler:** \`backend/app/api/v1/endpoints/sync_handlers.py\`
- **WebSocket Events:** \`frontend/web/static/js/budget/budgetWSClient/types/events.ts\`
- **Task Document:** \`task-007-incremental-sync-protocol.md\`

**Version History:**
- v1.0 (task-001 → task-005): Initial setup + Schema v1 (reference data)
- v2.0 (task-006 → task-007): Schema v2 (budget facts) + Incremental sync
