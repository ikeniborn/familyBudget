#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="${BACKUP_DIR:-/backups}"
COUCHDB_HOST="${COUCHDB_HOST:-couchdb}"
COUCHDB_PORT="${COUCHDB_PORT:-5984}"
COUCHDB_USER="${COUCHDB_USER:-admin}"
COUCHDB_PASSWORD="${COUCHDB_PASSWORD}"
RETENTION_DAYS="${RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create backup directory if it doesn't exist
mkdir -p "${BACKUP_DIR}"

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Function to send notification
notify() {
    local status=$1
    local message=$2
    log "${status}: ${message}"
    # TODO: Add webhook/email notification here
}

# Get list of databases
log "Starting CouchDB backup..."
BACKUP_FILE="${BACKUP_DIR}/couchdb_${TIMESTAMP}.tar.gz"
TEMP_DIR=$(mktemp -d)

# Get all databases except system databases
DBS=$(curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" "http://${COUCHDB_HOST}:${COUCHDB_PORT}/_all_dbs" | \
      jq -r '.[] | select(. | startswith("_") | not)')

# Backup each database
for db in $DBS; do
    log "Backing up database: $db"
    curl -s -u "${COUCHDB_USER}:${COUCHDB_PASSWORD}" \
         "http://${COUCHDB_HOST}:${COUCHDB_PORT}/${db}/_all_docs?include_docs=true" \
         -o "${TEMP_DIR}/${db}.json"
done

# Create tarball
if tar -czf "${BACKUP_FILE}" -C "${TEMP_DIR}" .; then
    log "Backup completed successfully: ${BACKUP_FILE}"
    log "Backup size: $(du -h ${BACKUP_FILE} | cut -f1)"
    notify "SUCCESS" "CouchDB backup completed: ${BACKUP_FILE}"
else
    log "ERROR: Backup failed!"
    notify "ERROR" "CouchDB backup failed"
    rm -rf "${TEMP_DIR}"
    exit 1
fi

# Cleanup
rm -rf "${TEMP_DIR}"

# Remove old backups
log "Removing backups older than ${RETENTION_DAYS} days..."
find "${BACKUP_DIR}" -name "couchdb_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

# List current backups
log "Current backups:"
ls -lh "${BACKUP_DIR}"/couchdb_*.tar.gz 2>/dev/null || echo "No backups found"

log "Backup process completed"