# SQL Data Management System

Comprehensive система для управления SQL данными Family Budget с параллельным выполнением, тестированием и генерацией из CSV.

## 📁 Структура проекта

```
sql/
├── data/              # Исходные CSV файлы
├── docs/              # Документация (этот файл)
├── queries/           # Сгенерированные SQL файлы
├── scripts/           # Python и shell скрипты
│   └── tests/         # Тестовые SQL файлы
└── venv/              # Virtual environment (создается автоматически)
```

**📖 Детали:** См. [DIRECTORY_STRUCTURE.md](DIRECTORY_STRUCTURE.md)

---

## 🎯 Основные возможности

### ✨ Highlights

- ✅ **Параллельное выполнение SQL** - до 50 одновременных подключений
- ✅ **Автоматическая генерация** из CSV
- ✅ **Comprehensive testing** - 7 тестов покрывающих все аспекты
- ✅ **Изолированная среда** - Python venv для зависимостей
- ✅ **SCD Type 2 support** - историческое отслеживание изменений
- ✅ **Batch processing** - автоматическое определение батчей
- ✅ **Performance** - 5-10x быстрее чем psql

---

## 📋 Содержимое

### SQL Queries (queries/)

Сгенерированные SQL файлы для наполнения БД:

| # | Файл | Описание | Записи |
|---|------|----------|--------|
| 01 | `insert_t_d_financial_center.sql` | Финансовые центры (ЦФО) | 4 |
| 02 | `insert_t_d_cost_center.sql` | Центры затрат (МВЗ) | 30 |
| 03 | `insert_t_d_article_parents.sql` | Родительские категории | 32 |
| 04 | `insert_t_d_article_children.sql` | Подкатегории (триггеры → иерархия) | 60 |
| 05 | `insert_t_f_budget_fact.sql` | Факты (plan + fact) | 6,662 |

> **⚠️ ВАЖНО:** Партиции для `t_f_budget_fact` (96 месячных партиций: 2023-01 до 2030-12) создаются автоматически через Alembic baseline migration (`backend/db/migrations/`), НЕ через SQL скрипты.

### Python Scripts (scripts/)

| Скрипт | Назначение |
|--------|-----------|
| `execute_sql_parallel.py` | **Параллельное выполнение SQL** с connection pooling |
| `transform_csv_to_sql.py` | Генерация SQL файлов из CSV |

### Shell Scripts (scripts/)

| Скрипт | Назначение |
|--------|-----------|
| `setup_and_test.sh` | **Setup + Comprehensive test suite** (7 тестов) |
| `execute_all.sh` | Последовательное выполнение всех SQL файлов |
| `run.sh` | Wrapper для выполнения одного файла |

### Test Suite (scripts/tests/)

| # | Test | Проверяет |
|---|------|----------|
| 1 | `01_test_connection.sql` | Connection & Permissions |
| 2 | `02_test_create_table.sql` | DDL (CREATE TABLE) |
| 3 | `03_test_create_indexes.sql` | Index creation |
| 4 | `04_test_insert_batch.sql` | Parallel batch INSERT |
| 5 | `05_test_update_records.sql` | UPDATE (SCD Type 2) |
| 6 | `06_test_delete_records.sql` | DELETE (Hard & Soft) |
| 7 | `07_test_cleanup.sql` | Cleanup artifacts |

**📖 Детали:** См. [TESTING.md](TESTING.md)

### Documentation (docs/)

| Документ | Назначение |
|----------|-----------|
| `README.md` | Этот файл - полная документация |
| `QUICKSTART.md` | Быстрый старт (3 шага) |
| `TESTING.md` | Comprehensive testing guide |
| `DIRECTORY_STRUCTURE.md` | Структура каталогов |
| `USAGE_PARALLEL_EXECUTOR.md` | Parallel executor документация |
| `README_EXECUTION_ORDER.md` | Порядок выполнения SQL |

---

## 🚀 Quick Start

### 1. Setup & Testing (рекомендуется начать с этого)

```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql/scripts
./setup_and_test.sh
```

**Что происходит:**
1. **Environment Setup:**
   - Создается Python virtual environment
   - Устанавливаются зависимости (asyncpg, python-dotenv, rich)
   - Проверяется postgresql.env

2. **Comprehensive Tests (7 тестов):**
   - Test 1: Database connection & permissions
   - Test 2: Table creation (DDL)
   - Test 3: Index creation & optimization
   - Test 4: Batch insert (parallel execution)
   - Test 5: Update records (SCD Type 2)
   - Test 6: Delete records (hard & soft)
   - Test 7: Cleanup test artifacts

3. **Result:**
   - ✅ All tests passed → Ready for production
   - ❌ Some tests failed → Troubleshooting guide

**📖 Детали:** См. [TESTING.md](TESTING.md)

