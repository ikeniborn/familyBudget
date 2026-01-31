---
name: Dexie Management
description: Автоматизация работы с Dexie.js offline-first database в проекте Family Budget
version: 1.1.0
author: Family Budget Team
tags: [dexie, offline-first, indexeddb, caching, crud, sync, cents-conversion]
dependencies: [db-management, frontend-development, websocket-realtime]
architecture_refs:
  - $ref: ../../docs/architecture/dexie-integration.md
  - $ref: ../../DEXIE-MIGRATION-SUMMARY.md
  - $ref: ../../docs/architecture/dexie-rollback.md
  - $ref: ../../docs/architecture/pwa.md
user-invocable: false
---

# Dexie Management Skill v1.1.0

Автоматизация разработки offline-first CRUD операций с Dexie.js (v11.0.0, production-ready).

## When to Use

- Создать offline-first CRUD операции для новой сущности
- Реализовать синхронизацию pending operations с сервером
- Мигрировать данные с PGlite на Dexie
- Добавить compound indexes для оптимизации queries
- Реализовать conflict resolution для offline изменений

**Автоматически активируется при:**
- "Добавь offline поддержку для модели X"
- "Создай Dexie CRUD для Y"
- "Реализуй синхронизацию pending operations"
- "Мигрируй данные с PGlite на Dexie"

## Architecture Context

**References:**
- Dexie Integration: [$ref](../../docs/architecture/dexie-integration.md) (418 строк)
- Migration Summary: [$ref](../../DEXIE-MIGRATION-SUMMARY.md) (331 строка)
- Rollback Procedure: [$ref](../../docs/architecture/dexie-rollback.md) (358 строк)
- PWA Offline: [$ref](../../docs/architecture/pwa.md)

**Key Patterns:**

### 1. Cents Conversion (КРИТИЧНО!)
Amount fields хранятся как **integer cents** для точности:
```typescript
import { toCents, fromCents } from '@db/dexie';

// При сохранении
const fact = { amount: toCents(123.45) }; // → 12345 (integer)

// При чтении
const displayAmount = fromCents(fact.amount); // → 123.45 (float)
```

**Причина:** JavaScript float precision errors (`0.1 + 0.2 = 0.30000000000000004`)

### 2. Async/Await Pattern (ОБЯЗАТЕЛЬНО!)
Все Dexie operations MUST use `await`:
```typescript
// ✅ CORRECT
await db.budgetFacts.add(newFact);
await db.budgetFacts.where('temp_id').equals(temp_id).modify({ ... });

// ❌ WRONG (silent failure)
db.budgetFacts.add(newFact); // Missing await!
```

### 3. Sync Status Tracking
4 валидных состояния:
- `'synced'` - Successfully synced with server
- `'pending'` - Awaiting sync (added to pending queue)
- `'conflict'` - Sync conflict (needs resolution)
- `'deleted'` - Soft delete (pending server confirmation)

### 4. Compound Indexes Optimization
Используйте compound indexes для fast queries:
```typescript
// Schema definition
budgetFacts: '..., [user_id+date], [user_id+sync_status]'

// Query using compound index
await db.budgetFacts
  .where('[user_id+date]')
  .between([userId, dateFrom], [userId, dateTo])
  .toArray();
```

### 5. Temp ID → Server ID Mapping
Offline-first workflow:
1. Create с `temp_id` (UUID) + `id: null`
2. Add to `pendingOperations` queue
3. Upload to server → получить `server_id`
4. Update `id: server_id`, `sync_status: 'synced'`
5. Remove from `pendingOperations`

## Commands

### Command: offline-crud

**Usage:**
```
Создай offline-first CRUD operations для модели <ModelName> с Dexie.js.
Поля: <field1: type1, field2: type2, ...>
Amount field: <field_name> (если есть)
```

**What It Does:**
1. Создает CRUD functions (create, update, delete, query) в `operations/{model}Operations.ts`
2. Создает type definitions в `types/{model}.ts`
3. Добавляет validation function в `utils/validation.ts`
4. Добавляет cents conversion для amount fields
5. Добавляет sync status tracking
6. Добавляет pending operations queue integration

