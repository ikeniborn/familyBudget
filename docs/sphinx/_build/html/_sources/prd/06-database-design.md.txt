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
    telegram_id BIGINT NOT NULL,
    username VARCHAR(255),
    first_name VARCHAR(255),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,

    -- SCD Type 2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT check_user_valid_dates CHECK (valid_from < valid_to)
);

-- Unique constraint on telegram_id for current records
CREATE UNIQUE INDEX idx_user_telegram_current
    ON t_d_user(telegram_id, is_current)
    WHERE is_current = TRUE;

CREATE INDEX idx_user_current
    ON t_d_user(is_current)
    WHERE is_current = TRUE;
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

---

### 6.3.1 Transfer Support Fields

**Добавлено в версии:** v5.1.4+
**Branch:** `feature/ui-improvements-and-transfers`
**Статус:** ✅ IMPLEMENTED

**Описание:**
Поддержка переводов между Счетами реализована через дополнительное поле `transfer_id` в таблице фактов и расширение типов статей.

#### transfer_id (t_f_budget_fact)

**Назначение:** Связывает 2 транзакции, созданные одним переводом.

**Характеристики:**
- **Type:** `INTEGER NULL`
- **Index:** `ix_budget_fact_transfer_id` (B-tree)
- **Nullable:** `true` (обратная совместимость с existing facts)
- **Foreign Key:** Нет (логическая связь через одинаковое значение)

**Логика использования:**
- `transfer_id = NULL` → обычная транзакция (income/expense)
- `transfer_id != NULL` → транзакция является частью перевода

**Пример:**
```sql
-- Перевод 1000 руб из "Кошелек" в "Банк"
-- Создаются 2 связанные транзакции:

-- Факт 1: Списание с кошелька
INSERT INTO t_f_budget_fact (
    user_id, article_id, financial_center_id, amount,
    record_type, fact_date, transfer_id, description
) VALUES (
    1, 42, 1, 1000.00,  -- article_id=42 имеет type='debit'
    'fact', '2025-11-24', 100, 'Перевод в банк'
);

-- Факт 2: Пополнение банка
INSERT INTO t_f_budget_fact (
    user_id, article_id, financial_center_id, amount,
    record_type, fact_date, transfer_id, description
) VALUES (
    1, 43, 2, 1000.00,  -- article_id=43 имеет type='credit'
    'fact', '2025-11-24', 100, 'Перевод из кошелька'
);

-- Обе транзакции имеют transfer_id=100 → они связаны
```

**Генерация transfer_id:**
- Используется pattern: `MAX(transfer_id) + 1`
- Реализовано в: `backend/app/api/v1/endpoints/transfers.py::generate_transfer_id()`
- Thread-safe в PostgreSQL через SERIALIZABLE isolation level

**Индекс:**
```sql
CREATE INDEX ix_budget_fact_transfer_id
    ON t_f_budget_fact(transfer_id)
    WHERE transfer_id IS NOT NULL;
```

**Преимущества partial index:**
- Меньший размер индекса (индексируются только transfer facts)
- Быстрее queries для поиска связанных транзакций
- Не затрагивает обычные транзакции (transfer_id = NULL)

---

#### Article Types Extension

**Добавлено в версии:** v5.1.4+
**Alembic migration:** `20251124_add_debit_credit_types.py`

**Изменения в CHECK constraint:**

**Старый constraint (до v5.1.4):**
```sql
ALTER TABLE t_d_article ADD CONSTRAINT t_d_article_type_check
    CHECK (type IN ('income', 'expense'));
```

**Новый constraint (с v5.1.4):**
```sql
ALTER TABLE t_d_article ADD CONSTRAINT t_d_article_type_check
    CHECK (type IN ('income', 'expense', 'debit', 'credit'));
```

**Типы статей:**

| Type | Русский | Назначение | Использование |
|------|---------|------------|---------------|
| `income` | Доход | Обычные доходы | Зарплата, подработки, проценты |
| `expense` | Расход | Обычные расходы | Продукты, транспорт, развлечения |
| `debit` | Списание | Списание при переводе | "Из кошелька", "Со сбережений" |
| `credit` | Пополнение | Пополнение при переводе | "В банк", "На сбережения" |

**Особенности типов `debit` и `credit`:**

