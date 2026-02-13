# Backup System Architecture

Техническая архитектура системы бэкапов Family Budget.

**Содержание:**
- [Архитектура](#архитектура) - компоненты и потоки
- [Локальные бэкапы](#локальные-бэкапы) - pg_dump + gzip
- [S3 бэкапы](#s3-бэкапы) - boto3 + retention
- [Восстановление](#восстановление) - orchestration + validation
- [Производительность](#производительность) - timing, compression
- [Безопасность](#безопасность) - permissions, encryption

---

## Архитектура

### Компоненты

```
┌─────────────────────────────────────────────────────────────┐
│                    BACKUP SYSTEM                             │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐      ┌──────────────┐      ┌───────────┐ │
│  │  backup.sh   │      │ restore.sh   │      │s3_backup  │ │
│  │  (495 lines) │      │ (824 lines)  │      │  .py      │ │
│  │              │      │              │      │(199 lines)│ │
│  └──────┬───────┘      └──────┬───────┘      └─────┬─────┘ │
│         │                     │                    │        │
│         │ pg_dump             │ psql               │ boto3  │
│         ↓                     ↓                    ↓        │
│  ┌──────────────────────────────────────────────────────┐  │
│  │           PostgreSQL Container (postgres)            │  │
│  │  ┌────────────────────────────────────────────────┐  │  │
│  │  │   Database: familybudget                       │  │  │
│  │  │   - Schema (36 tables)                         │  │  │
│  │  │   - Data (~1000-10000 rows per table)          │  │  │
│  │  │   - Indexes, constraints, sequences            │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
           │                          │                │
           ↓                          ↓                ↓
    ┌────────────┐            ┌─────────────┐  ┌──────────┐
    │ Local      │            │  Safety     │  │   S3     │
    │ Backups    │            │  Backup     │  │ Backups  │
    │ (7 days)   │            │ (temp)      │  │(28 days) │
    └────────────┘            └─────────────┘  └──────────┘
```

### Поток данных

**Backup Flow:**
```
1. Cron (2:00 AM daily)
    ↓
2. backup.sh → Lock file check
    ↓
3. pg_dump (SQL text, 2-3 GB uncompressed)
    ↓
4. gzip -6 (compression ~10:1)
    ↓
5. Local file (5-10 MB, chmod 644)
    ↓
6. Rotation (delete >7 days)
    ↓
7. S3 upload (if configured, 3 retry)
    ↓
8. S3 cleanup (delete >28 days)
```

**Restore Flow:**
```
1. User: ./scripts/restore.sh
    ↓
2. Select source (Local / S3)
    ↓
3. Download from S3 (if selected)
    ↓
4. Validate (gzip -t + SQL header check)
    ↓
5. Safety backup (current state)
    ↓
6. Confirmation (type 'yes')
    ↓
7. Stop services (backend, bot)
    ↓
8. Terminate DB connections
    ↓
9. DROP DATABASE + CREATE DATABASE
    ↓
10. zcat backup.sql.gz | psql
    ↓
11. Start services
    ↓
12. Health check
```

---

## Критические зависимости

### Cron Daemon (CRITICAL!)

**Статус:** ОБЯЗАТЕЛЬНЫЙ компонент для автоматизации backup

**Проблема:**
- Если `cron` пакет НЕ установлен → backup automation ПОЛНОСТЬЮ ОТКЛЮЧЕНА
- `setup_backup_cron()` молча завершается с warning
- Пользователь может не заметить проблему до первой потери данных

**Симптомы отсутствия cron:**
```bash
# При деплое появляется CRITICAL ERROR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CRITICAL: cron package NOT installed!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**Диагностика:**
```bash
# Проверка установки cron
which crontab
# Ожидаемый вывод: /usr/bin/crontab
# Если ошибка: command not found → cron НЕ установлен

# Проверка cron daemon
sudo systemctl status cron
# Ожидаемый вывод: Active: active (running)
```

**Исправление:**
```bash
# Установка cron (выполнить на сервере)
sudo apt-get update
sudo apt-get install -y cron
sudo systemctl enable cron
sudo systemctl start cron

# Проверка
sudo systemctl status cron

# Настройка backup cron job
cd ~/familyBudget
sudo ./deploy.sh  # Автоматически настроит crontab

# Или вручную:
sudo crontab -e
# Добавить: 0 2 * * * /bin/bash /opt/budget/scripts/backup.sh >> /opt/budget/logs/backup.log 2>&1
```

**Предотвращение:**
- `install.sh` теперь устанавливает `cron` автоматически (v6.8.1+)
- `backup_integration.sh` показывает КРИТИЧЕСКУЮ ошибку если cron отсутствует

**Риски при отсутствии cron:**
- ❌ Daily backups НЕ создаются автоматически
- ❌ S3 uploads НЕ происходят
- ❌ Retention policy НЕ работает (старые backup НЕ удаляются)
- ⚠️  Риск DATA LOSS при аварии сервера

**Верификация автоматизации:**
```bash
# Проверить что cron job создан
sudo crontab -l | grep backup

# Проверить логи последнего cron запуска
ls -lh /opt/budget/backups/logs/
cat /opt/budget/backups/logs/backup_$(date +%Y%m%d).log

# Проверить что бэкапы создаются ежедневно
ls -lh /opt/budget/backups/ | grep backup
# Должны быть файлы за последние 7 дней
```

---

## Локальные бэкапы

### Технология

**Команда:**
```bash
docker compose exec -T postgres pg_dump -U familybudget familybudget | gzip -6 > backup.sql.gz
```

**Что делает `pg_dump`:**
- Создает SQL скрипт (text format)
- Включает: CREATE TABLE, INSERT, CREATE INDEX, constraints
- НЕ включает: PostgreSQL users/roles, settings
- Читает из БД без блокировки (MVCC snapshots)

**Что делает `gzip`:**
- Сжимает SQL text → binary .gz
- Level 6 (balanced speed/size)
- Compression ratio: ~10:1

### Структура файлов

```
/opt/budget/backups/
├── backup_20251223_143055.sql.gz  (5.2 MB)
├── backup_20251222_020000.sql.gz  (5.1 MB)
├── backup_20251221_020000.sql.gz  (5.0 MB)
├── backup_20251220_020000.sql.gz  (5.3 MB)
├── backup_20251219_020000.sql.gz  (5.0 MB)
├── backup_20251218_020000.sql.gz  (5.1 MB)
├── backup_20251217_020000.sql.gz  (5.3 MB)  ← Удаляется (>7 days)
└── logs/
    ├── backup_20251223.log  (текстовые логи)
    └── backup_20251222.log
```

### Lock Mechanism

**Lock file:** `/tmp/familybudget_backup.lock`

**Формат:**
```
PID
```

**Логика:**
```python
if lock_file.exists():
    pid = read_lock_file()
    if process_is_running(pid):
        abort("Another backup running")
    else:
        remove_stale_lock()
        proceed()
else:
    create_lock(current_pid)
    proceed()
```

**Cleanup:** `trap remove_lock EXIT INT TERM` (bash trap)

### Rotation Policy

**Алгоритм:**
```bash
# Find backups older than 7 days
find /opt/budget/backups -name "backup_*.sql.gz" -mtime +7

# Delete them
find /opt/budget/backups -name "backup_*.sql.gz" -mtime +7 -delete

# Log count
echo "Deleted $(count) old backups"
```

**Параметр:** `LOCAL_RETENTION_DAYS=7` (в `.env`)

---

## S3 бэкапы

### Технология

**Библиотека:** `boto3` (AWS SDK for Python)

**Поддерживаемые провайдеры:**
- AWS S3
- Yandex Object Storage
- DigitalOcean Spaces
- Backblaze B2
- MinIO (self-hosted)
- Любой S3-совместимый сервис

### Аутентификация

**Метод:** Access Key ID + Secret Access Key

**Конфигурация:**
```python
s3_client = boto3.client(
    's3',
    endpoint_url=os.getenv('S3_ENDPOINT_URL'),
    aws_access_key_id=os.getenv('S3_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('S3_SECRET_ACCESS_KEY'),
    region_name=os.getenv('S3_REGION', 'us-east-1')
)
```

### Upload Mechanism

**Retry Logic:**
```python
max_retries = 3
backoff = [1, 5, 15]  # seconds

for attempt in range(max_retries):
    try:
        s3_client.upload_file(local_file, bucket, s3_key)
        break
    except Exception as e:
        if attempt < max_retries - 1:
            sleep(backoff[attempt])
            continue
        else:
            raise
```

**Progress Callback:**
```python
def progress_callback(bytes_transferred):
    percent = (bytes_transferred / total_size) * 100
    print(f"Progress: {bytes_transferred / 1024**2:.1f} MB / {total_size / 1024**2:.1f} MB ({percent:.0f}%)")
```

### S3 Path Structure

```
s3://familybudget-backups/
└── postgresql-backups/
    ├── 2024/
    │   ├── 11/
    │   │   └── backup_20241130_020000.sql.gz
    │   └── 12/
    │       └── backup_20241225_020000.sql.gz
    └── 2025/
        ├── 11/
        │   ├── backup_20251125_020000.sql.gz
        │   └── ...
        └── 12/
            ├── backup_20251201_020000.sql.gz
            ├── backup_20251202_020000.sql.gz
            └── backup_20251223_020000.sql.gz
```

**Формат ключа:**
```
postgresql-backups/{YYYY}/{MM}/backup_{YYYYMMDD}_{HHMMSS}.sql.gz
```

### Retention Policy

**Алгоритм:**
```python
cutoff_date = datetime.now() - timedelta(days=retention_days)

for obj in bucket.objects.filter(Prefix='postgresql-backups/'):
    if obj.key.endswith('.sql.gz') and 'backup_' in obj.key:
        if obj.last_modified < cutoff_date:
            obj.delete()
            log(f"Deleted: {obj.key}")
```

**Параметр:** 28 дней (hardcoded в `backup.sh`, configurable в `s3_backup.py`)

---

## Восстановление

### Service Orchestration

**Sequence:**
```bash
# 1. Stop services (release DB connections)
docker compose stop backend bot

# 2. Terminate active connections
docker compose exec postgres psql -U familybudget -c "
  SELECT pg_terminate_backend(pid)
  FROM pg_stat_activity
  WHERE datname = 'familybudget' AND pid <> pg_backend_pid();"

# 3. Drop database
docker compose exec postgres psql -U familybudget -c "DROP DATABASE IF EXISTS familybudget;"

# 4. Create database
docker compose exec postgres psql -U familybudget -c "CREATE DATABASE familybudget;"

# 5. Restore
zcat backup.sql.gz | docker compose exec -T postgres psql -U familybudget familybudget

# 6. Start services
docker compose start backend bot

# 7. Wait for health
until curl -f http://localhost:8000/health; do sleep 1; done
```

### Validation

**Pre-restore validation:**
```bash
# 1. File exists
[ -f "$backup_file" ] || error "File not found"

# 2. Gzip integrity
gzip -t "$backup_file" || error "Corrupted gzip"

# 3. SQL header
zcat "$backup_file" | head -100 | grep -q "PostgreSQL database dump" || error "Invalid SQL"

# 4. File size (reasonable)
file_size=$(stat -c%s "$backup_file")
[ $file_size -gt 1000000 ] || error "File too small (< 1 MB)"
```

**Post-restore validation:**
```bash
# 1. Database connectivity
docker compose exec postgres psql -U familybudget -d familybudget -c "SELECT 1;" || error "DB not accessible"

# 2. Table count (should be ~36)
table_count=$(docker compose exec postgres psql -U familybudget -d familybudget -tAc "
  SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
[ $table_count -gt 30 ] || error "Too few tables ($table_count)"

# 3. Data presence
article_count=$(docker compose exec postgres psql -U familybudget -d familybudget -tAc "SELECT COUNT(*) FROM t_d_article;")
[ $article_count -gt 0 ] || error "No articles found"
```

### Safety Backup

**Цель:** Возможность rollback при неудачном restore

**Создается:** Перед каждым restore

**Формат:**
```
safety_backup_before_restore_{YYYYMMDD}_{HHMMSS}.sql.gz
```

**Не участвует в rotation:** Удаляется вручную или через 7 дней обычной rotation

---

## Производительность

### Timing

| Операция | Min | Typical | Max | Bottleneck |
|----------|-----|---------|-----|-----------|
| **Local Backup** | 45s | 60-90s | 120s | pg_dump (CPU), gzip (CPU) |
| pg_dump | 20s | 30-60s | 90s | Disk I/O (read) |
| gzip | 15s | 20-40s | 60s | CPU (compression) |
| Rotation | 1s | 1-2s | 5s | Disk I/O (delete) |
| **S3 Upload** | 10s | 30-120s | 300s | Network bandwidth |
| Upload (1 Mbps) | - | 40s | - | Slow network |
| Upload (10 Mbps) | - | 4s | - | Average network |
| Upload (100 Mbps) | - | <1s | - | Fast network |
| S3 Cleanup | 2s | 5-10s | 30s | S3 API latency |
| **Total Backup** | 60s | 90-210s | 450s | Network (if S3) |
| **Restore** | 2m | 3-5m | 10m | psql (disk write) |
| Stop services | 10s | 30s | 60s | Graceful shutdown |
| Terminate connections | 1s | 5s | 15s | Active queries |
| DROP + CREATE | 1s | 2s | 5s | Fast operation |
| psql restore | 60s | 60-120s | 300s | Disk I/O (write) |
| Start services | 10s | 30s | 60s | Container startup |
| Health check wait | 5s | 15s | 45s | App initialization |

### Resource Usage

**CPU:**
- pg_dump: 20-40% (single core)
- gzip: 80-100% (single core)
- psql: 10-30% (single core)

**Memory:**
- pg_dump: ~100-200 MB
- gzip: ~50 MB
- psql: ~50-100 MB
- Total peak: ~300-400 MB

**Disk I/O:**
- Backup read: ~100-200 MB/s (sequential read from PostgreSQL data files)
- Backup write: ~10-20 MB/s (compressed gzip write)
- Restore read: ~10-20 MB/s (read compressed backup)
- Restore write: ~100-200 MB/s (write to PostgreSQL data files)

**Network (S3):**
- Upload: 5-10 MB/s typical (depends on bandwidth)
- Download: 5-20 MB/s typical

### Compression Ratio

| Level | Ratio | Size (2.5 GB uncompressed) | Time (backup) | Time (restore) |
|-------|-------|---------------------------|---------------|----------------|
| gzip -1 | 5:1 | 500 MB | 45s | 90s |
| gzip -6 (default) | 10:1 | 250 MB | 60-90s | 60-120s |
| gzip -9 | 12:1 | 210 MB | 120s | 60-120s |

**Trade-off:** gzip -6 оптимален (balanced speed/size)

---

## Безопасность

### File Permissions

**Backup files:**
```bash
chmod 644 /opt/budget/backups/backup_*.sql.gz
# Owner: read/write
# Group: read
# Others: read
```

**Credentials file:**
```bash
chmod 600 /opt/budget/.env
# Owner: read/write
# Group: no access
# Others: no access
```

**Lock file:**
```bash
chmod 644 /tmp/familybudget_backup.lock
# Owner: read/write (для удаления stale lock)
```

### S3 Credentials

**Хранение:** `.env` file (не в git)

**Rotation:** Рекомендуется каждые 90 дней

**Минимальные permissions (AWS IAM example):**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::familybudget-backups/postgresql-backups/*"
    },
    {
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::familybudget-backups",
      "Condition": {
        "StringLike": {
          "s3:prefix": "postgresql-backups/*"
        }
      }
    }
  ]
}
```

### Encryption

**В transit:**
- S3: HTTPS (TLS 1.2+)
- PostgreSQL: внутри Docker network (no encryption needed)

**At rest:**
- Local backups: File system encryption (опционально, не по умолчанию)
- S3: Server-side encryption (SSE-S3 или SSE-KMS, опционально)

**Рекомендации:**
```bash
# Yandex Object Storage: включить шифрование bucket
yc storage bucket update familybudget-backups --default-storage-class STANDARD --encryption algorithm=AES256

# AWS S3: включить default encryption
aws s3api put-bucket-encryption \
  --bucket familybudget-backups \
  --server-side-encryption-configuration '{
    "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]
  }'
```

### Backup Content Security

**Что содержится (sensitive data):**
- User credentials (пароли в `t_d_user`)
- Financial data (транзакции в `t_f_budget_fact`)
- Personal data (имена, Telegram IDs)

**Что НЕ содержится:**
- PostgreSQL superuser password
- `.env` file содержимое
- JWT secrets
- S3 credentials

**Рекомендации:**
- Хранить backups на encrypted volumes
- Ограничить доступ к S3 bucket (IAM/ACL)
- Не публиковать backups (private bucket)
- Регулярно audit access logs

---

## Мониторинг

### Metrics to Track

```yaml
backup_job_status:
  type: gauge
  values: [0 = failed, 1 = success]
  alert: if failed > 0 for 24h

backup_last_timestamp:
  type: gauge
  unit: unix_timestamp
  alert: if age > 25h (should run daily at 2 AM)

backup_file_size:
  type: gauge
  unit: bytes
  alert: if size < 1MB or size > 50MB (anomaly)

s3_upload_status:
  type: gauge
  values: [0 = failed, 1 = success, 2 = not_configured]
  alert: if failed > 0 for 24h (and S3 is configured)

restore_duration:
  type: histogram
  unit: seconds
  percentiles: [p50, p95, p99]
  alert: if p95 > 600s (10 min)

disk_space_used:
  type: gauge
  unit: bytes
  alert: if > 80% of /opt/budget partition

s3_monthly_cost:
  type: gauge
  unit: USD
  alert: if > $1.00 (anomaly, should be ~$0.01)
```

### Logging

**Структура логов:**
```
[YYYY-MM-DD HH:MM:SS] [LEVEL] Message
```

**Levels:**
- `[INFO]` - Информация (начало/конец операции)
- `[SUCCESS]` - Успешное завершение
- `[WARN]` - Предупреждение (продолжаем)
- `[ERROR]` - Ошибка (прерываем)

**Log Rotation:**
```bash
# Daily logs (one file per day)
/opt/budget/backups/logs/backup_YYYYMMDD.log

# Retention: 30 days
find /opt/budget/backups/logs -name "backup_*.log" -mtime +30 -delete
```

---

## Disaster Recovery Parameters

**RPO (Recovery Point Objective):** 1 day
- Daily backups at 2 AM
- Максимальная потеря данных: 24 часа

**RTO (Recovery Time Objective):** < 5 minutes
- Restore process: 3-5 минут
- Включая: download from S3, validation, restore, service restart

**Cost:**
- Storage: ~$0.01/month (S3)
- Network: negligible (15 GB/month upload)
- Time: ~2 hours/month (monitoring + maintenance)

---

## Связанная документация

- [Backup & Restore Manual](../BACKUP_RESTORE.md) - Пошаговые инструкции
- [Disaster Recovery](guides/disaster-recovery.md) - Аварийные сценарии
- [Backup Operations](guides/backup-operations.md) - Daily/weekly/monthly tasks
- [Database Design (CLAUDE.md)](../../CLAUDE.md#база-данных) - Database schema
