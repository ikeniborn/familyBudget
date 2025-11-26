# User Model Foreign Key Dependencies Analysis

**Created:** 2025-11-26
**Status:** Analysis Complete
**Version:** 1.0

---

## Обзор

Этот документ содержит полный анализ всех Foreign Key зависимостей к таблице `t_d_user.id`.
Используется для планирования миграции из SCD Type 2 → SCD Type 1 + History.

**КРИТИЧНО:** При миграции User model из SCD2 в SCD1 нужно гарантировать что:
1. Все FK в fact таблицах остаются валидными (указывают на стабильный `user.id`)
2. История пользователей корректно переносится в `t_d_user_history`
3. Integrity constraints не нарушаются

---

## FK Dependencies (полный список)

### 1. **t_f_budget_fact.user_id** ⚠️ КРИТИЧНО

**Описание:**
- Fact table для budget transactions (income/expense)
- User who created this transaction
- Используется в **ВСЕХ** queries к транзакциям

**FK Details:**
```python
user_id: int = Field(
    nullable=False,
    foreign_key="t_d_user.id",
    index=True,
    description="User who created this transaction"
)
```

**Migration Impact:**
- ⚠️ **КРИТИЧЕСКАЯ зависимость** - миллионы records в production
- FK должен указывать на **стабильный** `user.id` (НЕ на версионированный SCD2 id)
- При миграции: нужно переназначить все `user_id` на новые стабильные IDs

**Migration Strategy:**
```sql
-- BEFORE migration: Map old versioned IDs → new stable IDs
CREATE TEMP TABLE user_id_mapping AS
SELECT
    old_scd2.id AS old_id,
    new_stable.id AS new_id,
    old_scd2.telegram_id
FROM t_d_user old_scd2
JOIN t_d_user_new new_stable ON old_scd2.telegram_id = new_stable.telegram_id
WHERE old_scd2.is_current = TRUE;

-- Update FK in t_f_budget_fact
UPDATE t_f_budget_fact f
SET user_id = m.new_id
FROM user_id_mapping m
WHERE f.user_id = m.old_id;
```

**Verification:**
```sql
-- Check no orphaned FKs
SELECT COUNT(*) FROM t_f_budget_fact f
WHERE NOT EXISTS (SELECT 1 FROM t_d_user u WHERE u.id = f.user_id);
-- Expected: 0
```

---

### 2. **t_d_article.user_id**

**Описание:**
- Dimension table для budget categories (Articles)
- Owner user ID (creator for audit trail)
- Используется для Shared References (все видят все категории, но user_id - audit)

**FK Details:**
```python
user_id: int = Field(
    foreign_key="t_d_user.id",
    index=True,
    nullable=False,
    description="Owner user ID (required - all articles are user-specific)"
)
```

**Migration Impact:**
- **MODERATE impact** - несколько сотен records
- FK должен указывать на стабильный `user.id`
- При миграции: переназначить `user_id` на новые стабильные IDs

**Migration Strategy:**
```sql
-- Same strategy as t_f_budget_fact
UPDATE t_d_article a
SET user_id = m.new_id
FROM user_id_mapping m
WHERE a.user_id = m.old_id;
```

**Verification:**
```sql
SELECT COUNT(*) FROM t_d_article a
WHERE NOT EXISTS (SELECT 1 FROM t_d_user u WHERE u.id = a.user_id);
-- Expected: 0
```

---

### 3. **t_d_financial_center.user_id**

**Описание:**
- Dimension table для Financial Centers (ЦФО)
- Owner user ID (creator for audit trail)

**FK Details:**
```sql
-- From migration: backend/db/migrations/versions/20251110_*.py
user_id INT REFERENCES t_d_user(id) ON DELETE CASCADE
```

**Migration Impact:**
- **LOW impact** - десятки records
- FK должен указывать на стабильный `user.id`

**Migration Strategy:**
```sql
UPDATE t_d_financial_center fc
SET user_id = m.new_id
FROM user_id_mapping m
WHERE fc.user_id = m.old_id;
```

---

### 4. **t_d_cost_center.user_id**

**Описание:**
- Dimension table для Cost Centers (МВЗ)
- Owner user ID (creator for audit trail)

**FK Details:**
```sql
-- From migration
user_id INT REFERENCES t_d_user(id) ON DELETE CASCADE
```

**Migration Impact:**
- **LOW impact** - десятки records
- FK должен указывать на стабильный `user.id`

**Migration Strategy:**
```sql
UPDATE t_d_cost_center cc
SET user_id = m.new_id
FROM user_id_mapping m
WHERE cc.user_id = m.old_id;
```

---

### 5. **t_import_staging.user_id**

**Описание:**
- Staging table для Tinkoff CSV import
- User who uploaded CSV import

**FK Details:**
```python
user_id: int = Field(
    nullable=False,
    foreign_key="t_d_user.id",
    index=True,
    description="User who uploaded this CSV import"
)
```

**Migration Impact:**
- **MINIMAL impact** - staging table, периодически очищается
- FK должен указывать на стабильный `user.id`

