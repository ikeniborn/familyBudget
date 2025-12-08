# PostgreSQL Volume Migration: Bind Mount → Docker Managed

## Prerequisites

- Root access
- PostgreSQL running and healthy
- Disk space: 2x current data size

## Migration

```bash
# 1. Backup
./scripts/backup.sh --force-s3

# 2. Run migration
sudo ./scripts/migrate_to_docker_volume.sh

# 3. Deploy
sudo bash deploy.sh --sync-mode update --cleanup-mode smart

# 4. Verify
docker compose ps
docker compose exec postgres pg_isready -U familybudget
curl -f http://localhost:8000/health
```

## Rollback

```bash
sudo ./scripts/migrate_to_docker_volume.sh --rollback
```

## Check Status

```bash
sudo ./scripts/migrate_to_docker_volume.sh --check
```

## What Changes

| Before | After |
|--------|-------|
| `/opt/budget/data/postgres` (bind mount) | Docker managed volume `familybudget_postgres_data` |
| Requires repair functions before each deploy | Docker handles automatically |
| Host filesystem access | Isolated Docker volume |

## Backward Compatibility

Existing bind mount installations continue working without migration.
