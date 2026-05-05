---
wiki_sources: ["docs/architecture/core/dexie-integration.md", "docs/architecture/core/pwa.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["Dexie", "offline-first", "IndexedDB", "Service-Worker", "PWA"]
aliases: ["Offline-First", "Dexie Offline", "IndexedDB Sync"]
---

# Offline-First

Архитектурный подход, при котором приложение функционирует без интернета, сохраняя данные локально (IndexedDB через Dexie.js) и синхронизируя их с сервером при восстановлении связи. Используется во всех основных разделах Family Budget: Dashboard, Facts, Plans, Shopping Lists.

## Основные характеристики

### Стек

```
DataLayer (абстракция)
    ↓
DexieManager (IndexedDB) ← primary
REST API (fallback)
    ↓
Dexie.js (29 KB, production-ready)
    ↓
IndexedDB (Native Browser Storage)
```

### Схема данных (Dexie, v2)

```typescript
// Справочники (reference data)
articles, articleHierarchy, financialCenters, costCenters

// Транзакционные данные
budgetFacts: 'id, temp_id, user_id, article_id, date, sync_status, [user_id+date]'

// Списки покупок
shoppingLists, shoppingListItems

// Sync metadata
syncMetadata, pendingOperations
```

**Важно:** `amount` хранится как integer cents (12345 = $123.45) для избежания IEEE 754 погрешностей.

### Sync Strategy

- **Reference data** (Articles, FC, CC): синхронизируется при логине
- **Facts**: загружаются при первом открытии /facts, кешируются в Dexie
- **Plans**: синхронизируются при логине, фильтрация по configurable периоду (1–6 мес)
- **Pending operations**: экспоненциальный backoff (2s → 4s → 8s → ...) при ошибках

### Pruning (автоочистка)

Три механизма запуска:
- `setInterval` — каждые 60 минут (primary)
- `Visibility API` — при возврате на вкладку
- `requestIdleCallback` — во время idle браузера (Safari: fallback на setTimeout)

Период хранения: Facts 30–180 дней, Plans 1–6 месяцев (настраивается в Dexie Diagnostic Modal).

## История миграции

| Версия | Изменение |
|--------|-----------|
| v11.0 | PGlite → Dexie (bundle: 3.4 MB → 29 KB) |
| v11.0.1 | Transaction atomicity fix, exponential backoff |
| v11.3.1 | Legacy IndexedDB удалён, Shopping Lists мигрированы |
| v11.5.0 | Раздельные периоды для Facts и Plans |

## Ограничение: Direct API POST

Прямой `fetch('/api/v1/facts', ...)` в обход UI создаёт запись в БД, но **не попадает в Dexie** текущей сессии. Dexie-запись происходит только в save-хендлере UI. Для QA: после прямого POST необходим перезагрузка страницы или pull sync.

## Связанные концепции

- [[websocket-realtime]]
- [[pwa-service-worker]]
- [[retry-pattern]]
