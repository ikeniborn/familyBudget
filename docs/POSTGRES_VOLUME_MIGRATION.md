# PostgreSQL Volume Migration: Bind Mount → Docker Managed

## Целевая архитектура

| Volume | Тип | Причина |
|--------|-----|---------|
| `postgres_data` | Docker managed | Автоматическое управление permissions, нет repair-функций |
| `postgres_backups` | Bind mount | Прямой доступ к бэкапам с хоста |

## Это РАЗОВАЯ миграция

Скрипт автоматически проверяет, была ли миграция выполнена ранее, и откажется запускаться повторно.

## Prerequisites

- Root access
- PostgreSQL running and healthy
- Disk space: 2x текущего размера данных

## Миграция

```bash
# 1. Backup (ОБЯЗАТЕЛЬНО!)
./scripts/backup.sh --force-s3

# 2. Миграция
sudo ./scripts/migrate_to_docker_volume.sh

# 3. Deploy
sudo bash deploy.sh --sync-mode update --cleanup-mode smart

# 4. Проверка
docker compose ps
docker compose exec postgres pg_isready -U familybudget
curl -f http://localhost:8000/health
```

## Rollback

```bash
sudo ./scripts/migrate_to_docker_volume.sh --rollback
```

## Проверка статуса

```bash
sudo ./scripts/migrate_to_docker_volume.sh --check
```

## Что меняется

**До миграции:**
```yaml
postgres_data:
  driver_opts:
    type: none
    o: bind
    device: /opt/budget/data/postgres  # Bind mount
```

**После миграции:**
```yaml
postgres_data:
  driver: local  # Docker managed volume
```

- Данные: `/opt/budget/data/postgres` → Docker volume `familybudget_postgres_data`
- Бэкапы: остаются в `/opt/budget/backups` (bind mount)
- Repair-функции в deploy.sh: пропускаются автоматически

## Backward Compatibility

Существующие bind mount installations работают без миграции.
