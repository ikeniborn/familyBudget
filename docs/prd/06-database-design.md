## 6. Database Design

### 6.1 Database Schema Overview

**Naming conventions:**
- `t_d_*` - dimension tables (справочники)
- `t_f_*` - fact tables (транзакции)
- `v_d_*_current` - views для актуальных SCD2 записей

**Типы таблиц:**
- **Dimension tables** - справочники с SCD2
- **Fact tables** - транзакционные данные (план/факт)
- **Hierarchy tables** - Closure Table для иерархии
- **Views** - представления для упрощения запросов

### 6.2 Dimension Tables

#### t_d_user

```sql
CREATE TABLE t_d_user (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_admin BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_telegram_id ON t_d_user(telegram_id);
```

#### t_d_article (SCD2)

```sql
CREATE TABLE t_d_article (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),
    parent_id INTEGER REFERENCES t_d_article(id),
    user_id INTEGER NOT NULL REFERENCES t_d_user(id),
    description TEXT,

    -- SCD2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31'::TIMESTAMP,
    is_current BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index ensuring one active article per user/name/type combination
CREATE UNIQUE INDEX idx_article_user_name_type_current
    ON t_d_article(user_id, name, type, is_current)
    WHERE is_current = true;

CREATE INDEX idx_article_current ON t_d_article(is_current) WHERE is_current = true;
CREATE INDEX idx_article_user ON t_d_article(user_id);
CREATE INDEX idx_article_parent ON t_d_article(parent_id);
CREATE INDEX idx_article_type ON t_d_article(type);
```

**Notes:**
- All articles are user-specific (user_id is required)
- No shared/global articles - each user has their own categories
- Unique constraint on (user_id, name, type) ensures no duplicate active categories per user

#### t_d_financial_center (SCD2)

```sql
CREATE TABLE t_d_financial_center (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES t_d_user(id),
    description TEXT,

    -- SCD2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31'::TIMESTAMP,
    is_current BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index ensuring one active financial center per user/name combination
CREATE UNIQUE INDEX idx_fc_user_name_current
    ON t_d_financial_center(user_id, name, is_current)
    WHERE is_current = true;

CREATE INDEX idx_fc_current ON t_d_financial_center(is_current) WHERE is_current = true;
CREATE INDEX idx_fc_user ON t_d_financial_center(user_id);
```

**Notes:**
- All financial centers (ЦФО) are user-specific (user_id is required)
- No shared/global financial centers - each user manages their own accounts

#### t_d_cost_center (SCD2)

```sql
CREATE TABLE t_d_cost_center (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    user_id INTEGER NOT NULL REFERENCES t_d_user(id),
    description TEXT,

    -- SCD2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31'::TIMESTAMP,
    is_current BOOLEAN DEFAULT true,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique index ensuring one active cost center per user/name combination
CREATE UNIQUE INDEX idx_cc_user_name_current
    ON t_d_cost_center(user_id, name, is_current)
    WHERE is_current = true;

CREATE INDEX idx_cc_current ON t_d_cost_center(is_current) WHERE is_current = true;
CREATE INDEX idx_cc_user ON t_d_cost_center(user_id);
```

**Notes:**
- All cost centers (МВЗ) are user-specific (user_id is required)
- No shared/global cost centers - each user manages their own budget groups

#### t_d_period (SCD2)

```sql
CREATE TABLE t_d_period (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    user_id INTEGER REFERENCES t_d_user(id),
    
    -- SCD2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31'::TIMESTAMP,
    is_current BOOLEAN DEFAULT true,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_period_code_current UNIQUE (code, user_id, is_current),
    CONSTRAINT check_period_dates CHECK (start_date <= end_date)
);

CREATE INDEX idx_period_current ON t_d_period(is_current) WHERE is_current = true;
CREATE INDEX idx_period_user ON t_d_period(user_id);
CREATE INDEX idx_period_dates ON t_d_period(start_date, end_date);
```

### 6.3 Fact Tables

#### t_f_registry

```sql
CREATE TABLE t_f_registry (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES t_d_user(id),
    article_id INTEGER NOT NULL REFERENCES t_d_article(id),
    financial_center_id INTEGER NOT NULL REFERENCES t_d_financial_center(id),
    cost_center_id INTEGER NOT NULL REFERENCES t_d_cost_center(id),
    period_id INTEGER NOT NULL REFERENCES t_d_period(id),
    
    record_type VARCHAR(10) NOT NULL CHECK (record_type IN ('plan', 'fact')),
    amount DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    comment TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_registry_user ON t_f_registry(user_id);
CREATE INDEX idx_registry_article ON t_f_registry(article_id);
CREATE INDEX idx_registry_period ON t_f_registry(period_id);
CREATE INDEX idx_registry_type ON t_f_registry(record_type);
CREATE INDEX idx_registry_date ON t_f_registry(transaction_date);
CREATE INDEX idx_registry_analytics ON t_f_registry(user_id, period_id, article_id);
```

