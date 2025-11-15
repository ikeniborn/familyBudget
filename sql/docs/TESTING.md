# Testing Documentation

## 📋 Обзор

Comprehensive test suite для проверки всех аспектов параллельного SQL executor и работы с PostgreSQL.

**Философия тестирования:**
- ✅ **Без воздействия на реальные данные** - все тесты используют временную таблицу
- ✅ **Автоматическая очистка** - все тестовые артефакты удаляются после завершения
- ✅ **Комплексное покрытие** - Connection, DDL, DML, Indexes, Parallel execution
- ✅ **Изолированная среда** - Python virtual environment для зависимостей

---

## 🧪 Структура тестов

### Test Suite Components

```
scripts/
├── setup_and_test.sh           # Главный тестовый скрипт
└── tests/                      # Тестовые SQL файлы
    ├── 01_test_connection.sql      # Connection & Permissions
    ├── 02_test_create_table.sql    # DDL (CREATE TABLE)
    ├── 03_test_create_indexes.sql  # Index creation
    ├── 04_test_insert_batch.sql    # Batch INSERT (parallel)
    ├── 05_test_update_records.sql  # UPDATE (SCD Type 2)
    ├── 06_test_delete_records.sql  # DELETE (Hard & Soft)
    └── 07_test_cleanup.sql         # Cleanup artifacts
```

---

## 🚀 Запуск тестов

### Quick Start

```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql/scripts
./setup_and_test.sh
```

**Что происходит:**

1. **Phase 1: Environment Setup**
   - Проверка Python 3
   - Создание virtual environment
   - Установка зависимостей (asyncpg, python-dotenv, rich)
   - Проверка postgresql.env

2. **Phase 2: Database Tests** (7 тестов)
   - Test 1: Connection & Permissions
   - Test 2: Table Creation
   - Test 3: Indexes
   - Test 4: Batch Insert (parallel execution)
   - Test 5: Update Records (SCD Type 2 pattern)
   - Test 6: Delete Records (hard & soft delete)
   - Test 7: Cleanup (автоматическое удаление)

3. **Phase 3: Summary**
   - Статистика (Passed/Failed)
   - Next steps если все тесты прошли
   - Troubleshooting если есть failures

---

## 📝 Детальное описание тестов

### Test 1: Connection & Permissions

**Файл:** `01_test_connection.sql`

**Проверяет:**
- ✓ Подключение к PostgreSQL
- ✓ Database credentials
- ✓ CREATE permission на schema 'public'
- ✓ Базовые connection parameters

**SQL операции:**
```sql
SELECT current_database(), current_user, version();
SELECT has_schema_privilege(current_user, 'public', 'CREATE');
SELECT inet_server_addr(), inet_server_port(), pg_backend_pid();
```

**Expected output:**
- Database name: familybudget
- User: familybudget
- CREATE permission: TRUE

---

### Test 2: Table Creation (DDL)

**Файл:** `02_test_create_table.sql`

**Проверяет:**
- ✓ DDL permissions
- ✓ CREATE TABLE capability
- ✓ SCD Type 2 pattern implementation

**Создает тестовую таблицу:**
```sql
CREATE TABLE test_parallel_executor (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) DEFAULT 0,
    is_current BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Особенности:**
- SCD Type 2 fields: `is_current`, `valid_from`, `valid_to`
- Serial primary key
- Default values
- Timestamps

---

### Test 3: Indexes

**Файл:** `03_test_create_indexes.sql`

**Проверяет:**
- ✓ CREATE INDEX capability
- ✓ Unique constraint indexes
- ✓ Partial indexes (WHERE clause)
- ✓ Composite indexes

**Создает 3 индекса:**

1. **Unique constraint** (для SCD Type 2):
   ```sql
   CREATE UNIQUE INDEX idx_test_code_current
   ON test_parallel_executor (code, is_current)
   WHERE is_current = TRUE;
   ```

2. **Valid period index** (для temporal queries):
   ```sql
   CREATE INDEX idx_test_valid_period
   ON test_parallel_executor (valid_from, valid_to);
   ```

3. **Partial index** (для amount > 0):
   ```sql
   CREATE INDEX idx_test_amount
   ON test_parallel_executor (amount)
   WHERE amount > 0;
   ```

---

### Test 4: Batch Insert (Parallel Execution)

**Файл:** `04_test_insert_batch.sql`

**Проверяет:**
- ✓ Parallel INSERT execution
- ✓ Batch processing (BEGIN...COMMIT blocks)
- ✓ Connection pooling
- ✓ Throughput performance

**Данные:**
- 100 записей в 2 батчах (50 + 50)
- Коды: TEST_001 ... TEST_100
- Amounts: 100.00 ... 10000.00

**Батчи:**
```sql
BEGIN;
INSERT INTO test_parallel_executor (code, name, amount, is_current, valid_from)
VALUES
    ('TEST_001', 'Test Record 001', 100.00, TRUE, CURRENT_TIMESTAMP),
    ('TEST_002', 'Test Record 002', 200.00, TRUE, CURRENT_TIMESTAMP),
    ...
    ('TEST_050', 'Test Record 050', 5000.00, TRUE, CURRENT_TIMESTAMP);