1. **User-defined categories:**
   - Пользователи создают собственные категории с типами `debit`/`credit`
   - Иерархическая структура поддерживается (подкатегории)
   - Коды генерируются автоматически: ART-{seq}

2. **Transfer validation:**
   - FROM article MUST have `type='debit'`
   - TO article MUST have `type='credit'`
   - Валидация на уровне backend API

3. **Analytics:**
   - `debit` транзакции суммируются с `expense` (списания)
   - `credit` транзакции суммируются с `income` (поступления)
   - Фильтры в аналитике: "Расходы" включает expense + debit

4. **Code generation:**
   - Переиспользуется существующая логика `generate_code()`
   - Нет отдельной последовательности TRF-{seq}
   - Все типы статей используют единую нумерацию ART-{seq}

**Пример категорий переводов:**

```sql
-- Пользователь создает категории для переводов
-- Категория списания
INSERT INTO t_d_article (name, type, code, description, user_id)
VALUES (
    'Списание с кошелька',
    'debit',
    'ART-150',  -- Автоматически сгенерирован
    'Перевод средств из кошелька',
    1
);

-- Категория пополнения
INSERT INTO t_d_article (name, type, code, description, user_id)
VALUES (
    'Пополнение банка',
    'credit',
    'ART-151',  -- Следующий код
    'Перевод средств в банк',
    1
);

-- Иерархическая структура (подкатегории)
-- Родительская категория
INSERT INTO t_d_article (name, type, code, description, user_id)
VALUES ('Переводы', 'debit', 'ART-152', 'Все переводы', 1);

-- Дочерняя категория
INSERT INTO t_d_article (name, type, code, description, parent_id, user_id)
VALUES (
    'На сбережения',
    'debit',
    'ART-153',
    'Перевод на накопления',
    (SELECT id FROM t_d_article WHERE code='ART-152'),
    1
);
```

---

#### Migration Strategy

**Alembic migration:**
```python
"""add debit/credit types for transfer categories

Revision ID: add_debit_credit_types
Revises: previous_revision
Create Date: 2025-11-24

"""

def upgrade() -> None:
    # 1. Drop old CHECK constraint
    op.drop_constraint('t_d_article_type_check', 't_d_article', type_='check')

    # 2. Create new CHECK constraint with debit/credit
    op.create_check_constraint(
        't_d_article_type_check',
        't_d_article',
        "type IN ('income', 'expense', 'debit', 'credit')"
    )

    # 3. Delete old static categories (if they exist)
    # TRF-OUT and TRF-IN from Phase 2 implementation
    op.execute("""
        DELETE FROM t_d_article
        WHERE code IN ('TRF-OUT', 'TRF-IN')
          AND is_current = true
    """)

def downgrade() -> None:
    # 1. Restore old CHECK constraint
    op.drop_constraint('t_d_article_type_check', 't_d_article', type_='check')
    op.create_check_constraint(
        't_d_article_type_check',
        't_d_article',
        "type IN ('income', 'expense')"
    )

    # 2. Recreate static categories TRF-OUT, TRF-IN
    # (Only if no user-created debit/credit categories exist)
```

**Data Migration:**
- ✅ Не требуется для existing facts (transfer_id = NULL)
- ✅ Старые категории TRF-OUT, TRF-IN удаляются (функционал в тестировании)
- ✅ Пользователи создают новые категории с типами debit/credit

---

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

-- View для актуальных Счетов (FinancialCenter)
CREATE VIEW v_d_financial_center_current AS
SELECT * FROM t_d_financial_center WHERE is_current = true;

-- View для актуальных Мест затрат (CostCenter)
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

При изменении атрибутов категории (особенно `type`) необходимо обновить `article_id` во всех связанных транзакциях для корректной работы аналитики. Без обновления старые транзакции не попадут в выборки по новым атрибутам, так как ссылаются на неактуальные версии (`is_current=false`).

### 6.6 Indexes & Performance

**Composite indexes для аналитики:**

