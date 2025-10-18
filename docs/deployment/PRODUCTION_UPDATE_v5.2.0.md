# Production Update v5.2.0 - Deployment Guide

Руководство по применению обновлений Family Budget v5.2.0 на production сервере.

## Версия: 5.2.0

## Дата: 2023-10-18

---

## Обзор обновлений

### Что включено в v5.2.0

#### ✅ Phase 1: Критические исправления
- **Миграция 013**: Создание таблицы `t_f_refresh_token` для JWT refresh tokens
- **Nginx healthcheck**: Endpoint `/health` уже в конфигурации
- **UFW Firewall**: Автоматическая настройка портов 80, 443

#### ✅ Phase 2: Web авторизация через Telegram
- **Telegram Login Widget**: Полноценная web-авторизация через Telegram
- **Auto-fetch bot username**: Автоматическое получение username бота из Telegram API
- **GET endpoints**: `/api/v1/auth/telegram-login` и `/api/v1/auth/telegram-callback`

#### ✅ Phase 3: Автоматические бэкапы на S3
- **Cron job**: Автоматическая установка ежедневных бэкапов в 2:00 AM
- **S3 integration**: Еженедельная загрузка в Yandex Object Storage
- **Backup documentation**: Полное руководство по backup/restore

---

## Предварительная подготовка

### 1. Проверить текущее состояние системы

```bash
# На production сервере
cd /путь/к/familyBudget

# Проверить текущую версию
git log -1 --oneline

# Проверить статус контейнеров
docker compose ps

# Проверить текущее состояние базы данных
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\dt t_f_*"
```

### 2. Создать резервную копию (ОБЯЗАТЕЛЬНО!)

```bash
# Создать бэкап перед обновлением
./scripts/backup.sh --verbose

# Проверить что бэкап создан
ls -lh backups/backup_*.sql.gz | tail -1
```

### 3. Загрузить обновления с сервера разработки

```bash
# На сервере разработки (где были внесены изменения)
cd /home/ikeniborn/Documents/Project/familyBudget

# Создать git commit с обновлениями
git add .
git commit -m "feat: Family Budget v5.2.0 - Critical fixes, web auth, automatic backups

Phase 1: Critical Fixes
- Migration 013 for refresh tokens
- Nginx healthcheck configuration
- UFW firewall auto-configuration

Phase 2: Web Authorization
- Telegram Login Widget implementation
- Auto-fetch bot username from Telegram API
- GET endpoints for web login flow

Phase 3: Automatic Backups
- Cron job auto-installation in deploy.sh
- S3 integration for Yandex Object Storage
- Comprehensive backup/restore documentation

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"

# Отправить на сервер (если используется git)
git push origin telegram
```

### 4. На production сервере: Загрузить изменения

```bash
# На production сервере
cd /путь/к/familyBudget

# Создать резервную копию текущей ветки
git branch backup-$(date +%Y%m%d-%H%M%S)

# Загрузить обновления
git fetch origin
git pull origin telegram

# Проверить что изменения загружены
git log -1 --stat
```

---

## Вариант A: Автоматический деплой (РЕКОМЕНДУЕТСЯ)

### Шаг 1: Проверить конфигурацию .env

```bash
# Проверить что все необходимые переменные установлены
source .env

echo "POSTGRES_USER: $POSTGRES_USER"
echo "POSTGRES_DB: $POSTGRES_DB"
echo "TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN:0:10}..."
echo "JWT_SECRET: ${JWT_SECRET:0:10}..."

# Опционально: Проверить S3 переменные (для автоматических бэкапов)
echo "S3_BUCKET_NAME: ${S3_BUCKET_NAME:-NOT SET}"
echo "AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}..."
```

**Если S3 переменные не установлены:**
```bash
# Редактировать .env
nano .env

# Добавить следующие переменные (см. docs/deployment/BACKUP_RESTORE.md):
# AWS_ACCESS_KEY_ID=AKIA...
# AWS_SECRET_ACCESS_KEY=wJalr...
# S3_BUCKET_NAME=familybudget-backups-production
# S3_ENDPOINT_URL=https://storage.yandexcloud.net
```

### Шаг 2: Запустить ./deploy.sh

```bash
# Запустить деплой с миграциями
./deploy.sh

# Скрипт выполнит следующие действия:
# 1. Проверит prerequisites (Docker, Docker Compose)
# 2. Валидирует .env файл
# 3. Очистит старые deployment (если есть)
# 4. Выберет свободные сети
# 5. Соберёт образы (если нужно)
# 6. Запустит контейнеры
# 7. Дождётся готовности сервисов
# 8. Применит миграции (включая 013!)
# 9. Установит cron job для бэкапов
# 10. Настроит UFW firewall
# 11. Настроит SSL (если нужно)
# 12. Проверит статус системы
```

### Ожидаемый вывод