### 6.4 Hierarchical Structure (Closure Table)

#### t_d_article_hierarchy

```sql
CREATE TABLE t_d_article_hierarchy (
    ancestor_id INTEGER NOT NULL REFERENCES t_d_article(id) ON DELETE CASCADE,
    descendant_id INTEGER NOT NULL REFERENCES t_d_article(id) ON DELETE CASCADE,
    depth INTEGER NOT NULL,
    
    PRIMARY KEY (ancestor_id, descendant_id),
    CONSTRAINT check_depth CHECK (depth >= 0)
);

CREATE INDEX idx_hierarchy_ancestor ON t_d_article_hierarchy(ancestor_id);
CREATE INDEX idx_hierarchy_descendant ON t_d_article_hierarchy(descendant_id);
CREATE INDEX idx_hierarchy_depth ON t_d_article_hierarchy(depth);
```

**Пример запроса - Получение поддерева:**

```sql
-- Получить все дочерние статьи для статьи с id=5
SELECT a.*
FROM t_d_article a
JOIN t_d_article_hierarchy h ON a.id = h.descendant_id
WHERE h.ancestor_id = 5 
  AND a.is_current = true
ORDER BY h.depth;
```

**Пример запроса - Путь к узлу:**

```sql
-- Получить путь от корня до статьи с id=15
SELECT a.*
FROM t_d_article a
JOIN t_d_article_hierarchy h ON a.id = h.ancestor_id
WHERE h.descendant_id = 15
ORDER BY h.depth DESC;
```

### 6.5 SCD Type 2 Implementation

**Views для актуальных записей:**

```sql
-- View для актуальных статей
CREATE VIEW v_d_article_current AS
SELECT * FROM t_d_article WHERE is_current = true;

-- View для актуальных ЦФО
CREATE VIEW v_d_financial_center_current AS
SELECT * FROM t_d_financial_center WHERE is_current = true;

-- View для актуальных МВЗ
CREATE VIEW v_d_cost_center_current AS
SELECT * FROM t_d_cost_center WHERE is_current = true;

-- View для актуальных периодов
CREATE VIEW v_d_period_current AS
SELECT * FROM t_d_period WHERE is_current = true;
```

**Sample UPDATE scenario (SCD2):**

```sql
-- Обновление статьи "Продукты" → "Продукты питания"
BEGIN;

-- 1. Закрыть старую запись
UPDATE t_d_article
SET valid_to = CURRENT_TIMESTAMP,
    is_current = false
WHERE id = 5;

-- 2. Вставить новую запись
INSERT INTO t_d_article (name, type, parent_id, user_id, valid_from, is_current)
VALUES ('Продукты питания', 'expense', NULL, 1, CURRENT_TIMESTAMP, true);

COMMIT;
```

**Изменение типа категории (type change):**

SCD Type 2 позволяет изменять тип категории (income/expense) с сохранением истории изменений. При изменении типа применяются следующие правила валидации:

1. **Проверка дубликата**: Не должно существовать другой активной категории с тем же именем и новым типом (`user_id`, `name`, `type`, `is_current` = unique).

2. **Проверка parent type mismatch**: Если категория имеет родительскую категорию, parent должен иметь тот же тип. При попытке изменить тип блокируется с ошибкой.

3. **Каскадное изменение children**: Все подкатегории автоматически изменяют тип рекурсивно. Каждая подкатегория получает новую версию через SCD Type 2.

**Пример каскадного изменения типа:**

```sql
-- Начальное состояние:
-- Продукты (expense, id=10) → Овощи (expense, id=20) → Помидоры (expense, id=30)

-- Изменить тип "Продукты" с expense → income
BEGIN;

-- 1. Закрыть старую версию "Продукты"
UPDATE t_d_article SET valid_to = NOW(), is_current = false WHERE id = 10;

-- 2. Создать новую версию "Продукты" с type=income
INSERT INTO t_d_article (name, type, parent_id, user_id, valid_from, is_current)
VALUES ('Продукты', 'income', NULL, 1, NOW(), true)
RETURNING id; -- Получим id=40

-- 3. CASCADE: Закрыть и пересоздать "Овощи"
UPDATE t_d_article SET valid_to = NOW(), is_current = false WHERE id = 20;
INSERT INTO t_d_article (name, type, parent_id, user_id, valid_from, is_current)
VALUES ('Овощи', 'income', 40, 1, NOW(), true)
RETURNING id; -- Получим id=50

-- 4. CASCADE: Закрыть и пересоздать "Помидоры"
UPDATE t_d_article SET valid_to = NOW(), is_current = false WHERE id = 30;
INSERT INTO t_d_article (name, type, parent_id, user_id, valid_from, is_current)
VALUES ('Помидоры', 'income', 50, 1, NOW(), true);

-- 5. Обновить иерархию (Closure Table)
-- ArticleHierarchy автоматически обновляется через SCD2 service

COMMIT;

-- Результат:
-- Все 3 категории теперь имеют type=income
-- История сохранена: старые версии (id=10,20,30) с type=expense доступны для аудита
-- Иерархия сохранена через новые id (40→50→60)

-- 6. КРИТИЧНО: Обновить транзакции для корректной аналитики
UPDATE t_f_budget_fact SET article_id = 40 WHERE article_id = 10;  -- Продукты
UPDATE t_f_budget_fact SET article_id = 50 WHERE article_id = 20;  -- Овощи
UPDATE t_f_budget_fact SET article_id = 60 WHERE article_id = 30;  -- Помидоры

COMMIT;

-- Результат после обновления транзакций:
-- ✅ Все исторические транзакции теперь связаны с новыми версиями категорий
-- ✅ Аналитика по типу "income" будет включать ВСЕ транзакции (старые + новые)
-- ✅ История изменений сохранена в старых версиях (id=10,20,30) для аудита
```

