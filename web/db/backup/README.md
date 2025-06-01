# Database Backup System

## Overview

This backup system provides automated daily backups for both PostgreSQL and CouchDB databases with configurable retention policies.

## Features

- **Automated Daily Backups**: PostgreSQL at 2 AM, CouchDB at 3 AM
- **Retention Policy**: Keeps backups for 7 days by default (configurable)
- **Compression**: All backups are compressed to save space
- **Container-based**: Runs in its own Docker container with cron
- **Logging**: All backup operations are logged with rotation
- **Easy Restoration**: Simple restore scripts included

## Configuration

The backup service is configured via environment variables in `.env`:

```bash
# Backup retention (days)
RETENTION_DAYS=7

# Run initial backup on container start
RUN_INITIAL_BACKUP=false
```

## Usage

### Starting the Backup Service

```bash
docker-compose up -d backup
```

### Manual Backup

To run a backup manually:

```bash
# PostgreSQL backup
docker-compose exec backup /scripts/backup-postgres.sh

# CouchDB backup
docker-compose exec backup /scripts/backup-couchdb.sh
```

### Viewing Backup Logs

```bash
docker-compose logs backup
# or
docker-compose exec backup tail -f /var/log/backup.log
```

### Listing Backups

```bash
docker-compose exec backup ls -lh /backups/
```

### Restoring from Backup

#### PostgreSQL Restore

```bash
# List available backups
docker-compose exec backup ls -lh /backups/postgres_*.sql.gz

# Restore specific backup
docker-compose exec backup /scripts/restore-postgres.sh /backups/postgres_budgetdb_20250106_020000.sql.gz
```

#### CouchDB Restore

CouchDB restore requires manual steps:

1. Extract the backup:
```bash
docker-compose exec backup tar -xzf /backups/couchdb_20250106_030000.tar.gz -C /tmp/
```

2. Restore each database using CouchDB API or Fauxton UI

## Backup Schedule

Default cron schedule (UTC):
- PostgreSQL: Daily at 2:00 AM
- CouchDB: Daily at 3:00 AM

To modify the schedule, edit the crontab in the Dockerfile and rebuild:
```bash
docker-compose build backup
docker-compose up -d backup
```

## Monitoring

### Health Checks

The backup service tests database connectivity on startup. Check the logs for connection status.

### Notifications

To add email or webhook notifications:

1. Edit `/scripts/backup-postgres.sh` and `/scripts/backup-couchdb.sh`
2. Implement the `notify()` function with your notification method
3. Rebuild the container

Example webhook notification:
```bash
notify() {
    local status=$1
    local message=$2
    curl -X POST https://your-webhook-url \
         -H "Content-Type: application/json" \
         -d "{\"status\": \"${status}\", \"message\": \"${message}\"}"
}
```

## Backup Location

Backups are stored in the Docker volume `backup-data`, mounted at `/backups` inside the container.

To access backups from the host:
```bash
docker volume inspect familybudget_backup-data
```

## Security Notes

- Backup files contain sensitive data - ensure proper access controls
- Consider encrypting backups for additional security
- Regularly test restore procedures
- Monitor backup sizes and adjust retention as needed

## Troubleshooting

### Backup Fails

1. Check database connectivity:
```bash
docker-compose exec backup pg_isready -h postgres -U postgres
```

2. Check credentials in `.env` file

3. Review logs:
```bash
docker-compose logs backup --tail=50
```

### No Backups Created

1. Verify cron is running:
```bash
docker-compose exec backup ps aux | grep cron
```

2. Check crontab:
```bash
docker-compose exec backup crontab -l
```

3. Run backup manually to test

### Disk Space Issues

1. Reduce retention period in `.env`
2. Check backup sizes:
```bash
docker-compose exec backup du -sh /backups/*
```
3. Consider external storage for long-term retention