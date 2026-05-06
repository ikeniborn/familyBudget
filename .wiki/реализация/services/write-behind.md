---
wiki_sources:
  - "backend/app/services/write_behind_service.py"
wiki_updated: 2026-05-06
wiki_status: mature
wiki_outgoing_links:
  - "реализация/api/facts-endpoint.md"
  - "реализация/services/redis-ws-manager.md"
tags:
  - family-budget
  - implementation
  - backend-service
  - redis
  - async
aliases:
  - "write-behind"
  - "write behind queue"
  - "WriteBehindService"
---

# Write-Behind Service — асинхронная запись в PostgreSQL

`backend/app/services/write_behind_service.py` — паттерн write-behind: запросы пишутся в Redis queue и асинхронно применяются к PostgreSQL фоновым воркером.

## Зачем

- API latency: ~10ms (write-behind) vs ~50ms (sync write)
- Decoupled: ответ 201 немедленно, запись в фоне
- Retry: exponential backoff + Dead Letter Queue

## Архитектура

```
API → validates → queue_fact_create() → Redis RPUSH write_queue:facts
                → returns {id: pre_generated_id} сразу

Worker (background) → BLPOP write_queue:facts
                    → _process_fact() → PostgreSQL INSERT
                    → cache invalidate + WS broadcast
                    → on failure: retry → DLQ
```

## Redis ключи

| Ключ | Тип | Назначение |
|------|-----|-----------|
| `write_queue:facts` | LIST | Основная очередь |
| `write_queue:facts:failed` | LIST | Dead Letter Queue |
| `write_queue:facts:lock` | STRING NX EX | Distributed lock |
| `write_queue:facts:stats` | STRING | Метрики |

## Pre-generated ID

```python
fact_id = await get_next_fact_id(session)  # nextval('t_f_budget_fact_id_seq')
# API возвращает этот ID немедленно
# Worker использует его при INSERT: BudgetFact(id=pre_generated_id, ...)
```

## Retry стратегия

```
retries=0: backoff 100ms
retries=1: backoff 200ms
retries=2: backoff 400ms
...
retries=MAX_RETRIES: → DLQ
```
- `INITIAL_BACKOFF_MS = 100`
- `MAX_BACKOFF_MS = 5000`
- `MAX_RETRIES` из `settings.WRITE_BEHIND_MAX_RETRIES`

## DLQ

- `WRITE_BEHIND_DLQ_TTL_DAYS` — TTL в днях
- `WRITE_BEHIND_DLQ_MAX_SIZE` — ограничение размера
- Cleanup каждые 60с в worker loop
- При переполнении удаляются старые элементы (LPOP)

## Включение/выключение

```python
def is_enabled(self) -> bool:
    return settings.WRITE_BEHIND_ENABLED and is_redis_available()
```
При недоступности Redis или `WRITE_BEHIND_ENABLED=false` — автоматически sync write.

## History tracking

Worker создаёт `BudgetFactHistory` с полными данными после каждой операции:
- CREATE: `change_type="CREATE"`, `is_current=True`
- UPDATE: закрывает предыдущую запись (`valid_to=now`), создаёт новую
- DELETE: `change_type="DELETE"`, `is_current=False`, `valid_from=valid_to`

## Broadcast событий

После записи в PostgreSQL воркер вызывает `manager.broadcast(event_type, data)`, использует `SAFE_FACT_FIELDS` фильтрацию (идентично sync path в `facts.py`).

## Запуск/остановка

```python
# main.py lifespan:
await start_write_behind_worker()  # startup
await stop_write_behind_worker()   # shutdown
```

Singleton: `write_behind_service = WriteBehindService()`
