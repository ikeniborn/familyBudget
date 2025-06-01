#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
POSTGRES_HOST="${POSTGRES_HOST:-postgres}"
POSTGRES_PORT="${POSTGRES_PORT:-5432}"
POSTGRES_DB="${POSTGRES_DB:-budgetdb}"
POSTGRES_USER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD}"

# Export password for psql
export PGPASSWORD

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if backup file is provided
if [ $# -eq 0 ]; then
    log "ERROR: No backup file specified"
    echo "Usage: $0 <backup_file>"
    echo ""
    echo "Available backups:"
    ls -lh "${BACKUP_DIR}"/postgres_${POSTGRES_DB}_*.sql.gz 2>/dev/null || echo "No backups found"
    exit 1
fi

BACKUP_FILE="$1"

# Check if backup file exists
if [ ! -f "${BACKUP_FILE}" ]; then
    log "ERROR: Backup file not found: ${BACKUP_FILE}"
    exit 1
fi

# Confirm restoration
log "WARNING: This will restore the database from: ${BACKUP_FILE}"
log "All current data in database '${POSTGRES_DB}' will be replaced!"
read -p "Are you sure you want to continue? (yes/NO): " confirm

if [ "${confirm}" != "yes" ]; then
    log "Restoration cancelled"
    exit 0
fi

# Perform restoration
log "Starting PostgreSQL restoration..."

if gunzip -c "${BACKUP_FILE}" | psql -h "${POSTGRES_HOST}" -p "${POSTGRES_PORT}" -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" > /dev/null 2>&1; then
    log "Restoration completed successfully from: ${BACKUP_FILE}"
else
    log "ERROR: Restoration failed!"
    exit 1
fi

log "Database restored successfully"