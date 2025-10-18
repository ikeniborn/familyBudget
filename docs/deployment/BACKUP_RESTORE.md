# Family Budget - Backup & Restore Guide

Полное руководство по резервному копированию и восстановлению данных PostgreSQL.

## Версия: 5.2.0

## Содержание

- [Обзор системы бэкапов](#обзор-системы-бэкапов)
- [Автоматические бэкапы](#автоматические-бэкапы)
- [Ручные бэкапы](#ручные-бэкапы)
- [Восстановление данных](#восстановление-данных)
- [Настройка S3](#настройка-s3)
- [Мониторинг бэкапов](#мониторинг-бэкапов)
- [Troubleshooting](#troubleshooting)

---

## Обзор системы бэкапов

### Архитектура

Family Budget использует двухуровневую систему резервного копирования:

```
┌─────────────────────────────────────────┐
│      AUTOMATIC BACKUPS (cron)           │
│                                         │
│  Daily at 2:00 AM                       │
│    ├─> Local backup (compressed)       │
│    ├─> 7-day retention                 │
│    └─> Weekly S3 upload (Sundays)      │
│           └─> 28-day retention         │
└─────────────────────────────────────────┘
```

### Ключевые особенности

- ✅ **Автоматические бэкапы**: Ежедневно в 2:00 AM через cron
- ✅ **Локальное хранение**: 7-дневная ротация в `./backups/`
- ✅ **Облачное хранение**: Еженедельная загрузка в Yandex Object Storage (S3)
- ✅ **Сжатие**: gzip компрессия для экономии места
- ✅ **Логирование**: Детальные логи всех операций
- ✅ **Lock файлы**: Защита от одновременного запуска

### Файлы и директории

```bash
familyBudget/
├── backups/                          # Локальные бэкапы
│   ├── backup_20231015_020000.sql.gz
│   ├── backup_20231016_020000.sql.gz
│   └── logs/                         # Логи бэкапов
│       ├── backup_20231015.log
│       └── backup_20231016.log
├── scripts/
│   ├── backup.sh                     # Скрипт бэкапа
│   ├── restore.sh                    # Скрипт восстановления (TODO)
│   └── cron/
│       └── familybudget-backup.cron  # Cron конфигурация
└── /var/log/familybudget/
    └── cron.log                      # Логи cron задач
```

---

## Автоматические бэкапы

### Установка cron job

Cron job автоматически устанавливается при деплое через `./deploy.sh`:

```bash
# Деплой с установкой cron job
./deploy.sh
```

Скрипт создаёт файл `/etc/cron.d/familybudget-backup` с конфигурацией:

```cron
# Daily backup at 2:00 AM
0 2 * * * root cd /путь/к/проекту && set -a && source .env && set +a && ./scripts/backup.sh >> /var/log/familybudget/cron.log 2>&1
```

### Проверка установки cron job

```bash
# Проверить что cron job установлен
sudo ls -la /etc/cron.d/familybudget-backup

# Проверить содержимое
sudo cat /etc/cron.d/familybudget-backup

# Проверить статус cron сервиса
sudo systemctl status cron
```

### Ручная установка cron job (если автоматическая не сработала)

```bash
# Скопировать cron файл
sudo cp scripts/cron/familybudget-backup.cron /etc/cron.d/familybudget-backup

# Установить правильные права доступа
sudo chmod 644 /etc/cron.d/familybudget-backup
sudo chown root:root /etc/cron.d/familybudget-backup

# Перезапустить cron сервис
sudo systemctl restart cron
```

### Расписание бэкапов

- **Локальные бэкапы**: Ежедневно в 2:00 AM (серверное время)
- **S3 загрузки**: Каждое воскресенье в 2:00 AM (если S3 настроен)
- **Ротация локальных**: Автоматическое удаление файлов старше 7 дней
- **Ротация S3**: Автоматическое удаление файлов старше 28 дней

---

## Ручные бэкапы

### Базовый бэкап (локальный)

```bash
# Перейти в директорию проекта
cd /путь/к/familyBudget

# Запустить скрипт бэкапа
./scripts/backup.sh

# С подробным выводом
./scripts/backup.sh --verbose
```

### Принудительная загрузка в S3

```bash
# Загрузить бэкап в S3 независимо от дня недели
./scripts/backup.sh --force-s3

# С подробным выводом
./scripts/backup.sh --force-s3 --verbose
```

### Проверка результатов

```bash
# Список локальных бэкапов
ls -lh backups/backup_*.sql.gz

# Последний лог бэкапа
tail -f backups/logs/backup_$(date +%Y%m%d).log

# Размер бэкапов
du -sh backups/
```

### Формат файлов бэкапа

Файлы бэкапов имеют следующий формат имени:

```
backup_YYYYMMDD_HHMMSS.sql.gz
```

Например:
- `backup_20231015_020000.sql.gz` - Бэкап от 15 октября 2023, 02:00:00
- `backup_20231022_143000.sql.gz` - Бэкап от 22 октября 2023, 14:30:00

---

## Восстановление данных

### ⚠️ ВАЖНО: Предупреждения перед восстановлением

- ✋ **ОСТАНОВИТЕ все сервисы** перед восстановлением
- ⚠️ **ВСЕ текущие данные будут УДАЛЕНЫ**
- 📋 **Создайте резервную копию** текущих данных перед восстановлением
- 🔒 **Убедитесь что никто не использует систему**

### Восстановление из локального бэкапа

#### Шаг 1: Остановить сервисы

```bash
cd /путь/к/familyBudget

# Остановить все контейнеры
docker compose down
```

#### Шаг 2: Выбрать файл бэкапа

```bash
# Список доступных бэкапов
ls -lht backups/backup_*.sql.gz | head -10

# Выбрать нужный файл (например, последний)
BACKUP_FILE="backups/backup_20231015_020000.sql.gz"
```

#### Шаг 3: Запустить только PostgreSQL

```bash
# Запустить только postgres контейнер
docker compose up -d postgres

# Подождать пока postgres станет ready
docker compose logs -f postgres
# Дождаться сообщения "database system is ready to accept connections"
```

#### Шаг 4: Восстановить данные

```bash
# Загрузить переменные окружения
source .env

# Удалить существующую базу данных и создать новую
docker compose exec -T postgres psql -U $POSTGRES_USER -d postgres -c "DROP DATABASE IF EXISTS $POSTGRES_DB;"
docker compose exec -T postgres psql -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $POSTGRES_DB;"

# Восстановить данные из бэкапа
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB

echo "✅ Database restored from $BACKUP_FILE"
```

#### Шаг 5: Запустить все сервисы

```bash
# Запустить все сервисы
docker compose up -d

# Проверить что все работает
docker compose ps
curl http://localhost:8000/health
```

### Восстановление из S3 бэкапа

#### Шаг 1: Скачать бэкап из S3

```bash
# Загрузить переменные окружения
source .env

# Список доступных бэкапов в S3
aws s3 ls s3://$S3_BUCKET_NAME/ \
    --endpoint-url $S3_ENDPOINT_URL \
    --recursive

# Скачать конкретный бэкап
aws s3 cp s3://$S3_BUCKET_NAME/2023/10/backup_20231015_020000.sql.gz \
    backups/restore_temp.sql.gz \
    --endpoint-url $S3_ENDPOINT_URL

echo "✅ Backup downloaded to backups/restore_temp.sql.gz"
```

#### Шаг 2: Восстановить из скачанного файла

Следуйте шагам 1-5 из раздела "Восстановление из локального бэкапа", используя файл `backups/restore_temp.sql.gz`.

### Частичное восстановление (только определённые таблицы)

```bash
# Распаковать бэкап во временный файл
gunzip -c "$BACKUP_FILE" > /tmp/restore.sql

# Извлечь только нужные таблицы (например, t_f_fact)
grep -A 1000 "CREATE TABLE t_f_fact" /tmp/restore.sql > /tmp/restore_facts.sql

# Восстановить только эту таблицу
docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB < /tmp/restore_facts.sql

# Очистить временные файлы
rm /tmp/restore.sql /tmp/restore_facts.sql
```

---

## Настройка S3

### Требования

- Аккаунт Yandex Cloud
- Созданный S3 бакет
- Access Key ID и Secret Access Key

### Создание S3 бакета в Yandex Cloud

#### 1. Создать сервисный аккаунт

```bash
# В консоли Yandex Cloud
yc iam service-account create --name familybudget-backup
```

#### 2. Выдать права на Object Storage

```bash
# Получить ID сервисного аккаунта
yc iam service-account list

# Назначить роль storage.editor
yc resource-manager folder add-access-binding <FOLDER_ID> \
    --role storage.editor \
    --subject serviceAccount:<SERVICE_ACCOUNT_ID>
```

#### 3. Создать статический ключ доступа

```bash
# Создать ключ
yc iam access-key create --service-account-name familybudget-backup

# Сохранить вывод:
# key_id: AKIA...
# secret: wJalr...
```

#### 4. Создать бакет

```bash
# В веб-консоли Yandex Cloud Object Storage:
# 1. Перейти в Object Storage
# 2. Создать бакет
# 3. Имя: familybudget-backups-production
# 4. Класс хранения: Холодное (для экономии)
# 5. Приватный доступ
```

### Конфигурация в .env файле

```bash
# Редактировать .env
nano .env
```

Добавить следующие переменные:

```bash
# =============================================================================
# S3 (Yandex Object Storage) Configuration - Backups
# =============================================================================

# Yandex Object Storage (S3-compatible)
AWS_ACCESS_KEY_ID=AKIA...              # Access Key ID из шага 3
AWS_SECRET_ACCESS_KEY=wJalr...         # Secret Key из шага 3
S3_BUCKET_NAME=familybudget-backups-production
S3_ENDPOINT_URL=https://storage.yandexcloud.net
S3_REGION=ru-central1

# Backup retention
BACKUP_LOCAL_RETENTION_DAYS=7          # Локальная ротация
BACKUP_S3_RETENTION_DAYS=28            # S3 ротация
```

### Установка AWS CLI (если не установлен)

```bash
# Установить AWS CLI
sudo apt-get update
sudo apt-get install -y awscli

# Проверить версию
aws --version
```

### Проверка подключения к S3

```bash
# Загрузить переменные окружения
source .env

# Проверить доступ к бакету
aws s3 ls s3://$S3_BUCKET_NAME/ --endpoint-url $S3_ENDPOINT_URL

# Тестовая загрузка файла
echo "test" > /tmp/test.txt
aws s3 cp /tmp/test.txt s3://$S3_BUCKET_NAME/test.txt --endpoint-url $S3_ENDPOINT_URL

# Проверить что файл загрузился
aws s3 ls s3://$S3_BUCKET_NAME/ --endpoint-url $S3_ENDPOINT_URL

# Удалить тестовый файл
aws s3 rm s3://$S3_BUCKET_NAME/test.txt --endpoint-url $S3_ENDPOINT_URL
rm /tmp/test.txt
```

### Тестовый бэкап с S3

```bash
# Запустить бэкап с принудительной загрузкой в S3
./scripts/backup.sh --force-s3 --verbose

# Проверить что файл появился в S3
aws s3 ls s3://$S3_BUCKET_NAME/ --endpoint-url $S3_ENDPOINT_URL --recursive
```

---

## Мониторинг бэкапов

### Проверка статуса автоматических бэкапов

```bash
# Проверить последний лог cron
tail -f /var/log/familybudget/cron.log

# Проверить логи бэкапов за сегодня
tail -f backups/logs/backup_$(date +%Y%m%d).log

# Список всех бэкапов
ls -lht backups/backup_*.sql.gz

# Статистика бэкапов
echo "Локальные бэкапы:"
find backups/ -name "backup_*.sql.gz" -type f -exec ls -lh {} \; | wc -l
du -sh backups/

echo ""
echo "S3 бэкапы:"
source .env
aws s3 ls s3://$S3_BUCKET_NAME/ --endpoint-url $S3_ENDPOINT_URL --recursive --human-readable
```

### Email уведомления при ошибках (опционально)

Для настройки email уведомлений при сбое бэкапов:

```bash
# Установить mailutils
sudo apt-get install -y mailutils

# Редактировать cron файл
sudo nano /etc/cron.d/familybudget-backup

# Добавить email
MAILTO=admin@example.com
```

### Настройка мониторинга через Healthchecks.io (опционально)

```bash
# Зарегистрироваться на https://healthchecks.io
# Создать новый check для бэкапов
# Скопировать ping URL

# Добавить в .env
echo "HEALTHCHECK_BACKUP_URL=https://hc-ping.com/your-uuid-here" >> .env

# Модифицировать scripts/backup.sh (добавить в конец main()):
curl -fsS --retry 3 "$HEALTHCHECK_BACKUP_URL" > /dev/null || true
```

---

## Troubleshooting

### Проблема: Cron job не запускается

**Симптомы:**
- Новые бэкапы не создаются
- Логи в `/var/log/familybudget/cron.log` пустые

**Решение:**

```bash
# 1. Проверить что cron сервис работает
sudo systemctl status cron

# Если не запущен:
sudo systemctl start cron
sudo systemctl enable cron

# 2. Проверить что cron файл существует
sudo ls -la /etc/cron.d/familybudget-backup

# 3. Проверить права доступа
sudo chmod 644 /etc/cron.d/familybudget-backup
sudo chown root:root /etc/cron.d/familybudget-backup

# 4. Проверить синтаксис cron файла
sudo cat /etc/cron.d/familybudget-backup

# 5. Проверить логи cron
sudo tail -f /var/log/syslog | grep CRON

# 6. Перезапустить cron
sudo systemctl restart cron
```

### Проблема: Бэкап завершается с ошибкой "Lock file exists"

**Симптомы:**
- Ошибка: "Another backup instance is running (PID: XXX)"
- Exit code 3

**Решение:**

```bash
# Проверить процесс
ps aux | grep backup.sh

# Если процесс не найден (stale lock), удалить lock файл
sudo rm /tmp/familybudget_backup.lock

# Запустить бэкап заново
./scripts/backup.sh
```

### Проблема: S3 загрузка не работает

**Симптомы:**
- Бэкапы создаются локально, но не загружаются в S3
- Ошибка "S3 credentials not configured"

**Решение:**

```bash
# 1. Проверить что переменные S3 установлены
source .env
echo "AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}..."
echo "S3_BUCKET_NAME: $S3_BUCKET_NAME"
echo "S3_ENDPOINT_URL: $S3_ENDPOINT_URL"

# 2. Проверить что AWS CLI установлен
which aws
aws --version

# Если не установлен:
sudo apt-get install -y awscli

# 3. Тестовое подключение к S3
aws s3 ls s3://$S3_BUCKET_NAME/ --endpoint-url $S3_ENDPOINT_URL

# 4. Проверить права доступа к бакету
aws s3api get-bucket-location \
    --bucket $S3_BUCKET_NAME \
    --endpoint-url $S3_ENDPOINT_URL
```

### Проблема: Восстановление не работает

**Симптомы:**
- Ошибка "database does not exist"
- Ошибка "permission denied"

**Решение:**

```bash
# 1. Убедиться что postgres контейнер запущен
docker compose ps postgres

# 2. Проверить что можно подключиться к postgres
source .env
docker compose exec postgres psql -U $POSTGRES_USER -d postgres -c "SELECT version();"

# 3. Убедиться что база данных создана
docker compose exec postgres psql -U $POSTGRES_USER -d postgres -c "\l"

# 4. Если базы нет, создать её
docker compose exec postgres psql -U $POSTGRES_USER -d postgres -c "CREATE DATABASE $POSTGRES_DB;"

# 5. Попробовать восстановление заново
gunzip -c "$BACKUP_FILE" | docker compose exec -T postgres psql -U $POSTGRES_USER -d $POSTGRES_DB
```

### Проблема: Недостаточно места на диске

**Симптомы:**
- Ошибка "No space left on device"
- Бэкапы не создаются

**Решение:**

```bash
# 1. Проверить свободное место
df -h

# 2. Удалить старые бэкапы вручную
find backups/ -name "backup_*.sql.gz" -mtime +7 -delete

# 3. Очистить логи бэкапов
find backups/logs/ -name "backup_*.log" -mtime +30 -delete

# 4. Очистить логи cron
sudo truncate -s 0 /var/log/familybudget/cron.log

# 5. Удалить неиспользуемые Docker образы и контейнеры
docker system prune -a --volumes
```

### Проблема: Бэкап слишком долго выполняется

**Симптомы:**
- Бэкап занимает более 10-15 минут
- Система тормозит во время бэкапа

**Решение:**

```bash
# 1. Проверить размер базы данных
source .env
docker compose exec postgres psql -U $POSTGRES_USER -d $POSTGRES_DB -c "\
    SELECT pg_size_pretty(pg_database_size('$POSTGRES_DB'));"

# 2. Использовать pg_dump с опциями для ускорения
# Модифицировать scripts/backup.sh:
# pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" -j 4  # Параллельный дамп (4 потока)

# 3. Изменить время запуска cron (на менее загруженное время)
sudo nano /etc/cron.d/familybudget-backup
# Например, с 2:00 AM на 3:00 AM

# 4. Включить сжатие на лету в pg_dump
# pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" -Fc  # Custom format с сжатием
```

---

## Дополнительные ресурсы

### Документация

- [PostgreSQL pg_dump](https://www.postgresql.org/docs/current/app-pgdump.html)
- [PostgreSQL pg_restore](https://www.postgresql.org/docs/current/app-pgrestore.html)
- [AWS CLI S3 Commands](https://docs.aws.amazon.com/cli/latest/reference/s3/)
- [Yandex Object Storage](https://cloud.yandex.ru/docs/storage/)

### Связанные файлы

- `scripts/backup.sh` - Основной скрипт бэкапа
- `scripts/cron/familybudget-backup.cron` - Конфигурация cron job
- `deploy.sh` - Скрипт деплоя (устанавливает cron job)
- `.env.example` - Примеры переменных окружения для S3

### Полезные команды

```bash
# Проверить текущий размер всех бэкапов
du -sh backups/

# Показать 10 самых больших бэкапов
ls -lhS backups/backup_*.sql.gz | head -10

# Подсчитать количество бэкапов в S3
aws s3 ls s3://$S3_BUCKET_NAME/ --endpoint-url $S3_ENDPOINT_URL --recursive | wc -l

# Проверить целостность gzip архива
gunzip -t backups/backup_20231015_020000.sql.gz

# Быстрый просмотр содержимого бэкапа
gunzip -c backups/backup_20231015_020000.sql.gz | head -100
```

---

## Контрольный список (Checklist)

### Первоначальная настройка

- [ ] Cron job установлен через `./deploy.sh`
- [ ] Создан S3 бакет в Yandex Cloud
- [ ] Переменные S3 добавлены в `.env`
- [ ] AWS CLI установлен
- [ ] Тестовый бэкап с S3 успешно выполнен
- [ ] Настроены email уведомления (опционально)

### Регулярная проверка (еженедельно)

- [ ] Проверить логи последних бэкапов
- [ ] Убедиться что бэкапы создаются ежедневно
- [ ] Проверить что S3 загрузки работают (воскресенья)
- [ ] Проверить свободное место на диске
- [ ] Протестировать восстановление из случайного бэкапа

### В случае аварии

- [ ] Остановить все сервисы
- [ ] Скачать нужный бэкап (локальный или из S3)
- [ ] Создать резервную копию текущих данных
- [ ] Восстановить данные из бэкапа
- [ ] Запустить все сервисы
- [ ] Проверить работоспособность системы
- [ ] Задокументировать инцидент

---

**Версия документа:** 1.0
**Последнее обновление:** 2023-10-18
**Автор:** Claude Code + ikeniborn
**Статус:** ✅ Production Ready
