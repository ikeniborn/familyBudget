# Dexie.js Integration

**Дата создания:** 2026-01-31
**Версия:** v11.1.40
**Статус:** Production-ready
**Migration Status:** Complete (v11.0+ - PGlite fully removed)

---

## Migration Complete (v11.1.40)

**PGlite Legacy Removed:**
- ✅ `offlineManager` directory deleted (21 files)
- ✅ `conflictResolver.ts` deleted
- ✅ `userHelpers.ts` moved to `@shared/utils/`
- ✅ Templates migrated to Dexie API (`plan.html`, `navbar-sync-badge.html`)
- ✅ Dexie активен по умолчанию (`isDexieActive()` returns `true`)
- ✅ Build configuration updated (PGlite → Dexie comments)
- ✅ Obsolete tests removed

**Note:** userHelpers moved from `offlineManager/utils/` to `frontend/shared/static/js/utils/userHelpers.ts` and used by:
- `dashboard/features/addTransaction/categoryLoader.ts`
- `plan/helpers.ts`
- `facts/integration/dropdownAPI.ts`

---

## Обзор

Dexie.js - production-ready IndexedDB wrapper для offline-first функциональности Family Budget.

### Замена PGlite → Dexie.js

**Причины миграции:**
- PGlite v0.3.x в alpha статусе (нестабильно)
- Критические баги в production
- Большой bundle size (3.4MB vs 29KB Dexie)
- Dexie production-ready (10+ лет, 10k+ stars)

**Результаты миграции:**
- ✅ Bundle size: 99.1% reduction (3.4MB → 29KB)
- ✅ Стабильность: Alpha → Production-ready
- ✅ API совместимость: Transparent replacement
- ✅ Performance: Допустимое снижение ±20% (250ms → 280-300ms dashboard)

---

## Архитектура

### Stack

```
┌─────────────────────────────────────────────┐
│           DataLayer (абстракция)            │
├─────────────────────────────────────────────┤
│  getArticles(), getFinancialCenters(),      │
│  getShoppingLists(), getFacts(), etc.       │
│  ⚠️ MINIMAL CHANGES (только импорты)        │
└────────────┬────────────────────────────────┘
             │
   ┌─────────┴────────┐
   │                  │
┌──▼──────────┐  ┌───▼──────┐
│DexieManager │  │REST API  │
│  (IndexedDB)│  │ Fallback │
└──┬──────────┘  └──────────┘
   │
┌──▼────────────────────┐
│    Dexie.js API       │
│  (Promise-based)      │
└──┬────────────────────┘
   │
┌──▼────────────────────┐
│ IndexedDB (Native)    │
│ (Browser Storage)     │
└───────────────────────┘
```

### Core Components

1. **DexieManager** (`frontend/shared/db/dexie/DexieManager.ts`)
   - Main API interface
   - Compatible с PGliteManager API
   - CRUD operations
   - Sync operations

2. **Database Schema** (`frontend/shared/db/dexie/core/database.ts`)
   - 13 tables (articles, facts, shopping, etc.)
   - Compound indexes для performance
   - Cents conversion helpers

3. **Operations Modules** (`frontend/shared/db/dexie/operations/`)
   - schemaOperations.ts - reference data
   - factOperations.ts - budget facts CRUD
   - bulkOperations.ts - batch operations
   - shoppingOperations.ts - shopping lists
   - *Sync.ts - синхронизация (reference, fact, shopping)

4. **Migration** (`frontend/shared/db/dexie/migration/migrateFromPGlite.ts`)
   - Одноразовая миграция данных
   - Progress reporting
   - Data verification
   - Rollback support

---

## Database Schema

### Reference Data

```typescript
// Articles (budget categories)
articles: 'id, user_id, type, parent_id, is_active'

// Article Hierarchy (closure table)
articleHierarchy: '[ancestor_id+descendant_id], ancestor_id, descendant_id, depth'

// Financial Centers (accounts, wallets)
financialCenters: 'id, user_id, is_active'

// Cost Centers (projects, departments)
costCenters: 'id, user_id, is_active'
```

### Transactional Data

```typescript
// Budget Facts (transactions)
budgetFacts: 'id, temp_id, user_id, article_id, financial_center_id, cost_center_id, date, sync_status, [user_id+date], [user_id+sync_status]'

// ВАЖНО: amount хранится как integer cents
// Example: $123.45 stored as 12345
// Convert: save → amount * 100 | load → amount / 100
```

### Shopping Lists

