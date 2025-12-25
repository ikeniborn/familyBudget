# Disaster Recovery Procedures

Аварийное восстановление системы бэкапов Family Budget.

**Для кого:** On-call инженеры, DevOps, sysadmins

**Содержание:**
- [5 сценариев аварий](#сценарии-аварий)
- [Процедуры восстановления](#процедуры-восстановления)
- [Валидация](#валидация-после-восстановления)
- [Мониторинг](#мониторинг-и-алерты)

---

## Сценарии аварий

### Сценарий 1: PostgreSQL контейнер упал

**Симптомы:**
- `docker compose ps` показывает `postgres` в статусе `Exited`
- Backend возвращает 500 errors
- Логи: "could not connect to server"

**Детекция:**
```bash
docker compose ps | grep postgres
# postgres   Exited (1)
```

**Восстановление:**
```bash
cd /opt/budget
docker compose restart postgres
docker compose logs postgres | tail -50
```

**Валидация:**
```bash
docker compose ps | grep postgres  # Should be "Up (healthy)"
curl http://localhost:8000/health  # Should return 200
```

**Параметры:**
- **RTO:** 1-2 минуты
- **RPO:** 0 (нет потери данных)
- **Критичность:** LOW

---

### Сценарий 2: Повреждение данных

**Симптомы:**
- Query errors: "invalid page header", "index corruption"
- Неожиданные результаты запросов
- NULL values в NOT NULL колонках

**Детекция:**
```bash
docker compose logs backend | grep -i "IntegrityError\|CorruptionError"
```

**Восстановление:**
```bash
# 1. Остановить запись
cd /opt/budget
docker compose stop backend bot

# 2. Снапшот текущего состояния
cd ~/familyBudget
./scripts/backup.sh

# 3. Определить время начала проблемы (из логов)
docker compose logs backend | grep -i error | head -1
# [2025-12-23 14:30:00] ERROR

# 4. Выбрать backup ДО этого времени
ls -lt /opt/budget/backups/backup_*.sql.gz | head -5

# 5. Восстановить
./scripts/restore.sh --backup-file /opt/budget/backups/backup_20251223_140000.sql.gz --yes

# 6. Валидация
curl http://localhost:8000/health/detailed
```

**Параметры:**
- **RTO:** 5-10 минут
- **RPO:** До 1 дня (зависит от бэкапа)
- **Критичность:** HIGH

---

### Сценарий 3: Случайный DELETE

**Симптомы:**
- Пользователь сообщает об исчезновении данных
- Логи показывают массовый DELETE

**Детекция:**
```bash
docker compose logs backend | grep "DELETE FROM" | tail -20
# [2025-12-23 14:35:22] DELETE FROM t_f_budget_fact WHERE ...
```

**Восстановление:**
```bash
# 1. Немедленно остановить дальнейшие операции
docker compose stop backend bot

# 2. Создать снапшот (может содержать частично удаленные данные)
./scripts/backup.sh

# 3. Найти timestamp DELETE
docker compose logs backend | grep "DELETE FROM" | head -1
# [2025-12-23 14:35:22]

# 4. Найти последний backup ДО delete (например, 14:30)
ls -lt /opt/budget/backups/ | grep "143[0-4]"

# 5. Восстановить
./scripts/restore.sh --backup-file /opt/budget/backups/backup_20251223_143000.sql.gz

# 6. Если между backup и delete были важные операции:
# - Экспортировать из safety_backup
# - Попросить пользователей ввести заново
```

**Параметры:**
- **RTO:** 10-20 минут
- **RPO:** Минимальная (если быстро среагировали)
- **Критичность:** MEDIUM

---

### Сценарий 4: Отказ Docker volume

**Симптомы:**
- `postgres_data` volume unmountable
- I/O errors: "Input/output error"
- Docker: "Error response from daemon: error while mounting volume"

**Детекция:**
```bash
docker volume inspect budget_postgres_data
# Error: No such volume

docker compose logs postgres
# Error: could not open directory "/var/lib/postgresql/data": Input/output error
```

**NOTE:** Начиная с версии 1.2.0, Docker volume создается автоматически при деплое. Ручное создание требуется только для сценариев disaster recovery.

**Восстановление:**
```bash
# 1. Остановить все
cd /opt/budget
docker compose down

# 2. Проверить volume
docker volume ls | grep postgres_data
docker volume inspect budget_postgres_data

# 3. Удалить поврежденный volume
docker volume rm budget_postgres_data

# 4. Создать новый (или просто запустите deploy.sh для автоматического создания)
docker volume create budget_postgres_data

# ИЛИ просто запустите деплой (автоматическое создание):
cd ~/familyBudget
sudo ./deploy.sh

# 5. Запустить postgres
docker compose up -d postgres

# 6. Дождаться готовности
until docker compose exec postgres pg_isready; do sleep 1; done

# 7. Восстановить из S3 (локальные бэкапы могут быть утеряны)
cd ~/familyBudget
./scripts/restore.sh
# Выбрать: 2) S3 backups
# Выбрать последний бэкап

# 8. Запустить все сервисы
cd /opt/budget
docker compose up -d
```

**Параметры:**
- **RTO:** 15-30 минут
- **RPO:** До 1 дня (последний S3 backup)
- **Критичность:** CRITICAL

**Preventive measures:**
- Regular volume backups
- RAID configuration for Docker storage
- Monitoring disk health (SMART)

---

### Сценарий 5: Множественный отказ сервисов

**Симптомы:**
- Все контейнеры (postgres, backend, bot) в состоянии `Exited`
- Docker daemon не отвечает
- Host system issues (OOM, kernel panic)

**Детекция:**
```bash
docker compose ps
# All services: Exited

systemctl status docker
# Active: failed
```

**Восстановление:**
```bash
# 1. Проверить Docker daemon
sudo systemctl status docker
sudo systemctl restart docker

# 2. Проверить disk space
df -h
# If > 90% → clean up

# 3. Проверить memory
free -h
# If swap usage high → investigate OOM

# 4. Перезапустить все сервисы
cd /opt/budget
docker compose down
docker compose up -d

# 5. Проверить логи на errors
docker compose logs --tail=100

# 6. Если БД повреждена → восстановить
docker compose exec postgres psql -U familybudget -d familybudget -c "SELECT 1;"
# If fails → restore from backup

cd ~/familyBudget
./scripts/restore.sh
```

**Параметры:**
- **RTO:** 5-15 минут
- **RPO:** Зависит от причины (0 до 1 дня)
- **Критичность:** CRITICAL

---

## Процедуры восстановления

### Generic Recovery Checklist

**Для любой аварии, следуйте этим 10 шагам:**

1. **Assess Damage**
   ```bash
   # Что сломано?
   docker compose ps
   docker compose logs --tail=100
   curl http://localhost:8000/health
   ```

2. **Stabilize**
   ```bash
   # Остановить проблемные сервисы
   docker compose stop backend bot
   ```

3. **Backup Current State**
   ```bash
   # Создать снапшот (даже если БД повреждена)
   ./scripts/backup.sh
   ```

4. **Locate Clean Backup**
   ```bash
   # Найти последний рабочий backup
   ls -lt /opt/budget/backups/
   # Или S3:
   python3 scripts/s3_backup.py list --bucket familybudget-backups
   ```

5. **Plan Restore**
   ```bash
   # Определить:
   # - Какой backup использовать
   # - Какие данные будут потеряны
   # - Нужен ли тест restore в dev
   ```

6. **Execute Restore**
   ```bash
   ./scripts/restore.sh --backup-file /path/to/backup.sql.gz
   ```

7. **Validate Data**
   ```bash
   # Проверить ключевые таблицы
   docker compose exec postgres psql -U familybudget -d familybudget -c "
   SELECT schemaname, tablename, n_live_tup
   FROM pg_stat_user_tables
   ORDER BY n_live_tup DESC LIMIT 10;"
   ```

8. **Monitor Services**
   ```bash
   # Следить 30 минут
   watch -n 5 'docker compose ps'
   watch -n 5 'curl -s http://localhost:8000/health'
   ```

9. **Communicate Status**
   ```bash
   # Уведомить:
   # - Пользователей (если downtime > 5 min)
   # - Team (incident report)
   # - Management (if critical)
   ```

10. **Post-Incident Review**
    ```bash
    # Документировать:
    # - Root cause
    # - Timeline
    # - Actions taken
    # - Preventive measures
    ```

---

## Валидация после восстановления

### Database Validation

```bash
# 1. Connectivity
docker compose exec postgres psql -U familybudget -d familybudget -c "SELECT 1;"
# Expected: 1 (one row)

# 2. Table count
docker compose exec postgres psql -U familybudget -d familybudget -tAc "
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';"
# Expected: ~36 tables

# 3. Row counts (spot check)
docker compose exec postgres psql -U familybudget -d familybudget -c "
SELECT 't_d_article' AS table, COUNT(*) FROM t_d_article
UNION ALL
SELECT 't_f_budget_fact', COUNT(*) FROM t_f_budget_fact
UNION ALL
SELECT 't_d_user', COUNT(*) FROM t_d_user;"
# Expected: reasonable numbers (>0 for all)

# 4. Recent data
docker compose exec postgres psql -U familybudget -d familybudget -c "
SELECT MAX(fact_date) FROM t_f_budget_fact;"
# Expected: recent date (not too old)

# 5. Indexes
docker compose exec postgres psql -U familybudget -d familybudget -c "
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname
LIMIT 20;"
# Expected: indexes exist
```

### Application Validation

```bash
# 1. Health endpoint
curl http://localhost:8000/health
# Expected: {"status": "healthy"}

# 2. Detailed health
curl http://localhost:8000/health/detailed
# Expected: JSON with db_connection: true

# 3. API test (articles)
curl http://localhost:8000/api/v1/articles | jq '.[0:3]'
# Expected: Array of articles

# 4. Backend logs (no errors)
docker compose logs backend | tail -50 | grep -i error
# Expected: no critical errors

# 5. Bot status
docker compose logs bot | tail -20
# Expected: "Bot started successfully" or similar
```

### Service Health

```bash
# 1. Container status
docker compose ps
# Expected: All services "Up (healthy)"

# 2. Resource usage
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}"
# Expected: Normal CPU/Memory usage

# 3. Disk space
df -h /opt/budget
# Expected: < 80% used

# 4. Network connectivity
curl -I http://localhost:8000
# Expected: HTTP/1.1 200 OK
```

---

## Мониторинг и алерты

### Critical Metrics

```yaml
# Backup job failed
alert: BackupJobFailed
condition: backup_job_status == 0
duration: 24h
severity: HIGH
action: Check logs, retry manually, notify team

# Backup too old
alert: BackupTooOld
condition: (now() - backup_last_timestamp) > 25h
severity: HIGH
action: Run manual backup, check cron job

# S3 upload failed
alert: S3UploadFailed
condition: s3_upload_status == 0 AND s3_configured == true
duration: 24h
severity: MEDIUM
action: Check S3 credentials, network, retry

# Disk space low
alert: DiskSpaceLow
condition: disk_space_used > 80%
severity: HIGH
action: Clean up old backups, add storage

# Restore failed
alert: RestoreFailed
condition: restore_job_status == 0
severity: CRITICAL
action: Immediate investigation, manual restore
```

### Monitoring Setup

**Prometheus metrics (example):**
```python
# In backend/app/monitoring.py
from prometheus_client import Gauge

backup_last_timestamp = Gauge('backup_last_timestamp', 'Timestamp of last successful backup')
backup_file_size = Gauge('backup_file_size_bytes', 'Size of last backup file')
s3_upload_status = Gauge('s3_upload_status', 'S3 upload status (0=failed, 1=success)')

# Update after backup
with open('/opt/budget/backups/backup_*.sql.gz') as f:
    backup_file_size.set(os.path.getsize(f.name))
    backup_last_timestamp.set(os.path.getmtime(f.name))
```

**Alertmanager config (example):**
```yaml
route:
  routes:
    - match:
        severity: CRITICAL
      receiver: pagerduty
      continue: true
    - match:
        severity: HIGH
      receiver: slack
      continue: true

receivers:
  - name: pagerduty
    pagerduty_configs:
      - service_key: <key>
  - name: slack
    slack_configs:
      - api_url: <webhook>
        channel: '#alerts'
```

---

## Escalation Path

### Level 1: On-Call Engineer
- Responds within 15 minutes
- Executes standard recovery procedures
- Escalates if unsuccessful after 30 minutes

### Level 2: Senior DevOps
- Deep investigation
- Custom recovery procedures
- Coordinates with team

### Level 3: CTO / Engineering Manager
- Critical decisions (downtime vs data loss)
- External communication (users, stakeholders)
- Post-mortem coordination

---

## Contact Information

**Emergency Contacts:**
- On-Call Phone: XXX-XXX-XXXX
- Slack: #incidents
- Email: devops@company.com

**Vendor Contacts:**
- Yandex Cloud Support: +7 XXX XXX-XX-XX
- AWS Support: Case via console
- Hetzner Support: https://hetzner.com/support

---

**Related Documentation:**
- [Backup & Restore Manual](../../BACKUP_RESTORE.md)
- [Backup System Architecture](../backup-system.md)
- [Backup Operations](backup-operations.md)
