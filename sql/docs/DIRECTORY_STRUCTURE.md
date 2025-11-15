# Структура каталогов SQL проекта

## 📁 Обзор

```
sql/
├── data/              # Исходные CSV файлы
├── docs/              # Документация
├── queries/           # Сгенерированные SQL файлы
├── scripts/           # Python и shell скрипты
└── venv/              # Виртуальное окружение Python (создается автоматически)
```

## 📂 Детальное описание

### `data/` - Исходные данные

```
data/
└── t_f_registry_t_d_financial_center_t_d_cost_center_t_d_nomenclatu_202511012113.csv
```

**Назначение:** Хранение исходных CSV файлов для генерации SQL запросов.

**Использование:**
- Читается скриптом `scripts/transform_csv_to_sql.py`
- НЕ версионируется в Git (в .gitignore)

---

### `docs/` - Документация

```
docs/
├── DIRECTORY_STRUCTURE.md         # Этот файл
├── QUICKSTART.md                   # Быстрый старт (3 шага)
├── README.md                       # Полная документация
├── README_EXECUTION_ORDER.md       # Порядок выполнения SQL файлов
└── USAGE_PARALLEL_EXECUTOR.md      # Документация execute_sql_parallel.py
```

**Назначение:** Вся документация проекта.

**Использование:**
- Начинайте с `QUICKSTART.md` для быстрого старта
- `README.md` - для полной информации
- `USAGE_PARALLEL_EXECUTOR.md` - для продвинутого использования параллельного executor

---

### `queries/` - SQL запросы

```
queries/
├── 01_insert_t_d_financial_center.sql      # 4 финансовых центра (ЦФО)
├── 02_insert_t_d_cost_center.sql           # 30 центров затрат (МВЗ)
├── 03_insert_t_d_article_parents.sql       # 32 родительские категории
├── 04_insert_t_d_article_children.sql      # 60 дочерние категории
├── 05_create_partitions_t_f_budget_fact.sql # 96 партиций (2023-2030)
├── 06_insert_t_f_budget_fact.sql           # 6662 транзакции (7 батчей)
└── verify_hierarchy.sql                     # Проверка иерархии
```

**Назначение:** Сгенерированные SQL файлы для загрузки в PostgreSQL.

**Генерация:**
```bash
cd scripts
python transform_csv_to_sql.py
```

**Выполнение:**
```bash
cd scripts
./execute_all.sh  # Все файлы последовательно
```

**⚠️ ВАЖНО:**
- Файлы генерируются автоматически - НЕ редактируйте вручную!
- Выполняйте в указанном порядке (01 → 02 → ... → 06)
- Иерархия (`t_d_article_hierarchy`) создается триггерами при выполнении 04!

---

### `scripts/` - Скрипты и конфигурация

```
scripts/
├── execute_sql_parallel.py     # Параллельный SQL executor (Python)
├── transform_csv_to_sql.py     # Генератор SQL из CSV
├── setup_and_test.sh           # Установка зависимостей + тест
├── execute_all.sh              # Выполнение всех SQL файлов
├── run.sh                      # Wrapper для одного файла
├── postgresql.env              # Конфигурация БД (credentials)
└── requirements.txt            # Python зависимости
```

#### Python скрипты

**`execute_sql_parallel.py`** - Параллельный SQL executor
```bash
# Из каталога scripts/
python execute_sql_parallel.py --file ../queries/06_insert_t_f_budget_fact.sql --max-connections 30
```

**Особенности:**
- Async/await с connection pooling
- Автоматическое определение батчей (BEGIN...COMMIT блоки)
- Progress bar с Rich library
- Retry логика для failed statements
- ~5-10x быстрее чем psql

**`transform_csv_to_sql.py`** - Генератор SQL
```bash
# Из каталога scripts/
python transform_csv_to_sql.py
```

**Процесс:**
1. Читает CSV из `../data/`
2. Извлекает dimension данные (financial_center, cost_center, articles)
3. Генерирует SQL файлы в `../queries/`
4. Создает партиции для fact table (2023-2030)
5. Группирует fact records в батчи по 1000 записей

#### Shell скрипты

**`setup_and_test.sh`** - Первоначальная установка
```bash
cd scripts
./setup_and_test.sh
```

**Что делает:**
1. Проверяет Python 3
2. Создает виртуальное окружение (`../venv/`)
3. Устанавливает зависимости (asyncpg, python-dotenv, rich)
4. Проверяет `postgresql.env`
5. Тестирует подключение к БД на файле `01_insert_t_d_financial_center.sql`

**`execute_all.sh`** - Выполнение всех файлов
```bash
cd scripts
./execute_all.sh
```

**Процесс:**
1. Активирует venv
2. Проверяет prerequisites
3. Запрашивает подтверждение
4. Выполняет файлы последовательно (01 → 06)
5. При ошибке - предлагает продолжить или остановиться
6. Выводит summary статистику
7. Деактивирует venv

