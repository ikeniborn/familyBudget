# Phase 1: Руководство по развёртыванию критических исправлений

**Дата:** 2025-10-18
**Версия:** v5.2.0
**Приоритет:** CRITICAL
**Время выполнения:** 10-15 минут

---

## Обзор

Это руководство описывает процесс применения критических исправлений из Фазы 1:

1. ✅ Применение миграции 013 (таблица `t_f_refresh_token`)
2. ✅ Исправление nginx healthcheck
3. ✅ Настройка UFW firewall
4. ✅ Перезапуск контейнеров
5. ✅ Верификация системы

---

## Что изменилось

### Исправленные файлы:

1. **deploy.sh** - добавлена автоматическая проверка `t_f_refresh_token`
2. **nginx/conf.d/app.conf.template** - добавлен `location /health`
3. **backend/db/migrations/013_create_refresh_tokens_table.sql** - миграция для refresh tokens
4. **scripts/fix_phase1_critical.sh** - новый скрипт для автоматического исправления

### Что будет автоматически:

- ✅ Миграции применяются при каждом деплое (через `deploy.sh`)
- ✅ Проверка критических таблиц (включая `t_f_refresh_token`)
- ✅ Nginx healthcheck работает из коробки
- ✅ UFW правила настраиваются автоматически

---

## Метод 1: Автоматическое развёртывание (Рекомендуется)

Этот метод использует обновлённый `deploy.sh` который автоматически применяет все миграции.

### Шаг 1: Обновление файлов на production

```bash
# На локальной машине
cd ~/Documents/Project/familyBudget

# Копируем обновлённые файлы на production
./setup.sh
```

**Что происходит:**
- Копируются все файлы из репозитория в `/opt/budget/`
- Обновляется deploy.sh с новой логикой миграций
- Обновляется nginx конфигурация
- Копируется миграция 013

### Шаг 2: Перезапуск deployment

```bash
# SSH на production сервер
ssh user@budget-dev.ikeniborn.ru

# Переход в deploy директорию
cd /opt/budget

# Запуск deploy с применением миграций
sudo ./deploy.sh --build

# ИЛИ без rebuild (быстрее):
sudo ./deploy.sh
```

**Ожидаемый вывод:**
```
========================================
Family Budget - Production Deployment
========================================

✓ Prerequisites validated
✓ Services started
✓ Waiting for services to be healthy...
✓ Running database migrations...
  Found 13 SQL migration files
  Applying migration: 001_create_t_d_user.sql
  ...
  Applying migration: 013_create_refresh_tokens_table.sql
  ✓ Database migrations completed
✓ Verifying database schema...
  ✓ All critical tables verified
✓ Deployment completed successfully!
```

### Шаг 3: Проверка результата

```bash
# Проверка контейнеров
sudo docker compose ps

# Проверка таблицы
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "\d t_f_refresh_token"

# Проверка health endpoint
curl http://localhost:8000/health
```

---

## Метод 2: Ручное применение (Если Метод 1 не сработал)

Используйте этот метод если автоматический deploy не применил миграции.

### Шаг 1: Применение миграции вручную

```bash
# На production сервере
cd /opt/budget

# Применение миграции 013
sudo docker compose exec -T postgres psql -U familybudget familybudget < backend/db/migrations/013_create_refresh_tokens_table.sql

# Проверка результата
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "\d t_f_refresh_token"
```

**Ожидаемый вывод:**
```
CREATE TABLE
CREATE INDEX
CREATE INDEX
CREATE INDEX
CREATE INDEX
COMMENT
```

### Шаг 2: Настройка UFW

```bash
# Разрешить HTTP (80)
sudo ufw allow 80/tcp comment 'HTTP'

# Разрешить HTTPS (443)
sudo ufw allow 443/tcp comment 'HTTPS'

# Разрешить PostgreSQL с определённого IP
sudo ufw allow from 78.107.114.37 to any port 5432 proto tcp comment 'PostgreSQL external access'

# Проверка правил
sudo ufw status numbered | grep -E "80|443|5432"
```

