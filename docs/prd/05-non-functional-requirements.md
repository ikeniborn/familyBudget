## 5. Non-Functional Requirements

### 5.1 Performance (NFR-001)

**Производительность API**

**Метрики:**
- API response time < 500ms (p95) для GET запросов
- API response time < 1000ms (p95) для POST запросов
- Поддержка до 10 одновременных запросов

**Обоснование:**
Для семьи из 2-5 человек этих показателей достаточно для комфортной работы.

#### 5.1.1 Performance Architecture Analysis

**Вопрос:** Достаточно ли текущей архитектуры (PostgreSQL + covering indexes) или нужно добавлять Redis кэширование?

**Анализ текущей нагрузки:**

| Метрика | Текущее значение | Threshold для Redis | Статус |
|---------|------------------|---------------------|--------|
| Пользователи | 2-5 | 100+ одновременных | ✅ Достаточно |
| Одновременные запросы | 10 max | 1000+ req/s | ✅ Достаточно |
| Фактов/месяц | 300 (~10/день) | 10,000+/день | ✅ Достаточно |
| Dimension data size | ~13KB | >100MB | ✅ Достаточно |
| API response time (p95) | <200ms | >500ms | ✅ Соответствует |

**Существующие механизмы оптимизации:**

1. **PostgreSQL Connection Pooling:**
   - pool_size=5, max_overflow=15 (до 20 connections)
   - **Избыточно** для 2-5 пользователей
   - **Достаточно** для 100+ пользователей

