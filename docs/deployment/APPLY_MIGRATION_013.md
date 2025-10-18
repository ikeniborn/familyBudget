# Инструкция: Применение миграции 013

**Дата:** 2025-10-18
**Миграция:** `013_create_refresh_tokens_table.sql`
**Цель:** Создать таблицу `t_f_refresh_token` для JWT refresh token механизма
**Приоритет:** CRITICAL (блокирует авторизацию)

---

## Проблема

Таблица `t_f_refresh_token` отсутствует в production БД, что приводит к:
- ❌ Telegram Bot `/start` → 500 DATABASE_ERROR
- ❌ Web авторизация не работает
- ❌ Невозможно залогиниться в систему

## Решение

Применить миграцию 013 вручную к production базе данных.

---

## Шаг 1: Копирование файлов на сервер

```bash
# На локальной машине
cd ~/Documents/Project/familyBudget

# Копируем обновлённые файлы на production
./setup.sh
```

**Что копируется:**
- `backend/db/migrations/013_create_refresh_tokens_table.sql`
- Обновлённые конфигурации (nginx, deploy.sh и т.д.)

---

## Шаг 2: Применение миграции

### Вариант A: Через Docker (Рекомендуется)

```bash
# SSH на сервер
ssh user@budget-dev.ikeniborn.ru

# Переход в deploy директорию
cd /opt/budget

# Проверка что PostgreSQL контейнер работает
sudo docker compose ps postgres

# Применение миграции
sudo docker compose exec -T postgres psql -U familybudget familybudget < backend/db/migrations/013_create_refresh_tokens_table.sql

# Ожидаемый вывод:
# CREATE TABLE
# CREATE INDEX
# CREATE INDEX
# CREATE INDEX
# CREATE INDEX
# COMMENT
# (далее комментарии к колонкам...)
```

### Вариант B: Через run_migrations.sh

```bash
# На сервере
cd /opt/budget/backend/db

# Загрузка переменных окружения
set -a && source /opt/budget/.env && set +a

# Запуск миграций
./run_migrations.sh run

# Проверка статуса
./run_migrations.sh status
```

---

## Шаг 3: Верификация

### 3.1 Проверка существования таблицы

```bash
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "\d t_f_refresh_token"
```

**Ожидаемый вывод:**
```
                            Table "public.t_f_refresh_token"
    Column    |            Type             | Collation | Nullable |      Default
--------------+-----------------------------+-----------+----------+-------------------
 id           | integer                     |           | not null | nextval('...')
 user_id      | integer                     |           | not null |
 token_hash   | character varying(255)      |           | not null |
 expires_at   | timestamp without time zone |           | not null |
 is_revoked   | boolean                     |           | not null | false
 created_at   | timestamp without time zone |           | not null | CURRENT_TIMESTAMP
 last_used_at | timestamp without time zone |           |          |
 revoked_at   | timestamp without time zone |           |          |
Indexes:
    "t_f_refresh_token_pkey" PRIMARY KEY, btree (id)
    "t_f_refresh_token_token_hash_key" UNIQUE CONSTRAINT, btree (token_hash)
    (plus 4 additional indexes...)
```

### 3.2 Проверка всех критических таблиц

```bash
# Скрипт проверки
for table in t_d_user t_d_article t_f_budget_fact t_f_refresh_token t_d_article_hierarchy; do
    echo -n "Checking $table: "
    sudo docker compose exec -T postgres psql -U familybudget familybudget -c "\d $table" >/dev/null 2>&1 && echo "✓ EXISTS" || echo "✗ MISSING"
done
```

**Ожидаемый результат:**
```
Checking t_d_user: ✓ EXISTS
Checking t_d_article: ✓ EXISTS
Checking t_f_budget_fact: ✓ EXISTS
Checking t_f_refresh_token: ✓ EXISTS
Checking t_d_article_hierarchy: ✓ EXISTS
```

### 3.3 Проверка индексов

```bash
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "
SELECT indexname
FROM pg_indexes
WHERE tablename = 't_f_refresh_token'
ORDER BY indexname;"
```