### 2. Настройка postgresql.env

Отредактируйте `postgresql.env`:

```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=familybudget
POSTGRES_USER=familybudget
POSTGRES_PASSWORD=your_actual_password  # ← ИЗМЕНИТЕ!
```

### 3. Выполнение SQL файлов (production data)

**Вариант A: Все файлы автоматически**

```bash
cd scripts
./execute_all.sh
```

Скрипт выполнит все 6 файлов последовательно с подтверждением.

**Вариант B: Отдельные файлы**

```bash
cd scripts

# Через wrapper (автоматически использует venv)
./run.sh --file ../queries/06_insert_t_f_budget_fact.sql --max-connections 30

# Или напрямую (нужно активировать venv вручную)
source ../venv/bin/activate
python execute_sql_parallel.py --file ../queries/06_insert_t_f_budget_fact.sql
deactivate
```

---

## 📖 Подробная документация

### Параллельный executor (execute_sql_parallel.py)

**Полная документация:** [USAGE_PARALLEL_EXECUTOR.md](USAGE_PARALLEL_EXECUTOR.md)

**Ключевые возможности:**
- ⚡ Параллельное выполнение батчей (до 50 подключений)
- 📊 Progress bar с ETA в реальном времени
- 🔧 Connection pooling для эффективности
- 📝 Rich terminal output со статистикой
- ⚙️ Автоопределение батчей (BEGIN...COMMIT блоки)

**Примеры использования:**

```bash
cd scripts

# Маленький файл (4 записи)
./run.sh --file ../queries/01_insert_t_d_financial_center.sql
# Результат: ~0.15s, 1 batch

# Большой файл (6662 записи, 7 батчей)
./run.sh --file ../queries/06_insert_t_f_budget_fact.sql --max-connections 50
# Результат: ~25s, 7 batches parallel, ~270 statements/sec
```

**Производительность:**
- 🚀 **5-10x быстрее** чем `psql` для больших файлов с батчами
- Throughput: 200-500+ statements/sec (зависит от размера батча и сети)

### Порядок выполнения SQL

**Полная документация:** [README_EXECUTION_ORDER.md](README_EXECUTION_ORDER.md)

**Правильная последовательность:**

1. **Dimension tables** (01-02)
2. **Article hierarchy** (03-04) - триггеры создают `t_d_article_hierarchy` автоматически!
3. **Partitions** (05) - **ОБЯЗАТЕЛЬНО перед facts!**
4. **Facts** (06)

**⚠️ ВАЖНО:** Файл `05_insert_t_d_article_hierarchy.sql` **НЕ СУЩЕСТВУЕТ** и **НЕ НУЖЕН**!

Таблица `t_d_article_hierarchy` наполняется **автоматически триггерами** при вставке в `t_d_article` (файл 04).

**Причина:** Closure Table управляется триггером `trg_article_hierarchy_insert_after` (из миграции `007_create_article_hierarchy_triggers.sql`).

---

## 🔧 Генерация SQL файлов из CSV

### transform_csv_to_sql.py

Преобразует CSV данные в SQL INSERT statements.

**Использование:**

```bash
python3 transform_csv_to_sql.py
```

**Что делает:**
1. Читает `t_f_registry_t_d_financial_center_t_d_cost_center_t_d_nomenclatu_*.csv`
2. Парсит dimension таблицы (financial centers, cost centers, articles)
3. Генерирует SQL файлы (01-06)
4. Создает партиции до 2030 года
5. Разбивает транзакции на батчи (1000 записей на batch)

**Output файлы:**
- 01-04: Dimension tables
- 05: Партиции (96 месяцев: 2023-01 → 2030-12)
- 06: Fact таблица (6662 транзакции в 7 батчах)

**⚠️ Файл 05_insert_t_d_article_hierarchy.sql больше НЕ генерируется!**

---

## 🧪 Тестирование и проверка

### Быстрый тест

```bash
./setup_and_test.sh
```

Выполнит тест на маленьком файле и проверит работоспособность.

### Проверка иерархии

После выполнения файлов 03-04, проверьте что иерархия создана триггерами:

```bash
# Выполнить verify_hierarchy.sql
psql -U familybudget -d familybudget -f verify_hierarchy.sql
```

**Ожидаемый результат:**
- Total hierarchy records: 152 (92 self-refs + 60 parent-child)
- Parent-child relationships: 60
- Orphaned children: 0

---

## 📊 Статистика данных

| Таблица | Тип | Записи | Особенности |
|---------|-----|--------|-------------|
| `t_d_financial_center` | Dimension | 4 | Shared, SCD Type 2 |
| `t_d_cost_center` | Dimension | 30 | Shared, SCD Type 2 |
| `t_d_article` | Dimension | 92 | 32 parents + 60 children, SCD Type 2 |
| `t_d_article_hierarchy` | Closure Table | 152 | Auto-created by triggers! |
| `t_f_budget_fact` | Fact | 6,662 | Partitioned (2023-2030) |

