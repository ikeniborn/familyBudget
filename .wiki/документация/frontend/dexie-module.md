---
wiki_sources:
  - "docs/architecture/core/dexie-integration.md"
  - "docs/architecture/overview.yaml"
wiki_updated: 2026-05-07
wiki_status: mature
wiki_outgoing_links:
  - "[[websocket-клиент]]"
  - "[[build-system]]"
  - "[[dashboard-module]]"
tags:
  - family-budget
  - architecture
  - frontend
aliases:
  - "DexieManager"
  - "Dexie.js"
  - "offline database"
  - "IndexedDB"
---

# Dexie — модуль офлайн-базы данных

Dexie.js — production-ready обёртка над IndexedDB для реализации offline-first функциональности. Заменил PGlite в v11.0.0 (2026-01-31). Активен по умолчанию для всех пользователей.

## Основные характеристики

| Параметр | Значение |
|----------|----------|
| Bundle | `frontend/shared/db/dexie.min.js` |
| Размер | ~255KB minified / ~65KB gzip |
| Версия | v11.5.0+ |
| Статус | Production |

**Причины миграции с PGlite:**
- PGlite v0.3.x в alpha-статусе (нестабильно)
- Размер: 3.4MB (PGlite) → 29KB (Dexie) — сокращение на 99.1%
- Dexie.js: 10+ лет в production, 10k+ stars

## Архитектура

```
DexieManager (абстракция) → Dexie.js API → IndexedDB (браузер)
DataLayer → DexieManager | REST API fallback
```

**Ключевые модули:**
- `DexieManager.ts` — основной API-интерфейс
- `core/database.ts` — схема БД (13 таблиц), compound indexes, cents helpers
- `operations/` — factOperations, bulkOperations, shoppingOperations, referenceSync
- `migration/cleanupLegacyDB.ts` — автоматическая миграция с Legacy IndexedDB

## Схема данных

**Reference Data:**
```typescript
articles: 'id, user_id, type, parent_id, is_active'
articleHierarchy: '[ancestor_id+descendant_id], ancestor_id, descendant_id, depth'
financialCenters: 'id, user_id, is_active'
costCenters: 'id, user_id, is_active'
```

**Transactional Data:**
```typescript
// ВАЖНО: amount хранится как integer cents (12345 = $123.45)
budgetFacts: 'id, temp_id, user_id, article_id, date, sync_status, [user_id+date]'
```

**Shopping Lists:**
```typescript
shoppingLists: 'temp_id, id, user_id, creator_id, sync_status'
shoppingListItems: 'temp_id, id, creator_id, shopping_list_temp_id, position, sync_status'
```

## Cents conversion (критически важно)

JavaScript IEEE 754 float precision:
```javascript
0.1 + 0.2 = 0.30000000000000004 (!)
```

Решение — хранить суммы как integer cents:
```typescript
import { toCents, fromCents } from '@db/dexie';
const saved = { amount: toCents(123.45) }; // → 12345
const displayed = fromCents(saved.amount);  // → 123.45
```

## Синхронизация

**Периоды хранения (v11.5.0+):**
- Facts: 30–180 дней (localStorage: `budget_dexie_sync_period_facts`)
- Plans: 1–6 месяцев (localStorage: `budget_dexie_sync_period_plans`)
- Default: Facts 90 дней, Plans 3 месяца

**Pruning-механизмы:**
| Механизм | Триггер | Browser Support |
|----------|---------|-----------------|
| setInterval | Каждые 60 мин | 100% |
| Visibility API | Возврат на вкладку | 98%+ |
| requestIdleCallback | Idle браузера | 90%+ |

## Ключевые паттерны

**Transaction atomicity (v11.0.1):**
```typescript
// Обе операции атомарны — crash между ними невозможен
await db.transaction('rw', [db.budgetFacts, db.pendingOperations], async () => {
  await db.budgetFacts.modify({ sync_status: 'synced' });
  await db.pendingOperations.delete();
});
```

**Exponential backoff при retry:**
- Attempt 1: немедленно
- Attempt 2: 2s, Attempt 3: 4s, Attempt 4: 8s, ... (максимум 32s)

**Bundle load order (критически важно):**
```html
<script src="dexie.min.js"></script>     <!-- 1. ДОЛЖЕН быть первым -->
<script src="facts.min.js"></script>     <!-- 2. Зависит от window.Dexie -->
```

**In-memory filtering** (shopping list items): Dexie принимает только primitive key в `.equals()`, поэтому DataLayer применяет фильтры in-memory после запроса (O(n), <10ms для <10,000 элементов).

## Связанные концепции

- [[websocket-клиент]]
- [[dashboard-module]] — основной потребитель DexieManager (analytics queries)
- [[build-system]]

## FactRepository (2026-05-07)

Новый слой абстракции над `db.budgetFacts`. Все записи в таблицу теперь проходят через `FactRepository` — прямой доступ к `db.budgetFacts.put/add/modify/delete` запрещён вне этого класса.

**Расположение:** `frontend/shared/db/dexie/repositories/FactRepository.ts`

```typescript
// Экспортируется через @db/dexie
import { factRepo, getTabId } from '@db/dexie';

factRepo.createFromAPI(responseData);          // POST /facts → Dexie
factRepo.createOffline(data);                  // offline, атомарная транзакция
factRepo.upsertFromServer(wsPayload);          // WS-событие, идемпотентно
factRepo.confirmPending(temp_id, server_id);   // sync подтверждение, атомарно
factRepo.bulkUpsert(facts, onProgress);        // initial sync, батчи 1000
factRepo.remove(temp_id);                      // удаление по temp_id
```

**Tab-origin deduplication** — устраняет двойную запись в Dexie при online-создании факта:
1. `saveTransaction.ts` отправляет `X-Tab-Id: <uuid>` заголовок
2. Бэкенд включает `tab_origin_id` в WS broadcast
3. `upsertFromServer` пропускает запись если `serverFact.tab_origin_id === getTabId()`

**`getTabId()`** — UUID вкладки из `sessionStorage` (`fb_tab_id`). Уникален для каждой вкладки, сохраняется при навигации внутри вкладки, сбрасывается при закрытии.

**Схема версии 5** — добавлен индекс `created_at` на `pendingOperations`:
```typescript
this.version(5).stores({
  pendingOperations: '++id, content_hash, entity_type, temp_id, server_id, next_retry_at, created_at'
});
```
`getPendingOperations()` теперь использует `.orderBy('created_at')` вместо JS-сортировки.

**Видимые ошибки WS** — `catch { /* non-fatal */ }` заменён на `dbLogger.error(...)` в `eventHandlers.ts`. WS listener не падает, но ошибки видны в мониторинге.

## История версий

| Версия | Дата | Ключевые изменения |
|--------|------|-------------------|
| — | 2026-05-07 | FactRepository: централизация db.budgetFacts, tab-origin dedup, schema v5 |
| v11.5.0 | 2026-02-09 | Раздельные sync periods для Facts/Plans, dual sliders UI |
| v11.3.1 | 2026-02-05 | Удалён Legacy IndexedDB, завершена миграция Shopping Lists |
| v11.0.1 | 2026-02-02 | Transaction atomicity fix, exponential backoff |
| v11.0.0 | 2026-01-31 | Первый релиз (замена PGlite) |