```typescript
shoppingLists: 'id, temp_id, user_id, is_completed, sync_status'
shoppingListItems: 'id, temp_id, shopping_list_temp_id, position, sync_status, [shopping_list_temp_id+position]'
```

---

## Cents Conversion

**КРИТИЧЕСКИ ВАЖНО:** amount fields хранятся как integer cents для точности.

### Why Cents?

JavaScript numbers используют IEEE 754 float precision:
```javascript
// ❌ ПРОБЛЕМА: Float precision
0.1 + 0.2 = 0.30000000000000004 (!)
0.07 * 100 = 7.000000000000001 (!)
```

**Решение:** Хранить amount как integer cents.

### Helpers

```typescript
import { toCents, fromCents } from '@db/dexie';

// При сохранении
const fact = {
  amount: toCents(123.45) // → 12345 (integer)
};

// При чтении
const displayAmount = fromCents(fact.amount); // → 123.45 (float)
```

### Testing

См. `__tests__/centsConversion.test.ts` для precision tests.

---

## API Reference

### Initialization

```typescript
import { getDexieManager } from '@db/dexie';

const manager = getDexieManager();
await manager.init();

if (manager.isReady()) {
  // Ready to use
}
```

### Reference Data Queries

```typescript
// Articles
const articles = await manager.queryArticles({
  user_id: 1,
  type: 'expense',
  is_active: true
});

// Financial Centers
const centers = await manager.queryFinancialCenters(
  userId,
  includeGlobal: true
);

// Cost Centers
const costCenters = await manager.queryCostCenters(userId);
```

### Facts CRUD

```typescript
// Create
const temp_id = await manager.createFact({
  user_id: 1,
  article_id: 1,
  financial_center_id: 1,
  cost_center_id: null,
  date: '2026-01-31',
  amount: 123.45, // dollars (автоматически конвертируется в cents)
  record_type: 'fact',
  comment: 'Test',
  transfer_group_id: null,
  is_transfer: false,
  sync_hash: null
});

// Query
const facts = await manager.queryFacts({
  user_id: 1,
  date_from: '2026-01-01',
  date_to: '2026-01-31'
});
// facts[0].amount уже в dollars (автоматически конвертируется из cents)

// Update
await manager.updateFact(temp_id, {
  amount: 200.0, // dollars
  comment: 'Updated'
});

// Delete (soft)
await manager.deleteFact(temp_id);
```

### Bulk Operations

```typescript
import { bulkInsertFacts } from '@db/dexie';

await bulkInsertFacts(facts, (current, total) => {
  console.log(`Progress: ${current}/${total}`);
});
```

### Sync Operations

```typescript
import {
  uploadPendingOperations,
  downloadFacts,
  fullFactSync
} from '@db/dexie';

// Upload pending offline changes
const uploadResult = await uploadPendingOperations();
// { success: true, uploaded: 5, failed: 0 }

// Download facts from server
const downloadResult = await downloadFacts(userId, dateFrom, dateTo);
// { success: true, count: 150 }

// Full bidirectional sync
const syncResult = await fullFactSync(userId, dateFrom, dateTo);
```

### Reference Data Sync

**Purpose:** Sync reference data (Articles, Financial Centers, Cost Centers, Article Hierarchy) from server to local IndexedDB.

**Use case:** Initial data population on first login, periodic refresh, or manual sync trigger.

```typescript
const manager = getDexieManager();
await manager.init();

// Option 1: Auto-detect userId from window.userData or window.user
await manager.syncReferenceData();

// Option 2: Explicit userId
await manager.syncReferenceData(userId);
```

**Behavior:**
- Fetches all reference data from server via `/api/v1/articles`, `/api/v1/financial-centers`, etc.
- Clears existing user-specific data before inserting new data (avoids duplicates)
- Updates sync metadata (last sync timestamp, record counts)
- **Auto-detects userId** from `window.userData.id` or `window.user.id` if not provided
- **Throws error** if sync fails or userId cannot be determined

**Returns:**
- Success: Promise resolves (no return value)
- Failure: Throws error with details about failed syncs

**Example output (success):**
```
[DexieManager] ✅ Reference data synced {
  userId: 1,
  counts: {
    articles: 45,
    financialCenters: 8,
    costCenters: 12,
    articleHierarchy: 203
  }
}
```

**Example error (failure):**
```typescript
try {
  await manager.syncReferenceData();
} catch (error) {
  console.error('Sync failed:', error);
  // Error: [DexieManager] Reference data sync failed for: articles, costCenters.
  // Details: {"articles":{"success":false,"count":0},...}
}
// { success: true, uploaded: 5, downloaded: 150, failed: 0 }
```