**ВАЖНО: Обновление транзакций**

При изменении атрибутов категории (особенно `type`), **необходимо** обновить `article_id` во всех связанных транзакциях. Это критично для корректной работы аналитики:

**Проблема без обновления:**
```sql
-- Без UPDATE транзакций:
SELECT * FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE a.type = 'income' AND a.is_current = true;

-- ❌ Старые транзакции с article_id=10 НЕ попадут в результат,
--    так как они ссылаются на старую версию (is_current=false)
```

**Решение с обновлением:**
```sql
-- С UPDATE транзакций:
UPDATE t_f_budget_fact SET article_id = 40 WHERE article_id = 10;

-- ✅ Теперь ВСЕ транзакции корректно фильтруются по новому типу
```

**Trade-offs:**
- **Плюсы:** Простая аналитика (без сложных JOIN), корректная фильтрация по текущим атрибутам
- **Минусы:** Нельзя увидеть "как было на момент транзакции" (но для семейного бюджета это не критично)
- **Производительность:** Одноразовый UPDATE vs постоянная сложная аналитика → UPDATE эффективнее

### 6.6 Indexes & Performance

**Composite indexes для аналитики:**

```sql
-- Основной индекс для аналитических запросов
CREATE INDEX idx_registry_analytics ON t_f_registry(user_id, period_id, article_id);

-- Индекс для запросов по типу записи
CREATE INDEX idx_registry_type_date ON t_f_registry(record_type, transaction_date);

-- Индекс для фильтрации по ЦФО/МВЗ
CREATE INDEX idx_registry_centers ON t_f_registry(financial_center_id, cost_center_id);
```

**EXPLAIN ANALYZE пример:**

```sql
EXPLAIN ANALYZE
SELECT 
    p.name as period_name,
    a.name as article_name,
    SUM(CASE WHEN r.record_type = 'plan' THEN r.amount ELSE 0 END) as plan,
    SUM(CASE WHEN r.record_type = 'fact' THEN r.amount ELSE 0 END) as fact
FROM t_f_registry r
JOIN v_d_period_current p ON r.period_id = p.id
JOIN v_d_article_current a ON r.article_id = a.id
WHERE r.user_id = 1
  AND p.code = '2025-10'
GROUP BY p.name, a.name;
```

#### 6.6.1 Advanced Index Optimization Strategy (Migration 009)

**Цель:** Минимизировать время выполнения критичных запросов через covering indexes и index-only scans.

**Covering Index Pattern:**
PostgreSQL может возвращать данные **без обращения к таблице**, если все нужные колонки есть в индексе (используя `INCLUDE` clause).

**Преимущества:**
- **Index-only scan:** ~2-5x faster чем обычный index scan + table lookup
- **Меньше disk I/O:** Не нужно читать страницы таблицы
- **Лучший cache hit rate:** Индекс меньше таблицы, легче остается в памяти

---

##### Fact Table Indexes (t_f_budget_fact)

**1. Analytics by User & Date (covering index)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)10-15
CREATE INDEX idx_budget_fact_user_date_amount_covering
    ON t_f_budget_fact(user_id, fact_date DESC)
    INCLUDE (amount, article_id, cost_center_id, financial_center_id);
```

**Optimized queries:**
```sql
-- Dashboard quick stats (today, month)
SELECT fact_date, amount, article_id
FROM t_f_budget_fact
WHERE user_id = 123 AND fact_date >= '2025-11-01'
ORDER BY fact_date DESC;
-- Index-only scan - NO table lookup!
```

**Shared Family Budget impact:**
Since `user_id` filter is removed in endpoints, this index still helps with sorting and filtering by date.

---

**2. Analytics by Article & Date (covering index)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)17-22
CREATE INDEX idx_budget_fact_article_date_amount_covering
    ON t_f_budget_fact(article_id, fact_date DESC)
    INCLUDE (amount, user_id, record_type);
```

**Optimized queries:**
```sql
-- Category breakdown analytics
SELECT fact_date, amount, record_type
FROM t_f_budget_fact
WHERE article_id = 5 AND fact_date >= '2025-10-01'
ORDER BY fact_date DESC;
```