### Шаг 3: Перезагрузка nginx и контейнеров

```bash
# Проверка nginx конфигурации
sudo docker compose exec nginx nginx -t

# Перезагрузка nginx
sudo docker compose exec nginx nginx -s reload

# Перезапуск backend и bot
sudo docker compose restart backend bot

# Ожидание запуска
sleep 10

# Проверка статуса
sudo docker compose ps
```

---

## Метод 3: Автоматический скрипт исправлений

Самый быстрый способ - использовать готовый скрипт.

```bash
# На production сервере
cd /opt/budget

# Сделать скрипт исполняемым
chmod +x scripts/fix_phase1_critical.sh

# Запустить исправления
sudo ./scripts/fix_phase1_critical.sh
```

**Что делает скрипт:**
1. Проверяет prerequisites (Docker, PostgreSQL)
2. Применяет миграцию 013
3. Перезагружает nginx конфигурацию
4. Настраивает UFW firewall
5. Перезапускает backend и bot
6. Верифицирует все критические таблицы
7. Показывает summary

---

## Верификация (Обязательно!)

После применения любого метода выполните проверку:

### 1. Проверка критических таблиц

```bash
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

### 2. Проверка контейнеров

```bash
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

### 3. Проверка health endpoint

```bash
curl -s http://localhost:8000/health | jq .
```

**Ожидаемый результат:**
```json
{
  "status": "healthy",
  "database": "connected",
  "version": "5.2.0"
}
```

### 4. Проверка nginx healthcheck

```bash
curl -s http://localhost/health | jq .
```

**Должен вернуть тот же JSON что и выше.**

### 5. Проверка логов

```bash
# Проверка на ошибки БД
sudo docker compose logs backend --tail=50 | grep -i "refresh_token\|error"

# Не должно быть:
# ❌ "relation t_f_refresh_token does not exist"
# ❌ "UndefinedTableError"
```

### 6. Проверка UFW

```bash
sudo ufw status numbered | grep -E "80|443|5432"
```

**Ожидаемый результат:**
```
[X] 80/tcp                     ALLOW IN    Anywhere                   # HTTP
[Y] 443/tcp                    ALLOW IN    Anywhere                   # HTTPS
[Z] 5432/tcp                   ALLOW IN    78.107.114.37              # PostgreSQL external access
```

---

## Функциональное тестирование

### Тест 1: Telegram Bot авторизация

1. Откройте Telegram
2. Найдите бота `@ikenibornbudgetbot`
3. Отправьте команду `/start`

**Ожидаемое поведение:**
- ✅ Бот отвечает приветственным сообщением
- ✅ Пользователь создаётся в БД
- ✅ НЕТ ошибок 500 DATABASE_ERROR

**Если ошибка:**
```bash
# Проверка логов бота
sudo docker compose logs bot --tail=50

# Проверка логов backend
sudo docker compose logs backend --tail=50 | grep -i "telegram\|auth"
```

### Тест 2: Web доступность

```bash
# Локально на сервере
curl -I http://localhost:8000/

# Извне (замените на ваш домен)
curl -I https://budget-dev.ikeniborn.ru/
```

**Ожидаемый результат:**
```
HTTP/1.1 200 OK
```

---

## Troubleshooting

### Проблема 1: Миграция не применяется автоматически

**Симптомы:**
```
✗ Missing critical tables: t_f_refresh_token
```

**Решение:**
```bash
# Применить вручную
cd /opt/budget
sudo docker compose exec -T postgres psql -U familybudget familybudget < backend/db/migrations/013_create_refresh_tokens_table.sql
```

### Проблема 2: Nginx healthcheck fails

**Симптомы:**
```bash
sudo docker compose ps nginx
# nginx (unhealthy)
```