**Ожидаемый вывод (5 индексов):**
```
             indexname
------------------------------------
 idx_refresh_token_active
 idx_refresh_token_expires_at
 idx_refresh_token_hash
 idx_refresh_token_user_id
 t_f_refresh_token_pkey
 t_f_refresh_token_token_hash_key
```

---

## Шаг 4: Перезапуск контейнеров

```bash
# Перезапуск backend и bot (применят новую схему БД)
sudo docker compose restart backend bot

# Ожидание запуска (10 секунд)
sleep 10

# Проверка статуса
sudo docker compose ps
```

**Ожидаемый результат:**
```
NAME                    STATUS
familybudget-backend    Up X seconds (healthy)
familybudget-bot        Up X seconds
familybudget-nginx      Up X hours (healthy)
familybudget-postgres   Up X hours (healthy)
```

---

## Шаг 5: Функциональное тестирование

### 5.1 Проверка Telegram Bot

```bash
# В Telegram
/start

# Ожидаемое поведение:
# ✓ Бот отвечает приветственным сообщением
# ✓ Пользователь создаётся в БД
# ✓ Нет ошибок 500 DATABASE_ERROR
```

### 5.2 Проверка логов backend

```bash
# Проверка последних логов на ошибки
sudo docker compose logs backend --tail=50 | grep -i "error\|refresh_token"

# Не должно быть:
# ❌ "relation t_f_refresh_token does not exist"
# ❌ "UndefinedTableError"
```

### 5.3 Проверка health endpoint

```bash
# Проверка детального health check
curl -s http://localhost:8000/health/detailed | jq .

# Ожидаемый результат:
# {
#   "status": "healthy",
#   "database": "connected",
#   ...
# }
```

---

## Возможные проблемы

### Проблема 1: "permission denied" при применении миграции

**Причина:** Недостаточно прав у пользователя PostgreSQL

**Решение:**
```bash
# Проверка прав
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "\du"

# Пользователь familybudget должен иметь CREATE privilege
```

### Проблема 2: Миграция уже применена (duplicate table)

**Причина:** Таблица уже существует

**Решение:**
```bash
# Проверка существования
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "\d t_f_refresh_token"

# Если таблица есть - миграция не нужна, переходите к Шагу 4
```

### Проблема 3: Foreign key constraint fails

**Причина:** Таблица `t_d_user` не существует

**Решение:**
```bash
# Применить все миграции по порядку
cd /opt/budget/backend/db
set -a && source /opt/budget/.env && set +a
./run_migrations.sh run
```

---

## Rollback (если что-то пошло не так)

```bash
# Удаление таблицы (ВНИМАНИЕ: потеря данных!)
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "
DROP TABLE IF EXISTS t_f_refresh_token CASCADE;
"

# Откат через бэкап (если есть)
gunzip < /opt/budget/backups/backup_YYYYMMDD_HHMMSS.sql.gz | \
    sudo docker compose exec -T postgres psql -U familybudget familybudget
```

---

## Checklist завершения

- [ ] Файлы скопированы на сервер через `./setup.sh`
- [ ] Миграция 013 применена успешно
- [ ] Таблица `t_f_refresh_token` существует
- [ ] Все 5 индексов созданы
- [ ] Контейнеры backend и bot перезапущены
- [ ] Telegram Bot `/start` работает без ошибок
- [ ] Логи backend не содержат ошибок БД
- [ ] Health check возвращает "healthy"

---

## Результат

После успешного выполнения:
- ✅ Таблица `t_f_refresh_token` создана
- ✅ Telegram Bot авторизация работает
- ✅ Web авторизация разблокирована (после Phase 2)
- ✅ Можно продолжать работу с системой

---

**Автор:** Claude Code
**Задача:** ФАЗА 1 - Задача 1
**Связанные документы:**
- [PROJECT_STATUS_REPORT.md](../PROJECT_STATUS_REPORT.md)
- [DEPLOYMENT_FIX_CRITICAL_ISSUES.md](./DEPLOYMENT_FIX_CRITICAL_ISSUES.md)
