#!/bin/bash
set -e

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "Starting backup service..."

# Test database connections on startup
log "Testing PostgreSQL connection..."
if pg_isready -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}"; then
    log "PostgreSQL connection successful"
else
    log "WARNING: PostgreSQL connection failed - backups may fail"
fi

# Run initial backup if requested
if [ "${RUN_INITIAL_BACKUP}" = "true" ]; then
    log "Running initial backup..."
    /scripts/backup-postgres.sh
fi

# Start cron in foreground
log "Starting cron daemon..."
exec crond -f -l 2