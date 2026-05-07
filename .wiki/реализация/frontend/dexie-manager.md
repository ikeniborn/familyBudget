---
wiki_sources:
  - "frontend/shared/db/dexie/DexieManager.ts"
  - "frontend/shared/db/dexie/core/database.ts"
  - "frontend/shared/db/dexie/repositories/FactRepository.ts"
  - "frontend/shared/db/dexie/operations/factOperations.ts"
  - "frontend/shared/db/dexie/operations/factSync.ts"
  - "frontend/shared/db/dexie/operations/pruningOperations.ts"
  - "frontend/shared/db/dexie/operations/conflictOperations.ts"
wiki_updated: 2026-05-07
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "DexieManager"
  - "Offline DB"
---

# DexieManager — offline-first IndexedDB менеджер (Dexie.js)

Основной интерфейс для работы с IndexedDB через Dexie.js. Реализует offline-first паттерн: локальное хранилище фактов, справочников и shopping lists с синхронизацией через `/sync` API.

## Основные характеристики

**Расположение:** `frontend/shared/db/dexie/`
**InitializationStatus:** `'not_started' | 'initializing' | 'ready' | 'error'`

**Класс DexieManager:**
- `init()` — открытие IndexedDB; lazy init (повторные вызовы → noop если state='ready')
- Lazy init pattern — db не открывается до первого вызова

**Операции (из operations/):**
- `factOperations.ts` — CRUD для LocalBudgetFact
- `factSync.ts` — `fullFactSync()` — полная синхронизация фактов с сервером
- `referenceSync.ts` — `initialReferenceSync()`, `syncArticles()`, `syncFinancialCenters()`, `syncCostCenters()`, `syncRecurringPlans()`
- `bulkOperations.ts` — batch INSERT/UPDATE
- `conflictOperations.ts` — `detectConflict()`, `resolveConflict()`, `createConflictRecord()`, `getConflictMetrics()`
- `pruningOperations.ts` — `pruneFacts()`, `startAutoPruning()`, `stopAutoPruning()`, `calculateDatabaseSize()`, `setupVisibilityPruning()`, `setupIdlePruning()`
- `shoppingOperations.ts` — CRUD для LocalShoppingList и shopping items
- `shoppingSync.ts` — синхронизация shopping lists
- `schemaOperations.ts` — работа со схемой
- `recurringOperations.ts` — recurring plans offline
- `migration/cleanupLegacyDB.ts` — очистка старых версий IndexedDB

**Типы (types/models.ts):**
- `LocalBudgetFact`, `LocalArticle`, `LocalFinancialCenter`, `LocalCostCenter`
- `LocalShoppingList`, `LocalRecurringPlan`
- `LocalSyncMetadata`, `LocalSyncConflict`, `FactFilters`, `ShoppingListFilters`

**Repository (новое, 2026-05-07):**
- `repositories/FactRepository.ts` — единственная точка записи в `db.budgetFacts`
  - `createFromAPI(serverFact)` — онлайн-путь, stamping `tab_origin_id`
  - `createOffline(data)` — атомарная транзакция: budgetFacts + pendingOperations
  - `upsertFromServer(wsPayload)` — WS-событие, skip если own tab, propagates errors
  - `confirmPending(temp_id, server_id)` — атомарная замена temp → server id
  - `bulkUpsert(facts, onProgress?)` — пакетная загрузка, батчи 1000
  - `remove(temp_id)` — физическое удаление
- `repositories/__tests__/FactRepository.test.ts` — unit-тесты (fake-indexeddb)

**Утилиты:**
- `utils/hash.ts` — `generateUUID()`, content hash
- `utils/apiMapper.ts` — конвертация между server schema ↔ local schema
- `utils/tabId.ts` — `getTabId()` / `resetTabId()`, UUID вкладки из sessionStorage
- `utils/retry.ts` — экспоненциальный backoff
- `utils/fetchWithTimeout.ts`

## Auto-pruning

Два триггера для автоматической очистки старых фактов:
- `setupVisibilityPruning()` — при переключении вкладки (visibility change)
- `setupIdlePruning()` — при idle браузера

## Схема БД — версии

| Версия | Изменение |
|--------|-----------|
| 5 | `created_at` index на `pendingOperations` → `getPendingOperations()` использует `.orderBy('created_at')` вместо JS-сортировки |
| 4 | (предыдущая) |

## Поля LocalBudgetFact (обновление 2026-05-07)

Добавлено поле: `tab_origin_id: string | null` — UUID вкладки, создавшей запись. Используется для WS-дедупликации. Не индексируется.

## Связанные концепции

- [[реализация/api/sync-endpoint.md]]
- [[реализация/frontend/budget-ws-client.md]]