2. **Covering Indexes (14 индексов):**
   - Index-only scans для критичных запросов
   - **Результат:** Telegram OAuth <5ms, analytics <50ms
   - **См. подробности:** [06-database-design.md, секция 6.6.1](#661-advanced-index-optimization-strategy-migration-009)

3. **PostgreSQL Buffer Pool:**
   - shared_buffers=256MB
   - **Dimension tables (~13KB) полностью в памяти**
   - **Fact data (~50MB) в памяти** для активного периода
   - effective_cache_size=1GB (вся БД в кэше ОС)

4. **Database-Level Cache:**
   - Таблица `t_recommended_amounts` для pre-computed K-means analytics
   - Nightly recalculation (scheduler at 02:00 UTC)
   - 24-hour TTL
   - **Заменяет Redis** для analytics cache

5. **Application-Level Optimizations:**
   - @lru_cache для settings (in-memory)
   - Async queries (НЕ блокируют event loop)
   - Batch loading (avoid N+1 queries)

**Фактические результаты production (VPS 2 vCPU, 4GB RAM):**

| Endpoint | p50 | p95 | p99 | Требование (p95) | Статус |
|----------|-----|-----|-----|------------------|--------|
| GET /api/v1/facts?limit=100 | 45ms | 120ms | 180ms | <500ms | ✅ 2.4x faster |
| GET /api/v1/articles | 12ms | 30ms | 50ms | <500ms | ✅ 16.6x faster |
| POST /api/v1/facts | 80ms | 150ms | 250ms | <1000ms | ✅ 6.6x faster |
| GET /api/v1/analytics/quick-stats | 90ms | 200ms | 350ms | <500ms | ✅ 2.5x faster |
| GET /api/v1/analytics/recommended-amounts (cache HIT) | 15ms | 40ms | 80ms | <500ms | ✅ 12.5x faster |

**Вывод: Текущая архитектура ИЗБЫТОЧНА для заявленной нагрузки.**

**Решение: Redis НЕ требуется.**

**Аргументы ПРОТИВ добавления Redis:**

1. **Существующая производительность избыточна:**
   - 95% запросов < 200ms (требование < 500ms)
   - Margin 2.5x - запас для роста нагрузки

2. **Redis добавит сложность БЕЗ измеримого gain:**
   - +1 сервис (memory overhead, monitoring, deployment complexity)
   - Cache invalidation logic для SCD Type 2 (сложная логика)
   - Network latency backend ↔ Redis (хоть и минимальная в Docker network)
   - Дополнительная точка отказа
   - Overhead для разработки, тестирования, мониторинга

3. **Dimension data уже в памяти PostgreSQL:**
   - ~13KB помещается в shared_buffers (256MB)
   - Latency <1ms для SELECT на dimension tables
   - NO need для external cache

4. **Analytics cache уже реализован:**
   - Database-level cache (t_recommended_amounts таблица)
   - Pre-computation через scheduler
   - 24-hour TTL через WHERE clause
   - Index-optimized lookups

**Когда МОЖЕТ понадобиться Redis (условия пересмотра):**

| Метрика | Текущее | Threshold для Redis | Причина |
|---------|---------|---------------------|---------|
| Одновременные пользователи | 2-5 | 100+ | PostgreSQL connection pooling перестанет справляться |
| Requests/second | <10 | 1000+ | PostgreSQL buffer pool eviction rate |
| Dimension data | ~13KB | >100MB | Не помещается в shared_buffers |
| Deployment | Single instance | Multiple instances | Нужен shared cache между instances |
| Features | No real-time | Real-time collaboration | Redis Pub/Sub для broadcasting |

**Альтернативы Redis при масштабировании:**

Если потребуется дополнительная оптимизация, но Redis избыточен:

1. **PostgreSQL Materialized Views:**
   ```sql
   CREATE MATERIALIZED VIEW mv_monthly_stats AS
   SELECT user_id, DATE_TRUNC('month', fact_date) as month,
          SUM(amount) as total
   FROM t_f_budget_fact GROUP BY 1, 2;

   REFRESH MATERIALIZED VIEW mv_monthly_stats;  -- Nightly via scheduler
   ```

2. **Application-level LRU cache:**
   ```python
   from functools import lru_cache

   @lru_cache(maxsize=100)
   async def get_monthly_stats_cached(user_id: int, month: date):
       # In-memory cache (TTL = process restart)
       pass
   ```

3. **PostgreSQL увеличение shared_buffers:**
   - Текущий: 256MB
   - При росте data: 512MB или 1GB
   - Вся БД в памяти PostgreSQL

**Архитектурное решение: YAGNI Principle**

**"You Aren't Gonna Need It"** - не добавляй сложность до тех пор, пока она не нужна.

**Текущая стратегия:** Сосредоточиться на features, а не на преждевременной оптимизации.

**Критерии пересмотра:** Приложение масштабируется до 100+ пользователей, 1000+ req/s, или distributed deployment.

**См. также:**
- [03-system-architecture.md, секция 3.8](#38-performance-optimization-architecture) - подробная Performance Optimization Architecture
- [06-database-design.md, секция 6.6.1](#661-advanced-index-optimization-strategy-migration-009) - Index Optimization Strategy
- [14-caching-strategy.md](#14-caching-strategy) - полная Caching Strategy документация

---

### 5.2 Scalability (NFR-002)

**Масштабируемость**

**Метрики:**
- Пользователей: 2-5 человек
- Фактов в месяц: до 300
- Общий объем данных: до 100,000 записей (несколько лет использования)

---

### 5.3 Availability & Reliability (NFR-003, NFR-007)

**Доступность и надежность**

**Метрики:**
- Uptime: 95%+ (допустимы перерывы на обслуживание)
- Запланированные простои: в ночное время
- Ежедневные бэкапы БД
- Хранение бэкапов в двух местах (локально + S3)
- Транзакционная целостность на уровне БД
- Graceful shutdown для всех сервисов

---

### 5.4 Security (NFR-004)

**Безопасность**

**Меры:**
- HTTPS для всех внешних соединений
- Валидация всех входных данных
- Secrets хранятся в переменных окружения, не в git
- JWT токены с ограниченным временем жизни (7 дней)
- Rate limiting для API (100 запросов/минуту на IP)
- Firewall (UFW) разрешает только необходимые порты (22, 80, 443, опционально 5432 с IP restriction)

---

### 5.5 Usability (NFR-005)

**Удобство использования**

**Меры:**
- **Telegram бот:** простые команды, inline-клавиатуры, понятные сообщения
- **Веб:** адаптивный дизайн для мобильных устройств
- **Время на добавление расхода через бота:** < 1 минуты
- **Язык интерфейса:** русский

---

### 5.6 Maintainability (NFR-006)

**Поддерживаемость**

**Меры:**
- Чистый и документированный код
- Docker контейнеры для изоляции
- Логирование всех критичных операций
- Bash скрипты для рутинных операций
- Документация по развертыванию и обновлению

---

