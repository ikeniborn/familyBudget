## 14. Caching Strategy

### 14.1 Overview

**Цель:** Обеспечить высокую производительность приложения без излишнего усложнения архитектуры.

**Текущий подход:** Многоуровневое кэширование БЕЗ внешних сервисов (Redis, Memcached).

**Обоснование:** Для семейного бюджета (2-5 пользователей, 10 req/s) существующие механизмы оптимизации достаточны.

---

### 14.2 Current Caching Mechanisms

#### 14.2.1 PostgreSQL Buffer Pool (Layer 1: Database-Level)

**Что кэшируется:**
- **Dimension tables** (~13KB) - полностью в памяти
- **Fact data** (~50MB активного периода) - hot data в памяти
- **Index pages** - для covering indexes

**Конфигурация:**

```yaml
# docker-compose.yml
postgres:
  command:
    - "-c" "shared_buffers=256MB"        # Кэш данных в памяти PostgreSQL
    - "-c" "effective_cache_size=1GB"    # Доступная память для кэша ОС
```

**Преимущества:**
- ✅ Автоматическое управление (PostgreSQL самостоятельно решает что кэшировать)
- ✅ NO configuration needed (работает из коробки)
- ✅ NO cache invalidation logic (PostgreSQL гарантирует консистентность)

**Результат:**
- Dimension queries: <50ms (почти всегда in-memory)
- Fact queries: <200ms с covering indexes

---

#### 14.2.2 Covering Indexes (Layer 2: Index-Only Scans)

**Что оптимизируется:**
- Telegram OAuth lookups
- Analytics queries (user stats, category breakdown)
- Hierarchy queries (category tree)
- Recent transactions

**Примеры:**

```sql
-- 1. Telegram OAuth (index-only scan)
CREATE INDEX idx_user_telegram_current_covering
    ON t_d_user(telegram_id, is_current)
    INCLUDE (id, username, first_name, last_name, is_admin);

-- Query: 5ms вместо 25ms (5x faster)

-- 2. Dashboard analytics (index-only scan)
CREATE INDEX idx_budget_fact_user_date_amount_covering
    ON t_f_budget_fact(user_id, fact_date DESC)
    INCLUDE (amount, article_id, cost_center_id, financial_center_id);

-- Query: 45ms вместо 180ms (4x faster)
```

**Всего:** 14 covering indexes оптимизируют критичные запросы.

