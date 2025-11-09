# Quick Start Guide

## 🚀 3 шага до успеха

### 1. Установка зависимостей (с изолированной средой)

```bash
cd /home/ikeniborn/Documents/Project/familyBudget/sql/scripts
./setup_and_test.sh
```

**Что произойдет:**
- Создастся виртуальное окружение Python (venv/)
- Установятся Python библиотеки в изолированную среду (asyncpg, python-dotenv, rich)
- Выполнится тест на файле `01_insert_t_d_financial_center.sql`
- Проверится подключение к PostgreSQL

**Примечание:** Все зависимости устанавливаются в `../venv/` - изолированная среда, не затрагивающая системный Python.

### 2. Выполнение SQL файлов

**Вариант A: Все файлы автоматически (рекомендуется)**

```bash
./execute_all.sh
```

Скрипт автоматически активирует виртуальное окружение и выполнит все файлы.

**Вариант B: Отдельный файл через wrapper**

```bash
# Интерактивный режим (запросит путь к файлу)
./run.sh

# Прямое указание файла
./run.sh --file ../queries/06_insert_t_f_budget_fact.sql

# С ограничением подключений (для удаленного сервера)
./run.sh --file ../queries/06_insert_t_f_budget_fact.sql --max-connections 20
```

**Вариант C: Прямой запуск (для продвинутых пользователей)**

```bash
# Активировать виртуальное окружение вручную
source ../venv/bin/activate

# Запустить скрипт
python execute_sql_parallel.py --file ../queries/06_insert_t_f_budget_fact.sql

# Деактивировать окружение после работы
deactivate
```

### 3. Проверка результата

```bash
# Подключение к БД
psql -h 205.172.58.179 -U familybudget -d familybudget

# Проверить количество записей
SELECT COUNT(*) FROM t_f_budget_fact;  -- Expected: 6662

# Проверить иерархию (создана триггерами!)
SELECT COUNT(*) FROM t_d_article_hierarchy;  -- Expected: 152
```

---

## 📋 Порядок выполнения файлов

```
01_insert_t_d_financial_center.sql     (4 записи)
02_insert_t_d_cost_center.sql          (30 записей)
03_insert_t_d_article_parents.sql      (32 записи)
04_insert_t_d_article_children.sql     (60 записей) ← Триггеры создают hierarchy!
06_insert_t_f_budget_fact.sql          (6662 транзакции, 7 батчей)
```

**⚠️ ВАЖНЫЕ ЗАМЕЧАНИЯ:**
- Файл `05_create_partitions_t_f_budget_fact.sql` **УДАЛЕН** - партиции создаются через Alembic baseline migration
- Файл `05_insert_t_d_article_hierarchy.sql` НЕ СУЩЕСТВУЕТ - иерархия создается автоматически триггерами при выполнении файла 04

---

## ⚡ Примеры команд

```bash
# Все файлы последовательно (рекомендуется)
./execute_all.sh

# Только dimension таблицы (01-04)
for f in 01 02 03 04; do
  ./run.sh --file ../queries/${f}_*.sql
done

# Только facts (06) - партиции создаются через Alembic!
./run.sh --file ../queries/06_insert_t_f_budget_fact.sql --max-connections 30

# Проверка иерархии после файлов 03-04
psql -h 205.172.58.179 -U familybudget -d familybudget -f ../queries/verify_hierarchy.sql
```

**Все скрипты используют изолированную среду (venv) автоматически!**

---

## 🔧 Конфигурация

**postgresql.env** уже настроен:
```
POSTGRES_HOST=205.172.58.179
POSTGRES_PORT=5432
POSTGRES_DB=familybudget
POSTGRES_USER=familybudget
POSTGRES_PASSWORD=XgmJvnvPlPPQSOvO3s3NVOOzHmecydjP
```

---

## 📊 Ожидаемая производительность

| Файл | Записи | Батчи | Время | Throughput |
|------|--------|-------|-------|------------|
| 01 | 4 | 1 | ~0.1s | ~40 stmt/sec |
| 02 | 30 | 1 | ~0.2s | ~150 stmt/sec |
| 03 | 32 | 1 | ~0.2s | ~160 stmt/sec |
| 04 | 60 | 1 | ~0.3s | ~200 stmt/sec |
| 06 | 6662 | 7 | ~20-30s | ~250 stmt/sec |

**Общее время:** ~21-31 секунд для всех файлов (партиции создаются через Alembic - не учитываются)

---

## ❓ Troubleshooting

**Connection refused:**
```bash
# Проверить доступность PostgreSQL
ping 205.172.58.179
telnet 205.172.58.179 5432

# Проверить credentials
psql -h 205.172.58.179 -U familybudget -d familybudget
```

**Too many connections:**
```bash
# Уменьшить max-connections
python3 execute_sql_parallel.py --file ../queries/06_insert_t_f_budget_fact.sql --max-connections 10
```

**Missing dependencies:**
```bash
# Пересоздать виртуальное окружение
rm -rf ../venv
./setup_and_test.sh
```

**Проблема с python3-venv:**
```bash
# Установить поддержку виртуальных окружений
sudo apt install python3-venv

# Затем запустить setup
./setup_and_test.sh
```

---

## 📚 Дополнительно

- **Полная документация:** [README.md](README.md)
- **Документация скрипта:** [USAGE_PARALLEL_EXECUTOR.md](USAGE_PARALLEL_EXECUTOR.md)
- **Порядок выполнения:** [README_EXECUTION_ORDER.md](README_EXECUTION_ORDER.md)

---

**Готово к использованию!** 🎉
