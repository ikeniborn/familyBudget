---
wiki_sources: ["docs/architecture/optimization/caching-strategy.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["Redis", "FastAPI", "cache", "backend", "PWA", "Service Worker", "IndexedDB"]
aliases: ["CacheService", "cache_service.py", "Redis Cache", "Read-Through Cache", "Cache Invalidation"]
---

# Cache Service (Multi-Layer Caching)

Многоуровневая система кэширования для оптимизации производительности. Включает Redis backend cache, HTTP Cache-Control, Service Worker cache и IndexedDB.

## Основные характеристики

### Архитектура слоёв

```
Redis (Backend) → HTTP Headers → Service Worker → IndexedDB
     ↑                                                ↑
Reference data                              Offline sync queue
Dashboard stats
```

### Redis Cache (Backend)

**Реализация:** `backend/app/services/cache_service.py`

**TTL по категориям:**

| Категория | TTL | Ключи | Cache hit rate |
|-----------|-----|-------|----------------|
| Reference data | 300s | `articles:*`, `financial_centers:*`, `cost_centers:*` | ~90% |
| Dashboard stats | 30s | `dashboard:*` | ~70% |
| Recent transactions | 10s | `recent:*` | ~60% |
| Facts API | нет кэша | — | — |

**Read-Through Cache Pattern:**
```python
cached = await cache_service.get(key)
if cached:
    return cached  # Cache HIT
data = await fetch_from_db()  # Cache MISS
await cache_service.set(key, data, ttl)
return data
```

### Инвалидация кэша (критично!)

**Правило: всегда await инвалидацию перед return:**

```python
# ❌ WRONG — race condition, стейл данные после мутации
asyncio.create_task(cache_service.invalidate_dashboard())
return response

# ✅ CORRECT — кэш гарантированно очищен
await cache_service.invalidate_dashboard()
return response
```

**Триггеры инвалидации:**

| Мутация | Инвалидирует |
|---------|-------------|
| CRUD fact/transfer | `dashboard:*`, `recent:*` |
| CRUD article | `articles:*` |
| CRUD financial center | `financial_centers:*` |
| CRUD cost center | `cost_centers:*` |

### HTTP Cache Headers

| Endpoint | Policy | Обоснование |
|----------|--------|------------|
| `/api/v1/facts` | `private, no-cache, must-revalidate` | Часто меняется, user-specific |
| Reference data | `private, max-age=300` | Редко меняется |
| Dashboard widgets | Redis 10-30s TTL | Дорогие агрегаты |

### Service Worker Cache

| Ресурс | Стратегия |
|--------|----------|
| `/api/*` | Network First (offline fallback) |
| HTML страницы | Network First |
| `.css`, `.js`, `.png` | Cache First + Stale-While-Revalidate |
| Static assets | Precache (при активации SW) |
| Health (`/health`, `/ping`) | Bypass SW |

### IndexedDB (Offline)

| Store | Назначение | Очистка |
|-------|-----------|---------|
| `offline_facts` | Транзакции офлайн | После sync |
| `offline_plans` | Планы офлайн | После sync |
| `sync_queue` | Очередь операций | После sync |
| `data_cache` | Reference data | По TTL |

### Client-Side Cache Monitoring (v6.2+)

Admins могут видеть метрики кэша всех клиентов на `/admin/monitoring`:

```
[Browser] --POST--> /api/v1/admin/cache-metrics (202 Accepted)
                                 ↓
                    [In-Memory Aggregator] (5min TTL)
                                 ↓
[Admin Page] <--GET-- /api/v1/admin/cache-metrics (auto-refresh 5s)
```

Метрики: размер SW cache (sampling первых 20 записей, точность ±10%), IndexedDB pending records, Storage Quota usage.

### Performance Impact

| Операция | До | После | Улучшение |
|----------|----|----|-----------|
| Dashboard | ~2-3s | ~500ms-1s | 60-70% |
| Article list | ~200-400ms | ~50-100ms | 75-80% |
| Facts list | ~300-800ms | ~300-800ms | нет (no cache) |

## Связанные концепции

- [[websocket-realtime]]
- [[pwa-service-worker]]
- [[offline-first]]