COMMIT;
```

**Проверяет:**
- Total records: 100
- Current records: 100 (все is_current = TRUE)
- Total amount: 505000.00
- Min/Max/Avg amounts

---

### Test 5: Update Records (SCD Type 2)

**Файл:** `05_test_update_records.sql`

**Проверяет:**
- ✓ SCD Type 2 versioning
- ✓ UPDATE operations
- ✓ Historical tracking

**Операции:**

1. **SCD Type 2 Update** (TEST_001):
   ```sql
   -- Close old version
   UPDATE test_parallel_executor
   SET is_current = FALSE, valid_to = CURRENT_TIMESTAMP
   WHERE code = 'TEST_001' AND is_current = TRUE;

   -- Create new version
   INSERT INTO test_parallel_executor (code, name, amount, is_current, valid_from)
   SELECT code, name, amount * 2, TRUE, CURRENT_TIMESTAMP
   FROM test_parallel_executor
   WHERE code = 'TEST_001' AND is_current = FALSE
   ORDER BY valid_to DESC LIMIT 1;
   ```

2. **Batch Update** (TEST_051 ... TEST_100):
   ```sql
   UPDATE test_parallel_executor
   SET amount = amount * 1.10, updated_at = CURRENT_TIMESTAMP
   WHERE code > 'TEST_050' AND is_current = TRUE;
   ```

**Проверяет:**
- SCD Type 2 versioning: TEST_001 теперь имеет 2 версии
- Batch update: 50 записей обновлены (+10% к amount)

---

### Test 6: Delete Records

**Файл:** `06_test_delete_records.sql`

**Проверяет:**
- ✓ Hard DELETE operations
- ✓ Soft DELETE pattern (is_current = FALSE)
- ✓ Cascading deletes (если есть FK)

**Операции:**

1. **Hard Delete** (полное удаление):
   ```sql
   DELETE FROM test_parallel_executor
   WHERE code IN ('TEST_099', 'TEST_100');
   ```

2. **Soft Delete** (архивирование):
   ```sql
   UPDATE test_parallel_executor
   SET is_current = FALSE, valid_to = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
   WHERE code BETWEEN 'TEST_090' AND 'TEST_098';
   ```

**Проверяет:**
- Hard delete: TEST_099, TEST_100 полностью удалены
- Soft delete: TEST_090 ... TEST_098 помечены is_current = FALSE
- Final statistics: total records, current vs historical

---

### Test 7: Cleanup

**Файл:** `07_test_cleanup.sql`

**Проверяет:**
- ✓ DROP INDEX capability
- ✓ DROP TABLE capability
- ✓ Полная очистка артефактов

**Операции:**
```sql
-- Drop indexes
DROP INDEX IF EXISTS idx_test_code_current;
DROP INDEX IF EXISTS idx_test_valid_period;
DROP INDEX IF EXISTS idx_test_amount;

-- Drop table
DROP TABLE IF EXISTS test_parallel_executor CASCADE;
```

**Проверяет:**
- Remaining tables: 0
- Remaining indexes: 0
- База данных вернулась в исходное состояние

---

## 📊 Expected Output

### Successful Test Run

```
================================================================================
Setup and Comprehensive Test Suite
================================================================================

Phase 1: Environment Setup
--------------------------------------------------------------------------------
Checking Python version...
✓ Python 3 detected

✓ Virtual environment exists at: /path/to/venv
✓ Dependencies installed (asyncpg, python-dotenv, rich)
✓ postgresql.env found