**`run.sh`** - Wrapper для одного файла
```bash
cd scripts
./run.sh --file ../queries/06_insert_t_f_budget_fact.sql --max-connections 20
```

**Особенности:**
- Автоматически активирует/деактивирует venv
- Создает venv если не существует (вызывает setup_and_test.sh)
- Передает все аргументы в `execute_sql_parallel.py`

#### Конфигурация

**`postgresql.env`** - Credentials для PostgreSQL
```env
POSTGRES_HOST=205.172.58.179
POSTGRES_PORT=5432
POSTGRES_DB=familybudget
POSTGRES_USER=familybudget
POSTGRES_PASSWORD=XgmJvnvPlPPQSOvO3s3NVOOzHmecydjP
```

**⚠️ ВАЖНО:** НЕ коммитить в Git! (в .gitignore)

**`requirements.txt`** - Python зависимости
```txt
asyncpg>=0.29.0
python-dotenv>=1.0.0
rich>=13.7.0
```

---

### `venv/` - Виртуальное окружение

**Назначение:** Изолированная среда для Python зависимостей.

**Создание:**
```bash
cd scripts
./setup_and_test.sh  # Автоматически создает venv/
```

**Структура:**
```
venv/
├── bin/               # Активация скрипт, python, pip
├── lib/               # Установленные пакеты
└── pyvenv.cfg         # Конфигурация venv
```

**Использование:**
```bash
# Активировать вручную
source venv/bin/activate

# Деактивировать
deactivate
```

**⚠️ ВАЖНО:**
- НЕ версионируется в Git (в .gitignore)
- Все shell скрипты (`*.sh`) автоматически используют venv
- Для Python 3.12+ - **ОБЯЗАТЕЛЬНО** использовать venv (PEP 668)

---

## 🚀 Типичные workflows

### 1. Первоначальная установка

```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql/scripts
./setup_and_test.sh
```

### 2. Генерация SQL из CSV

```bash
cd scripts
python transform_csv_to_sql.py
# ИЛИ с активацией venv вручную
source ../venv/bin/activate
python transform_csv_to_sql.py
deactivate
```

### 3. Выполнение всех SQL файлов

```bash
cd scripts
./execute_all.sh
```

### 4. Выполнение одного файла

```bash
cd scripts
./run.sh --file ../queries/06_insert_t_f_budget_fact.sql --max-connections 30
```

### 5. Прямой вызов executor (продвинутый)

```bash
cd scripts
source ../venv/bin/activate
python execute_sql_parallel.py \
  --file ../queries/06_insert_t_f_budget_fact.sql \
  --max-connections 30 \
  --env postgresql.env
deactivate
```

---

## 📝 Git Ignore

`.gitignore` настроен для исключения:

```gitignore
# Virtual environment
venv/
env/
.venv/

# Python cache
__pycache__/
*.pyc
*.pyo
*.pyd

# Data files (sensitive/large)
*.csv

# Configuration (credentials)
postgresql.env
```

**⚠️ НЕ коммитить:**
- `venv/` - виртуальное окружение
- `*.csv` - исходные данные
- `postgresql.env` - credentials
- `__pycache__/` - Python cache

**✓ Коммитить:**
- `queries/*.sql` - сгенерированные SQL файлы
- `scripts/*.py` - Python скрипты
- `scripts/*.sh` - Shell скрипты
- `docs/*.md` - Документация
- `scripts/requirements.txt` - зависимости

---

## 🔧 Troubleshooting

### Ошибка: `scripts: No such file or directory`

**Проблема:** Неправильный рабочий каталог.

**Решение:**
```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql/scripts
./setup_and_test.sh
```

### Ошибка: `python3-venv not installed`

**Проблема:** Отсутствует модуль venv для Python.

**Решение:**
```bash
sudo apt install python3-venv
cd scripts && ./setup_and_test.sh
```

### Ошибка: `ModuleNotFoundError: No module named 'asyncpg'`

**Проблема:** Виртуальное окружение не активировано или повреждено.

**Решение:**
```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql
rm -rf venv
cd scripts && ./setup_and_test.sh
```

### Ошибка: `duplicate key value violates constraint`

**Проблема:** Данные уже существуют в БД.

**Решение:**
```sql
-- Очистить таблицы перед повторной загрузкой
TRUNCATE TABLE t_f_budget_fact CASCADE;
TRUNCATE TABLE t_d_article CASCADE;
TRUNCATE TABLE t_d_cost_center CASCADE;
TRUNCATE TABLE t_d_financial_center CASCADE;
```

---

## 📚 Дополнительные ресурсы

- **[QUICKSTART.md](QUICKSTART.md)** - Быстрый старт (3 шага)
- **[README.md](README.md)** - Полная документация
- **[USAGE_PARALLEL_EXECUTOR.md](USAGE_PARALLEL_EXECUTOR.md)** - Parallel executor
- **[README_EXECUTION_ORDER.md](README_EXECUTION_ORDER.md)** - Порядок выполнения

---

**Версия:** 1.0
**Дата:** 2025-11-02
**Автор:** Claude Code
