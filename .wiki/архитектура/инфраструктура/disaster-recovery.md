---
wiki_sources: ["docs/architecture/operations/disaster-recovery.md", "docs/architecture/operations/backup-operations.md"]
wiki_updated: 2026-05-05
wiki_status: developing
tags: ["Docker", "PostgreSQL", "backup", "operations", "restore"]
aliases: ["DR", "Disaster Recovery", "Аварийное восстановление", "RTO", "RPO"]
---

# Disaster Recovery

Процедуры аварийного восстановления системы Family Budget. 5 сценариев с параметрами RTO/RPO.

## Основные характеристики

### Сценарии аварий

| Сценарий | RTO | RPO | Критичность |
|---------|-----|-----|------------|
| PostgreSQL контейнер упал | 1-2 мин | 0 | LOW |
| Повреждение данных | 5-10 мин | до 1 дня | HIGH |
| Случайный DELETE | 10-20 мин | минимальная | MEDIUM |
| Отказ Docker volume | 15-30 мин | до 1 дня | CRITICAL |
| Множественный отказ сервисов | 5-15 мин | 0 до 1 дня | CRITICAL |

### Generic Recovery Checklist (10 шагов)

1. **Assess** — `docker compose ps && docker compose logs --tail=100`
2. **Stabilize** — остановить проблемные сервисы
3. **Backup Current State** — `./scripts/backup.sh` (даже повреждённую БД)
4. **Locate Clean Backup** — локально `/opt/budget/backups/` или S3
5. **Plan Restore** — определить потери данных, тест в dev если нужно
6. **Execute Restore** — `./scripts/restore.sh --backup-file /path/backup.sql.gz`
7. **Validate Data** — проверить таблицы через psql
8. **Monitor** — наблюдать 30 минут (`watch -n 5 'docker compose ps'`)
9. **Communicate** — уведомить пользователей при downtime >5 мин
10. **Post-Incident Review** — документировать root cause и превентивные меры

### Валидация после восстановления

```bash
# Database
docker compose exec postgres psql -U familybudget -d familybudget -c "SELECT 1;"
# ~36 tables expected
SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';

# Application
curl http://localhost:8000/health  # {"status": "healthy"}
curl http://localhost:8000/health/detailed  # db_connection: true
```

### Восстановление Docker Volume (Сценарий 4)

Docker volume создаётся автоматически с v1.2.0 при деплое. Восстановление из S3:

```bash
docker compose down
docker volume rm budget_postgres_data
# Запустить деплой (volume создастся автоматически)
sudo ./deploy.sh
# Затем restore из S3
./scripts/restore.sh  # выбрать S3 backups
```

### Мониторинг и алерты

| Alert | Условие | Severity |
|-------|---------|---------|
| BackupJobFailed | backup_job_status == 0 за 24h | HIGH |
| BackupTooOld | last_backup > 25h | HIGH |
| S3UploadFailed | s3_upload_status == 0 | MEDIUM |
| DiskSpaceLow | disk_space_used > 80% | HIGH |
| RestoreFailed | restore_job_status == 0 | CRITICAL |

## Связанные концепции

- [[ci-cd-pipeline]]
- [[бэкап-система]] (скрипты домен)
