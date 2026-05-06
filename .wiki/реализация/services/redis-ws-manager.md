---
wiki_sources:
  - "backend/app/services/redis_ws_manager.py"
wiki_updated: 2026-05-06
wiki_status: mature
wiki_outgoing_links:
  - "реализация/api/budget-websocket.md"
tags:
  - family-budget
  - implementation
  - backend-service
  - redis
  - websocket
aliases:
  - "RedisBudgetWebSocketManager"
  - "redis ws manager"
---

# Redis WS Manager — multi-worker WebSocket

`backend/app/services/redis_ws_manager.py` — Redis Pub/Sub WebSocket менеджер для multi-worker деплоя.

## Проблема

WebSocket-объекты не сериализуемы → нельзя передать между воркерами. Каждый воркер хранит только свои локальные коннекты, но события должны доходить до всех воркеров.

## Решение

```
Worker 1           Worker 2           Worker N
LocalConns[ws1]    LocalConns[ws2]    LocalConns[wsN]
     │                  │                  │
     └──────────────────┴──────────────────┘
                        │
               Redis Pub/Sub
               channel: budget:events
```

При `broadcast()`:
1. `publish_event(event_type, data)` → Redis PUBLISH
2. Все воркеры получают через Pub/Sub subscriber
3. Каждый воркер делает `_local_broadcast()` своим коннектам

## Классы

### `RedisBudgetWebSocketManager`

```python
connections: list[tuple[int, WebSocket, str, float]]
# (user_id, websocket, connection_id, last_activity_timestamp)
```

| Метод | Описание |
|-------|----------|
| `connect(ws, user_id)` | Регистрация + лимит-проверка → connection_id |
| `disconnect(user_id, ws)` | Удаление по websocket reference |
| `disconnect_by_id(user_id, conn_id)` | Удаление по UUID |
| `update_activity(conn_id)` | Обновление last_activity |
| `broadcast(event_type, data)` | Через Redis или local fallback |
| `_local_broadcast(event_type, data)` | Только локальные коннекты |
| `send_to_connection(conn_id, ...)` | Конкретному соединению |
| `cleanup_stale_connections()` | Удалить inactive > 60с |
| `start_pubsub()` / `stop_pubsub()` | Redis Pub/Sub lifecycle |

### `RedisEventBuffer`

Ring buffer для Long Polling. Использует Redis ZSET если доступен, иначе `deque` in-memory.

```python
async def get_events_since_async(since_timestamp: float) -> list[dict]
async def wait_for_event(timeout: float) -> bool  # comet-style wait
```

## Fallback режим

```python
async def broadcast(self, event_type, data):
    if is_redis_available():
        published = await publish_event(event_type, data)
        if published:
            return  # Redis обработает
    # Fallback: local only
    await self._local_broadcast(event_type, data)
```

## Лимиты безопасности

- `MAX_CONNECTIONS_PER_USER = 10` — per worker
- `MAX_TOTAL_CONNECTIONS = 500` — per worker
- `STALE_CONNECTION_TIMEOUT = 60` — секунд без активности

## Lifecycle

```python
# main.py lifespan startup:
await init_redis_ws()   # → manager.start_pubsub()

# main.py lifespan shutdown:
await close_redis_ws()  # → manager.stop_pubsub()
```

Singleton: `get_ws_manager()` / `get_event_buffer()`
