---
wiki_sources:
  - "docs/architecture/core/dexie-integration.md"
  - "docs/architecture/flows/offline-sync.yaml"
  - "docs/architecture/overview.yaml"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links:
  - "[[dexie-module]]"
  - "[[websocket-клиент]]"
tags:
  - family-budget
  - architecture
  - patterns
  - offline
aliases:
  - "offline-first"
  - "offline sync"
  - "IndexedDB sync"
  - "PWA"
---

# Offline-First паттерн

Offline-first архитектура позволяет пользователям создавать транзакции без сети. Изменения хранятся локально в Dexie (IndexedDB) и синхронизируются с сервером через WebSocket при восстановлении соединения.

## Основные характеристики

**Стек:**
- Dexie.js (IndexedDB) — локальное хранилище
- WebSocket sync protocol — синхронизация с backend
- `pending_operations` таблица — очередь офлайн-изменений
- `sync_status` поле — статус каждой записи (`synced | pending | conflict | deleted`)

## Sync Protocol

**Три типа сообщений:**

| Событие | Направление | Назначение |
|---------|------------|-----------|
| `sync_initial` | Server → Client | Начальная загрузка reference data (articles, FCs, CCs) |
| `sync_incremental` | Server → Client | Дельта-обновления с момента last_sync_timestamp |
| `sync_client_changes` | Client → Server | Загрузка pending операций (create/update/delete) |

**Batch upload:** максимум 100 операций за запрос. Retry с exponential backoff (2s, 4s, 8s, ..., 32s max).

## Создание записи офлайн

1. Пользователь создаёт транзакцию — запись с `temp_id` (UUID) и `sync_status: 'pending'`
2. Запись попадает в `pending_operations` таблицу
3. При восстановлении сети: WebSocket upload операций на сервер
4. Сервер создаёт запись, возвращает реальный `id`
5. Dexie обновляет: `temp_id` → `id`, `sync_status: 'synced'`

**Content hash deduplication:** сервер вычисляет хеш контента и отклоняет дублирующие create-запросы.

## DataLayer абстракция

```typescript
// DataLayer.ts — прозрачный переключатель Dexie / REST API
async getFacts(filters): Promise<LocalFact[]> {
    if (isDexieActive()) {
        const result = await dexieManager.queryFacts(filters);
        if (result.length === 0) {
            // Fallback + кешируем результат в Dexie
            const apiResult = await this.getFactsFromAPI(filters);
            if (apiResult.length > 0) await dexieManager.bulkInsertFacts(apiResult);
            return apiResult;
        }
        return result;
    }
    return await this.getFactsFromAPI(filters);
}
```

## Gotcha: Direct API bypass

Прямой `fetch('/api/v1/facts')` (например, из DevTools) создаёт запись в БД, но **не попадает в Dexie** текущей сессии. Dexie обновляется только через UI-flow (save-handler) или WebSocket-broadcast от внешних клиентов. Для QA: после прямого API-запроса нужен reload или manual sync.

## Pruning

Старые синхронизированные данные автоматически удаляются для экономии места:
- setInterval: каждые 60 минут
- Visibility API: при возврате на вкладку
- requestIdleCallback: в idle-время браузера

Настройка периодов: Facts 30–180 дней, Plans 1–6 месяцев (Dexie Diagnostic Modal).