================================================================================
✓ Phase 1 Complete: Environment Ready
================================================================================

Phase 2: Comprehensive Database Tests
--------------------------------------------------------------------------------

═══════════════════════════════════════════════════════════════════════════
Test 1/7: Database Connection & Permissions
═══════════════════════════════════════════════════════════════════════════
[Rich progress bars and output...]
✅ Test 1 PASSED: Database Connection & Permissions (2s)

═══════════════════════════════════════════════════════════════════════════
Test 2/7: Table Creation (DDL)
═══════════════════════════════════════════════════════════════════════════
✅ Test 2 PASSED: Table Creation (DDL) (1s)

... (тесты 3-6) ...

═══════════════════════════════════════════════════════════════════════════
Test 7/7: Cleanup Test Artifacts
═══════════════════════════════════════════════════════════════════════════
✅ Test 7 PASSED: Cleanup Test Artifacts (1s)

================================================================================
Test Suite Summary
================================================================================
Total tests:     7
Passed:          7
Failed:          0

================================================================================
✅ All tests passed successfully!
================================================================================

Next steps:
  1. Review postgresql.env credentials
  2. Generate SQL files from CSV:
     cd /path/to/scripts
     source /path/to/venv/bin/activate
     python transform_csv_to_sql.py
     deactivate
  3. Execute SQL files:
     cd /path/to/scripts && ./execute_all.sh
```

---

## 🔧 Troubleshooting

### Test 1 Failed: Connection refused

**Проблема:** PostgreSQL не доступен.

**Решение:**
```bash
# Проверить что PostgreSQL запущен
docker ps | grep postgres

# Проверить доступность порта
telnet 205.172.58.179 5432

# Проверить credentials
cat scripts/postgresql.env
```

---

### Test 2 Failed: Permission denied

**Проблема:** Нет прав на CREATE TABLE.

**Решение:**
```sql
-- Подключиться как superuser и дать права
GRANT CREATE ON SCHEMA public TO familybudget;
```

---

### Test 4 Failed: Too many connections

**Проблема:** Превышен лимит подключений PostgreSQL.

**Решение:**
```bash
# Уменьшить max-connections в тесте
# Отредактировать setup_and_test.sh:
python execute_sql_parallel.py \
    --file "$test_file" \
    --max-connections 5 \  # Было 10
    --env "postgresql.env"
```

---

### Test 5/6 Failed: Deadlock detected

**Проблема:** Deadlock при параллельных UPDATE/DELETE.

**Решение:**
- Тесты 5 и 6 выполняются последовательно (не параллельно)
- Убедитесь что нет других процессов работающих с test_parallel_executor
- Проверьте PostgreSQL logs для деталей

---

### Test 7 Failed: Table does not exist

**Проблема:** Предыдущие тесты не выполнились или таблица уже удалена.

**Решение:**
```bash
# Cleanup вручную
psql -h 205.172.58.179 -U familybudget -d familybudget << EOF
DROP TABLE IF EXISTS test_parallel_executor CASCADE;
EOF
```

---

## 🎯 Best Practices

### 1. Запускать тесты перед deployment

```bash
cd scripts
./setup_and_test.sh

# Если все тесты прошли - можно деплоить
if [ $? -eq 0 ]; then
    ./execute_all.sh
fi
```

### 2. Использовать для CI/CD

```yaml
# .github/workflows/test.yml
- name: Run Database Tests
  run: |
    cd sql/scripts
    ./setup_and_test.sh
```

### 3. Регулярно запускать после изменений

```bash
# После изменений в execute_sql_parallel.py
cd scripts
./setup_and_test.sh

# После изменений в postgresql.env
cd scripts
./setup_and_test.sh
```

### 4. Проверять performance metrics

```bash
# Следить за throughput в Test 4
# Expected: ~200-250 statements/sec для batch insert
```

---

## 📚 Дополнительные ресурсы

- **[QUICKSTART.md](QUICKSTART.md)** - Quick start guide
- **[DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md)** - Структура каталогов
- **[USAGE_PARALLEL_EXECUTOR.md](USAGE_PARALLEL_EXECUTOR.md)** - Parallel executor docs
- **[README.md](README.md)** - Полная документация

---

**Версия:** 1.0
**Дата:** 2025-11-02
**Автор:** Claude Code