**Решение:**
```bash
# Проверка конфигурации
sudo docker compose exec nginx nginx -t

# Если ошибка - проверьте app.conf
sudo docker compose exec nginx cat /etc/nginx/conf.d/app.conf | grep "location /health"

# Должно быть два блока:
# - В HTTP server (порт 80)
# - В HTTPS server (порт 443, закомментирован)

# Перезагрузка
sudo docker compose exec nginx nginx -s reload
```

### Проблема 3: Backend не подключается к БД

**Симптомы:**
```
Error: could not connect to database
```

**Решение:**
```bash
# Проверка что PostgreSQL работает
sudo docker compose ps postgres

# Проверка подключения
sudo docker compose exec -T postgres pg_isready -U familybudget -d familybudget

# Перезапуск backend
sudo docker compose restart backend

# Проверка через 10 секунд
sleep 10
sudo docker compose logs backend --tail=20
```

### Проблема 4: UFW блокирует доступ

**Симптомы:**
- Сайт не открывается извне
- PostgreSQL недоступен с рабочей машины

**Решение:**
```bash
# Проверка статуса UFW
sudo ufw status verbose

# Проверка конкретных портов
sudo ufw status numbered | grep -E "80|443|5432"

# Добавление правил (если отсутствуют)
sudo ufw allow 80/tcp comment 'HTTP'
sudo ufw allow 443/tcp comment 'HTTPS'
sudo ufw allow from 78.107.114.37 to any port 5432 proto tcp comment 'PostgreSQL'

# Перезагрузка UFW
sudo ufw reload
```

---

## Rollback (если что-то пошло не так)

### Откат миграции

```bash
# Удаление таблицы (ВНИМАНИЕ: потеря данных!)
sudo docker compose exec -T postgres psql -U familybudget familybudget -c "
DROP TABLE IF EXISTS t_f_refresh_token CASCADE;
"
```

### Откат через бэкап

```bash
# Список бэкапов
ls -lh /opt/budget/backups/

# Восстановление из последнего бэкапа
gunzip < /opt/budget/backups/backup_YYYYMMDD_HHMMSS.sql.gz | \
    sudo docker compose exec -T postgres psql -U familybudget familybudget

# Перезапуск
sudo docker compose restart backend bot
```

### Откат deployment

```bash
# Остановка
sudo docker compose down

# Откат на предыдущую версию кода
cd ~/Documents/Project/familyBudget
git checkout <previous-commit>
./setup.sh

# Новый deploy
cd /opt/budget
sudo ./deploy.sh
```

---

## Checklist завершения Phase 1

- [ ] Файлы скопированы на production через `./setup.sh`
- [ ] Deployment выполнен через `./deploy.sh` или `./deploy.sh --build`
- [ ] Миграция 013 применена (автоматически или вручную)
- [ ] Таблица `t_f_refresh_token` существует и содержит 6 индексов
- [ ] Nginx healthcheck работает (проверено через `curl /health`)
- [ ] UFW правила настроены (80, 443, 5432)
- [ ] Все контейнеры в статусе `healthy` или `Up`
- [ ] Telegram Bot `/start` работает без ошибок
- [ ] Backend логи не содержат database errors
- [ ] Health endpoint возвращает `"status": "healthy"`

---

## Следующие шаги

После успешного завершения Phase 1:

1. **Phase 2:** Реализация Web авторизации (Telegram Login Widget)
   - GET endpoint `/api/v1/auth/telegram-login`
   - HTML template с Telegram Widget
   - Callback обработка
   - E2E тесты

2. **Phase 3:** Настройка автоматических бэкапов на S3
   - Установка cron job
   - Конфигурация S3 credentials
   - Тестирование backup/restore

---

**Автор:** Claude Code
**Задача:** PHASE-1 Critical Fixes
**Связанные документы:**
- [PROJECT_STATUS_REPORT.md](../PROJECT_STATUS_REPORT.md)
- [APPLY_MIGRATION_013.md](./APPLY_MIGRATION_013.md)
- [DEPLOYMENT_FIX_CRITICAL_ISSUES.md](./DEPLOYMENT_FIX_CRITICAL_ISSUES.md)