**Partition coverage:** 2023-01-01 до 2030-12-31 (96 месяцев)

**CSV data range:** 2023-01-01 до 2025-11-01

---

## ⚙️ Конфигурация

### postgresql.env

```env
# PostgreSQL Connection Configuration
POSTGRES_HOST=localhost      # Хост БД
POSTGRES_PORT=5432          # Порт БД
POSTGRES_DB=familybudget    # Имя БД
POSTGRES_USER=familybudget  # Пользователь
POSTGRES_PASSWORD=password  # Пароль (ИЗМЕНИТЕ!)
```

**Расположение:** Должен находиться в каталоге `sql/`

### Python Dependencies

```txt
asyncpg>=0.29.0      # Async PostgreSQL driver
python-dotenv>=1.0.0 # Environment variables
rich>=13.7.0         # Rich terminal UI
```

**Установка:**
```bash
pip install -r requirements.txt
```

---

## 🔍 Troubleshooting

### Ошибка: postgresql.env not found

**Решение:**
```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql
ls postgresql.env  # Проверить наличие
```

Если файла нет - запустите `./setup_and_test.sh` для создания.

### Ошибка: Too many connections

**Причина:** PostgreSQL достиг лимита подключений.

**Решение:**
```bash
# Уменьшить max-connections
python3 execute_sql_parallel.py --file 06_insert_t_f_budget_fact.sql --max-connections 20
```

### Ошибка: Duplicate key constraint (t_d_article_hierarchy)

**Причина:** Попытка выполнить несуществующий файл `05_insert_t_d_article_hierarchy.sql`.

**Решение:** Этот файл **НЕ НУЖЕН**! Иерархия создается автоматически триггерами при выполнении файла 04.

### Низкая производительность

**Причины:**
- Недостаточно параллельных подключений
- Маленькие батчи
- Медленная сеть/диск

**Решения:**
```bash
# Увеличить connections
python3 execute_sql_parallel.py --file 06_insert_t_f_budget_fact.sql --max-connections 50

# Проверить PostgreSQL performance
docker stats familybudget-postgres
```

---

## 📚 Дополнительные ресурсы

### Документация проекта

- `../../CLAUDE.md` - Главная документация проекта
- `../../backend/db/migrations/` - **Alembic миграции** (ТЕКУЩАЯ СИСТЕМА для всех окружений)
- `../../backend/db/deprecated/schema/` - Старые SQL schema файлы (АРХИВ, не используются)
- `../../backend/db/README.md` - Документация по Alembic миграциям
- `../../backend/README.md` - Backend документация

### Документация инструментов

- [USAGE_PARALLEL_EXECUTOR.md](USAGE_PARALLEL_EXECUTOR.md) - Подробная документация execute_sql_parallel.py
- [README_EXECUTION_ORDER.md](README_EXECUTION_ORDER.md) - Порядок выполнения SQL скриптов

---

## 🎯 Рекомендуемый workflow

### Первоначальная загрузка данных

```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql

# 1. Установка и тест
./setup_and_test.sh

# 2. Настройка postgresql.env
nano postgresql.env  # Установить правильный пароль

# 3. Выполнение всех файлов
./execute_all.sh

# 4. Проверка
psql -U familybudget -d familybudget -f verify_hierarchy.sql
```

### Обновление данных из CSV

```bash
# 1. Поместить новый CSV в каталог sql/
# 2. Перегенерировать SQL файлы
python3 transform_csv_to_sql.py

# 3. Очистить старые данные (если нужно)
psql -U familybudget -d familybudget -c "TRUNCATE TABLE t_f_budget_fact CASCADE;"

# 4. Загрузить новые данные
./execute_all.sh
```

---

## 📝 Changelog

### 2025-11-09
- ✅ Обновлена документация для Alembic-only системы миграций
- ✅ Ссылки на `backend/db/schema/` заменены на `backend/db/migrations/`
- ✅ Добавлена ссылка на `backend/db/README.md` (Alembic документация)
- ✅ Отмечено, что старые schema/*.sql файлы теперь в `backend/db/deprecated/`

### 2025-11-02
- ✅ Создан `execute_sql_parallel.py` - параллельный executor
- ✅ Удален `05_insert_t_d_article_hierarchy.sql` (триггеры автоматически управляют)
- ✅ Перенумерованы файлы: 06→05, 07→06
- ✅ Расширены партиции до 2030 года (было: до 2025)
- ✅ Создана документация и вспомогательные скрипты
- ✅ Добавлен `postgresql.env` в каталог sql/

---

**Автор:** Claude Code
**Последнее обновление:** 2025-11-09
**Версия:** 1.1.0
