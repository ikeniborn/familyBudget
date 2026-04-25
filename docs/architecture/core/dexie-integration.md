# Dexie.js Integration

**Дата создания:** 2026-01-31
**Последнее обновление:** 2026-02-09 (v11.5.0 - Separate Sync Periods)
**Версия:** v11.5.0+
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
shoppingLists: 'temp_id, id, user_id, creator_id, is_completed, sync_status'
shoppingListItems: 'temp_id, id, creator_id, shopping_list_temp_id, position, sync_status, [shopping_list_temp_id+position]'
```

**Schema v2 (current):** Added `creator_id` index for Shared Family Budget support

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

### Schema Versioning

**Version History:**

| Version | Date | Changes | Migration |
|---------|------|---------|-----------|
| **v2** | 2026-02-06 | Added `creator_id` indexes to `shoppingLists` and `shoppingListItems` tables | Auto-upgrade on next page load |
| **v1** | 2026-01-31 | Initial Dexie schema (PGlite replacement) | Manual re-sync from server |

**How Migrations Work:**
- `DEFAULT_SCHEMA_VERSION` constant in `database.ts` defines current version
- `getDatabaseVersion()` dynamically detects existing DB version
- Dexie auto-migrates to higher version on `db.open()`
- Migration preserves existing data, adds missing indexes
- Users see seamless upgrade (no manual IndexedDB clearing needed)

**Example:** User with v1 schema visits site after v2 deployment → Dexie automatically upgrades to v2, adds `creator_id` indexes, preserves all existing shopping lists.

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

## Sync Period Configuration (v11.5.0+)

### Overview

Пользователи могут настроить период хранения offline данных через **Dexie Diagnostic Modal** с раздельными настройками для Facts и Plans.

### Features (v11.5.0+)

**🆕 Separate Retention Periods:**
- **Facts:** 30-180 days (шаг 30 дней) - для транзакций
- **Plans:** 1-6 months (шаг 1 месяц) - для recurring plans с загрузкой **полных месяцев**
- **Default:** Facts: 90 days, Plans: 3 months
- **Storage:**
  - `localStorage.budget_dexie_sync_period_facts` (дни)
  - `localStorage.budget_dexie_sync_period_plans` (месяцы)
  - Legacy key: `budget_dexie_sync_period` (автоматическая миграция)

**UI controls (v11.5.0+):**
- **Два раздельных слайдера** в Dexie Diagnostic Modal:
  - Facts retention slider: 30-180 days
  - Plans retention slider: 1-6 months
- Real-time preview (oninput) + pruning on change (onchange)
- Automatic Facts pruning при изменении периода
- Plans re-sync при изменении периода (на следующей загрузке)

**API integration:**
- Backend: `GET /api/v1/recurring-plans?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD`
- Frontend: DataLayer автоматически добавляет date filtering к запросам Plans
- **🆕 Full months calculation:** Plans загружаются по **полным месяцам** (с 1-го по последнее число)
- Dexie: Фильтрация Plans по `next_generation_date` в памяти

### Implementation

**DexieManager (v11.5.0+):**
```typescript
// Get sync period for Facts (days)
getSyncPeriodDays(): number {
  const saved = localStorage.getItem('budget_dexie_sync_period_facts');
  if (!saved) {
    // Fallback to legacy key for backward compatibility
    const legacy = localStorage.getItem('budget_dexie_sync_period');
    return legacy ? parseInt(legacy, 10) : 90;
  }
  return parseInt(saved, 10);
}

// Get sync period for Plans (months) - NEW in v11.5.0
getSyncPeriodMonths(): number {
  const saved = localStorage.getItem('budget_dexie_sync_period_plans');
  return saved ? parseInt(saved, 10) : 3; // Default: 3 months
}

// Set sync period for Facts (days) - NEW in v11.5.0
setSyncPeriodDays(days: number): void {
  if (days < 30 || days > 180) {
    throw new Error('[DexieManager] Invalid sync period: must be 30-180 days');
  }
  localStorage.setItem('budget_dexie_sync_period_facts', days.toString());
  logger.info('[DexieManager] Facts sync period updated', { days });
}

// Set sync period for Plans (months) - NEW in v11.5.0
setSyncPeriodMonths(months: number): void {
  if (months < 1 || months > 6) {
    throw new Error('[DexieManager] Invalid sync period: must be 1-6 months');
  }
  localStorage.setItem('budget_dexie_sync_period_plans', months.toString());
  logger.info('[DexieManager] Plans sync period updated', { months });
}

