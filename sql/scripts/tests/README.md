# Test SQL Files

Comprehensive test suite для проверки параллельного SQL executor и PostgreSQL connectivity.

## 📋 Test Files Overview

| # | File | Description | Operations | Records |
|---|------|-------------|------------|---------|
| 1 | `01_test_connection.sql` | Connection & Permissions | SELECT | - |
| 2 | `02_test_create_table.sql` | Table Creation (DDL) | CREATE TABLE | - |
| 3 | `03_test_create_indexes.sql` | Index Creation | CREATE INDEX | 3 indexes |
| 4 | `04_test_insert_batch.sql` | Batch Insert (Parallel) | INSERT | 100 records |
| 5 | `05_test_update_records.sql` | Update (SCD Type 2) | UPDATE, INSERT | ~50 records |
| 6 | `06_test_delete_records.sql` | Delete (Hard & Soft) | DELETE, UPDATE | ~10 records |
| 7 | `07_test_cleanup.sql` | Cleanup Artifacts | DROP TABLE, DROP INDEX | - |

## 🚀 How to Run

**Автоматически (рекомендуется):**
```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql/scripts
./setup_and_test.sh
```

**Вручную (отдельный тест):**
```bash
cd scripts
source ../venv/bin/activate
python execute_sql_parallel.py --file tests/01_test_connection.sql --max-connections 10
deactivate
```

## ✅ Test Coverage

### 1. Connection Test
- ✓ Database connectivity
- ✓ User authentication
- ✓ Schema permissions (CREATE)
- ✓ Server info (version, IP, port)

### 2. DDL Operations
- ✓ CREATE TABLE
- ✓ SCD Type 2 pattern (is_current, valid_from, valid_to)
- ✓ Serial primary key
- ✓ Default values

### 3. Index Management
- ✓ CREATE UNIQUE INDEX
- ✓ Composite indexes
- ✓ Partial indexes (WHERE clause)
- ✓ Performance optimization

### 4. Parallel Execution
- ✓ Batch INSERT (100 records in 2 batches)
- ✓ Connection pooling
- ✓ Transaction management (BEGIN...COMMIT)
- ✓ Throughput performance (~200-250 stmt/sec)

### 5. Data Modification
- ✓ SCD Type 2 UPDATE (versioning)
- ✓ Batch UPDATE operations
- ✓ Historical tracking
- ✓ Timestamp management

### 6. Data Deletion
- ✓ Hard DELETE (permanent removal)
- ✓ Soft DELETE (is_current = FALSE)
- ✓ Archive pattern
- ✓ Statistics verification

### 7. Cleanup
- ✓ DROP INDEX
- ✓ DROP TABLE
- ✓ Artifact removal
- ✓ Database state verification

## 🎯 Test Artifacts

**Создаваемые объекты:**
- Таблица: `test_parallel_executor`
- Индексы:
  - `idx_test_code_current` (UNIQUE)
  - `idx_test_valid_period`
  - `idx_test_amount` (PARTIAL)
- Данные: 100 test records

**⚠️ ВАЖНО:** Все артефакты автоматически удаляются в Test 7!

## 📊 Expected Results

| Test | Expected Outcome | Duration |
|------|------------------|----------|
| 1. Connection | SUCCESS, permission = TRUE | ~2s |
| 2. Table Creation | 1 table created | ~1s |
| 3. Indexes | 3 indexes created | ~1s |
| 4. Batch Insert | 100 records inserted | ~3s |
| 5. Update | ~51 records modified | ~2s |
| 6. Delete | 2 hard + 9 soft deletes | ~1s |
| 7. Cleanup | 0 tables, 0 indexes | ~1s |

**Total Duration:** ~11 seconds

## 🔧 Customization

### Изменить количество записей

Отредактируйте `04_test_insert_batch.sql`:
```sql
-- Добавьте больше INSERT VALUES для увеличения dataset
INSERT INTO test_parallel_executor (code, name, amount, is_current, valid_from)
VALUES
    ('TEST_101', 'Test Record 101', 10100.00, TRUE, CURRENT_TIMESTAMP),
    ...
```

### Изменить max connections

Отредактируйте `../setup_and_test.sh`:
```bash
python execute_sql_parallel.py \
    --file "$test_file" \
    --max-connections 20 \  # Было 10
    --env "postgresql.env"
```

### Добавить новый тест

1. Создайте `08_test_custom.sql`
2. Добавьте в `../setup_and_test.sh`:
   ```bash
   TEST_FILES=(
       "01_test_connection.sql"
       ...
       "07_test_cleanup.sql"
       "08_test_custom.sql"  # Новый тест
   )

   TEST_DESCRIPTIONS=(
       ...
       "Custom Test Description"
   )
   ```

## 📝 Test SQL Patterns

### SCD Type 2 Update Pattern
```sql
-- Close old version
UPDATE table SET is_current = FALSE, valid_to = CURRENT_TIMESTAMP
WHERE code = 'XXX' AND is_current = TRUE;

-- Create new version
INSERT INTO table (code, name, amount, is_current, valid_from)
SELECT code, name, new_amount, TRUE, CURRENT_TIMESTAMP
FROM table WHERE code = 'XXX' AND is_current = FALSE
ORDER BY valid_to DESC LIMIT 1;
```

### Soft Delete Pattern
```sql
UPDATE table
SET is_current = FALSE, valid_to = CURRENT_TIMESTAMP
WHERE condition;
```

### Batch Insert Pattern
```sql
BEGIN;
INSERT INTO table (col1, col2, col3) VALUES
    (val1, val2, val3),
    (val4, val5, val6),
    ...;
COMMIT;
```

## 🐛 Troubleshooting

**Test 4 Failed: Too many connections**
```bash
# Уменьшите max-connections в setup_and_test.sh
--max-connections 5  # Вместо 10
```

**Test 5 Failed: Unique constraint violation**
```bash
# Очистите БД от предыдущих тестов
psql -h HOST -U USER -d DB << EOF
DROP TABLE IF EXISTS test_parallel_executor CASCADE;
EOF
```

**All tests failed: Connection refused**
```bash
# Проверьте PostgreSQL и credentials
docker ps | grep postgres
cat ../postgresql.env
```

## 📚 See Also

- **[../setup_and_test.sh](../setup_and_test.sh)** - Main test runner
- **[../../docs/TESTING.md](../../docs/TESTING.md)** - Comprehensive testing guide
- **[../../docs/QUICKSTART.md](../../docs/QUICKSTART.md)** - Quick start

---

**Автор:** Claude Code
**Дата:** 2025-11-02
**Версия:** 1.0