**См. подробности:** [06-database-design.md, секция 6.6.1](./06-database-design.md#661-advanced-index-optimization-strategy-migration-009)

---

#### 14.2.3 Database-Level Cache (Layer 3: Pre-Computed Analytics)

**Таблица кэша:**

```sql
-- backend/db/schema/007_recommendations.sql
CREATE TABLE t_recommended_amounts (
    id SERIAL PRIMARY KEY,
    article_id INTEGER REFERENCES t_d_article(id),
    type VARCHAR(10) CHECK (type IN ('INCOME', 'EXPENSE')),
    record_type VARCHAR(10) CHECK (record_type IN ('PLAN', 'FACT')),
    period VARCHAR(10) CHECK (period IN ('month', 'quarter', 'year')),
    amounts NUMERIC[] NOT NULL,      -- Pre-computed K-means results
    metadata JSONB,                  -- Cluster info, statistics
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (article_id, type, record_type, period)
);
```

**Cache Strategy:**

1. **Nightly pre-computation** (scheduler at 02:00 UTC):
   - **Все листовые категории** (maximum coverage)
   - **Adaptive period per category:** 90→180→270→360 дней
     - Frequent categories: 90 days (fresh recommendations)
     - Rare categories: up to 360 days (historical data)
   - Пересчет для quarter period (semantic period)
   - Полная замена старых результатов

2. **Adaptive Period Algorithm:**
   - Для каждой leaf категории индивидуально:
     - Try 90 days: IF sample_size ≥ 20 → compute K-means
     - Else try 180 days: IF sample_size ≥ 20 → compute K-means
     - Else try 270 days: IF sample_size ≥ 20 → compute K-means
     - Else try 360 days: IF sample_size ≥ 20 → compute K-means
     - Else skip category (insufficient data)
   - **metadata.days_analyzed** хранит использованный период (transparency)

3. **On-demand calculation** (при cache miss):
   - Расчет K-means для редких категорий
   - Сохранение в cache для повторного использования

4. **TTL: 24 hours** (через WHERE clause):
   ```sql
   WHERE last_updated >= NOW() - INTERVAL '24 hours'
   ```

**Результат:**
- Cache HIT: 15ms (вместо 850ms K-means calculation)
- **56x faster** для часто используемых категорий
- **80-95% category coverage** (vs 3 categories with TOP-10 limit)
- **Fresh data for frequent categories** (90 days), historical for rare (360 days)

**Заменяет:** Redis cache для analytics.

---

#### 14.2.4 Application-Level Cache (Layer 4: In-Memory)

**Settings Singleton:**

```python
# backend/app/core/config.py
from functools import lru_cache
from pydantic_settings import BaseSettings

@lru_cache
def get_settings() -> Settings:
    """Singleton settings - загружается один раз при старте"""
    return Settings()

# Использование:
settings = get_settings()  # Cached in memory (process lifetime)
```

**Преимущества:**
- ✅ Zero latency (in-process)
- ✅ NO external service needed
- ✅ Automatic cleanup (при restart процесса)

**Недостатки:**
- ❌ НЕ shared между instances (только для single backend instance)
- ❌ TTL = process lifetime (NO expiration)

**Подходит для:** Configuration, static data.

---

### 14.3 Cache Performance Comparison

**Сравнение латентности разных cache layers:**

| Cache Layer | Latency | Use Case | Pros | Cons |
|-------------|---------|----------|------|------|
| **PostgreSQL Buffer Pool** | <1ms | Dimension tables | Automatic, consistent | Limited by shared_buffers size |
| **Covering Indexes** | <5ms | Critical queries | Index-only scans, fast | Требуют дискового пространства |
| **Database-Level Cache** | 15ms | Pre-computed analytics | 24h TTL, shared | Требует scheduler для обновления |
| **@lru_cache (Python)** | <0.1ms | Settings, config | In-memory, zero latency | NOT shared между instances |
| **Redis (если бы был)** | 1-2ms | Session, shared cache | Shared, TTL, Pub/Sub | +1 service, network latency, complexity |

**Вывод:** Текущие cache layers достаточны для 2-5 пользователей.

---

### 14.4 When Redis Would Be Needed

**Условия добавления Redis (хотя бы один выполнен):**

#### 14.4.1 Scale Thresholds

| Metric | Current | Threshold | Reason |
|--------|---------|-----------|--------|
| **Concurrent users** | 2-5 | 100+ | PostgreSQL connection pooling (20 connections) недостаточно |
| **Requests/second** | <10 | 1000+ | PostgreSQL buffer pool eviction rate |
| **Dimension data** | ~13KB | >100MB | Не помещается в shared_buffers (256MB) |
| **Backend instances** | 1 | 2+ | Нужен shared cache между instances |
| **Real-time features** | No | Yes | Redis Pub/Sub для notifications |

#### 14.4.2 Redis Use Cases (When Applicable)

**1. Session Storage:**
- **Текущее решение:** JWT tokens (stateless auth, NO session storage)
- **Когда нужен Redis:** Stateful sessions, user preferences

**2. Rate Limiting:**
- **Текущее решение:** NO rate limiting (2-5 trusted family members)
- **Когда нужен Redis:** Public API, защита от abuse (100+ external users)

**3. Pub/Sub (Real-time notifications):**
- **Текущее решение:** Telegram Bot push notifications (через Telegram API)
- **Когда нужен Redis:** Real-time web notifications, collaboration features

**4. Distributed Locking:**
- **Текущее решение:** Single backend instance (NO need для locks)
- **Когда нужен Redis:** Multiple backend instances, concurrent job processing

**5. Shared Cache:**
- **Текущее решение:** @lru_cache в single backend instance
- **Когда нужен Redis:** Multiple backend instances (load balancing)

---

### 14.5 Alternative Optimization Strategies

**Если потребуется дополнительная оптимизация, но Redis избыточен:**

#### 14.5.1 PostgreSQL Materialized Views

**Что это:** Pre-computed SQL views с сохранением результата.

**Пример:**

```sql
-- Создание materialized view
CREATE MATERIALIZED VIEW mv_monthly_stats AS
SELECT
    user_id,
    DATE_TRUNC('month', fact_date) as month,
    article_id,
    SUM(amount) as total_amount,
    COUNT(*) as transaction_count
FROM t_f_budget_fact
WHERE record_type = 'FACT'
GROUP BY user_id, month, article_id;

-- Индекс для быстрого поиска
CREATE INDEX idx_mv_monthly_stats_user_month
    ON mv_monthly_stats(user_id, month DESC);

-- Обновление (nightly scheduler)
REFRESH MATERIALIZED VIEW mv_monthly_stats;
```

**Использование:**

```python
# backend/app/api/v1/analytics.py
@router.get("/monthly-stats")
async def get_monthly_stats(
    user_id: int,
    month: date,
    session: AsyncSession
):
    # Query materialized view (очень быстро)
    result = await session.exec(
        select(MonthlyStats).where(
            MonthlyStats.user_id == user_id,
            MonthlyStats.month == month
        )
    )
    return result.all()
```

**Преимущества:**
- ✅ Очень быстрые запросы (pre-computed)
- ✅ NO external service needed
- ✅ PostgreSQL native feature

**Недостатки:**
- ❌ Требует периодический REFRESH (через scheduler)
- ❌ Stale data между REFRESH

**Подходит для:** Сложные analytics queries с GROUP BY, JOINs.

---

#### 14.5.2 Increase PostgreSQL shared_buffers

**Текущая конфигурация:**

```yaml
postgres:
  command:
    - "-c" "shared_buffers=256MB"
    - "-c" "effective_cache_size=1GB"
```

**При росте данных:**

```yaml
postgres:
  command:
    - "-c" "shared_buffers=512MB"    # или 1GB
    - "-c" "effective_cache_size=2GB"
```

**Правило:** shared_buffers = 25% от total RAM (для dedicated DB server).

**Для VPS 4GB RAM:**
- shared_buffers: 512MB - 1GB
- effective_cache_size: 2-3GB

**Результат:** Больше данных в памяти PostgreSQL, меньше disk I/O.

---

#### 14.5.3 Application-Level LRU Cache (Advanced)

**Пример:** Кэширование API responses в памяти процесса.

```python
# backend/app/services/cache.py
from functools import lru_cache
from datetime import datetime, timedelta
from typing import Optional

class TimedLRUCache:
    """LRU cache with TTL support"""

    def __init__(self, maxsize=100, ttl_seconds=3600):
        self.maxsize = maxsize
        self.ttl = timedelta(seconds=ttl_seconds)
        self.cache = {}  # {key: (value, timestamp)}

    def get(self, key: str) -> Optional[Any]:
        if key in self.cache:
            value, timestamp = self.cache[key]
            if datetime.now() - timestamp < self.ttl:
                return value
            else:
                # Expired - удалить
                del self.cache[key]
        return None

    def set(self, key: str, value: Any):
        # Evict oldest if cache full
        if len(self.cache) >= self.maxsize:
            oldest_key = min(self.cache, key=lambda k: self.cache[k][1])
            del self.cache[oldest_key]

        self.cache[key] = (value, datetime.now())

# Использование
monthly_stats_cache = TimedLRUCache(maxsize=100, ttl_seconds=3600)

@router.get("/monthly-stats")
async def get_monthly_stats(user_id: int, month: date):
    cache_key = f"monthly_stats:{user_id}:{month}"

    # Try cache
    cached = monthly_stats_cache.get(cache_key)
    if cached:
        return cached

    # Cache miss - calculate
    result = await calculate_monthly_stats(user_id, month)

    # Save to cache
    monthly_stats_cache.set(cache_key, result)

    return result
```

**Преимущества:**
- ✅ Custom TTL
- ✅ In-memory (sub-millisecond latency)
- ✅ NO external service

**Недостатки:**
- ❌ НЕ shared между backend instances
- ❌ Lost при process restart
- ❌ Manual cache invalidation

**Подходит для:** Temporary data, user session data.

---

### 14.6 Cache Invalidation Strategy

**"There are only two hard things in Computer Science: cache invalidation and naming things." — Phil Karlton**

#### 14.6.1 Current Invalidation Strategies

**PostgreSQL Buffer Pool:**
- **Automatic** - PostgreSQL гарантирует консистентность
- NO manual invalidation needed

**Database-Level Cache (t_recommended_amounts):**
- **TTL-based:** 24-hour expiration через WHERE clause
- **Nightly refresh:** Scheduler пересчитывает популярные категории
- **On-demand calculation:** При cache miss - расчет и сохранение

**Application-Level (@lru_cache):**
- **Process restart:** Cache очищается при restart backend
- **Manual invalidation:** НЕ требуется для settings (static data)

#### 14.6.2 Invalidation для SCD Type 2 (If Redis Were Used)

**Проблема:** При изменении dimension table (SCD2) нужно инвалидировать кэш.

**Пример сценария:**

1. Admin обновляет Article "Продукты" → "Продукты питания"
2. SCD2 logic: close old version, insert new version
3. **Cache problem:** Redis может содержать старую версию

**Решение (сложное):**

```python
# backend/app/services/scd2_service.py
async def create_new_version(
    session: AsyncSession,
    old_instance: T,
    updates: Dict[str, Any],
) -> T:
    # Step 1: Close old version
    old_instance.is_current = False
    old_instance.valid_to = datetime.now()

    # Step 2: Create new version
    new_instance = create_new_scd2_version(old_instance, updates)

    # Step 3: Commit
    await session.commit()

    # Step 4: INVALIDATE REDIS CACHE (if Redis were used)
    # ❌ Complex logic:
    # - Invalidate article by id
    # - Invalidate article by code
    # - Invalidate article hierarchy
    # - Invalidate all analytics for this article
    # await redis.delete(f"article:{old_instance.id}")
    # await redis.delete(f"article:code:{old_instance.code}")
    # await redis.delete(f"article:hierarchy:{old_instance.id}")
    # await redis.delete(f"analytics:article:{old_instance.id}:*")  # Wildcard!

    return new_instance
```

**Вывод:** Cache invalidation для SCD Type 2 + Redis = СЛОЖНАЯ ЛОГИКА.

**Текущее решение:** PostgreSQL buffer pool гарантирует консистентность БЕЗ manual invalidation.

---

### 14.7 Monitoring & Debugging

#### 14.7.1 PostgreSQL Cache Hit Rate

**Проверка эффективности buffer pool:**

```sql
-- Cache hit rate (должен быть >95%)
SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit) as heap_hit,
    sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100 AS cache_hit_rate
FROM pg_statio_user_tables;

-- Результат (production):
-- cache_hit_rate: 98.5% ✅
```

**Интерпретация:**
- **>95%:** Excellent - большинство данных в памяти
- **80-95%:** Good - рассмотреть увеличение shared_buffers
- **<80%:** Poor - нужна оптимизация (больше памяти или лучшие индексы)

---

#### 14.7.2 Index Usage Statistics

**Проверка какие индексы используются:**

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,              -- Сколько раз использовался
    idx_tup_read,          -- Сколько строк прочитано
    idx_tup_fetch,         -- Сколько строк fetched
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Результат (top indexes):
-- idx_user_telegram_current_covering: 15,234 scans (каждый запрос)
-- idx_budget_fact_user_date_amount_covering: 8,912 scans
-- idx_article_current_covering: 7,345 scans
```

**Неиспользуемые индексы (candidates для удаления):**

```sql
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- Результат: 0 unused indexes ✅
```

---

#### 14.7.3 Slow Query Logging

**Конфигурация:**

```yaml
postgres:
  command:
    - "-c" "log_min_duration_statement=1000"  # Log queries >1s
    - "-c" "log_statement=all"                # Log all statements (development)
```

**Просмотр логов:**

```bash
docker compose logs postgres | grep "duration:"

# Результат:
# 2025-11-05 14:30:12 UTC [123] LOG:  duration: 1250.123 ms  statement: SELECT ...
```

**Action:** Оптимизировать запросы >1s (добавить индекс, rewrite query).

---

### 14.8 Architecture Decision Record (ADR)

**ADR-014: Use PostgreSQL-Native Caching Instead of Redis**

**Status:** ✅ ACCEPTED

**Context:**

Приложение Family Budget предназначено для 2-5 пользователей (семейный бюджет). Текущая нагрузка: 10 одновременных запросов, 300 транзакций/месяц.

**Decision:**

Используем **PostgreSQL-native caching** (buffer pool + covering indexes + database-level cache) вместо Redis.

**Rationale:**

1. **Производительность достаточна:**
   - API response time <200ms (требование <500ms)
   - 95% запросов соответствуют NFR-001

2. **Complexity cost > performance gain:**
   - Redis добавит +1 сервис, overhead для разработки, мониторинга
   - Cache invalidation для SCD Type 2 сложная
   - Network latency backend ↔ Redis (хоть и минимальная)

3. **Dimension data в памяти PostgreSQL:**
   - ~13KB помещается в shared_buffers (256MB)
   - Latency <1ms для dimension queries

4. **Database-level cache заменяет Redis:**
   - Таблица t_recommended_amounts для analytics
   - 24-hour TTL, nightly pre-computation

**Alternatives Considered:**

- **Redis:** Rejected - избыточно для текущего масштаба
- **Memcached:** Rejected - аналогично Redis
- **Application-level cache:** Используется для settings (@lru_cache)

**Consequences:**

- ✅ **Pros:**
  - Простая архитектура (меньше moving parts)
  - NO cache invalidation complexity
  - Меньше overhead для разработки и мониторинга

- ❌ **Cons:**
  - НЕ подходит для distributed deployment (multiple backend instances)
  - НЕ подходит для real-time features (Pub/Sub)

**Reconsideration Criteria:**

- Приложение масштабируется до 100+ пользователей
- 1000+ requests/second
- Multiple backend instances
- Real-time collaboration features

**Date:** 2025-11-05

**Author:** Claude (based on performance analysis)

---

### 14.9 Summary

**Current Caching Strategy:**

| Layer | Mechanism | Latency | TTL | Use Case |
|-------|-----------|---------|-----|----------|
| **L1** | PostgreSQL Buffer Pool | <1ms | Automatic | Dimension tables, hot data |
| **L2** | Covering Indexes | <5ms | N/A | Critical queries (auth, analytics) |
| **L3** | Database-Level Cache | 15ms | 24h | Pre-computed analytics |
| **L4** | @lru_cache (Python) | <0.1ms | Process lifetime | Settings, config |

**Performance Results:**

- ✅ 95% запросов < 200ms (требование <500ms)
- ✅ Dimension queries <50ms
- ✅ Analytics cache HIT: 15ms (56x faster)
- ✅ Telegram OAuth: <5ms (5x faster)

**Architecture Decision:**

- **Redis НЕ требуется** для текущего масштаба (2-5 пользователей)
- **YAGNI Principle:** Don't add complexity until you need it
- **Reconsider:** При масштабировании до 100+ пользователей, 1000+ req/s, distributed deployment

**См. также:**
- [03-system-architecture.md, секция 3.8](./03-system-architecture.md#38-performance-optimization-architecture) - Performance Optimization Architecture
- [05-non-functional-requirements.md, секция 5.1.1](./05-non-functional-requirements.md#511-performance-architecture-analysis) - Performance Architecture Analysis
- [06-database-design.md, секция 6.6.1](./06-database-design.md#661-advanced-index-optimization-strategy-migration-009) - Index Optimization Strategy

---

**Версия:** 1.0
**Дата:** 2025-11-05
**Статус:** ACTIVE