```
========================================================================
       Family Budget - Deployment Script
========================================================================

✓ Checking prerequisites...
✓ Validating .env file...
✓ Cleaning up old deployment...
✓ Selecting network subnets...
✓ Building images...
✓ Starting services...
✓ Waiting for services to be ready...

========================================================================
Running Database Migrations
========================================================================

Found 1 pending migration(s):
  013_create_refresh_tokens_table.sql

Applying migration: 013_create_refresh_tokens_table.sql
✓ Migration 013 applied successfully

Verifying critical tables...
✓ Table t_f_refresh_token exists (13 columns)

All migrations completed successfully.

========================================================================
Setting up automatic backups...
========================================================================

✓ Log directory created: /var/log/familybudget
✓ Backup cron job installed
Schedule: Daily at 2:00 AM
Logs: /var/log/familybudget/cron.log
Backup logs: /путь/к/проекту/backups/logs/
S3 uploads: Weekly on Sundays to s3://familybudget-backups-production/

========================================================================
Configuring firewall for SSL...
========================================================================

Options:
  [1] Open ports 80 and 443 (required for new SSL certificate)
  [2] Open port 443 only (if certificate already exists)
  [3] Skip firewall configuration (manual setup required)

Select [1-3]: 1

✓ Ports 80 and 443 are now open in firewall

========================================================================
DEPLOYMENT SUCCESSFUL
========================================================================

Access Points:
  Backend API: http://your-domain:8000
  API Docs: http://your-domain:8000/docs
  Web Login: http://your-domain:8000/auth/telegram-login
  Health: http://your-domain:8000/health
```

---

## Верификация обновлений

### 1. Проверить миграцию 013

```bash
# Проверить что таблица t_f_refresh_token создана
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\d t_f_refresh_token"

# Ожидаемый вывод:
#                                      Table "public.t_f_refresh_token"
#      Column      |            Type             | Nullable |                      Default
# -----------------+-----------------------------+----------+---------------------------------------------------
#  id              | integer                     | not null | nextval('t_f_refresh_token_id_seq'::regclass)
#  user_id         | integer                     | not null |
#  token           | character varying(500)      | not null |
#  ...
```

### 2. Проверить Nginx healthcheck

```bash
# HTTP запрос к /health endpoint
curl http://localhost:8000/health

# Ожидаемый вывод:
# {"status":"healthy","version":"4.0.0"}

# Через nginx (если настроен)
curl http://your-domain/health
```

### 3. Проверить UFW firewall

```bash
# Проверить статус UFW
sudo ufw status

# Ожидаемый вывод:
# Status: active
#
# To                         Action      From
# --                         ------      ----
# 22/tcp                     ALLOW       Anywhere
# 80/tcp                     ALLOW       Anywhere    # HTTP for SSL challenge
# 443/tcp                    ALLOW       Anywhere    # HTTPS
```

### 4. Проверить auto-fetch bot username

```bash
# Проверить логи backend при запуске
docker compose logs backend | grep "Bot username"

# Ожидаемый вывод:
# backend  | Bot username auto-configured: @ikenibornbudgetbot
# или
# backend  | Using configured bot username: @ikenibornbudgetbot
```

### 5. Проверить Telegram Login Widget

```bash
# Открыть в браузере
open http://your-domain:8000/auth/telegram-login

# Должна открыться страница с Telegram Login Widget
# Виджет должен отображать корректный bot username
```

### 6. Проверить cron job для бэкапов

```bash
# Проверить что cron job установлен
sudo ls -la /etc/cron.d/familybudget-backup

# Проверить содержимое
sudo cat /etc/cron.d/familybudget-backup

# Ожидаемый вывод:
# SHELL=/bin/bash
# PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
# MAILTO=""
#
# # Run daily at 2:00 AM
# 0 2 * * * root cd /путь/к/проекту && set -a && source .env && set +a && ./scripts/backup.sh >> /var/log/familybudget/cron.log 2>&1

# Проверить статус cron сервиса
sudo systemctl status cron
```

### 7. Тестовый запуск бэкапа

```bash
# Запустить бэкап вручную
./scripts/backup.sh --verbose

# Проверить что бэкап создан
ls -lh backups/backup_*.sql.gz | tail -1

# Если S3 настроен, проверить загрузку в S3
./scripts/backup.sh --force-s3 --verbose

# Проверить что файл в S3
source .env
aws s3 ls s3://$S3_BUCKET_NAME/ --endpoint-url $S3_ENDPOINT_URL --recursive
```

---

## Тестирование функциональности

### 1. Telegram Bot авторизация (/start)

```bash
# В Telegram:
# 1. Открыть чат с ботом @ikenibornbudgetbot
# 2. Отправить команду /start
# 3. Проверить что бот отвечает и авторизация работает

# Проверить логи бота
docker compose logs bot | tail -50
```

### 2. Web авторизация через Telegram Widget

```bash
# В браузере:
# 1. Открыть http://your-domain:8000/auth/telegram-login
# 2. Нажать кнопку "Login with Telegram"
# 3. Авторизоваться через Telegram
# 4. Проверить что редирект на dashboard работает

# Проверить логи backend
docker compose logs backend | grep "telegram-callback"
```