**Migration Strategy:**
```sql
UPDATE t_import_staging s
SET user_id = m.new_id
FROM user_id_mapping m
WHERE s.user_id = m.old_id;
```

---

### 6. **History Tables: changed_by_user_id**

**Описание:**
- `t_d_article_history.changed_by_user_id`
- `t_d_financial_center_history.changed_by_user_id`
- `t_d_cost_center_history.changed_by_user_id`
- Audit field: who made the change (NULL for auto changes)

**FK Details:**
```sql
-- From migration
changed_by_user_id INT REFERENCES t_d_user(id) ON DELETE SET NULL
```

**Migration Impact:**
- **LOW impact** - история изменений, обычно NULL
- FK должен указывать на стабильный `user.id`

**Migration Strategy:**
```sql
-- Update non-NULL changed_by_user_id
UPDATE t_d_article_history h
SET changed_by_user_id = m.new_id
FROM user_id_mapping m
WHERE h.changed_by_user_id = m.old_id;

-- Same for other history tables
UPDATE t_d_financial_center_history h
SET changed_by_user_id = m.new_id
FROM user_id_mapping m
WHERE h.changed_by_user_id = m.old_id;

UPDATE t_d_cost_center_history h
SET changed_by_user_id = m.new_id
FROM user_id_mapping m
WHERE h.changed_by_user_id = m.old_id;
```

---

## Migration Strategy: FK Update Sequence

**Последовательность обновления FK (КРИТИЧНО - порядок важен!):**

### Phase 1: Preparation (before schema changes)

```sql
BEGIN; -- Atomic transaction

-- 1. Create mapping table (old versioned ID → new stable ID)
CREATE TEMP TABLE user_id_mapping AS
SELECT
    old.id AS old_id,
    ROW_NUMBER() OVER (ORDER BY old.created_at) AS new_id,
    old.telegram_id,
    old.username,
    old.is_current
FROM t_d_user old
WHERE old.is_current = TRUE;

-- 2. Verify mapping is complete (no missing users)
DO $$
DECLARE
    missing_count INT;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM t_d_user u
    WHERE u.is_current = TRUE
      AND NOT EXISTS (SELECT 1 FROM user_id_mapping m WHERE m.old_id = u.id);

    IF missing_count > 0 THEN
        RAISE EXCEPTION 'Migration aborted: % users missing from mapping', missing_count;
    END IF;
END $$;
```

### Phase 2: Update FKs (in dependency order)

**Порядок обновления:**
1. Dimension tables (t_d_article, t_d_financial_center, t_d_cost_center)
2. History tables (t_d_*_history.changed_by_user_id)
3. Staging tables (t_import_staging)
4. **Fact tables last** (t_f_budget_fact) - КРИТИЧНО, наибольший объём

```sql
-- 1. Update dimension tables
UPDATE t_d_article SET user_id = m.new_id
FROM user_id_mapping m WHERE user_id = m.old_id;

UPDATE t_d_financial_center SET user_id = m.new_id
FROM user_id_mapping m WHERE user_id = m.old_id;

UPDATE t_d_cost_center SET user_id = m.new_id
FROM user_id_mapping m WHERE user_id = m.old_id;

-- 2. Update history tables (changed_by_user_id, can be NULL)
UPDATE t_d_article_history SET changed_by_user_id = m.new_id
FROM user_id_mapping m WHERE changed_by_user_id = m.old_id;

UPDATE t_d_financial_center_history SET changed_by_user_id = m.new_id
FROM user_id_mapping m WHERE changed_by_user_id = m.old_id;

UPDATE t_d_cost_center_history SET changed_by_user_id = m.new_id
FROM user_id_mapping m WHERE changed_by_user_id = m.old_id;

-- 3. Update staging table
UPDATE t_import_staging SET user_id = m.new_id
FROM user_id_mapping m WHERE user_id = m.old_id;

-- 4. Update fact table (КРИТИЧНО - миллионы records)
-- Use batching for large tables
DO $$
DECLARE
    batch_size INT := 10000;
    updated INT;
BEGIN
    LOOP
        UPDATE t_f_budget_fact f
        SET user_id = m.new_id
        FROM user_id_mapping m
        WHERE f.user_id = m.old_id
          AND f.id IN (
              SELECT id FROM t_f_budget_fact
              WHERE user_id IN (SELECT old_id FROM user_id_mapping)
              LIMIT batch_size
          );

        GET DIAGNOSTICS updated = ROW_COUNT;
        EXIT WHEN updated = 0;

        RAISE NOTICE 'Updated % rows in t_f_budget_fact', updated;
    END LOOP;
END $$;
```

### Phase 3: Verification (before schema changes)

