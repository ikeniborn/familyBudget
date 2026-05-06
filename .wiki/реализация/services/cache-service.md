---
wiki_sources:
  - "backend/app/services/cache_service.py"
wiki_updated: 2026-05-06
wiki_status: developing
tags:
  - family-budget
  - implementation
  - source-code
aliases:
  - "Cache Service"
---

# Cache Service — Read-Through кэш на Redis

Read-through cache для справочных данных (articles, financial centers, cost centers) и данных дашборда. Graceful degradation: при недоступности Redis — прозрачный fallback к БД.

## Основные характеристики

**Паттерны:**
- Read-Through Cache: промах → запрос к БД → заполнение кэша
- Cache Invalidation: удаление ключей по паттерну при CRUD-операциях
- Graceful Degradation: при Redis=unavailable → прямой вызов DB

**Класс CacheTTL** — значения TTL из Settings:
- `REFERENCE()` — справочники (articles, CFO, cost centers): default 300с (5 мин)
- `DASHBOARD()` — быстрая статистика, балансы: default 30с
- `DYNAMIC()` — список фактов, последние транзакции: default 60с
- `SHORT()` — HTML-фрагменты: default 10с

**Класс CacheKey** — namespace builder для ключей.

**Основной метод:**
```python
articles = await cache_service.get_or_set(
    key="articles:list",
    fetch_fn=lambda: article_service.get_all(session),
    ttl=CacheTTL.REFERENCE()
)
```

**Инвалидация:**
```python
await cache_service.invalidate_pattern("articles:*")
```

## Зависимости

- `redis_service.get_redis()`, `is_redis_available()`
- `json_utils.dumps_for_cache()` — кастомный сериализатор

## Связанные концепции

- [[реализация/services/redis-ws-manager.md]]
- [[реализация/api/facts-endpoint.md]]