// Prune with configurable period
async pruneFacts(retentionDays?: number): Promise<number> {
  const days = retentionDays ?? this.getSyncPeriodDays();
  return await pruneFacts(days);
}
```

**DataLayer Plans sync (v11.5.0+):**
```typescript
async getRecurringPlans(filters?: RecurringPlanFilters): Promise<LocalRecurringPlan[]> {
  // NEW: Use months instead of days
  const syncPeriodMonths = this.dexieManager?.getSyncPeriodMonths?.() ?? 3;

  // Calculate full months range (start of month N months ago to end of month N months ahead)
  const { fromDate, toDate } = this.calculateFullMonthsRange(syncPeriodMonths);

  const syncFilters: RecurringPlanFilters = {
    ...filters,
    from_date: filters?.from_date ?? fromDate,  // YYYY-MM-01
    to_date: filters?.to_date ?? toDate         // YYYY-MM-31
  };

  // Use syncFilters for API/Dexie requests
}

// NEW in v11.5.0: Calculate full months range
private calculateFullMonthsRange(months: number): { fromDate: string; toDate: string } {
  const today = new Date();

  // Calculate from_date (start of month N months ago)
  const fromDate = new Date(today.getFullYear(), today.getMonth() - months, 1);

  // Calculate to_date (end of month N months ahead)
  const toDate = new Date(today.getFullYear(), today.getMonth() + months + 1, 0);

  // Format manually to avoid timezone issues
  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return {
    fromDate: formatDate(fromDate),
    toDate: formatDate(toDate)
  };
}
```

**Example calculation (v11.5.0+):**
```
Today: 2025-02-09, syncPeriodMonths: 3
→ from_date: 2024-11-01 (start of November)
→ to_date: 2025-05-31 (end of May)

API Request:
GET /api/v1/recurring-plans?from_date=2024-11-01&to_date=2025-05-31&limit=100
```

**Reference Sync (v11.4.6):**
- Plans синхронизируются автоматически при логине (как Articles/FinancialCenters)
- Использует sync period для date filtering (90 дней по умолчанию)
- Кеширует Plans в Dexie для offline доступа
- **Примечание:** временно отключена в v11.4.2 из-за 422 ошибки, восстановлена в v11.4.6 после подтверждения работоспособности endpoint

### Diagnostic Modal

**WebSocket status (v11.4.0+):**
- Connection state (CONNECTING/OPEN/CLOSING/CLOSED/NO_SOCKET)
- Enabled/disabled status
- Offline mode detection (via `offlineManager.networkDetector.autoOfflineMode`)

**Sync period display (v11.5.0+):**
- Facts: X records (Y days) - с отдельным слайдером 30-180 дней
- Plans: X records (Y months) - с отдельным слайдером 1-6 месяцев
- **🆕 Два раздельных слайдера:**
  - Facts retention slider: изменение сразу вызывает pruning
  - Plans retention slider: изменение применяется при следующей синхронизации

### Troubleshooting

**Plans не синхронизируются (v11.5.0+):**
1. Check localStorage:
   ```javascript
   localStorage.getItem('budget_dexie_sync_period_facts')  // Facts period (days)
   localStorage.getItem('budget_dexie_sync_period_plans')  // Plans period (months)
   localStorage.getItem('budget_dexie_sync_period')        // Legacy key (fallback)
   ```
2. Check Dexie Diagnostic Modal: Plans count должен быть > 0 после логина
3. Check browser console: `[referenceSync] Recurring plans synced: { count: X, syncPeriodMonths: Y }`
4. Check Network tab: Verify API request uses full months:
   ```
   GET /api/v1/recurring-plans?from_date=YYYY-MM-01&to_date=YYYY-MM-31
   ```

**WebSocket NO_SOCKET state:**
1. Check browser console: `window.offlineManager?.networkDetector?.autoOfflineMode`
2. Check backend logs: `docker logs familybudget-backend --tail=200 | grep WS`
3. Check token endpoint: `curl -X POST https://fbd.ikeniborn.ru/api/v1/budget/ws/token`
4. Check nginx config: WebSocket upgrade headers должны быть настроены

### Direct API POST в обход UI