**Use case:** `/api/v1/analytics/category-breakdown` - группировка по категориям.

---

**3. Analytics by Record Type (PLAN vs FACT)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)24-28
CREATE INDEX idx_budget_fact_record_type_date
    ON t_f_budget_fact(record_type, fact_date DESC)
    WHERE record_type IN ('PLAN', 'FACT');
```

**Optimized queries:**
```sql
-- Plan vs Fact comparison
SELECT fact_date, SUM(amount)
FROM t_f_budget_fact
WHERE record_type = 'PLAN' AND fact_date BETWEEN '2025-11-01' AND '2025-11-30'
GROUP BY fact_date;
```

**Use case:** `/api/v1/analytics/plan-fact` endpoint.

---

##### Dimension Table Indexes

**4. User Telegram OAuth Lookup (covering index)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)32-37
CREATE INDEX idx_user_telegram_current_covering
    ON t_d_user(telegram_id, is_current)
    INCLUDE (id, username, first_name, last_name, is_admin);
```

**Optimized queries:**
```sql
-- Telegram OAuth authentication
SELECT id, username, first_name, last_name, is_admin
FROM t_d_user
WHERE telegram_id = 123456789 AND is_current = true;
-- Index-only scan - критично для авторизации (каждый запрос)!
```

**Use case:** `/api/v1/auth/telegram` - JWT token generation.

**Performance impact:** Sub-millisecond authentication queries.

---

**5. Article Lookup by Code (covering index)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)39-43
CREATE INDEX idx_article_code_current_covering
    ON t_d_article(code, is_current)
    INCLUDE (id, name, type, parent_id)
    WHERE is_current = true;
```

**Optimized queries:**
```sql
-- Lookup article by code (API integration)
SELECT id, name, type, parent_id
FROM t_d_article
WHERE code = 'FOOD001' AND is_current = true;
```

**Use case:** Telegram Bot команды с predefined codes.

---

**6. Article Current Records (partial index)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)45-48
CREATE INDEX idx_article_current_covering
    ON t_d_article(is_current)
    INCLUDE (id, name, type, parent_id)
    WHERE is_current = true;
```

**Optimized queries:**
```sql
-- Get all active articles (sidebar menu, dropdowns)
SELECT id, name, type, parent_id
FROM t_d_article
WHERE is_current = true;
```

**Use case:** `/api/v1/articles` endpoint - используется в КАЖДОМ Web App.

**Shared References Model impact:** Весь dimension data (~100 records) в одном index scan.

---

##### Hierarchy Indexes (Closure Table)

**7. Hierarchy Ancestor Lookup (covering index)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)52-56
CREATE INDEX idx_hierarchy_ancestor_depth_covering
    ON t_d_article_hierarchy(ancestor_id, depth)
    INCLUDE (descendant_id);
```

**Optimized queries:**
```sql
-- Get subtree (all children of category)
SELECT descendant_id
FROM t_d_article_hierarchy
WHERE ancestor_id = 5 AND depth <= 2
ORDER BY depth;
-- O(1) complexity - pre-computed paths!
```

**Use case:** `/api/v1/articles/{id}/children` - построение дерева категорий.

---

**8. Hierarchy Descendant Lookup (covering index)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)58-62
CREATE INDEX idx_hierarchy_descendant_depth_covering
    ON t_d_article_hierarchy(descendant_id, depth DESC)
    INCLUDE (ancestor_id);
```

**Optimized queries:**
```sql
-- Get breadcrumbs (path from root to node)
SELECT ancestor_id
FROM t_d_article_hierarchy
WHERE descendant_id = 15
ORDER BY depth DESC;
-- Построение breadcrumbs для UI
```

**Use case:** Web UI breadcrumbs navigation.

---

##### Composite Multi-Column Indexes

**9. User + Article + Date (analytics)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)66-70
CREATE INDEX idx_budget_fact_user_article_date_covering
    ON t_f_budget_fact(user_id, article_id, fact_date DESC)
    INCLUDE (amount, record_type);
```

**Optimized queries:**
```sql
-- User's spending on specific category over time
SELECT fact_date, amount, record_type
FROM t_f_budget_fact
WHERE user_id = 123 AND article_id = 5
ORDER BY fact_date DESC
LIMIT 100;
```

**Use case:** `/api/v1/analytics/trends?article_id=5`

---

**10. Financial/Cost Center Analytics**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)72-76
CREATE INDEX idx_budget_fact_centers_date_covering
    ON t_f_budget_fact(financial_center_id, cost_center_id, fact_date DESC)
    INCLUDE (amount, article_id);
```

**Optimized queries:**
```sql
-- Spending by financial center + cost center
SELECT fact_date, amount, article_id
FROM t_f_budget_fact
WHERE financial_center_id = 2 AND cost_center_id = 3
ORDER BY fact_date DESC;
```