---

## Performance

### Benchmarks

| Operation | PGlite (SQL) | Dexie (IndexedDB) | Разница |
|-----------|--------------|-------------------|---------|
| Simple query | 5-10ms | 5-15ms | +0-5ms ✅ |
| Filtered query | 10ms | 15-20ms | +5-10ms ✅ |
| Bulk insert (1000) | 50ms | 60-80ms | +10-30ms ✅ |
| Dashboard load | 250ms | 280-300ms | +30-50ms ✅ |

### Optimization

**Compound Indexes:**
```typescript
// Оптимизация для user's facts in date range
budgetFacts: '[user_id+date]'

// Query использует index
await db.budgetFacts
  .where('[user_id+date]')
  .between([userId, dateFrom], [userId, dateTo])
  .toArray();
```

---

## Migration

### From PGlite to Dexie

**ВАЖНО:** Полная миграция данных невозможна без библиотеки `@electric-sql/pglite` (которую мы удалили).

**Решение:**
1. Проверка наличия PGlite database
2. Если данных нет → skip migration
3. Если данные есть → **recommend re-sync from server**

**Почему это приемлемо:**
- ✅ Все critical данные на сервере (не потеряются)
- ✅ Initial sync быстрый (<15 сек)
- ✅ Pending operations можно загрузить вручную

### Manual Migration

```typescript
import { migrateFromPGlite } from '@db/dexie';

await migrateFromPGlite((progress) => {
  console.log(`${progress.phase}: ${progress.message}`);
  console.log(`Progress: ${progress.current}/${progress.total}`);
});
```

---

## Feature Flags

### Enable Dexie

```typescript
import { isDexieActive } from '@db/dexie';

if (isDexieActive()) {
  // Dexie enabled
  const manager = getDexieManager();
  await manager.init();
}
```

### LocalStorage Key

```javascript
localStorage.setItem('dexieActive', 'true');  // Enable
localStorage.setItem('dexieActive', 'false'); // Disable
```

---

## Testing

### Unit Tests

```bash
npm run test -- dexie

# Specific tests
npm run test -- DexieManager.test.ts
npm run test -- centsConversion.test.ts
```

### Coverage

```bash
npm run test:coverage

# Target: ≥80% coverage
```

### E2E Tests

```bash
npm run test:e2e -- dexie-integration.spec.ts
```

---

## Troubleshooting

### Facts/Plans не загружаются в Dexie после авторизации (v11.3.7)

**Symptoms:**
- Dexie Diagnostics показывает Facts: 0, Plans: 0
- Console logs: `[DATA_LAYER] Dexie returned empty, using API fallback`
- Каждое открытие /facts или /plan загружает данные через API

**Root Cause:**
- Facts/Plans - transactional data, НЕ загружаются автоматически через `syncReferenceData()`
- DataLayer fallback на API без кеширования результатов в Dexie

**Solution (v11.3.7):**
Добавлено автоматическое кеширование API results в Dexie после fallback:

```typescript
// DataLayer.ts:getFacts() и getRecurringPlans()
if (result.length === 0) {
    const apiResult = await this.getFactsFromAPI(filters);

    // CACHE in Dexie for offline access
    if (apiResult.length > 0) {
        await pglite.bulkInsertFacts(apiResult);
        console.info('[DATA_LAYER] Cached API facts in Dexie');
    }

    return apiResult;
}
```

**Impact:**
- ✅ После первого открытия /facts или /plan данные кешируются в Dexie
- ✅ Offline mode работает для Facts/Plans после initial load
- ✅ Уменьшение нагрузки на API при повторных открытиях

**Files Changed:**
- `frontend/web/static/js/data/DataLayer.ts` (lines 972-991, 1197-1216)

---

### Dexie не инициализируется

**Symptoms:** `manager.isReady()` возвращает false

**Solutions:**
1. Проверить feature flag: `isDexieActive()`
2. Проверить IndexedDB support: `window.indexedDB`
3. Проверить browser console для errors

### Данные не синхронизируются

**Symptoms:** Pending operations не загружаются на сервер

**Solutions:**
1. Проверить network connection
2. Проверить pending queue: `await manager.getPendingOperations()`
3. Проверить server logs для API errors

### Amount precision issues

**Symptoms:** $123.45 отображается как $123.44 или $123.46

**Solutions:**
1. Убедиться что используется `toCents()`/`fromCents()`
2. Проверить тесты: `npm run test -- centsConversion.test.ts`
3. Проверить что amount хранится как integer, не float