Прямой `fetch('/api/v1/facts', ...)` (например, из DevTools Console или MCP-скрипта, минуя
`savePlanModal` / `saveFactModal`) **создаёт запись в БД, но не попадает в Dexie автора сессии**.

Причина: запись в Dexie происходит в save-обработчике (`savePlanTransaction` →
`db.budgetFacts.put(...)`), а не в ответ на WebSocket-broadcast. Broadcast идёт всем
клиентам (включая отправителя), но Dexie upsert из WS-события есть только для внешних
источников — локальный клиент предполагает, что он уже синхронизировал запись в save-хендлере.

**Последствия для QA:**
- Тестовые сценарии, создающие данные через `fetch()` в обход UI, должны вручную
  вызвать reload страницы или sync pull, чтобы увидеть запись в Dexie.
- Рекомендуется всегда тестировать через UI-flow (клики, форма, submit), иначе Dexie ↔ backend
  могут разойтись до следующей полной синхронизации.

Если в будущем понадобится «echo-to-sender» для восстановления консистентности — это
отдельное design-решение (текущий broadcast всем не фильтрует отправителя, см.
`backend/app/api/v1/endpoints/budget_ws.py`).

---

## История изменений

| Дата | Версия | Изменения |
|------|--------|-----------|
| 2026-02-09 | v11.5.0 | 🔀 **Separate Sync Periods:** раздельные настройки для Facts (30-180 дней) и Plans (1-6 месяцев)<br>📅 **Full Months Calculation:** Plans загружаются по полным месяцам (с 1-го по последнее число)<br>🎛️ **Dual Sliders UI:** два независимых слайдера в Dexie Diagnostic Modal<br>🔄 **localStorage Migration:** автоматическая миграция legacy key → separate keys<br>🐛 **Bug Fixes:** исправлен date calculation overflow и timezone offset (2 критических бага)<br>✅ **Backward Compatible:** getSyncPeriodDays() с fallback на legacy key |
| 2026-02-07 | v11.4.6 | 🔄 Plans Sync Restoration: восстановлена proactive sync при логине<br>🛡️ Graceful degradation: sync failure не блокирует login (non-critical sync)<br>📝 Documentation sync: актуализация после v11.4.2 removal<br>✅ Cents conversion: amount → toCents(amount) перед сохранением в Dexie |
| 2026-02-07 | v11.4.0 | ⚙️ Sync Period Configuration: настраиваемый период хранения offline данных (30-180 дней)<br>🚀 Plans proactive sync: автоматическая синхронизация при логине<br>📊 WebSocket diagnostics: мониторинг WebSocket в Dexie Diagnostic Modal<br>🔍 API date filtering: GET /recurring-plans?from_date&to_date для оптимизации sync |
| 2026-02-05 | v11.3.1 | 🔴 VersionError fix: завершение Dexie migration<br>🗑️ Удалён Legacy IndexedDB (~2,000 строк)<br>🚀 Shopping Lists полностью мигрированы на Dexie<br>⚙️ Автоматическая миграция для users с v10.1.x |
| 2026-02-04 | v11.3.0 | ⚙️ Полностью удалена страница /settings (была пустой после v11.0.1)<br>🚀 Оптимизирован PWA splash (убран промежуточный экран auth_redirect) |
| 2026-02-02 | v11.0.1 | 🔴 Transaction atomicity fix (confirmPendingOperation)<br>🟡 Exponential backoff для retry logic<br>🟡 Conflict modal timeout (60s)<br>⚙️ Удален /settings Dexie раздел |
| 2026-01-31 | v11.0.0 | Initial release (PGlite → Dexie migration) |

---

## Pruning Strategy

Family Budget использует **hybrid pruning approach** для автоматического удаления старых синхронизированных данных из Dexie.js.

### Механизмы Pruning

| Механизм | Триггер | Browser Support | Приоритет |
|----------|---------|-----------------|-----------|
| **setInterval** | Каждые 60 минут | 100% | Primary |
| **Visibility API** | При возврате на вкладку | 98%+ | Supplement |
| **requestIdleCallback** | Browser idle time | 90%+ (Chrome/Firefox) | Enhancement |

### 1. setInterval (Primary)

**Описание:** Основной механизм - запускается каждые 60 минут независимо от активности пользователя.

**Файл:** `frontend/shared/db/dexie/operations/pruningOperations.ts:63`