```sql
-- Основной индекс для аналитических запросов
CREATE INDEX idx_registry_analytics ON t_f_registry(user_id, period_id, article_id);

-- Индекс для запросов по типу записи
CREATE INDEX idx_registry_type_date ON t_f_registry(record_type, transaction_date);

-- Индекс для фильтрации по Счету/Месту затрат
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

#### 6.6.1 Advanced Index Optimization

**Covering Index Pattern:** PostgreSQL использует index-only scans (без обращения к таблице) когда все нужные колонки есть в индексе через `INCLUDE` clause. Преимущества: ~2-5x быстрее, меньше disk I/O, лучший cache hit rate.

**Все индексы проекта (15 шт):**

| # | Название | Тип | Таблица | Назначение |
|---|----------|-----|---------|------------|
| 1 | idx_budget_fact_user_date_amount_covering | Covering | t_f_budget_fact | Dashboard quick stats по дате |
| 2 | idx_budget_fact_article_date_amount_covering | Covering | t_f_budget_fact | Category breakdown analytics |
| 3 | idx_budget_fact_record_type_date | Partial | t_f_budget_fact | Plan vs Fact comparison |
| 4 | idx_user_telegram_current_covering | Covering | t_d_user | Telegram OAuth (каждый запрос) |
| 5 | idx_article_code_current_covering | Covering | t_d_article | Lookup by code (Bot API) |
| 6 | idx_article_current_covering | Partial | t_d_article | Все Web Apps (dropdowns, меню) |
| 7 | idx_hierarchy_ancestor_depth_covering | Covering | t_d_article_hierarchy | Subtree queries (O(1)) |
| 8 | idx_hierarchy_descendant_depth_covering | Covering | t_d_article_hierarchy | Breadcrumbs navigation |
| 9 | idx_budget_fact_user_article_date_covering | Covering | t_f_budget_fact | Trends по категории |
| 10 | idx_budget_fact_centers_date_covering | Covering | t_f_budget_fact | Счет/Место затрат analytics |
| 11 | idx_budget_fact_recent | Partial | t_f_budget_fact | Dashboard widget (30 дней) |
| 12 | idx_budget_fact_expensive | Partial | t_f_budget_fact | Auditing (amount > 10000) |
| 13 | idx_fc_current_covering | Partial | t_d_financial_center | Счет dropdown |
| 14 | idx_cc_current_covering | Partial | t_d_cost_center | Место затрат dropdown |
| 15 | idx_t_f_budget_fact_*_description_trgm | GIN Trigram | t_f_budget_fact (96 партиций) | Full-text поиск по описанию (ILIKE) |

**Критичные индексы (детальные примеры):**

**#4: Telegram OAuth Lookup (sub-millisecond auth)**
```sql
CREATE INDEX idx_user_telegram_current_covering
    ON t_d_user(telegram_id, is_current)
    INCLUDE (id, username, first_name, is_admin);

-- Query: `/api/v1/auth/telegram`
SELECT id, username, first_name, is_admin
FROM t_d_user
WHERE telegram_id = 123456789 AND is_current = true;
-- Index-only scan - критично для каждого запроса!
```

**#6: Article Current Records (каждый Web App)**
```sql
CREATE INDEX idx_article_current_covering
    ON t_d_article(is_current)
    INCLUDE (id, name, type, parent_id)
    WHERE is_current = true;

-- Query: `/api/v1/articles` (sidebar, dropdowns)
SELECT id, name, type, parent_id FROM t_d_article WHERE is_current = true;
-- Shared References Model: ~100 records в одном scan
```

**#7: Hierarchy Ancestor Lookup (O(1) Closure Table)**
```sql
CREATE INDEX idx_hierarchy_ancestor_depth_covering
    ON t_d_article_hierarchy(ancestor_id, depth)
    INCLUDE (descendant_id);

-- Query: `/api/v1/articles/{id}/children`
SELECT descendant_id FROM t_d_article_hierarchy
WHERE ancestor_id = 5 AND depth <= 2 ORDER BY depth;
-- O(1) complexity - pre-computed paths!
```

**#11: Recent Facts Partial Index (most common use case)**
```sql
CREATE INDEX idx_budget_fact_recent
    ON t_f_budget_fact(fact_date DESC, user_id)
    INCLUDE (amount, article_id)
    WHERE fact_date >= CURRENT_DATE - INTERVAL '30 days';

-- Query: Dashboard recent activity widget
SELECT fact_date, amount, article_id FROM t_f_budget_fact
WHERE fact_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY fact_date DESC LIMIT 20;
-- Partial index автоматически maintained, только 30 дней данных
```

**#1: Dashboard Quick Stats**
```sql
CREATE INDEX idx_budget_fact_user_date_amount_covering
    ON t_f_budget_fact(user_id, fact_date DESC)
    INCLUDE (amount, article_id, cost_center_id, financial_center_id);

