---
wiki_sources:
  - "backend/app/api/v1/endpoints/facts.py"
wiki_updated: 2026-05-06
wiki_status: mature
wiki_outgoing_links:
  - "реализация/services/write-behind.md"
  - "реализация/services/redis-ws-manager.md"
  - "реализация/models/budget-fact.md"
tags:
  - family-budget
  - implementation
  - api-endpoint
  - facts
aliases:
  - "facts api"
  - "транзакции endpoint"
  - "CRUD фактов"
---

# Facts API — реализация эндпоинта транзакций

`backend/app/api/v1/endpoints/facts.py` — FastAPI роутер CRUD-операций для `BudgetFact` (транзакции бюджета).

## Маршруты

| Метод | Путь | Описание |
|-------|------|----------|
| POST | `/facts` | Создание транзакции |
| GET | `/facts` | Список с фильтрами + пагинация |
| GET | `/facts/recent` | Последние N фактов (JSON, TTL 10s) |
| GET | `/facts/recent-html` | Dashboard-HTML с таблицей (TTL 10s) |
| GET | `/facts/summary` | Агрегация income/expense |
| GET | `/facts/count` | Счётчик с теми же фильтрами |
| GET | `/facts/{id}/row-html` | HTML-строка одного факта (incremental update) |
| GET | `/facts/{id}` | Один факт по ID |
| PUT | `/facts/{id}` | Обновление in-place (не SCD2) |
| DELETE | `/facts/{id}` | Удаление + history record |
| POST | `/facts/batch-delete` | Пакетное удаление до 500 фактов |

## Ключевые паттерны реализации

### Write-Behind (асинхронная запись)
```python
if write_behind_service.is_enabled():
    fact_id = await get_next_fact_id(session)  # pre-generated ID
    request_id = await write_behind_service.queue_fact_create(...)
    return response_data  # возврат немедленно, запись в фоне
# fallback: synchronous write
```
- Если Redis доступен → ID генерируется заранее, ответ 201 сразу
- При ошибке очереди → откат на синхронную запись

### Partition pruning (372 партиции по месяцам)
```python
# Two-phase query: сначала fact_date, затем полный JOIN
fact_date = await _get_fact_date(session, fact_id)  # ~35ms
stmt = select(...).where(BudgetFact.id == fact_id, BudgetFact.fact_date == fact_date)
# Без fact_date: Planning Time ~2.6s (все 372 партиции)
```

### Offline sync deduplication
```python
if fact_data.is_offline_sync and fact_data.sync_hash:
    # Проверить дубль за 24 часа по sync_hash
    existing_fact = ...
    if existing_fact:
        return existing_fact  # idempotent, без создания
```

### WebSocket broadcast после каждой мутации
```python
ws = _get_budget_ws_broadcast()  # lazy import (избежание circular dep)
await ws.broadcast_fact_created(response_data)
await cache_service.invalidate_dashboard()
```

### History tracking при DELETE
- Перед удалением создаётся запись `BudgetFactHistory` с `change_type="DELETE"`
- Каскадное удаление `ScheduledReminder` (нет FK из-за партицирования)
- Для transfer: удаляются оба факта (expense + income)

### Incremental row update (`/row-html`)
- Возвращает HTML-фрагмент: `<template>desktop_tr|||mobile_div</template>`
- Данный формат используют wsEventHandlers для замены строки без перезагрузки страницы
- `record_type` query param переключает onclick-обработчики (`FactsManager` vs глобальные функции)

## Shared Family Budget model
Нет фильтрации по `user_id` в базовых запросах — все аутентифицированные пользователи видят все транзакции. `user_id` фильтр опциональный query param.

## Кэш
- `recent_facts:{user_id}:{limit}` — TTL 10s
- `CacheKey.recent_html(limit)` — TTL 10s
- `invalidate_dashboard()` вызывается после каждой мутации