---

## See Also

- [PGlite Migration Plan](dexie-rollback.md)
- [Rollback Procedure](dexie-rollback.md)
- [Offline Sync Architecture](offline-sync.md)
- [PWA Features](pwa.md)

---

## Critical Fixes (v11.0.1)

### 🔴 Transaction Atomicity Fix

**Проблема:** `confirmPendingOperation()` выполняла две операции последовательно без транзакции:
```typescript
// ❌ БЕЗ транзакции (v11.0.0)
await db.budgetFacts.modify({ sync_status: 'synced' });  // Step 1
await db.pendingOperations.delete();                     // Step 2
// Crash между Step 1 и Step 2 → несогласованность данных!
```

**Решение (v11.0.1):**
```typescript
// ✅ С транзакцией (атомарность гарантирована)
await db.transaction('rw', [db.budgetFacts, db.pendingOperations], async () => {
  await db.budgetFacts.modify({ sync_status: 'synced' });
  await db.pendingOperations.delete();
});
// Crash → обе операции rollback, данные согласованы
```

**Файл:** `frontend/shared/db/dexie/operations/factOperations.ts:272-291`

---

### 🟡 Exponential Backoff для Retry Logic

**Проблема:** При сетевых ошибках sync пытался повторить операцию немедленно → спам requests на сервер.

**Решение (v11.0.1):**
- Добавлено поле `next_retry_at` в `LocalPendingOperation`
- Exponential backoff: 2s, 4s, 8s, 16s, 32s (максимум)
- `getPendingOperations()` фильтрует операции по `next_retry_at`

**Пример:**
```typescript
// Attempt 1: Immediate retry
// Attempt 2: Wait 2 seconds
// Attempt 3: Wait 4 seconds
// Attempt 4: Wait 8 seconds
// ...
```

**Файлы:**
- `frontend/shared/db/dexie/types/fact.ts` (добавлен `next_retry_at`)
- `frontend/shared/db/dexie/core/database.ts` (добавлен индекс)
- `frontend/shared/db/dexie/operations/factOperations.ts` (логика backoff)

---

### 🟡 Conflict Modal Timeout

**Проблема:** Если пользователь не закрывал conflict modal, sync зависал бесконечно.

**Решение (v11.0.1):**
- Timeout 60 секунд → auto-fallback на "server wins"
- Cleanup logic предотвращает double resolution

**Файл:** `frontend/web/static/js/offline/conflictResolver.ts:187-282`

---

### ⚙️ Удалена страница /settings

**v11.0.1:** UI раздел настроек Dexie удален из `/settings` страницы (Dexie включен по умолчанию).

**v11.3.0:** Вся страница `/settings` полностью удалена (не содержала активного контента после v11.0.1).

**Причина:** Dexie включен по умолчанию для всех пользователей (localStorage.dexieActive = 'true'). Страница оставалась пустой после удаления Dexie UI.

**Файлы удалены:**
- `frontend/web/templates/settings.html`
- Backend роут: `backend/app/api/web/router.py::settings_page()`

**Note:** Telegram bot команда `/settings` не затронута (отдельная функциональность бота).

---

## Shopping Lists Migration (v11.3.1)

**Дата:** 2026-02-05
**Статус:** ✅ Complete

### Проблема (v11.0-11.3.0)

VersionError при открытии страницы `/lists`:

```
[ListsManager] Initialization error: VersionError:
The requested version (5) is less than the existing version (10).
```

**Root cause:**
- Legacy IndexedDB (v5) конфликтовала с PGlite artifact (v10) в браузере пользователей
- ListsManager пытался открыть базу с версией 5, но существовала версия 10
- IndexedDB API не позволяет откатиться на меньшую версию → VersionError

**Затронуты:**
- ✅ Dashboard (`/`) - работает нормально (использует Dexie v1)
- ❌ Shopping Lists (`/lists`) - инициализация падала с VersionError

### Решение

**Подход:** Завершение v11.0 migration roadmap - удаление Legacy IndexedDB полностью

**Обоснование:**
1. ✅ Dexie.js уже production-ready (v11.0+, протестирован на Dashboard/Facts)
2. ✅ Shopping Lists schema уже есть в Dexie (`shoppingLists`, `shoppingListItems`, `stores`, `productGroups`)
3. ✅ DataLayer уже использует Dexie для shopping lists (v11.0)
4. ✅ Соответствует архитектурной стратегии: "Dexie активен по умолчанию"
5. ✅ Минимальный user impact (автоматическая синхронизация с сервера, 5-10 секунд)