### 3. API Endpoints

```bash
# Healthcheck
curl http://your-domain:8000/health

# Readiness
curl http://your-domain:8000/ready

# API docs
open http://your-domain:8000/docs
```

---

## Rollback (если что-то пошло не так)

### Вариант 1: Откат к предыдущей версии через git

```bash
# Остановить сервисы
docker compose down

# Откатиться к предыдущему коммиту
git log --oneline | head -5
git checkout <предыдущий-commit-hash>

# Восстановить из бэкапа
BACKUP_FILE="backups/backup_20231018_120000.sql.gz"

# Запустить только postgres
docker compose up -d postgres

# Загрузить .env
source .env

# Восстановить базу данных
docker compose exec -T postgres psql -U $POSTGRES_USER -d postgres -c "DROP DATABASE IF EXISTS $POSTGRES_DB;"
docker compose exec -T postgres psql -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $POSTGRES_DB;"
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

# Запустить все сервисы
docker compose up -d

# Проверить статус
docker compose ps
curl http://localhost:8000/health
```

### Вариант 2: Удаление миграции 013 (если проблема в ней)

```bash
# НЕ РЕКОМЕНДУЕТСЯ! Используйте только если точно уверены.

# Остановить сервисы
docker compose down

# Удалить таблицу refresh_token
docker compose up -d postgres
source .env
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "DROP TABLE IF EXISTS t_f_refresh_token CASCADE;"

# Удалить запись о миграции
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "DELETE FROM t_d_migration WHERE migration_file = '013_create_refresh_tokens_table.sql';"

# Запустить все сервисы
docker compose up -d
```

---

## Monitoring & Logs

### Полезные команды для мониторинга

```bash
# Общий статус
docker compose ps

# Логи всех сервисов
docker compose logs -f

# Логи конкретного сервиса
docker compose logs -f backend
docker compose logs -f postgres
docker compose logs -f bot

# Логи cron бэкапов
tail -f /var/log/familybudget/cron.log

# Логи самих бэкапов
tail -f backups/logs/backup_$(date +%Y%m%d).log

# Мониторинг дискового пространства
df -h
du -sh backups/

# Проверка ресурсов контейнеров
docker stats
```

---

## Контрольный список (Checklist)

### Перед деплоем

- [ ] Создан резервный бэкап базы данных
- [ ] Проверена конфигурация .env файла
- [ ] Загружены обновления с git
- [ ] Пользователи уведомлены о предстоящем обновлении

### После деплоя

- [ ] Миграция 013 применена успешно
- [ ] Таблица t_f_refresh_token создана
- [ ] Nginx healthcheck работает (GET /health)
- [ ] UFW firewall настроен (порты 80, 443)
- [ ] Bot username auto-fetched из Telegram API
- [ ] Telegram Bot авторизация работает (/start)
- [ ] Web авторизация через Widget работает
- [ ] Cron job для бэкапов установлен
- [ ] Тестовый бэкап выполнен успешно
- [ ] S3 загрузка работает (если настроена)
- [ ] API endpoints отвечают корректно
- [ ] Все контейнеры в статусе "healthy"
- [ ] Логи не содержат критических ошибок

### Через 24 часа

- [ ] Проверить что автоматический бэкап выполнился (2:00 AM)
- [ ] Проверить логи: /var/log/familybudget/cron.log
- [ ] Проверить что новый бэкап создан: ls -lh backups/
- [ ] Мониторинг дискового пространства
- [ ] Проверка метрик производительности

---

## Дополнительная документация

### Основные документы

- **[PROJECT_STATUS_REPORT.md](../PROJECT_STATUS_REPORT.md)** - Текущий статус проекта
- **[BACKUP_RESTORE.md](BACKUP_RESTORE.md)** - Полное руководство по бэкапам
- **[APPLY_MIGRATION_013.md](APPLY_MIGRATION_013.md)** - Детали миграции 013
- **[PHASE1_DEPLOYMENT_GUIDE.md](PHASE1_DEPLOYMENT_GUIDE.md)** - Руководство Phase 1

### Скрипты

- `deploy.sh` - Основной скрипт деплоя
- `setup.sh` - Интерактивная настройка .env
- `scripts/backup.sh` - Скрипт резервного копирования
- `backend/db/run_migrations.sh` - Применение миграций вручную

### API Документация

- OpenAPI docs: http://your-domain:8000/docs
- ReDoc: http://your-domain:8000/redoc

---

## Контакты и поддержка

### При возникновении проблем

1. Проверьте раздел [Troubleshooting](#rollback-если-что-то-пошло-не-так)
2. Изучите логи: `docker compose logs -f`
3. Проверьте документацию в `docs/deployment/`
4. Создайте issue в репозитории проекта

### Полезные ссылки

- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Telegram Bot API](https://core.telegram.org/bots/api)

---

**Версия документа:** 1.0
**Дата создания:** 2023-10-18
**Автор:** Claude Code + ikeniborn
**Статус:** ✅ Ready for Production Deployment

**Успешного деплоя! 🚀**