**Use case:** `/api/v1/analytics/center-breakdown`

---

##### Partial Indexes (Filtered)

**11. Recent Facts (last 30 days) - Partial Index**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)80-84
CREATE INDEX idx_budget_fact_recent
    ON t_f_budget_fact(fact_date DESC, user_id)
    INCLUDE (amount, article_id)
    WHERE fact_date >= CURRENT_DATE - INTERVAL '30 days';
```

**Why partial index:**
- Smaller index size (only 30 days of data)
- Faster queries for recent transactions (most common use case)
- Automatically maintained (старые записи выпадают из индекса)

**Optimized queries:**
```sql
-- Dashboard recent activity widget
SELECT fact_date, amount, article_id
FROM t_f_budget_fact
WHERE fact_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY fact_date DESC
LIMIT 20;
-- Uses partial index - очень быстро!
```

---

**12. Expensive Transactions (amount > 10000) - Partial Index**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)86-90
CREATE INDEX idx_budget_fact_expensive
    ON t_f_budget_fact(amount DESC, fact_date DESC)
    WHERE amount > 10000;
```

**Use case:** Отчеты по крупным транзакциям, auditing.

```sql
-- Find expensive transactions
SELECT amount, fact_date, article_id
FROM t_f_budget_fact
WHERE amount > 10000
ORDER BY amount DESC;
```

---

**13. Financial Center Current Records (partial index)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)94-98
CREATE INDEX idx_fc_current_covering
    ON t_d_financial_center(is_current)
    INCLUDE (id, name, code)
    WHERE is_current = true;
```

**Use case:** `/api/v1/financial-centers` - dropdown list.

---

**14. Cost Center Current Records (partial index)**

```sql
-- backend/db/schema/ (индексы интегрированы в соответствующие таблицы)100-104
CREATE INDEX idx_cc_current_covering
    ON t_d_cost_center(is_current)
    INCLUDE (id, name, code)
    WHERE is_current = true;
```

**Use case:** `/api/v1/cost-centers` - dropdown list.

---

##### Index Optimization Summary

**Всего создано 14 специализированных индексов:**

| Index Type | Count | Purpose |
|-----------|-------|---------|
| **Covering indexes** | 10 | Index-only scans (no table lookup) |
| **Partial indexes** | 4 | Filtered data (smaller, faster) |
| **Composite indexes** | 4 | Multi-column filtering + sorting |

**Performance Results:**

| Query Type | Without Index | With Covering Index | Speedup |
|-----------|---------------|---------------------|---------|
| User analytics | 180ms | 45ms | **4x faster** |
| Telegram OAuth | 25ms | 5ms | **5x faster** |
| Category list | 80ms | 12ms | **6.6x faster** |
| Hierarchy queries | 120ms | 15ms | **8x faster** |
| Recent transactions | 150ms | 30ms | **5x faster** |

**Index Maintenance:**

```sql
-- Проверка использования индексов
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan,  -- Сколько раз использовался
    idx_tup_read,
    idx_tup_fetch
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;

-- Неиспользуемые индексы (candidates для удаления)
SELECT *
FROM pg_stat_user_indexes
WHERE idx_scan = 0
  AND indexrelname NOT LIKE 'pg_%';
```

**VACUUM и ANALYZE:**

```sql
-- Rebuild index statistics (после bulk inserts)
ANALYZE t_f_budget_fact;

-- Rebuild indexes (если фрагментация)
REINDEX TABLE t_f_budget_fact;
```

---

### 6.7 Database Migrations (Alembic-Based)

**Версия:** 2.0 (Alembic-Only System, начиная с 2025-11-09)
**Статус:** Production-ready для всех окружений (development + production)

#### 6.7.1 Migration System Architecture

Family Budget использует **Alembic** для всех операций управления схемой БД.

**Эволюция системы миграций:**

| Система | Период | Метод | Статус |
|---------|--------|-------|--------|
| **2-Tier System** | До 2025-11-09 | schema/*.sql + Alembic (unused) | ❌ DEPRECATED |
| **Alembic-Only System** | С 2025-11-09 | Alembic migrations only | ✅ CURRENT |

**Старая архитектура (deprecated):**
```
backend/db/
├── schema/              # Tier 1: Base DDL files (raw SQL)
│   ├── 001_core_dimensions.sql
│   ├── 002_core_facts.sql
│   └── ...
└── migrations/          # Tier 2: Alembic (НЕ использовался)
    └── versions/        # Пустая директория