**Код:**
```typescript
startAutoPruning() // Runs every 60 minutes
```

**Когда работает:** Всегда (пока вкладка открыта)

### 2. Visibility API (Supplement)

**Описание:** Дополнительный pruning при возврате пользователя на вкладку (после переключения с другой вкладки).

**Триггер:** `document.visibilityState === 'visible'`

**Преимущества:**
- Запускается сразу после возврата пользователя
- Не ждёт 60-минутного интервала
- Работает в 98%+ браузеров

**Код:**
```typescript
setupVisibilityPruning() // Runs when tab becomes visible
```

**Файл:** `frontend/shared/db/dexie/operations/pruningOperations.ts:115`

### 3. requestIdleCallback (Enhancement)

**Описание:** Фоновый pruning во время простоя браузера (zero user impact).

**Триггер:** Browser idle detection (timeout fallback 2 min)

**Преимущества:**
- Не блокирует UI операции
- Запускается в фоновом режиме
- Safari fallback (setTimeout)

**Код:**
```typescript
setupIdlePruning() // Runs during browser idle
```

**Файл:** `frontend/shared/db/dexie/operations/pruningOperations.ts:141`

### Browser Compatibility

| Browser | setInterval | Visibility API | requestIdleCallback |
|---------|-------------|----------------|---------------------|
| Chrome | ✅ | ✅ | ✅ |
| Firefox | ✅ | ✅ | ✅ |
| Safari | ✅ | ✅ | ❌ (setTimeout fallback) |
| Edge | ✅ | ✅ | ✅ |

### Why Not Periodic Background Sync?

**Periodic Background Sync API** (Web API standard) требует:
- PWA в standalone mode (installed app)
- HTTPS connection
- Web App Manifest с permissions
- Battery optimization may delay execution

**Статус в Family Budget:**
- ❌ Not used (requires PWA installation)
- ✅ Hybrid approach работает во всех контекстах (browser tab, PWA, mobile)

### Configuration

**Retention Period (v11.5.0+):**
- **Facts:** 30-180 дней (настраивается в Dexie Diagnostic Modal)
- **Plans:** 1-6 месяцев (настраивается отдельным слайдером)

**Default:**
- Facts: 90 дней (via `DexieManager.getSyncPeriodDays()`)
- Plans: 3 месяца (via `DexieManager.getSyncPeriodMonths()`)

**Pruning Interval:** 60 минут (setInterval default)

**Manual Trigger:** `/diagnostics` dialog → "Run Pruning Now" button

### Recent Changes (v11.5.0)

- ✅ Раздельные sync periods для Facts (дни) и Plans (месяцы)
- ✅ Два независимых слайдера в Dexie Diagnostic Modal
- ✅ Автоматическая миграция localStorage keys
- ✅ Full months calculation для Plans (загрузка полных месяцев)
- ✅ Исправлены критические баги (date overflow, timezone offset)
- ✅ Backward compatibility через fallback на legacy key

### Previous Changes (v11.4.6)

- ✅ Добавлен Visibility API pruning
- ✅ Добавлен requestIdleCallback pruning
- ✅ Обновлены console messages (информативные, не warnings)
- ✅ Документирована hybrid strategy
- ✅ Автоматическая инициализация при запуске DexieManager

---

## Known Limitations: In-Memory Filtering

### Problem

**DexieManager.queryShoppingListItems()** accepts только `string` (shopping_list_temp_id), НЕ объект с фильтрами.

**Root Cause:**
- Dexie uses `.where('shopping_list_temp_id').equals(value)`
- `.equals()` expects primitive value (string), not object
- Passing object → IDBKeyRange error: "parameter is not a valid key"

### Solution (v11.4.9+)

**DataLayer применяет фильтры in-memory** после получения данных из Dexie:

```typescript
// DataLayer.ts:743-780
let result = await pglite.queryShoppingListItems(listTempId);  // ← STRING only

// Apply filters in-memory (single pass, O(n))
if (filters) {
  result = result.filter((item: LocalShoppingListItem) => {
    if (filters.is_completed !== undefined && item.is_completed !== filters.is_completed) {
      return false;
    }
    if (filters.store_id !== undefined && item.store_id !== filters.store_id) {
      return false;
    }
    // ... other filters
    return true;
  });
}
```

### Performance Impact

