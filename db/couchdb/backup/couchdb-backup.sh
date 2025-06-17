#!/bin/bash
set -euo pipefail

# Configuration
BACKUP_DIR="/home/ikeniborn/app/web/db/couchdb/backup"
LOG_FILE="${BACKUP_DIR}/backup.log"
RETENTION_DAYS=7
DATE_FORMAT="+%Y%m%d"
BACKUP_NAME="couchdb-$(date -u ${DATE_FORMAT}).tar.gz"
OLD_BACKUP_NAME="couchdb-$(date -d "${RETENTION_DAYS} days ago" ${DATE_FORMAT}).tar.gz"
DOCKER_VOLUME="web_couchdb-data"
S3_BUCKET="yandex/ikeniborn-obsidian-couchdb"
MC_BIN="/opt/minio-binaries/mc"
COUCHDB_CONTAINER="couchdb"
COUCHDB_DATA_PATH="/opt/couchdb/data"

# Resource limits
CPU_LIMIT="0.5"  # 50% of one CPU
MEMORY_LIMIT="512m"  # 512MB RAM
COMPRESSION_LEVEL="6"  # gzip compression level (1-9)
UPLOAD_BANDWIDTH="1MB"  # Bandwidth limit for S3 upload
NICE_LEVEL="19"  # Lowest priority
IONICE_CLASS="3"  # Idle I/O priority

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "${LOG_FILE}"
}

# Error handling
error_exit() {
    log "ERROR: $1"
    exit 1
}

# Check prerequisites
if [[ ! -d "${BACKUP_DIR}" ]]; then
    error_exit "Backup directory ${BACKUP_DIR} does not exist"
fi

if [[ ! -x "${MC_BIN}" ]]; then
    error_exit "MinIO client not found at ${MC_BIN}"
fi

# Change to backup directory
cd "${BACKUP_DIR}" || error_exit "Failed to change to backup directory"

log "Starting CouchDB backup process"

# Remove existing backup if present
if [[ -f "${BACKUP_NAME}" ]]; then
    log "Removing existing backup: ${BACKUP_NAME}"
    rm -f "${BACKUP_NAME}" || error_exit "Failed to remove existing backup"
fi

# Create backup with resource limits
log "Creating backup: ${BACKUP_NAME}"
log "Preparing Docker container..."

# Optional: Check CouchDB health before backup
log "Checking CouchDB health..."
if docker exec ${COUCHDB_CONTAINER} curl -s -f http://localhost:5984/_up > /dev/null; then
    log "CouchDB is healthy"
else
    log "WARNING: CouchDB health check failed, but continuing with backup"
fi

# Check if CouchDB container is running
if ! docker ps --format '{{.Names}}' | grep -q "^${COUCHDB_CONTAINER}$"; then
    error_exit "CouchDB container is not running"
fi

log "Starting archive creation..."
log "Creating backup from running CouchDB container..."

# Create backup directly from running container
if nice -n ${NICE_LEVEL} ionice -c ${IONICE_CLASS} \
    docker exec ${COUCHDB_CONTAINER} sh -c "
        cd ${COUCHDB_DATA_PATH} && \
        tar cf - .
    " | pv -p -t -e | pigz -${COMPRESSION_LEVEL} > "${BACKUP_NAME}"; then
    
    log "Backup created successfully"
    log "Backup size: $(du -h "${BACKUP_NAME}" | cut -f1)"
else
    error_exit "Failed to create backup"
fi

# Verify backup was created
if [[ ! -f "${BACKUP_NAME}" ]]; then
    error_exit "Backup file was not created"
fi

# Check backup integrity
log "Verifying backup integrity..."
if gzip -t "${BACKUP_NAME}" 2>/dev/null; then
    log "Backup integrity check passed"
else
    error_exit "Backup file is corrupted"
fi

# Upload to S3 with bandwidth limit and progress
log "Uploading backup to S3: ${S3_BUCKET}"
log "Upload bandwidth limit: ${UPLOAD_BANDWIDTH}"

# Use mc with progress output
if "${MC_BIN}" cp --limit-upload "${UPLOAD_BANDWIDTH}" "${BACKUP_NAME}" "${S3_BUCKET}/" 2>&1 | while IFS= read -r line; do
    # Log all non-empty lines from mc output for debugging
    if [[ -n "${line}" ]]; then
        log "Upload: ${line}"
    fi
done; then
    log "Backup uploaded successfully"
else
    error_exit "Failed to upload backup to S3"
fi

# Clean up local old backups
if [[ -f "${OLD_BACKUP_NAME}" ]]; then
    log "Removing old local backup: ${OLD_BACKUP_NAME}"
    rm -f "${OLD_BACKUP_NAME}" || log "WARNING: Failed to remove old local backup"
fi

# Clean up S3 old backups
log "Checking for old backup in S3: ${OLD_BACKUP_NAME}"
if "${MC_BIN}" ls "${S3_BUCKET}/${OLD_BACKUP_NAME}" &>/dev/null; then
    log "Removing old S3 backup: ${OLD_BACKUP_NAME}"
    "${MC_BIN}" rm "${S3_BUCKET}/${OLD_BACKUP_NAME}" || log "WARNING: Failed to remove old S3 backup"
else
    log "No old backup found in S3"
fi

# Clean up any backups older than retention period
log "Cleaning up backups older than ${RETENTION_DAYS} days"
find "${BACKUP_DIR}" -name "couchdb-*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

log "Backup process completed successfully"

# Return to home directory
cd ~ || true/