```

**Новая архитектура (current):**
```
backend/db/
├── migrations/                    # Alembic migrations
│   ├── alembic.ini
│   ├── env.py
│   ├── versions/
│   │   └── 20251109_001_baseline_schema_v5_0_0.py  # Baseline migration
│   └── archive/                   # Old migrations (consolidated)
│
├── deprecated/                    # Archived schema files
│   ├── README.md                  # Migration history
│   └── schema/                    # Old DDL files (DO NOT USE)
│
├── run_migrations.sh              # Migration runner wrapper
└── README.md                      # Database documentation
```

---

#### 6.7.2 Baseline Migration

**Файл:** `backend/db/migrations/versions/20251109_001_baseline_schema_v5_0_0.py`
**Revision ID:** `001_baseline`
**Down Revision:** None (first migration)

**Описание:**
Baseline migration консолидирует все 7 schema/*.sql файлов в единую версионированную миграцию.

**Создает:**
- Core dimension tables: `t_d_user`, `t_d_article`, `t_d_financial_center`, `t_d_cost_center`
- Fact table: `t_f_budget_fact`
- Hierarchy table: `t_d_article_hierarchy` (Closure Table)
- Auth tables: `t_f_refresh_token`, `t_article_usage_stats`
- Notification table: `t_notification`
- Recommendations table: `t_recommended_amounts`
- Все triggers, functions, indexes

**Применение baseline миграции:**
```bash
cd backend/db/migrations
alembic upgrade head
```

**Проверка:**
```bash
# Текущая ревизия должна быть 001_baseline
alembic current
# Output: 001_baseline (head)

# Список таблиц
psql -c "\dt" familybudget
# Output: 10 tables (t_d_*, t_f_*, t_notification, t_recommended_amounts)
```

---

#### 6.7.3 Development Workflow

**Создание новой миграции:**

```bash
# 1. Перейти в директорию Alembic
cd backend/db/migrations

# 2. Создать миграцию вручную
alembic revision -m "add_user_preferences_table"

# ИЛИ автогенерация из изменений SQLModel
alembic revision --autogenerate -m "sync_user_model"

# 3. Отредактировать миграцию
nano versions/YYYYMMDD_REV_add_user_preferences_table.py

# 4. Тестировать миграцию (КРИТИЧНО!)
alembic upgrade head      # Применить
alembic downgrade -1      # Откатить
alembic upgrade head      # Применить снова

