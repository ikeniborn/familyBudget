# Backup Operations Guide

Регулярные операционные задачи для команды DevOps.

**Содержание:**
- [Ежедневные проверки](#ежедневные-проверки)
- [Еженедельное обслуживание](#еженедельное-обслуживание)
- [Ежемесячные задачи](#ежемесячные-задачи)
- [Настройка производительности](#настройка-производительности)

---

## Ежедневные проверки

### Проверка статуса бэкапа

**Утренний чек-лист (5 минут):**

```bash
# 1. Проверить что сегодняшний backup создан
ls -lh /opt/budget/backups/backup_$(date +%Y%m%d)_*.sql.gz
# Expected: файл с сегодняшней датой

# 2. Проверить размер (должен быть ~5-10 MB)
du -h /opt/budget/backups/backup_$(date +%Y%m%d)_*.sql.gz
# Expected: 5.0M - 10M

# 3. Проверить логи на errors
tail -20 /opt/budget/backups/logs/backup_$(date +%Y%m%d).log | grep -i error
# Expected: no errors

# 4. Проверить cron status
systemctl status cron | grep Active
# Expected: Active: active (running)

# 5. Проверить exit code последнего backup
tail -1 /opt/budget/backups/logs/backup_$(date +%Y%m%d).log | grep SUCCESS
# Expected: [SUCCESS] Backup completed successfully
```

### Проверка S3 синхронизации

```bash
# 1. Проверить что S3 upload прошел
grep -i "s3" /opt/budget/backups/logs/backup_$(date +%Y%m%d).log
# Expected: [SUCCESS] Uploaded to S3

# 2. Список последних S3 backups
python3 ~/familyBudget/scripts/s3_backup.py list --bucket familybudget-backups | head -5
# Expected: Сегодняшний backup в списке

# 3. Проверить S3 credentials validity (если upload failed)
python3 ~/familyBudget/scripts/s3_backup.py list --bucket familybudget-backups > /dev/null
echo $?
# Expected: 0 (success)
```

### Проверка disk space

```bash
# 1. Проверить использование /opt/budget
df -h /opt/budget
# Expected: < 80% used

# 2. Размер директории backups
du -sh /opt/budget/backups/
# Expected: ~50-100 MB (7 дней × 5-10 MB)

# 3. Количество backups
ls -1 /opt/budget/backups/backup_*.sql.gz | wc -l
# Expected: 7-8 файлов

# 4. Если > 90% → cleanup старых backups
find /opt/budget/backups -name "backup_*.sql.gz" -mtime +7 -delete
```

---

## Еженедельное обслуживание

### Тест восстановления (Понедельник, 10:00)

**Цель:** Проверить что backup можно восстановить

**Процедура:**

```bash
# 1. Выбрать последний backup
LAST_BACKUP=$(ls -t /opt/budget/backups/backup_*.sql.gz | head -1)
echo "Testing restore of: $LAST_BACKUP"

# 2. Проверить целостность
gzip -t "$LAST_BACKUP"
echo "Integrity: $?"  # Expected: 0

# 3. Проверить SQL structure
zcat "$LAST_BACKUP" | head -100 | grep "PostgreSQL database dump"
# Expected: output with "PostgreSQL database dump"

# 4. Тест восстановления в dev environment (опционально)
# - Поднять отдельный PostgreSQL контейнер
# - Восстановить туда backup
# - Проверить данные

docker run --name test-postgres -e POSTGRES_PASSWORD=test -d postgres:16
sleep 5
zcat "$LAST_BACKUP" | docker exec -i test-postgres psql -U postgres postgres
docker exec test-postgres psql -U postgres postgres -c "SELECT COUNT(*) FROM t_d_article;"
docker rm -f test-postgres

# 5. Записать результат
echo "$(date): Restore test PASSED for $LAST_BACKUP" >> /opt/budget/backups/logs/restore_tests.log
```

**Длительность:** 10 минут

### Анализ логов

```bash
# 1. Проверить логи за неделю на warnings
grep -i warn /opt/budget/backups/logs/backup_*.log | tail -20

# 2. Trending backup duration
for log in /opt/budget/backups/logs/backup_2025122*.log; do
  duration=$(grep "Backup completed" "$log" | awk '{print $NF}')
  echo "$(basename $log): $duration"
done
# Expected: стабильная длительность (~60-90s)

# 3. Trending backup size
ls -lh /opt/budget/backups/backup_2025122*.sql.gz | awk '{print $5, $9}'
# Expected: стабильный размер (~5-10 MB)
```

### S3 verification

```bash
# 1. Количество S3 backups (должно быть ~28)
python3 ~/familyBudget/scripts/s3_backup.py list --bucket familybudget-backups | wc -l
# Expected: 28-30

# 2. Проверить oldest backup (должен быть ~28 дней назад)
python3 ~/familyBudget/scripts/s3_backup.py list --bucket familybudget-backups | tail -1
# Expected: дата ~28 days ago

# 3. Test download (случайный backup)
python3 ~/familyBudget/scripts/s3_backup.py download \
  $(python3 ~/familyBudget/scripts/s3_backup.py list --bucket familybudget-backups | head -1 | awk '{print $3}') \
  /tmp/test_s3_backup.sql.gz \
  --bucket familybudget-backups

# 4. Verify downloaded file
gzip -t /tmp/test_s3_backup.sql.gz
rm /tmp/test_s3_backup.sql.gz
```

### Capacity planning

```bash
# 1. Trend disk usage (last 7 days)
for i in {0..6}; do
  date=$(date -d "$i days ago" +%Y%m%d)
  size=$(du -b /opt/budget/backups/backup_${date}_*.sql.gz 2>/dev/null | awk '{print $1}')
  echo "$date: $size bytes"
done

# 2. Calculate growth rate
# Average size × 365 days = yearly storage need
avg_size=$(du -b /opt/budget/backups/backup_*.sql.gz | awk '{sum+=$1} END {print sum/NR}')
yearly_local=$((avg_size * 365 / 1024 / 1024))
yearly_s3=$((avg_size * 365 / 1024 / 1024))
echo "Projected yearly storage:"
echo "  Local (365 days): ${yearly_local} MB"
echo "  S3 (current retention): ${yearly_s3} MB"

# 3. Проверить доступное место
df -h /opt/budget | awk 'NR==2 {print "Available:", $4}'
```

---

## Ежемесячные задачи

### Полный тест восстановления (1-е число месяца)

**Цель:** End-to-end restore test

```bash
# 1. Выбрать backup недельной давности
BACKUP=$(ls -t /opt/budget/backups/backup_*.sql.gz | sed -n '7p')

# 2. Создать safety backup текущей БД
cd ~/familyBudget
./scripts/backup.sh

# 3. Полное восстановление (в production!)
# ВНИМАНИЕ: Downtime ~5 минут
./scripts/restore.sh --backup-file "$BACKUP" --yes

# 4. Измерить RTO
start_time=$(date +%s)
# ... restore process ...
end_time=$(date +%s)
rto=$((end_time - start_time))
echo "RTO: ${rto}s" >> /opt/budget/backups/logs/rto_tests.log

# 5. Full validation
curl http://localhost:8000/health/detailed
docker compose exec postgres psql -U familybudget -d familybudget -c "SELECT COUNT(*) FROM t_d_article;"
docker compose logs backend | tail -50 | grep -i error

# 6. Восстановить обратно из safety backup
./scripts/restore.sh --backup-file /opt/budget/backups/safety_backup_*.sql.gz --yes

# 7. Записать результат
echo "$(date): Full restore test PASSED, RTO: ${rto}s" >> /opt/budget/backups/logs/monthly_tests.log
```

**Длительность:** 30 минут (включая downtime)
**Планировать:** Во время maintenance window

### Retention policy review

```bash
# 1. Проверить локальные backups
actual_count=$(ls -1 /opt/budget/backups/backup_*.sql.gz | wc -l)
echo "Local backups count: $actual_count (expected: 7-8)"

# 2. Проверить что rotation работает
oldest_local=$(ls -t /opt/budget/backups/backup_*.sql.gz | tail -1)
oldest_date=$(stat -c %Y "$oldest_local")
now=$(date +%s)
age_days=$(( (now - oldest_date) / 86400 ))
echo "Oldest local backup age: ${age_days} days (expected: ≤7)"

# 3. Проверить S3 backups
s3_count=$(python3 ~/familyBudget/scripts/s3_backup.py list --bucket familybudget-backups | wc -l)
echo "S3 backups count: $s3_count (expected: ~28)"

# 4. Проверить S3 cleanup работает
oldest_s3=$(python3 ~/familyBudget/scripts/s3_backup.py list --bucket familybudget-backups | tail -1)
echo "Oldest S3 backup: $oldest_s3 (expected: ~28 days ago)"

# 5. Если cleanup не работает → manual cleanup
python3 ~/familyBudget/scripts/s3_backup.py cleanup --retention-days 28 --bucket familybudget-backups
```

### Documentation updates

```bash
# 1. Проверить что процедуры актуальны
cat ~/familyBudget/docs/BACKUP_RESTORE.md | grep "Последнее обновление"

# 2. Добавить новые ошибки в troubleshooting (если нашли)
nano ~/familyBudget/docs/BACKUP_RESTORE.md

# 3. Обновить performance baselines (если изменились)
# - Backup duration
# - Restore duration
# - Compression ratio

# 4. Commit changes
cd ~/familyBudget
git add docs/BACKUP_RESTORE.md
git commit -m "docs: update backup troubleshooting"
git push
```

### Performance analysis

```bash
# 1. Backup duration trend (last 30 days)
for log in /opt/budget/backups/logs/backup_202512*.log; do
  duration=$(grep "duration:" "$log" 2>/dev/null | awk '{print $NF}' | tr -d 's')
  if [ -n "$duration" ]; then
    echo "$(basename $log .log): ${duration}s"
  fi
done | sort

# 2. Average duration
avg=$(for log in /opt/budget/backups/logs/backup_202512*.log; do
  grep "duration:" "$log" 2>/dev/null | awk '{print $NF}' | tr -d 's'
done | awk '{sum+=$1; count++} END {print sum/count}')
echo "Average backup duration: ${avg}s"

# 3. Compression ratio trend
for backup in /opt/budget/backups/backup_202512*.sql.gz; do
  compressed=$(stat -c %s "$backup")
  uncompressed=$(zcat "$backup" | wc -c)
  ratio=$(echo "scale=2; $uncompressed / $compressed" | bc)
  echo "$(basename $backup): ${ratio}:1"
done

# 4. S3 upload speed trend
grep "Upload duration:" /opt/budget/backups/logs/backup_202512*.log | awk '{print $NF}'
```

### Cost analysis

```bash
# 1. S3 storage cost
s3_total_size=$(python3 ~/familyBudget/scripts/s3_backup.py list --bucket familybudget-backups | \
  awk '{sum+=$4} END {print sum}')
s3_cost_monthly=$(echo "scale=4; $s3_total_size * 0.024 / 1024" | bc)
echo "S3 monthly storage cost: \$${s3_cost_monthly}"

# 2. Network cost (upload)
monthly_uploads=30
avg_backup_size=5  # MB
total_upload_gb=$(echo "$monthly_uploads * $avg_backup_size / 1024" | bc -l)
echo "Monthly S3 upload: ${total_upload_gb} GB"

# 3. Total cost
echo "Total estimated monthly cost: \$${s3_cost_monthly} (storage only)"

# 4. Trend (compare with last month)
# ... similar calculations for previous month ...
```

---

## Настройка производительности

### Compression optimization

**Текущий:** gzip -6 (balanced)

**Опции:**

| Level | Speed | Size | Recommendation |
|-------|-------|------|----------------|
| gzip -1 | 2x faster | 2x larger | If CPU constrained |
| gzip -6 | Balanced | Balanced | **Default (recommended)** |
| gzip -9 | 2x slower | 15% smaller | If storage constrained |

**Изменить:**
```bash
# Edit scripts/backup.sh
nano ~/familyBudget/scripts/backup.sh

# Find line:
pg_dump ... | gzip -6 > backup.sql.gz

# Change to (example):
pg_dump ... | gzip -9 > backup.sql.gz

# Test
./scripts/backup.sh --verbose
```

### Backup window optimization

**Текущий:** 2:00 AM daily (в `/etc/cron.d/familybudget_backup`)

**Изменить:**
```bash
# Edit cron job
sudo crontab -e

# Change from:
0 2 * * * /opt/budget/scripts/backup.sh

# To (example: 3:00 AM):
0 3 * * * /opt/budget/scripts/backup.sh
```

**Рекомендации:**
- Выбрать время минимальной нагрузки
- Избегать одновременного backup с другими cron jobs
- Учитывать S3 upload time (~30-120s)

### S3 optimization

**Multipart upload (для больших файлов):**

Текущий `s3_backup.py` использует `upload_file` (автоматический multipart > 5 MB).

**Chunk size optimization:**
```python
# In scripts/s3_backup.py
from boto3.s3.transfer import TransferConfig

config = TransferConfig(
    multipart_threshold=5 * 1024 * 1024,  # 5 MB (default: 8 MB)
    multipart_chunksize=5 * 1024 * 1024,  # 5 MB chunks
    max_concurrency=10                     # parallel uploads
)

s3_client.upload_file(local_file, bucket, key, Config=config)
```

**Retry configuration:**
```python
from botocore.config import Config

config = Config(
    retries={
        'max_attempts': 5,
        'mode': 'adaptive'
    },
    connect_timeout=10,
    read_timeout=60
)

s3_client = boto3.client('s3', config=config)
```

### Database optimization

**Vacuum and Analyze (перед backup для consistency):**

```bash
# Добавить в backup.sh before pg_dump
docker compose exec postgres psql -U familybudget -d familybudget -c "VACUUM ANALYZE;"

# Проверит effect на backup size
```

**Exclude tables (если есть temp tables):**

```bash
# В backup.sh
pg_dump ... --exclude-table='tmp_*' --exclude-table='staging_*'
```

---

## Automation Scripts

### Daily health check script

**`/opt/budget/scripts/backup_health_check.sh`:**

```bash
#!/bin/bash
set -e

LOG_FILE="/opt/budget/backups/logs/health_check_$(date +%Y%m%d).log"

echo "=== Backup Health Check $(date) ===" >> "$LOG_FILE"

# Check today's backup exists
if ls /opt/budget/backups/backup_$(date +%Y%m%d)_*.sql.gz &> /dev/null; then
  echo "[OK] Today's backup exists" >> "$LOG_FILE"
else
  echo "[FAIL] Today's backup missing!" >> "$LOG_FILE"
  # Send alert
  curl -X POST <webhook_url> -d "Backup missing for $(date +%Y-%m-%d)"
  exit 1
fi

# Check disk space
USAGE=$(df -h /opt/budget | awk 'NR==2 {print $5}' | tr -d '%')
if [ $USAGE -lt 80 ]; then
  echo "[OK] Disk space: ${USAGE}%" >> "$LOG_FILE"
else
  echo "[WARN] Disk space high: ${USAGE}%" >> "$LOG_FILE"
fi

echo "=== Health Check Complete ===" >> "$LOG_FILE"
```

**Добавить в cron:**
```bash
0 9 * * * /opt/budget/scripts/backup_health_check.sh
```

---

**Related Documentation:**
- [Backup & Restore Manual](../../BACKUP_RESTORE.md)
- [Backup System Architecture](../backup-system.md)
- [Disaster Recovery](disaster-recovery.md)