**Optimization (v11.4.9):**
- ✅ Single `.filter()` pass вместо 5 sequential filters
- ✅ Reduces O(5n) → O(n)
- ✅ Avoids creating 4 intermediate arrays
- ✅ Completes in <10ms for 1000 items

**Trade-off:**
- ❌ Client-side filtering (не используется Dexie index)
- ✅ Acceptable для списков <10,000 товаров (typical: <100 items)

### Supported Filters

| Filter | Type | Description |
|--------|------|-------------|
| `is_completed` | boolean | Completed/incomplete items |
| `store_id` | number | Filter by store |
| `product_group_id` | number | Filter by product group |
| `sync_status` | 'synced' \| 'pending' \| 'conflict' \| 'deleted' | Sync state |
| `deleted` | boolean | true = only deleted (deleted_at !== null), false = only active |

### Alternative Considered

**Option 1: Add Dexie Compound Index**
```typescript
// Dexie schema
shoppingListItems: '++id, temp_id, [shopping_list_temp_id+is_completed], [shopping_list_temp_id+store_id]'
```

**Rejected:**
- ❌ Requires multiple compound indexes (combinatorial explosion)
- ❌ Increases IndexedDB size
- ❌ Complex query logic

**Option 2: Server-Side Filtering**
- ❌ Breaks offline-first architecture
- ❌ Increases API latency

### Related Files

- **Implementation:** `frontend/web/static/js/data/DataLayer.ts:743-780`
- **Tests:** `frontend/tests/unit/data/DataLayer.filtering.test.ts`
- **Interface:** `frontend/shared/db/dexie/types/shopping.ts` (ShoppingListItemFilters)

### Migration Notes

**Breaking Change (v11.4.9):**
- DexieManager.queryShoppingListItems() signature UNCHANGED (still accepts string)
- DataLayer.getShoppingListItems() behavior UNCHANGED (still accepts filters)
- Internal filtering moved from Dexie query → in-memory (transparent to callers)

---

## Troubleshooting

### Plans Sync Failures (v11.4.10+)

**Symptom:** Dexie Diagnostics modal shows "Plans: 0" when user expects recurring plans to be synced.

**Root Causes:**

#### 1. No Active Plans in Database (Expected Behavior)
**Diagnosis:**
- Plans count = 0
- NO warning shown in Diagnostics modal
- Browser console shows: `[referenceSync] ✅ Recurring plans synced { count: 0 }`

**Explanation:**
- User has no active recurring plans in backend DB **OR**
- All plans have `next_generation_date` outside configured sync period (default: ±3 months) **OR**
- All plans are inactive (`is_active = false`)

**Resolution:**
- This is **NOT a bug** - expected behavior
- Create active recurring plans in UI if needed
- Check plan `next_generation_date` falls within sync period (adjustable in Dexie Diagnostic Modal: 1-6 months)

#### 2. Sync Failure (Technical Issue)
**Diagnosis:**
- Plans count = 0
- ⚠️ Warning shown in Diagnostics modal: "Plans sync may have failed"
- Browser console shows: `[referenceSync] ❌ Recurring plans sync failed: <error>`

**Common errors:**
- **422 Validation Error:** Invalid date parameters in API request
  - Check Network tab: `/api/v1/recurring-plans?from_date=...&to_date=...`
  - Verify `from_date` and `to_date` format (YYYY-MM-DD)
- **Network Error:** Connection timeout or CORS issue
  - Check browser Network tab for failed requests
  - Verify API endpoint is accessible
- **Transaction Error:** Dexie `bulkAdd()` failed
  - Check console for IndexedDB quota exceeded
  - Check for data format issues (e.g., invalid `amount` type)

**Resolution Steps:**

1. **Check Browser Console:**
   ```javascript
   // Look for sync errors
   [referenceSync] ❌ Recurring plans sync failed: <error message>
   ```

2. **Check Network Tab:**
   - Filter by: `recurring-plans`
   - Expected: `200 OK` with `{ items: [...], total: X }`
   - If `422`: Fix API date parameter validation
   - If `500`: Check backend logs

3. **Check IndexedDB:**
   - DevTools → Application → IndexedDB → `budget_dexie`
   - Table: `syncMetadata`
   - Find: `entity_type = 'recurring_plans'`
   - Check: `last_sync_timestamp` (when was last sync?)

