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

### 6.7 Database Migrations

Рекомендуется использовать Alembic для управления миграциями базы данных.

**Пример команды инициализации:**

```bash
# Инициализация Alembic
alembic init alembic

# Создание первой миграции
alembic revision -m "initial schema"

# Применение миграции
alembic upgrade head
```

---

### 6.8 Changelog

#### Migration 014 (2025-10-24) - Remove code and is_global fields

**Changes:**
- **Removed fields from all dimension tables:**
  - `code` field removed from t_d_article, t_d_financial_center, t_d_cost_center
  - `is_global` field removed from t_d_article, t_d_financial_center, t_d_cost_center

- **Data ownership simplified:**
  - All dimension records are now user-specific (user_id is NOT NULL)
  - Removed concept of "global" shared records
  - Former global records migrated to admin user

- **Unique constraints updated:**
  - t_d_article: `(user_id, name, type, is_current)` WHERE is_current = true
  - t_d_financial_center: `(user_id, name, is_current)` WHERE is_current = true
  - t_d_cost_center: `(user_id, name, is_current)` WHERE is_current = true

**Rationale:**
- The `code` field was optional in UI but caused validation errors when left empty
- The `code` field was not in original PRD requirements
- The `is_global` field was not in original PRD requirements
- Simplified data model - each user has complete control over their own dimension records
- Improved data integrity with name-based uniqueness per user

**Migration script:** `backend/db/migrations/014_remove_code_and_is_global_fields.sql`

---