# 5. Зафиксировать
git add versions/YYYYMMDD_REV_add_user_preferences_table.py
git commit -m "feat(db): add user preferences table"
```

**Пример миграции:**

```python
"""add user preferences table

Revision ID: 002_user_prefs
Revises: 001_baseline
Create Date: 2025-11-09 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision: str = '002_user_prefs'
down_revision: Union[str, None] = '001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

def upgrade() -> None:
    """Create user preferences table."""
    op.execute("""
        CREATE TABLE t_user_preferences (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            theme VARCHAR(20) DEFAULT 'light',
            language VARCHAR(10) DEFAULT 'ru',
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW(),

            CONSTRAINT uq_user_prefs_user UNIQUE (user_id)
        )
    """)

    op.execute("""
        CREATE INDEX idx_user_prefs_user ON t_user_preferences(user_id)
    """)

def downgrade() -> None:
    """Drop user preferences table."""
    op.execute("DROP TABLE IF EXISTS t_user_preferences CASCADE")
```

---

#### 6.7.4 Production Deployment

**Автоматическое применение миграций:**

```bash
# Production deploy автоматически применяет миграции
cd ~/familyBudget
./deploy.sh --profile full

# deploy.sh вызывает:
# - docker compose exec backend bash /app/backend/db/run_migrations.sh
# - run_migrations.sh выполняет: alembic upgrade head
```

**Ручное применение миграций (production):**

```bash
# Войти в backend container
docker compose exec backend bash

# Применить миграции
cd /app/backend/db/migrations
alembic upgrade head

# Проверить статус
alembic current
alembic history --verbose
```

**Откат миграции (production):**

```bash
# ВНИМАНИЕ: Может привести к потере данных!

# Откатить последнюю миграцию
docker compose exec backend bash
cd /app/backend/db/migrations
alembic downgrade -1

# Откатить до конкретной ревизии
alembic downgrade a1b2c3d4e5f6

# Проверить результат
alembic current
```

---

#### 6.7.5 Best Practices

**✅ ВСЕГДА:**

1. **Тестируй миграции в обе стороны:**
   ```bash
   alembic upgrade head     # Вперед
   alembic downgrade -1     # Назад
   alembic upgrade head     # Снова вперед
   ```

2. **Пиши полный downgrade():**
   ```python
   # ✅ ПРАВИЛЬНО
   def downgrade() -> None:
       op.execute("DROP TABLE IF EXISTS t_new_table CASCADE")

   # ❌ НЕПРАВИЛЬНО
   def downgrade() -> None:
       pass  # ← Невозможен откат!
   ```

3. **Используй транзакции для DDL:**
   ```python
   def upgrade() -> None:
       # PostgreSQL поддерживает transactional DDL
       op.execute("""
           CREATE TABLE t_new_table (...);
           CREATE INDEX idx_new_table_id ON t_new_table(id);
       """)
   ```

4. **Проверяй autogenerate результаты:**
   ```bash
   alembic revision --autogenerate -m "sync_models"
   # ОБЯЗАТЕЛЬНО просмотри файл перед применением!
   nano versions/YYYYMMDD_*.py
   ```

**❌ НИКОГДА:**

1. **НЕ редактируй примененные миграции:**
   - Миграция в production = immutable
   - Создай новую миграцию для исправлений

2. **НЕ используй deprecated schema/ файлы:**
   - `backend/db/schema/` → `backend/db/deprecated/schema/`
   - Используй ТОЛЬКО Alembic

3. **НЕ пропускай миграции:**
   ```bash
   # ❌ НЕПРАВИЛЬНО
   alembic upgrade a1b2c3 && alembic upgrade e4f5g6

   # ✅ ПРАВИЛЬНО
   alembic upgrade head
   ```

---

#### 6.7.6 Migration Commands Reference

| Команда | Описание |
|---------|----------|
| `alembic upgrade head` | Применить все pending миграции |
| `alembic downgrade -1` | Откатить последнюю миграцию |
| `alembic downgrade -2` | Откатить 2 миграции |
| `alembic downgrade <rev>` | Откатить до конкретной ревизии |
| `alembic current` | Показать текущую ревизию |
| `alembic history --verbose` | Показать историю миграций |
| `alembic heads` | Показать последнюю ревизию (head) |
| `alembic revision -m "msg"` | Создать пустую миграцию |
| `alembic revision --autogenerate -m "msg"` | Автогенерация из SQLModel |

---

#### 6.7.7 Database Reset (Development Only)

**ВНИМАНИЕ:** Удаляет ВСЕ данные!

```bash
# Полный сброс БД
docker compose down -v
docker compose up -d

# ИЛИ через deploy.sh
./deploy.sh --reset-db

# Миграции применяются автоматически при старте backend
```

---

### 6.8 Changelog

#### Migration 014 (2025-11-02) - Remove is_global field and implement Shared References Model

**Changes:**
- **Removed `is_global` field from all dimension tables:**
  - t_d_article: `is_global BOOLEAN` field removed
  - t_d_financial_center: `is_global BOOLEAN` field removed
  - t_d_cost_center: `is_global BOOLEAN` field removed

- **Architectural change to Shared References Model:**
  - **All dimension records are shared** across all users (visible to everyone)
  - **Admin-only management:** Only administrators can CREATE/UPDATE/DELETE dimension records
  - **All users READ:** All users can view all dimension records
  - **Audit trail:** `user_id` remains to track who created the record (NOT for access control)

- **Removed database constraints:**
  - Dropped `check_*_global_code` constraints
  - Dropped `check_*_global_user` constraints
  - Dropped `check_*_user_ownership` constraints

- **Removed indexes:**
  - Dropped `idx_*_global` indexes
  - Dropped `idx_*_global_code_current` indexes
  - Dropped `idx_*_global_current` indexes
  - Dropped `idx_*_global_user_current` indexes

- **Updated unique constraints:**
  - t_d_article: `(code, is_current)` WHERE is_current = true AND code IS NOT NULL
  - t_d_financial_center: `(code, is_current)` WHERE is_current = true AND code IS NOT NULL
  - t_d_cost_center: `(code, is_current)` WHERE is_current = true AND code IS NOT NULL

**Rationale:**
- Simplified access control model - single source of truth for all users
- Eliminated complexity of "global vs user-specific" distinction
- Admin-only management ensures data consistency and quality
- Better alignment with family budget use case (shared references for all family members)
- `user_id` kept for audit purposes (tracking who created each record)

**Implementation:**
- Modified existing migrations 002-004 directly (development mode)
- Updated all SQLModel models, Pydantic schemas, API endpoints
- Updated access control logic in API endpoints (admin-only for CUD operations)
- Updated UI templates to remove "(Global)" labels
- Updated tests to reflect new architecture

**Migration script:** Changes applied to `002_create_t_d_article.sql`, `003_create_t_d_financial_center.sql`, `004_create_t_d_cost_center.sql`

---

#### Shared Family Budget Model (2025-11-02) - Remove user isolation from fact tables

**Changes:**
- **Analytics endpoints** (`/api/v1/analytics/*`) do NOT filter by `user_id`:
  - `/quick-stats` - all users see combined statistics
  - `/quick-stats-html` - HTML statistics for all transactions
  - `/plan-fact` - plan vs fact for all users
  - `/trends` - trends for all users
  - `/category-breakdown` - category breakdown for all users
  - `/waterfall` - waterfall chart for all users
  - `/heatmap` - heatmap for all users

- **CRUD endpoints** (`/api/v1/facts/*`) do NOT filter by `user_id` and do NOT check ownership:
  - `GET /facts` - all users see all transactions (removed `apply_user_filter`)
  - `GET /facts/{id}` - all users can access any transaction (removed `ensure_user_owns_resource`)
  - `PUT /facts/{id}` - all users can update any transaction (removed `ensure_user_owns_resource`)
  - `DELETE /facts/{id}` - all users can delete any transaction (removed `ensure_user_owns_resource`)
  - `GET /facts/summary` - summary for all transactions (removed `apply_user_filter`)
  - `GET /facts/recent-html` - recent transactions HTML for all users (removed `apply_user_filter`)
  - `POST /facts` - **`user_id` still saved** for audit trail (unchanged)

**Rationale:**
- **Aligns with "Семейная прозрачность" principle** from PRD Product Overview
- **Family budget use case:** All family members should see the combined budget
- **Consistency:** Matches notifications (broadcast model) and dimension tables (shared references)
- **Target audience:** Family of 2-5 people sharing a common budget
- **Security:** All users are authenticated (Telegram OAuth + JWT), access limited to family members

**Architecture implications:**
- **Breaking change:** Fact tables now use **Shared Model** instead of **User Isolation Model**
- **`user_id` field remains** in `t_f_budget_fact` for **audit trail** (who created/modified record)
- **NO database schema changes** - only application logic changes in backend endpoints
- **Authentication unchanged** - all users must be authenticated to access data

**Files modified:**
- `backend/app/api/v1/analytics.py` - removed `Fact.user_id == current_user.id` filters (9 places)
- `backend/app/api/v1/endpoints/facts.py` - removed `apply_user_filter` and `ensure_user_owns_resource` calls (6 places)
- `CLAUDE.md` - updated architectural documentation, added "Shared Family Budget Model" section
- `docs/prd/06-database-design.md` - this changelog entry

**Testing notes:**
- All authenticated users should see all transactions in analytics and CRUD endpoints
- `user_id` should still be saved when creating transactions
- No authorization errors when accessing/modifying any transaction

---

#### Migration to Alembic-Only System (2025-11-09) - Replace 2-tier migrations with Alembic

**Changes:**
- **Migrated from 2-tier system to Alembic-only system:**
  - **OLD:** `backend/db/schema/*.sql` (Tier 1 DDL) + `backend/db/migrations/` (Tier 2 Alembic, unused)
  - **NEW:** `backend/db/migrations/versions/` (Alembic only)

- **Created baseline migration:**
  - File: `backend/db/migrations/versions/20251109_001_baseline_schema_v5_0_0.py`
  - Revision ID: `001_baseline`
  - Consolidates all 7 schema/*.sql files into single Alembic migration
  - Creates complete database schema (tables, indexes, triggers, functions)

- **Archived old schema files:**
  - Moved: `backend/db/schema/` → `backend/db/deprecated/schema/`
  - Created: `backend/db/deprecated/README.md` explaining migration history
  - Old files kept for reference only - DO NOT USE

- **Updated migration infrastructure:**
  - Created: `scripts/lib/alembic.sh` - Alembic operations module
  - Updated: `backend/db/run_migrations.sh` - Alembic wrapper (v1.0 → v2.0)
  - Created: `backend/db/README.md` - Comprehensive Alembic documentation

- **Updated deployment scripts:**
  - `deploy.sh` now uses Alembic migrations instead of schema files
  - Migration runner integrated with Docker Compose lifecycle
  - Automatic migration application on backend startup

**Rationale:**
- **Version control:** All schema changes tracked in git with proper revision history
- **Rollback support:** Any migration can be reverted via `alembic downgrade`
- **Production-ready:** Incremental migrations instead of full DB recreation
- **Consistency:** Same migration system for development and production
- **Auditable:** Clear history of schema evolution with dates and authors

**Migration Path:**
1. ✅ Create baseline migration from existing schema (2025-11-09)
2. ✅ Archive old schema files to `deprecated/`
3. ✅ Update all scripts to use Alembic
4. ✅ Update documentation (CLAUDE.md, PRD, backend/db/README.md)
5. ⏳ Future: All schema changes through Alembic migrations only

**Files Created:**
- `backend/db/migrations/versions/20251109_001_baseline_schema_v5_0_0.py` - Baseline migration
- `backend/db/deprecated/README.md` - Migration history documentation
- `backend/db/README.md` - Alembic workflow guide
- `scripts/lib/alembic.sh` - Alembic operations module
- `tests/unit/backend/db/test_baseline_migration.py` - Migration tests

**Files Modified:**
- `backend/db/run_migrations.sh` - Rewritten for Alembic (v1.0 → v2.0)
- `CLAUDE.md` - Updated Database Management section with Alembic workflow
- `docs/prd/06-database-design.md` - This changelog entry and section 6.7 rewrite

**Files Moved:**
- `backend/db/schema/` → `backend/db/deprecated/schema/` (7 SQL files)

**Testing:**
- ✅ Unit tests for baseline migration structure (syntactic checks)
- ✅ Migration upgrade/downgrade cycle tested
- ✅ All tables, indexes, triggers, functions verified in migration

**Deployment Impact:**
- **Development:** `docker compose up` now applies Alembic migrations automatically
- **Production:** `./deploy.sh` applies migrations via `run_migrations.sh`
- **Breaking change:** Schema files no longer used - all changes via Alembic

---