```sql
-- Verify NO orphaned FKs in any table
DO $$
DECLARE
    orphaned_facts INT;
    orphaned_articles INT;
    orphaned_fc INT;
    orphaned_cc INT;
    orphaned_staging INT;
BEGIN
    -- Check t_f_budget_fact
    SELECT COUNT(*) INTO orphaned_facts
    FROM t_f_budget_fact f
    WHERE NOT EXISTS (SELECT 1 FROM user_id_mapping m WHERE m.new_id = f.user_id);

    -- Check t_d_article
    SELECT COUNT(*) INTO orphaned_articles
    FROM t_d_article a
    WHERE NOT EXISTS (SELECT 1 FROM user_id_mapping m WHERE m.new_id = a.user_id);

    -- Check t_d_financial_center
    SELECT COUNT(*) INTO orphaned_fc
    FROM t_d_financial_center fc
    WHERE NOT EXISTS (SELECT 1 FROM user_id_mapping m WHERE m.new_id = fc.user_id);

    -- Check t_d_cost_center
    SELECT COUNT(*) INTO orphaned_cc
    FROM t_d_cost_center cc
    WHERE NOT EXISTS (SELECT 1 FROM user_id_mapping m WHERE m.new_id = cc.user_id);

    -- Check t_import_staging
    SELECT COUNT(*) INTO orphaned_staging
    FROM t_import_staging s
    WHERE NOT EXISTS (SELECT 1 FROM user_id_mapping m WHERE m.new_id = s.user_id);

    -- Report results
    RAISE NOTICE 'Orphaned FK verification:';
    RAISE NOTICE '  t_f_budget_fact: %', orphaned_facts;
    RAISE NOTICE '  t_d_article: %', orphaned_articles;
    RAISE NOTICE '  t_d_financial_center: %', orphaned_fc;
    RAISE NOTICE '  t_d_cost_center: %', orphaned_cc;
    RAISE NOTICE '  t_import_staging: %', orphaned_staging;

    IF orphaned_facts > 0 OR orphaned_articles > 0 OR orphaned_fc > 0 OR orphaned_cc > 0 OR orphaned_staging > 0 THEN
        RAISE EXCEPTION 'Migration aborted: orphaned FKs detected!';
    END IF;

    RAISE NOTICE 'FK verification: ✓ PASSED (no orphaned FKs)';
END $$;

COMMIT; -- Commit if all verifications passed
```

### Phase 4: Schema Changes (after FK updates)

После успешного обновления FK можно приступать к schema changes:
1. Create new `t_d_user` table (SCD1) with stable IDs
2. Create new `t_d_user_history` table (SCD2)
3. Migrate data: old t_d_user → new t_d_user + t_d_user_history
4. Drop old t_d_user table
5. Rename new tables

---

## Риски и Митигация

### Риск 1: Orphaned FKs (КРИТИЧНО)

**Описание:**
FK в fact таблицах указывают на несуществующие `user.id` после миграции.

**Вероятность:** Высокая (если миграция выполнена некорректно)

**Влияние:** Критическое (data corruption, CASCADE DELETE может удалить данные)

**Митигация:**
1. **Pre-migration checks:** Проверка что ВСЕ current users имеют mapping
2. **Atomic transaction:** Вся миграция в одной транзакции (ROLLBACK при ошибке)
3. **Post-migration verification:** Проверка что нет orphaned FKs
4. **Backup:** Обязательный backup БД перед миграцией

### Риск 2: Performance degradation при обновлении миллионов FKs

**Описание:**
Обновление `t_f_budget_fact.user_id` может занять несколько минут (миллионы records).

**Вероятность:** Средняя

**Влияние:** Среднее (downtime при миграции)

**Митигация:**
1. **Batching:** Обновление по 10,000 records за раз
2. **Progress logging:** RAISE NOTICE для мониторинга прогресса
3. **Maintenance window:** Выполнять миграцию в нерабочее время
4. **Testing на staging:** Измерить время миграции на копии production БД

### Риск 3: Constraint violations при schema changes

**Описание:**
FK constraints могут блокировать schema changes (переименование таблиц, drop columns).

**Вероятность:** Средняя

**Влияние:** Среднее (миграция failed, нужен ROLLBACK)

**Митигация:**
1. **FK update BEFORE schema changes:** Сначала обновить все FKs, потом схему
2. **Deferred constraints:** Использовать DEFERRABLE constraints если возможно
3. **Testing:** Протестировать полную миграцию на staging

---

## Выводы

### Итоги анализа

1. **Всего найдено:** 8 FK зависимостей к `t_d_user.id`
2. **Критические:** 1 (t_f_budget_fact.user_id)
3. **Moderate impact:** 3 (t_d_article, t_d_financial_center, t_d_cost_center)
4. **Low impact:** 4 (history tables, staging)

### Стратегия миграции FK

**Ключевые принципы:**
1. ✅ **Атомарность:** Вся миграция в одной транзакции
2. ✅ **Mapping table:** Создать временную таблицу (old_id → new_stable_id)
3. ✅ **Порядок обновления:** Dimensions → History → Staging → Facts (последними)
4. ✅ **Verification:** Проверка на orphaned FKs **ДО** schema changes
5. ✅ **Rollback plan:** Backup БД + ROLLBACK при ошибке

### Готовность к Phase 2

- ✅ Все FK зависимости задокументированы
- ✅ Migration strategy определена
- ✅ Risks и mitigation описаны
- ✅ Verification queries готовы
- ➡️ **Готово для Phase 2: Alembic Migration**

---

**Status:** ✅ Analysis Complete
**Next:** Phase 2 - Alembic Migration (use this document for FK update strategy)