**Template Reference:**
- CRUD Operations: [templates/crud-operations.ts](templates/crud-operations.ts) (~150 строк)
- Type Definitions: см. Key Patterns выше
- Validation Function: см. Key Patterns выше

**Example:**
- Real RecurringPlan CRUD: [examples/recurring-plan-crud.md](examples/recurring-plan-crud.md)

**Generated Files:**
```
frontend/shared/db/dexie/operations/{model}Operations.ts  # CRUD operations
frontend/shared/db/dexie/types/{model}.ts                 # Type definitions
frontend/shared/db/dexie/utils/validation.ts              # Add validate{Model}()
```

---

### Command: sync-operations

**Usage:**
```
Создай sync operations для модели <ModelName> с двусторонней синхронизацией (upload pending + download server data).
```

**What It Does:**
1. Создает `{model}Sync.ts` в `operations/`
2. Реализует upload pending operations
3. Реализует download from server
4. Реализует full sync (upload + download)
5. Добавляет retry logic с exponential backoff
6. Реализует conflict resolution

**Template Reference:**
- Sync Operations: [templates/sync-operations.ts](templates/sync-operations.ts) (~120 строк)
- Conflict Resolution: [examples/conflict-resolution.md](examples/conflict-resolution.md)

**Generated Files:**
```
frontend/shared/db/dexie/operations/{model}Sync.ts  # Sync operations + conflict resolution
```

---

### Command: migration-guide

**Usage:**
```
Мигрируй данные модели <ModelName> с PGlite на Dexie.
```

**Recommendation:**
Вместо сложной миграции данных рекомендуется **re-sync from server**:
- Проще implementation (минимум кода)
- Гарантированная data integrity (source of truth - сервер)
- Меньше риска ошибок миграции
- Автоматическая валидация данных

**Template:**
```typescript
export async function resync{Models}FromServer(
  userId: number,
  dateFrom?: string,
  dateTo?: string
): Promise<{ success: boolean; deleted: number; downloaded: number }> {
  // 1. Clear existing data
  const deletedCount = await db.{models}.clear();

  // 2. Download fresh data from server
  const downloadResult = await download{Models}(userId, dateFrom, dateTo);

  if (!downloadResult.success) {
    throw new Error('Failed to download {models} from server');
  }

  return {
    success: true,
    deleted: deletedCount,
    downloaded: downloadResult.count
  };
}
```

**Alternative:** Direct Migration - см. `frontend/shared/db/dexie/migration/migrateFromPGlite.ts` (250+ строк). НЕ рекомендуется для новых миграций.

---

## Examples

Реальные примеры использования skill:

1. **RecurringPlan CRUD** - [examples/recurring-plan-crud.md](examples/recurring-plan-crud.md)
   - Полная implementation CRUD operations
   - Type definitions + validation
   - Usage examples

2. **Conflict Resolution** - [examples/conflict-resolution.md](examples/conflict-resolution.md)
   - Detect conflict (409 response)
   - Save to syncConflicts table
   - Resolve strategies (server/client)
   - UI integration

---

## Validation Checklist

**Перед commit:**

- [ ] **Cents Conversion:** Amount fields используют `toCents()` при save, `fromCents()` при load
- [ ] **Async/Await:** Все Dexie operations имеют `await`
- [ ] **Sync Status:** Используются только валидные значения (`'synced' | 'pending' | 'conflict' | 'deleted'`)
- [ ] **Compound Indexes:** Query оптимизирован через compound indexes (если применимо)
- [ ] **Temp ID Mapping:** Workflow temp_id → server_id реализован корректно
- [ ] **Content Hash:** Используется для deduplication в `pendingOperations`
- [ ] **Error Handling:** Try-catch блоки обрабатывают все async operations
- [ ] **Logging:** Используется `logger.debug/info/warn/error` для трейсинга
- [ ] **Validation:** Input data валидируется перед insert/update
- [ ] **Tests:** Создан test файл `__tests__/{model}Operations.test.ts` (опционально)

---

## Common Mistakes

### 1. Amount as Float
**Symptom:** Precision errors (0.1 + 0.2 = 0.30000000000000004)