4. **Retry Sync Manually:**
   - Open Dexie Diagnostics modal (click Dexie badge)
   - If warning shown, click **"Retry Sync"** button
   - Check browser console for retry result

5. **Query Backend DB (Server Access Required):**
   ```sql
   -- Check if user has recurring plans
   SELECT COUNT(*) FROM t_d_recurring_plan WHERE user_id = <USER_ID>;

   -- Check if plans are in sync range (v11.5.0+ uses configurable months, default: 3)
   SELECT COUNT(*) FROM t_d_recurring_plan
   WHERE user_id = <USER_ID>
     AND (
       (next_generation_date >= CURRENT_DATE - INTERVAL '3 months'
        AND next_generation_date <= CURRENT_DATE + INTERVAL '3 months')
       OR next_generation_date IS NULL
     );
   -- Note: Adjust '3 months' based on user's configured sync period (1-6 months)
   ```

### HTTP 422 Error on Plans Sync (v11.4.12 Fix)

**Symptom:** Console shows `GET /api/v1/recurring-plans 422 (Unprocessable Content)`

**Root Causes:**

#### 1. Duplicate Sync Code (FIXED in v11.4.12)
**Historical Issue:**
- `referenceSync.ts:321` - proactive background sync (dashboard) → sent `limit=1000` ❌
- `DataLayer.ts:1373` - on-demand API calls → ALREADY FIXED `limit=100` ✅ (commit 329f1822)

**Fix Applied:**
- Changed `referenceSync.ts:321` to `limit: '100'` (matches backend constraint)
- Backend limit increased to `le=1000` for architectural consistency (aligns with other endpoints)
- Manual VERSION bump: `11.4.11` → `11.4.12` (CI/CD rebuilds dashboard.min.js)

**Why Both Frontend AND Backend Fixes?**
- **Short-term (Frontend):** Immediate fix for HTTP 422 error (limit=1000 → limit=100)
- **Long-term (Backend):** Architectural consistency - ALL endpoints now use `le=1000`
- Allows reverting frontend to `limit=1000` in future (cleaner, no workaround needed)

#### 2. Invalid Date Format
**Backend requires** `YYYY-MM-DD` format (regex: `^\d{4}-\d{2}-\d{2}$`)

**Check:**
```javascript
// Browser console - verify date calculation in referenceSync.ts:312-315
const fromDate = new Date();
fromDate.setDate(fromDate.getDate() - 90);
console.log(fromDate.toISOString().split('T')[0]);  // Should be YYYY-MM-DD
```

**Solution:** Verify date format before API call

#### 3. from_date > to_date
**Field validator requires** `from_date <= to_date`

**Solution:** Check date range logic in `referenceSync.ts:312-315`

**Verification After Fix:**
1. Upgrade to v11.4.12+ (CI/CD builds new dashboard.min.js)
2. Check browser console: NO 422 errors for recurring-plans endpoint
3. Network tab shows: `GET /api/v1/recurring-plans?...&limit=100` (Status 200)
4. Dexie Diagnostics modal: Plans count > 0, no warning

**Enhanced Diagnostics (v11.4.10+):**
- DexieManager logs Plans count in success message:
  ```javascript
  [DexieManager] ✅ Reference data synced {
    counts: {
      articles: 90,
      // ...
      recurringPlans: 0,  // Now logged!
      shoppingLists: 11
    }
  }
  ```
- Diagnostics modal shows warning when sync fails
- "Retry Sync" button for manual sync trigger

**Related Files:**
- **Sync Logic:** `frontend/shared/db/dexie/operations/referenceSync.ts:304-378` (syncRecurringPlans)
- **Diagnostics UI:** `frontend/web/static/js/modules/uiComponents/modals/DexieDiagnosticModal.ts:303-332` (shouldShowPlansSyncWarning)
- **DexieManager:** `frontend/shared/db/dexie/DexieManager.ts:632-643` (syncRecurringPlans wrapper)
- **API Endpoint:** `backend/app/api/v1/endpoints/recurring_plans.py` (GET /api/v1/recurring-plans)

**See Also:**
- [Recurring Plans Architecture](../features/recurring-plans.md) - Sync behavior and date filtering
- [Backend Endpoints](../backend/endpoints/recurring_plans.md) - API documentation

**Backward Compatibility:** ✅ Full (zero breaking changes at API level)
