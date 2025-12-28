# Backup & Restore - Family Budget

**Содержание:**
- [Быстрый старт](#быстрый-старт) - команды без объяснений
- [Локальный бэкап](#локальный-бэкап) - ручное создание
- [Локальное восстановление](#локальное-восстановление) - из файла
- [S3 бэкапы](#s3-бэкапы) - настройка и использование
- [S3 восстановление](#s3-восстановление) - из облака
- [Аварийное восстановление](#аварийное-восстановление) - 5 сценариев
- [Решение проблем](#решение-проблем) - частые ошибки
- [Exit коды](#exit-коды) - расшифровка
- [FAQ](#faq) - частые вопросы

---

## Быстрый старт

### Создать бэкап (2 минуты)

```bash
cd /opt/budget
./scripts/backup.sh
```

**Результат:** `/opt/budget/backups/backup_20251223_143055.sql.gz` (5-10 MB)

### Восстановить из бэкапа (5 минут)

```bash
./scripts/restore.sh
# 1 → Local backups
# Выбрать номер → 1
# Ввести yes
```

**Результат:** БД восстановлена, сервисы перезапущены

---

## Локальный бэкап

### Создание бэкапа

```bash
cd /opt/budget
./scripts/backup.sh
```

**Что происходит:**
1. Проверка зависимостей (1-2 сек)
2. Создание lock файла
3. `pg_dump` + `gzip` → `/opt/budget/backups/backup_YYYYMMDD_HHMMSS.sql.gz` (30-60 сек)
4. Удаление старых бэкапов (>7 дней)
5. Загрузка в S3 (если настроено, 30-120 сек)

**Опции:**
```bash
./scripts/backup.sh --force-s3    # Принудительная загрузка в S3
./scripts/backup.sh --verbose     # Подробные логи
```

### Проверка бэкапа

```bash
# Список бэкапов
ls -lh /opt/budget/backups/backup_*.sql.gz

# Проверка целостности
gzip -t /opt/budget/backups/backup_20251223_143055.sql.gz

# Просмотр содержимого
zcat /opt/budget/backups/backup_20251223_143055.sql.gz | head -50
```

### Настройка

**Переменные в `/opt/budget/.env`:**
```bash
POSTGRES_USER=familybudget
POSTGRES_DB=familybudget
POSTGRES_PASSWORD=<пароль>
BACKUP_DIR=/opt/budget/backups  # По умолчанию
LOCAL_RETENTION_DAYS=7           # По умолчанию
```

### Автоматизация

**Cron (уже настроен при деплое):**
```bash
0 2 * * * /opt/budget/scripts/backup.sh >> /opt/budget/logs/backup.log 2>&1
```

**Проверка логов:**
```bash
tail -50 /opt/budget/backups/logs/backup_$(date +%Y%m%d).log
```

---

## Локальное восстановление

### Интерактивный режим (рекомендуется)

```bash
cd /opt/budget
./scripts/restore.sh
```

**Диалог:**
```
1) Local backups
2) S3 backups
3) Cancel

Selection: 1

1) backup_20251223_143055.sql.gz  (5.2 MB, 1 min ago)
2) backup_20251222_020000.sql.gz  (5.1 MB, 1 day ago)

Select: 1

Type 'yes' to proceed: yes
```

**Процесс:**
1. Валидация файла (gzip + SQL структура)
2. Safety backup → `/opt/budget/backups/safety_backup_before_restore_*.sql.gz`
3. Остановка `backend` и `bot`
4. Завершение подключений к БД
5. `DROP DATABASE` + `CREATE DATABASE`
6. `zcat backup.sql.gz | psql` (1-3 мин)
7. Запуск сервисов

### Прямое восстановление

```bash
# С подтверждением
./scripts/restore.sh --backup-file /opt/budget/backups/backup_20251223_143055.sql.gz

# Без подтверждения (автоматизация)
./scripts/restore.sh --backup-file /opt/budget/backups/backup_20251223_143055.sql.gz --yes
```

### Откат на safety backup

```bash
# Если восстановление дало неправильный результат
./scripts/restore.sh --backup-file /opt/budget/backups/safety_backup_before_restore_*.sql.gz --yes
```

### Проверка после восстановления

```bash
# Подключение к БД
docker compose exec postgres psql -U familybudget -d familybudget -c "SELECT 1;"

# Количество записей
docker compose exec postgres psql -U familybudget -d familybudget -c "
SELECT schemaname, tablename, n_live_tup FROM pg_stat_user_tables
ORDER BY n_live_tup DESC LIMIT 10;"

# Health check
curl http://localhost:8000/health

# Логи backend
docker compose logs backend | tail -50 | grep -i error
```

---

## S3 бэкапы

### Настройка S3

**1. Создать bucket** (Yandex Cloud / AWS / DigitalOcean / etc.)

**2. Создать ключи доступа**

**3. Добавить в `/opt/budget/.env`:**
```bash
# Yandex Object Storage
S3_ENDPOINT_URL=https://storage.yandexcloud.net
S3_ACCESS_KEY_ID=YCA...
S3_SECRET_ACCESS_KEY=YCM...
S3_BUCKET_NAME=familybudget-backups
S3_REGION=us-east-1
```

**Другие провайдеры:**
```bash
# AWS S3
S3_ENDPOINT_URL=https://s3.amazonaws.com

# DigitalOcean Spaces
S3_ENDPOINT_URL=https://nyc3.digitaloceanspaces.com

# MinIO (self-hosted)
S3_ENDPOINT_URL=http://localhost:9000
```

**4. Проверка подключения:**
```bash
python3 scripts/s3_backup.py list --bucket familybudget-backups
```

### Автоматическая загрузка в S3

**Как работает:**
- Ежедневный `cron` в 2:00 создает локальный бэкап
- Автоматически загружается в S3 (если настроено)
- Retry 3 раза при ошибке
- Если S3 не доступен → локальный бэкап сохраняется

**Структура в S3:**
```
s3://familybudget-backups/
└── postgresql-backups/
    └── 2025/
        └── 12/
            ├── backup_20251223_020000.sql.gz
            ├── backup_20251222_020000.sql.gz
            └── ...
```

**Ретеншн:**
- Локальные бэкапы: 7 дней
- S3 бэкапы: 28 дней

### Ручная загрузка в S3

```bash
# Принудительная загрузка текущего бэкапа
./scripts/backup.sh --force-s3

# Загрузка конкретного файла
python3 scripts/s3_backup.py upload \
  /opt/budget/backups/backup_20251223_143055.sql.gz \
  postgresql-backups/2025/12/backup_20251223_143055.sql.gz \
  --bucket familybudget-backups
```

### Список бэкапов в S3

```bash
python3 scripts/s3_backup.py list --bucket familybudget-backups
```

**Вывод:**
```
2025-12-23 02:00:00  backup_20251223_020000.sql.gz  (5.2 MB)
2025-12-22 02:00:00  backup_20251222_020000.sql.gz  (5.1 MB)
...
```

### Очистка старых бэкапов S3

```bash
# Удалить бэкапы старше 28 дней
python3 scripts/s3_backup.py cleanup --retention-days 28 --bucket familybudget-backups

# Удалить бэкапы старше 60 дней
python3 scripts/s3_backup.py cleanup --retention-days 60 --bucket familybudget-backups
```

---

## S3 восстановление

### Интерактивный режим

```bash
./scripts/restore.sh
```

**Диалог:**
```
1) Local backups
2) S3 backups  ← Выбрать
3) Cancel

Selection: 2

Fetching S3 backups...

1) backup_20251223_020000.sql.gz  (5.2 MB, 1 day ago)
2) backup_20251222_020000.sql.gz  (5.1 MB, 2 days ago)
...

Select: 1

Downloading from S3... [████████████████] 100%
Downloaded to /tmp/familybudget_restore_temp_*.sql.gz

Type 'yes' to proceed: yes
```

**Процесс:**
1. Скачивание из S3 (15-60 сек)
2. Валидация файла
3. Восстановление (как локальный бэкап)
4. Удаление временного файла

### Ручная загрузка + восстановление

```bash
# 1. Скачать из S3
python3 scripts/s3_backup.py download \
  postgresql-backups/2025/12/backup_20251209_020000.sql.gz \
  /tmp/backup_from_s3.sql.gz \
  --bucket familybudget-backups

# 2. Проверить
gzip -t /tmp/backup_from_s3.sql.gz

# 3. Восстановить
./scripts/restore.sh --backup-file /tmp/backup_from_s3.sql.gz

# 4. Удалить временный файл
rm /tmp/backup_from_s3.sql.gz
```

### AWS CLI (альтернатива)

```bash
# Список
aws s3 ls s3://familybudget-backups/postgresql-backups/ \
  --recursive --endpoint-url https://storage.yandexcloud.net

# Скачать
aws s3 cp \
  s3://familybudget-backups/postgresql-backups/2025/12/backup_20251223_020000.sql.gz \
  /tmp/backup.sql.gz \
  --endpoint-url https://storage.yandexcloud.net
```

---

## Аварийное восстановление

### Сценарий 1: PostgreSQL контейнер упал

**Симптомы:** `docker compose ps` показывает `postgres` в статусе `Exited`

**Восстановление:**
```bash
cd /opt/budget
docker compose restart postgres
docker compose logs postgres | tail -50
```

**Время:** 1-2 минуты
**Потеря данных:** Нет

---

### Сценарий 2: Повреждение данных

**Симптомы:** Ошибки запросов, INDEX corruption, странные результаты

**Восстановление:**
```bash
# 1. Остановить запись
docker compose stop backend bot

# 2. Создать снапшот текущего состояния
./scripts/backup.sh

# 3. Восстановить из последнего рабочего бэкапа
./scripts/restore.sh
# Выбрать бэкап ДО появления проблемы

# 4. Проверить
curl http://localhost:8000/health/detailed
```

**Время:** 5-10 минут
**Потеря данных:** До 1 дня (зависит от бэкапа)

---

### Сценарий 3: Случайный DELETE

**Симптомы:** Пользователь удалил важные данные

**Восстановление:**
```bash
# 1. Найти последний бэкап ДО удаления
ls -lh /opt/budget/backups/backup_*.sql.gz

# 2. Проверить timestamp удаления в логах
docker compose logs backend | grep -i delete

# 3. Восстановить из бэкапа перед удалением
./scripts/restore.sh --backup-file /opt/budget/backups/backup_YYYYMMDD_HHMMSS.sql.gz

# 4. Если нужны новые данные после бэкапа:
# - Вручную добавить из safety_backup
# - Или попросить пользователей ввести заново
```

**Время:** 10-20 минут
**Потеря данных:** Минимальна (быстрая реакция)

---

### Сценарий 4: Отказ Docker volume

**Симптомы:** `postgres_data` volume недоступен, I/O errors

**NOTE:** Начиная с версии 1.2.0, Docker volume создается автоматически при деплое. Ручное создание требуется только для сценариев disaster recovery.

**Восстановление:**
```bash
# 1. Проверить volume
docker volume inspect budget_postgres_data

# 2. Пересоздать volume (или просто запустите deploy.sh для автоматического создания)
docker compose down
docker volume rm budget_postgres_data
docker volume create budget_postgres_data

# ИЛИ просто запустите деплой (автоматическое создание):
cd ~/familyBudget
sudo ./deploy.sh

# 3. Восстановить из S3 (локальные бэкапы тоже могут быть утеряны)
docker compose up -d postgres
./scripts/restore.sh
# Выбрать S3 backups → последний бэкап

# 4. Запустить сервисы
docker compose up -d
```

**Время:** 15-30 минут
**Потеря данных:** Зависит от S3 бэкапа

---

### Сценарий 5: Множественный отказ сервисов

**Симптомы:** Все сервисы (postgres, backend, bot) недоступны

**Восстановление:**
```bash
# 1. Проверить статус
docker compose ps

# 2. Перезапустить все
docker compose restart

# 3. Если не помогло
docker compose down
docker compose up -d

# 4. Проверить логи
docker compose logs --tail=100

# 5. Если БД повреждена → восстановить
./scripts/restore.sh
```

**Время:** 5-15 минут
**Потеря данных:** Зависит от причины

---

### Общий чеклист восстановления

1. **Оценить ущерб** - что сломано, насколько критично
2. **Стабилизировать** - остановить проблемные сервисы
3. **Бэкап текущего состояния** - `./scripts/backup.sh`
4. **Найти чистый бэкап** - до появления проблемы
5. **Восстановить** - `./scripts/restore.sh`
6. **Проверить** - health checks, логи, данные
7. **Мониторить** - 30 минут после восстановления
8. **Документировать** - что случилось, как исправили

---

## Решение проблем

### Ошибка: "Another backup instance is running"

**Причина:** Существует lock файл `/tmp/familybudget_backup.lock`

**Решение:**
```bash
# 1. Проверить, действительно ли запущен backup
ps aux | grep backup.sh

# 2. Если процесса нет → удалить stale lock
rm /tmp/familybudget_backup.lock

# 3. Повторить backup
./scripts/backup.sh
```

---

### Ошибка: "POSTGRES_USER not set"

**Причина:** `.env` не загружен

**Решение:**
```bash
# 1. Проверить файл
ls -la /opt/budget/.env

# 2. Загрузить переменные
cd /opt/budget
set -a && source .env && set +a

# 3. Проверить
echo $POSTGRES_USER

# 4. Повторить backup
cd /opt/budget
./scripts/backup.sh
```

---

### Ошибка: "Backup file is corrupted"

**Причина:** Файл поврежден (неполная запись, disk errors)

**Решение:**
```bash
# 1. Проверить целостность
gzip -t /opt/budget/backups/backup_*.sql.gz

# 2. Проверить disk space
df -h /opt/budget/

# 3. Использовать другой бэкап
ls -lt /opt/budget/backups/backup_*.sql.gz | head -5

# 4. Или восстановить из S3
./scripts/restore.sh
# Выбрать S3 backups
```

---

### Ошибка: "PostgreSQL container not found"

**Причина:** `postgres` контейнер не запущен

**Решение:**
```bash
# 1. Проверить статус
cd /opt/budget
docker compose ps

# 2. Запустить контейнер
docker compose up -d postgres

# 3. Проверить логи
docker compose logs postgres | tail -50

# 4. Повторить операцию
cd /opt/budget
./scripts/backup.sh
```

---

### Ошибка: S3 credentials invalid

**Причина:** Неверные ключи доступа

**Решение:**
```bash
# 1. Проверить .env
grep S3_ /opt/budget/.env

# 2. Проверить что переменные загружены
cd /opt/budget
set -a && source .env && set +a
echo "S3_ACCESS_KEY_ID=$S3_ACCESS_KEY_ID"

# 3. Тест подключения
python3 scripts/s3_backup.py list --bucket $S3_BUCKET_NAME

# 4. Если не работает → пересоздать ключи в облаке
```

---

### Ошибка: S3 connection timeout

**Причина:** Сетевые проблемы, файрвол, неправильный endpoint

**Решение:**
```bash
# 1. Проверить сеть
ping storage.yandexcloud.net

# 2. Проверить порт 443
telnet storage.yandexcloud.net 443

# 3. Проверить endpoint в .env
grep S3_ENDPOINT_URL /opt/budget/.env

# 4. Попробовать другой endpoint (если используется AWS)
# S3_ENDPOINT_URL=https://s3.us-east-1.amazonaws.com
```

---

### Ошибка: Database restore failed

**Причина:** Несовместимость версий PostgreSQL, поврежденный SQL

**Решение:**
```bash
# 1. Проверить версию PostgreSQL
docker compose exec postgres psql --version

# 2. Проверить SQL файл
zcat /opt/budget/backups/backup_*.sql.gz | head -100

# 3. Попробовать другой бэкап
./scripts/restore.sh
# Выбрать предыдущий бэкап

# 4. Если все бэкапы ломаются → проверить БД
docker compose exec postgres psql -U familybudget -d familybudget -c "ANALYZE;"
```

---

## Exit коды

| Код | Значение | Что делать |
|-----|----------|-----------|
| `0` | Успех | Продолжить работу |
| `1` | Операция не удалась | Проверить логи, см. [Решение проблем](#решение-проблем) |
| `2` | Ошибка конфигурации | Проверить `.env`, переменные окружения |
| `3` | Отменено пользователем / Lock файл | Ввести `yes` или удалить `/tmp/familybudget_backup.lock` |
| `4` | Валидация не прошла (restore) / S3 не удалось (backup) | Проверить целостность файла или S3 credentials |

**Пример обработки в скрипте:**
```bash
./scripts/backup.sh
case $? in
  0) echo "OK" ;;
  1) echo "Backup failed"; exit 1 ;;
  2) echo "Check .env"; exit 1 ;;
  3) echo "Locked or cancelled" ;;
  4) echo "S3 failed, local OK" ;;
esac
```

---

## FAQ

### Как долго выполняется backup?

**Локальный бэкап:** 60-90 секунд (pg_dump 30-60s + gzip 20-40s)
**С загрузкой S3:** 90-210 секунд (+ upload 30-120s в зависимости от сети)

### Как долго выполняется restore?

**Восстановление:** 3-5 минут (остановка сервисов 30s + restore 60-120s + запуск 30s)
**С загрузкой S3:** + 15-60 секунд на скачивание

### Сколько места занимают бэкапы?

**Один бэкап:** 5-10 MB (сжатый gzip)
**7 дней локально:** ~35-70 MB
**28 дней в S3:** ~140-280 MB

**Примерная стоимость S3:** ~$0.01/месяц (1 цент)

### Можно ли сжать бэкап сильнее?

Да, изменить уровень gzip (по умолчанию -6):

```bash
# В scripts/backup.sh найти строку:
pg_dump ... | gzip -6 > backup.sql.gz

# Изменить на:
pg_dump ... | gzip -9 > backup.sql.gz  # Медленнее, но меньше размер
pg_dump ... | gzip -1 > backup.sql.gz  # Быстрее, но больше размер
```

### Можно ли запустить backup во время работы приложения?

Да, `pg_dump` не блокирует БД. Пользователи могут продолжать работу.

### Что делать если restore зависает?

```bash
# 1. Проверить логи
docker compose logs postgres | tail -100

# 2. Проверить процессы
docker compose exec postgres ps aux | grep psql

# 3. Если зависло > 10 минут → убить процесс
docker compose restart postgres

# 4. Повторить restore
./scripts/restore.sh --yes
```

### Можно ли восстановить на другой сервер?

Да:
1. Скачать бэкап с S3
2. Скопировать на новый сервер
3. Установить Family Budget
4. Восстановить: `./scripts/restore.sh --backup-file /path/to/backup.sql.gz`

### Как проверить что бэкап не поврежден?

```bash
# 1. gzip integrity
gzip -t /opt/budget/backups/backup_*.sql.gz

# 2. SQL структура
zcat backup.sql.gz | head -100 | grep "PostgreSQL database dump"

# 3. Количество INSERT
zcat backup.sql.gz | grep -c "^INSERT INTO"
```

### Что содержится в бэкапе?

**Включено:**
- Схема БД (таблицы, индексы, constraints, sequences)
- Все данные всех таблиц

**НЕ включено:**
- PostgreSQL users/roles
- Конфигурация PostgreSQL (postgresql.conf)
- Расширения БД (нужно установить отдельно)

### Можно ли сделать point-in-time recovery?

Нет, сейчас только full backup/restore. Для PITR нужно настроить:
- WAL archiving
- Continuous archiving
- Не реализовано в текущей версии

### Куда писать если нашел проблему?

1. Проверить [Решение проблем](#решение-проблем)
2. Проверить логи: `/opt/budget/backups/logs/`
3. Создать issue: https://github.com/your-repo/issues
4. Обновить эту документацию с решением

---

**Связанная документация:**
- [Архитектура системы бэкапов](architecture/backup-system.md)
- [Disaster Recovery процедуры](architecture/guides/disaster-recovery.md)
- [Операционные задачи](architecture/guides/backup-operations.md)
- [База данных (CLAUDE.md)](../CLAUDE.md#база-данных)
