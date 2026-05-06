---
wiki_sources:
  - "backend/app/api/v1/endpoints/budget_ws.py"
  - "backend/app/services/redis_ws_manager.py"
wiki_updated: 2026-05-06
wiki_status: mature
wiki_outgoing_links:
  - "реализация/services/redis-ws-manager.md"
tags:
  - family-budget
  - implementation
  - api-endpoint
  - websocket
  - realtime
aliases:
  - "budget ws"
  - "websocket endpoint"
  - "real-time"
---

# Budget WebSocket — реализация real-time обновлений

`backend/app/api/v1/endpoints/budget_ws.py` — WebSocket + Long Polling fallback для real-time событий.

## Маршруты

| Путь | Тип | Описание |
|------|-----|----------|
| `POST /budget/ws/token` | HTTP | Получить short-lived WS token (5 мин, type: ws) |
| `WS /budget/ws?token=...` | WebSocket | Основное соединение |
| `GET /budget/ws/status` | HTTP | Кол-во активных соединений |
| `POST /budget/ws/disconnect` | HTTP | Активный disconnect по connection_id |
| `GET /budget/poll` | HTTP | Long Polling fallback (comet-style) |

## Архитектура

```
Клиент → GET /budget/ws/token (cookie auth) → JWT WS-token
Клиент → WS /budget/ws?token=JWT → connection_id
Сервер → "connected" {user_id, connection_id}
Сервер → "ping" каждые 10с
Сервер → события: fact_created, fact_updated, fact_deleted, ...
```

**Модель**: Shared Family Budget — все аутентифицированные пользователи получают ВСЕ события.

## Менеджер соединений

`BudgetWebSocketManager` (in-memory, single worker) и `RedisBudgetWebSocketManager` (Redis Pub/Sub, multi-worker).

```python
ws_manager = _get_redis_ws_manager()  # Redis если доступен, иначе in-memory
```

Лимиты безопасности:
- `MAX_CONNECTIONS_PER_USER = 10`
- `MAX_TOTAL_CONNECTIONS = 500`
- Stale cleanup каждые 30с (inactivity > 60с)

## События (Server → Client)

| Тип события | Триггер |
|-------------|---------|
| `connected` | Успешное подключение |
| `ping` | Каждые 10с |
| `pong` | Ответ на клиентский ping |
| `fact_created/updated/deleted` | CRUD фактов |
| `plan_created/updated/deleted` | CRUD планов |
| `facts_batch_deleted` | Пакетное удаление |
| `transfer_created/deleted` | Переводы |
| `item_created/updated/deleted/completed` | Shopping items |
| `shopping_list_created/updated/deleted` | Shopping lists |
| `recurring_plan_*` | Recurring plans |
| `financial_center_*` | Счета |
| `cost_center_*` | Места затрат |
| `webauthn_credential_*` | WebAuthn credentials |

## Сообщения (Client → Server)

| Тип | Действие |
|-----|----------|
| `ping` | Сервер отвечает pong |
| `check_online` | Сервер отвечает online_status |
| `sync_initial` | PGlite initial sync |
| `sync_incremental` | PGlite delta sync |
| `sync_client_changes` | Upload клиентских изменений |

## Безопасность broadcast данных

```python
SAFE_FACT_FIELDS = {"id", "article_id", "financial_center_id", "cost_center_id",
                     "amount", "fact_date", "description", "record_type", "transfer_id"}
```
Все broadcast функции фильтруют данные через `SAFE_*_FIELDS` — никаких чувствительных полей.

## Long Polling fallback

`EventBuffer` / `RedisEventBuffer` — ring buffer с TTL 60с, max 1000 событий.

```
GET /budget/poll?since=<unix_ts>&timeout=5
→ {events: [...], server_time: float}
```
Comet-style: если нет событий — ждёт до `timeout` секунд перед ответом.

## Push notifications

При `broadcast_fact_created` → `_send_push_for_offline_users()`:
- Дебаунс 30с
- Отправляет только пользователям БЕЗ активного WS
- Требует настроенного VAPID
