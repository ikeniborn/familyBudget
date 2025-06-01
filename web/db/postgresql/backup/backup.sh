#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-budgetdb}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Export password for pg_dump
export PGPASSWORD

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to send notification (can be extended for email/webhook)
notify() {
    local status=$1
    local message=$2
    log "${status}: ${message}"
    # TODO: Add webhook/email notification here
}

# Perform backup
log "Starting PostgreSQL backup..."
BACKUP_FILE="${BACKUP_DIR}/postgres_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"

if pg_dump -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" --no-owner --clean --if-exists | gzip -9 > "${BACKUP_FILE}"; then
    log "Backup completed successfully: ${BACKUP_FILE}"
    log "Backup size: $(du -h ${BACKUP_FILE} | cut -f1)"
    notify "SUCCESS" "PostgreSQL backup completed: ${BACKUP_FILE}"
else
    log "ERROR: Backup failed!"
    notify "ERROR" "PostgreSQL backup failed"
    exit 1
fi

# Remove old backups
log "Removing backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "postgres_${POSTGRES_DB}_*.sql.gz" -type f -mtime +${RETENTION_DAYS} -delete

# List current backups
log "Current backups:"
ls -lh "${BACKUP_DIR}"/postgres_${POSTGRES_DB}_*.sql.gz 2>/dev/null || echo "No backups found"

log "Backup process completed"