**Fix:**
```typescript
// ❌ WRONG
const fact = { amount: 123.45 };
await db.budgetFacts.add(fact);

// ✅ CORRECT
const fact = { amount: toCents(123.45) }; // 12345 (integer)
await db.budgetFacts.add(fact);
```

**Reference:** `dexie-integration.md#cents-conversion`

---

### 2. Missing Await
**Symptom:** Operations silently fail, no error thrown, data not saved

**Fix:**
```typescript
// ❌ WRONG
db.budgetFacts.add(newFact); // Missing await!

// ✅ CORRECT
await db.budgetFacts.add(newFact);
```

**Reference:** `frontend/shared/db/dexie/operations/factOperations.ts:65`

---

### 3. Неправильный Sync Status
**Symptom:** Invalid sync_status value, queries fail

**Fix:**
```typescript
// ❌ WRONG
sync_status: 'created' // Invalid!

// ✅ CORRECT
sync_status: 'pending' // Valid
```

**Valid values:** `'synced'`, `'pending'`, `'conflict'`, `'deleted'`

---

### 4. Забытый Pending Queue
**Symptom:** Offline changes не синхронизируются с сервером

**Fix:**
```typescript
// ❌ WRONG (забыли добавить в pending queue)
await db.budgetFacts.add(newFact);

// ✅ CORRECT
await db.budgetFacts.add(newFact);
await db.pendingOperations.add({ /* ... */ });
```

**Reference:** `frontend/shared/db/dexie/operations/factOperations.ts:68-80`

---

### 5. Неоптимизированные Queries
**Symptom:** Slow queries, full table scans

**Fix:**
```typescript
// ❌ WRONG (full table scan)
const results = (await db.budgetFacts.toArray())
  .filter(fact => fact.user_id === userId && fact.date >= dateFrom);

// ✅ CORRECT (uses compound index [user_id+date])
const results = await db.budgetFacts
  .where('[user_id+date]')
  .between([userId, dateFrom], [userId, dateTo])
  .toArray();
```

**Reference:** `frontend/shared/db/dexie/core/database.ts:77`

---

## Related Skills

**Dependencies:**
- **db-management**: Create SQLAlchemy models и migrations для server-side
- **frontend-development**: Integrate Dexie operations с frontend UI
- **websocket-realtime**: Broadcast server changes → update Dexie local data
- **api-development**: Create REST API endpoints для sync operations

**Cross-references:**
- Используйте **api-development** для создания `/api/v1/{models}` endpoints (CRUD)
- Используйте **websocket-realtime** для real-time updates после server sync
- Используйте **db-management** для SCD Type 2 patterns (если dimension table)

---

## Quick Links

**Documentation:**
- [Dexie Integration](../../docs/architecture/dexie-integration.md) - Main architecture doc
- [Migration Summary](../../DEXIE-MIGRATION-SUMMARY.md) - Migration status
- [Rollback Procedure](../../docs/architecture/dexie-rollback.md) - Emergency rollback

**Code Examples:**
- [factOperations.ts](../../frontend/shared/db/dexie/operations/factOperations.ts) - Budget Facts CRUD
- [factSync.ts](../../frontend/shared/db/dexie/operations/factSync.ts) - Sync logic
- [database.ts](../../frontend/shared/db/dexie/core/database.ts) - Schema definition

**Tests:**
- [DexieManager.test.ts](../../frontend/shared/db/dexie/__tests__/DexieManager.test.ts) - Integration tests
- [centsConversion.test.ts](../../frontend/shared/db/dexie/__tests__/centsConversion.test.ts) - Precision tests

**Templates:**
- [CRUD Operations](templates/crud-operations.ts) - Full CRUD template
- [Sync Operations](templates/sync-operations.ts) - Sync template

**Examples:**
- [RecurringPlan CRUD](examples/recurring-plan-crud.md) - Complete CRUD example
- [Conflict Resolution](examples/conflict-resolution.md) - Conflict handling

---

## Bundle Size Impact

**Before (PGlite):** 3.4MB
**After (Dexie):** 29KB
**Reduction:** 99.1% (3.37MB saved)

**See:** `DEXIE-MIGRATION-SUMMARY.md#bundle-size-reduction`
