---
wiki_sources:
  - "backend/app/api/v1/endpoints/sync.py"
wiki_updated: 2026-05-06
wiki_status: developing
wiki_outgoing_links: []
tags:
  - family-budget
  - implementation
  - api-endpoint
  - offline-first
  - sync
aliases:
  - "sync api"
  - "delta sync"
  - "offline sync"
---

# Sync API — offline-first синхронизация

`backend/app/api/v1/endpoints/sync.py` — REST-эндпоинты для начальной и инкрементальной синхронизации с Dexie.js / PGlite клиентами.

## Маршруты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | `/sync/shopping-reference` | Initial sync: справочные данные |
| GET | `/sync/shopping-lists/delta` | Delta sync: изменения с `since` |

## Initial sync (`/shopping-reference`)

Возвращает ВСЕ справочные данные для оффлайн БД:

```json
{
  "stores": [...],
  "product_groups": [...],
  "product_group_hierarchy": [...]  // Closure Table
}
```

Справочные данные read-only на клиенте (server is source of truth).

## Delta sync (`/shopping-lists/delta?since=<ISO8601>`)

```json
{
  "created": {"lists": [...], "items": [...]},
  "updated": {"lists": [...], "items": [...]},
  "deleted": {"list_ids": [...], "item_ids": [...]},
  "server_time": "2026-05-06T..."
}
```

**Стратегия разделения created/updated**:
- `created`: `created_at > since`
- `updated`: `updated_at > since AND created_at <= since`
- `deleted`: `deleted_at > since` (soft delete)

Без `since` → initial sync (все активные записи).

**Важно**: всегда использовать `server_time` из ответа как `since` для следующего запроса — не использовать клиентское время.

## Shared model

Все пользователи получают все данные (нет фильтрации по `creator_id`).

## WS-based sync (через budget_ws.py)

PGlite sync происходит через WebSocket сообщения:
- `sync_initial` → `handle_sync_initial(session, user_id)`
- `sync_incremental` → `handle_sync_incremental_request(session, user_id, last_sync_timestamp)`
- `sync_client_changes` → `handle_sync_client_changes(session, user_id, operations)`
