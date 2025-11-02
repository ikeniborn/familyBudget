# Changelog - SQL проект

## [3.0.0] - 2025-11-02

### 🧪 Comprehensive Test Suite

**Добавлено:**
- ✅ **7 комплексных тестов** покрывающих все аспекты БД
- ✅ **Автоматическая очистка** - все тестовые артефакты удаляются
- ✅ **БЕЗ воздействия на production** - только временная таблица
- ✅ **Подробная отчетность** - Pass/Fail статус, metrics, troubleshooting

**Новые тестовые файлы (scripts/tests/):**
```
01_test_connection.sql       # Connection & Permissions
02_test_create_table.sql     # DDL (CREATE TABLE)
03_test_create_indexes.sql   # Index creation & optimization
04_test_insert_batch.sql     # Batch INSERT (100 records, parallel)
05_test_update_records.sql   # UPDATE (SCD Type 2 pattern)
06_test_delete_records.sql   # DELETE (Hard & Soft)
07_test_cleanup.sql          # Cleanup artifacts (DROP TABLE/INDEX)
```

**Test Coverage:**
- ✓ Connection & Authentication
- ✓ DDL operations (CREATE TABLE, CREATE INDEX)
- ✓ DML operations (INSERT, UPDATE, DELETE)
- ✓ Parallel execution (connection pooling, batches)
- ✓ SCD Type 2 pattern (versioning, historical tracking)
- ✓ Performance (throughput ~200-250 stmt/sec)
- ✓ Cleanup verification

**Обновлено:**
- ✅ `scripts/setup_and_test.sh` - ПОЛНОСТЬЮ ПЕРЕПИСАН
  - 3 Phases: Setup → Tests → Summary
  - Colorized output (6 colors)
  - Duration tracking
  - Failure handling (continue or abort)
  - Exit codes (0/1)

**Новая документация:**
- ✅ `docs/TESTING.md` - Comprehensive testing guide (500+ lines)
- ✅ `scripts/tests/README.md` - Test files documentation

**Обновлена документация:**
- ✅ `docs/README.md` - Highlights test suite
- ✅ `docs/QUICKSTART.md` - Test suite workflow
- ✅ `docs/DIRECTORY_STRUCTURE.md` - Tests section

**Performance metrics:**
```
Total test duration:  ~11 seconds
Test 4 throughput:    ~200-250 statements/sec
Test data:            100 records в 2 батчах
Test artifacts:       1 table, 3 indexes (auto-cleanup)
```

**Использование:**
```bash
cd scripts
./setup_and_test.sh

# Expected output:
# Phase 1: Environment Setup ✓
# Phase 2: Database Tests (7/7 passed) ✓
# Phase 3: Summary - All tests passed! ✓
```

---

## [2.0.0] - 2025-11-02

### 🏗️ Реорганизация структуры каталогов

**Изменено:**
- Реорганизована структура каталогов для лучшей поддерживаемости
- Разделены SQL запросы, документация, скрипты и данные

**Новая структура:**
```
sql/
├── data/       # Исходные CSV файлы
├── docs/       # Вся документация (5 файлов)
├── queries/    # Сгенерированные SQL файлы (7 файлов)
├── scripts/    # Python и shell скрипты (7 файлов)
└── venv/       # Виртуальное окружение (создается автоматически)
```

**Обновлено:**
- ✅ `scripts/transform_csv_to_sql.py` - обновлены пути (data/ → queries/)
- ✅ `scripts/setup_and_test.sh` - обновлены пути к venv и queries
- ✅ `scripts/execute_all.sh` - обновлены пути к queries
- ✅ `scripts/run.sh` - обновлен путь к venv
- ✅ `docs/QUICKSTART.md` - обновлены все примеры команд

**Добавлено:**
- ✅ `docs/DIRECTORY_STRUCTURE.md` - полное описание структуры каталогов

**Migration guide:**
```bash
# Старая команда
cd /home/ikeniborn/Documents/Project/familyBudget/sql
./setup_and_test.sh

# Новая команда
cd /home/ikeniborn/Documents/Project/familyBudget/sql/scripts
./setup_and_test.sh
```

---

## [1.0.0] - 2025-11-02

### 🚀 Первоначальный релиз

**Добавлено:**
- ✅ Параллельный SQL executor (`execute_sql_parallel.py`)
- ✅ CSV → SQL generator (`transform_csv_to_sql.py`)
- ✅ Setup и test скрипт с virtual environment
- ✅ Batch execution скрипт (`execute_all.sh`)
- ✅ Wrapper для single file execution (`run.sh`)
- ✅ Comprehensive документация (README, QUICKSTART, USAGE)

**Особенности:**
- Async/await с connection pooling
- Автоматическое определение батчей
- Progress bar с Rich library
- Retry логика для failed statements
- Virtual environment для изоляции зависимостей
- ~5-10x быстрее чем psql

**Исправлено:**
- ❌ Удален файл `05_insert_t_d_article_hierarchy.sql` (создается триггерами)
- ✅ Расширены партиции до 2030 года (96 партиций вместо 36)
- ✅ Исправлены номера файлов после удаления (06→05, 07→06)

**Генерируемые SQL файлы:**
1. `01_insert_t_d_financial_center.sql` - 4 ЦФО
2. `02_insert_t_d_cost_center.sql` - 30 МВЗ
3. `03_insert_t_d_article_parents.sql` - 32 родительские категории
4. `04_insert_t_d_article_children.sql` - 60 дочерние категории
5. `05_create_partitions_t_f_budget_fact.sql` - 96 партиций (2023-2030)
6. `06_insert_t_f_budget_fact.sql` - 6662 транзакции в 7 батчах

**Performance:**
- Общее время выполнения: ~25-35 секунд для всех файлов
- Throughput: ~250 statements/sec для больших батчей
- Connection pooling: до 50 параллельных подключений

---

## Версионирование

Формат: [MAJOR.MINOR.PATCH]

- **MAJOR**: Breaking changes (изменение структуры, API)
- **MINOR**: Новые features (backward compatible)
- **PATCH**: Bug fixes и улучшения

**Current version:** 2.0.0