### Изменения

**Удалено полностью (6 файлов):**
- `frontend/web/static/js/offline/idb.ts` (1,140 строк - Legacy IndexedDB)
- `frontend/web/static/js/offline/idb.js` (compiled)
- `frontend/web/static/js/offline/idb.min.js` (minified)
- `frontend/web/static/js/offline/offlineShoppingManager.js` (deprecated)
- `frontend/web/static/js/offline/offlineShoppingManager.min.js` (minified)
- `frontend/tests/unit/offline/idb.test.ts` (unit tests)

**Обновлено:**
- `frontend/web/static/js/lists/listsManager/core/stateManager.ts` - заменён IndexedDBManager → getDexieManager()
- `frontend/web/static/js/lists/listsManager/core/ListsState.ts` - удалены `db` и `offlineShopping` поля, добавлено `dexieManager`
- `frontend/web/templates/lists.html` - удалён script tag для offlineShoppingManager.min.js
- `sw.js` - удалён весь Legacy IndexedDB код (~300 строк: openIndexedDB, syncBudgetData, Background Sync)
- `build-all.js` - удалена конфигурация для offlineShoppingManager bundle
- `frontend/web/static/js/lists/listsManager/core/listOperations.ts` - updateItemsCache() → no-op (кеширование через DataLayer)
- `frontend/web/static/js/lists/listsManager/features/autocomplete.ts` - удалены cache функции (замена на DataLayer)

**Создано:**
- `frontend/shared/db/dexie/migration/cleanupLegacyDB.ts` - автоматическая миграция для пользователей

### Автоматическая миграция

**Для пользователей с v10.1.x или v11.0-11.2:**

1. При первом запуске:
   - Скрипт проверяет версию IndexedDB
   - Если версия 5-10 → удаляет базу данных
   - Создаёт Dexie v1 (версия 1)
   - Запускает синхронизацию с сервера (последние 90 дней)

2. User experience:
   - Toast notification: "База данных обновлена. Синхронизация с сервером..."
   - Синхронизация занимает 5-10 секунд
   - Нет потери данных (все данные на сервере)

3. Migration flag:
   - Сохраняется в `localStorage.dexie_legacy_cleanup_done = 'true'`
   - Повторная миграция не выполняется

### Технический debt resolved

**Before (v11.0-11.3.0):**
- ❌ VersionError (100% пользователей с v10.1.x)
- ❌ Shopping Lists offline broken
- ⚠️ Две параллельные IndexedDB системы (Legacy v5 + Dexie v1)
- ⚠️ ~2,000 строк dead code (idb.ts, offlineShoppingManager, sw.js sync)

**After (v11.3.1):**
- ✅ Нет VersionError
- ✅ Shopping Lists offline работает
- ✅ Единая Dexie система для всех компонентов (Dashboard, Facts, Shopping Lists)
- ✅ ~2,000 строк dead code удалено

### Rollback plan

**Если миграция не работает:**

1. **Git revert** (recovery time: ~10 минут)
   ```bash
   git revert <commit-hash>
   git push
   ```

2. **Feature flag** (для emergency hotfix)
   ```typescript
   const USE_LEGACY_IDB = localStorage.getItem('use_legacy_idb') === 'true';
   ```

### Проверка успешности миграции

**Browser Console:**
```
[Migration] Found legacy database v10, migrating to Dexie v1...
[Migration] Legacy database deleted
[Migration] Dexie v1 initialized
[Migration] ✅ Migration complete
```

**No errors:**
- ❌ Нет `VersionError`
- ❌ Нет `[ListsManager] Initialization error`

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-02-05 | v11.3.1 | 🔴 VersionError fix: завершение Dexie migration<br>🗑️ Удалён Legacy IndexedDB (~2,000 строк)<br>🚀 Shopping Lists полностью мигрированы на Dexie<br>⚙️ Автоматическая миграция для users с v10.1.x |
| 2026-02-04 | v11.3.0 | ⚙️ Полностью удалена страница /settings (была пустой после v11.0.1)<br>🚀 Оптимизирован PWA splash (убран промежуточный экран auth_redirect) |
| 2026-02-02 | v11.0.1 | 🔴 Transaction atomicity fix (confirmPendingOperation)<br>🟡 Exponential backoff для retry logic<br>🟡 Conflict modal timeout (60s)<br>⚙️ Удален /settings Dexie раздел |
| 2026-01-31 | v11.0.0 | Initial release (PGlite → Dexie migration) |