-- Query: Dashboard today/month stats
SELECT fact_date, amount, article_id FROM t_f_budget_fact
WHERE user_id = 123 AND fact_date >= '2025-11-01'
ORDER BY fact_date DESC;
```

**#15: Full-Text Search with GIN Trigram (Partitioned Table)**
```sql
-- Требует расширение pg_trgm
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Индекс создается на КАЖДОЙ партиции (96 индексов для 2023-01..2030-12)
-- Автоматизировано через Alembic миграцию 713fcefee450
CREATE INDEX idx_t_f_budget_fact_2025_11_description_trgm
    ON t_f_budget_fact_2025_11
    USING gin (description gin_trgm_ops);

-- Query: `/api/v1/admin/facts?search=продукты`
SELECT * FROM t_f_budget_fact
WHERE description ILIKE '%продукты%'
ORDER BY fact_date DESC LIMIT 50;

-- PostgreSQL автоматически использует GIN индексы на партициях
-- Trigram matching: быстрый fuzzy search с учетом опечаток
```

**Почему GIN на партициях:**
- **Партиционирование по месяцам:** 96 партиций (2023-01 → 2030-12)
- **Проблема:** Индекс `ON ONLY parent_table` НЕ работает для партиций
- **Решение:** Создан GIN индекс на КАЖДОЙ партиции через Alembic
- **Автоматизация:** Миграция динамически находит все партиции
- **Производительность:** ~10x speedup для ILIKE queries на больших данных
- **Maintenance:** Новые партиции автоматически индексируются при создании

**Performance Results:**

| Query Type | Without Index | With Covering Index | Speedup |
|-----------|---------------|---------------------|---------|
| Telegram OAuth | 25ms | 5ms | 5x |
| Category list | 80ms | 12ms | 6.6x |
| Hierarchy queries | 120ms | 15ms | 8x |
| Dashboard widget | 150ms | 30ms | 5x |
| Full-text search (ILIKE) | 500ms (Seq Scan) | 50ms (GIN Trigram) | 10x |

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

**Всегда:**
- Тестируй миграции в обе стороны: `upgrade head` → `downgrade -1` → `upgrade head`
- Пиши полный `downgrade()` (не `pass`!)
- Используй транзакции для DDL (PostgreSQL поддерживает transactional DDL)
- Проверяй autogenerate результаты перед применением

**Никогда:**
- НЕ редактируй примененные миграции (immutable в production)
- НЕ используй deprecated `backend/db/schema/` (только Alembic)
- НЕ пропускай миграции (только `alembic upgrade head`)

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

### 6.8 Changelog

#### 2025-11-09: Migration to Alembic-Only System
- **Что изменилось:** Заменена 2-tier система (schema/*.sql + unused Alembic) на Alembic-only. Создана baseline migration консолидирующая все 7 schema файлов. Старые SQL файлы перемещены в `backend/db/deprecated/`.
- **Почему:** Версионный контроль схемы БД, rollback support, production-ready incremental migrations.
- **Затронутые компоненты:** `backend/db/migrations/`, `scripts/lib/alembic.sh`, `deploy.sh`, `CLAUDE.md`, документация ПРД.

#### 2025-11-02: Shared References Model
- **Что изменилось:** Удалено поле `is_global` из всех dimension tables. Все справочники (articles, financial centers, cost centers) теперь shared для всех пользователей. Admin-only управление для CREATE/UPDATE/DELETE операций.
- **Почему:** Упрощение модели доступа, align с семейным бюджетом (2-5 человек), single source of truth.
- **Затронутые компоненты:** `t_d_article`, `t_d_financial_center`, `t_d_cost_center`, API endpoints, UI templates.

#### 2025-11-02: Shared Family Budget Model
- **Что изменилось:** Удалена user_id фильтрация из analytics и CRUD endpoints для fact tables. Все пользователи видят все транзакции. `user_id` сохраняется только для audit trail.
- **Почему:** "Семейная прозрачность" - семья должна видеть общий бюджет.
- **Затронутые компоненты:** `/api/v1/analytics/*`, `/api/v1/facts/*`, `CLAUDE.md`.

---

