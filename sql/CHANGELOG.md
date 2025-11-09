# Changelog - SQL проект

## [3.2.0] - 2025-11-09

### 🔄 Partition Management via Alembic (MONTHLY Partitions)

**КРИТИЧЕСКОЕ ИЗМЕНЕНИЕ:** Партиционирование перенесено из SQL скриптов в Alembic миграции.

**Удалено:**
- ❌ **`queries/05_create_partitions_t_f_budget_fact.sql`** - файл удален

**Причина удаления:**
- Конфликт overlapping partitions: ГОДОВЫЕ партиции (Alembic baseline) vs МЕСЯЧНЫЕ партиции (SQL script)
- Duplicate источник правды для DDL операций
- PostgreSQL ошибка: `partition "t_f_budget_fact_2023_01" would overlap partition "t_f_budget_fact_2023"`

**Новая архитектура:**
- ✅ **Партиции создаются через Alembic baseline migration**
- ✅ Локация: `backend/db/migrations/versions/20251109_001_baseline_schema_v5_0_0.py`
- ✅ Тип: **MONTHLY partitions** (96 партиций: 2023-01 до 2030-12)
- ✅ Преимущества: Лучшая производительность (partition pruning), более гибкое управление

**Изменено:**
- ✅ `queries/06_insert_t_f_budget_fact.sql` → `queries/05_insert_t_f_budget_fact.sql` - переименован для последовательной нумерации
- ✅ `scripts/execute_all.sh` - обновлена ссылка 06→05, удалена ссылка на создание партиций
- ✅ `docs/README.md` - обновлена таблица SQL queries (06→05, файл 05 помечен как удаленный)
- ✅ `docs/QUICKSTART.md` - обновлен порядок выполнения и таблица производительности (06→05)
- ✅ `docs/README_EXECUTION_ORDER.md` - обновлен порядок выполнения (06→05), добавлена секция "Partitions (via Alembic)"
- ✅ `docs/USAGE_PARALLEL_EXECUTOR.md` - обновлены все примеры команд (06→05)
- ✅ `README.md` - обновлена ссылка на файл 06→05

**Правило разделения (DDL vs DML):**
- **Alembic**: DDL операции (CREATE TABLE, ALTER TABLE, CREATE INDEX, **CREATE PARTITION**)
- **sql/**: DML операции (INSERT данных из CSV)

**Migration Path:**
```bash
# Старые БД с ГОДОВЫМИ партициями:
# - Партиции остаются как есть (backward compatible)
# - При необходимости: создать Alembic миграцию для конвертации YEARLY → MONTHLY

# Новые БД:
cd backend/db/migrations
alembic upgrade head  # Создает 96 МЕСЯЧНЫХ партиций автоматически
```

**Совместимость:**
- ✅ Backward compatible: Существующие ГОДОВЫЕ партиции продолжают работать
- ✅ Forward compatible: Новые установки получают МЕСЯЧНЫЕ партиции
- ⚠️ НЕ запускайте `sql/queries/05_*.sql` если уже есть партиции (конфликт!)

---

## [3.1.0] - 2025-11-09

### 🔑 Code Field Support - Unified Sequential Pattern

**Добавлено:**
- ✅ **Code field поддержка** для всех dimension tables (ЦФО, МВЗ, категории)
- ✅ **Унифицированный паттерн**: CFO-{seq}, MVZ-{seq}, ART-{seq}
- ✅ **Новый скрипт**: `scripts/update_code_patterns.py` - автоматическая конвертация паттернов

**Изменено:**
- ✅ `scripts/transform_csv_to_sql.py` - генерация code field с новым паттерном
  - FinancialCenter: FC_{name} → CFO-1, CFO-2, ...
  - CostCenter: CC_{name} → MVZ-1, MVZ-2, ...
  - Article parents: ART_PARENT_{num} → ART-1...ART-32
  - Article children: ART_CHILD_{num} → ART-33...ART-92 (unified sequence)

**Обновлено:**
- ✅ `queries/*.sql` - все dimension INSERT statements теперь с code field
  - 01_insert_t_d_financial_center.sql (4 codes: CFO-1...CFO-4)
  - 02_insert_t_d_cost_center.sql (30 codes: MVZ-1...MVZ-30)
  - 03_insert_t_d_article_parents.sql (32 codes: ART-1...ART-32)
  - 04_insert_t_d_article_children.sql (60 codes: ART-33...ART-92)

**Проверено:**
- ✅ Тестовые скрипты (scripts/tests/*) - все используют code field корректно
- ✅ Скрипты запуска (execute_all.sh, run.sh, setup_and_test.sh) - работают без изменений

**Совместимость:**
- ⚠️ Backward compatible: старые версии dimension records без code field продолжают работать (code nullable)
- ✅ Forward compatible: новые записи с code field для внешних интеграций

**Migration Path:**
```bash
# Обновить паттерны code в существующих SQL
cd sql/scripts
python3 update_code_patterns.py

# Результат: queries/ обновлены с новыми паттернами
```

---

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

**Current version:** 3.2.0
