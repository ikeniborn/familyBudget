#!/bin/bash
set -uo pipefail

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
COUCHDB_URL="http://admin:2L6uEoNMjW9rVnPgy37t@localhost:5984"
COUCHDB_HOST_URL="http://admin:2L6uEoNMjW9rVnPgy37t@localhost:5984"  # Direct access from host

# Resource limits
CPU_LIMIT="0.5"  # 50% of one CPU
MEMORY_LIMIT="512m"  # 512MB RAM
COMPRESSION_LEVEL="6"  # gzip compression level (1-9)
UPLOAD_BANDWIDTH="1MB"  # Bandwidth limit for S3 upload
NICE_LEVEL="19"  # Lowest priority
IONICE_CLASS="3"  # Idle I/O priority
BACKUP_BATCH_SIZE="10"  # Number of databases to backup before checking container health

# Timeout settings
BASE_TIMEOUT=60       # Base timeout for small databases (seconds)
MAX_TIMEOUT=1800      # Maximum timeout for very large databases (30 minutes)
TIMEOUT_PER_MB=2      # Additional seconds per MB of database size

# Progress tracking variables
TOTAL_STEPS=9
CURRENT_STEP=0
PROGRESS_WIDTH=50

# Function to calculate timeout based on database size
calculate_timeout() {
    local db_name="$1"
    local use_host_api="$2"  # Pass as parameter instead of relying on global variable
    local db_info
    local db_size_mb
    local timeout
    
    # Get database info to determine size
    if [[ "${use_host_api}" == "true" ]]; then
        db_info=$(curl -s --connect-timeout 10 "${COUCHDB_HOST_URL}/${db_name}" 2>/dev/null)
    else
        db_info=$(docker exec "${COUCHDB_CONTAINER}" curl -s "${COUCHDB_URL}/${db_name}" 2>/dev/null)
    fi
    
    if [[ -n "$db_info" ]]; then
        # Extract file size in bytes and convert to MB
        db_size_bytes=$(echo "$db_info" | grep -o '"file":[0-9]*' | cut -d':' -f2)
        if [[ -n "$db_size_bytes" && "$db_size_bytes" -gt 0 ]]; then
            db_size_mb=$((db_size_bytes / 1024 / 1024))
            timeout=$((BASE_TIMEOUT + db_size_mb * TIMEOUT_PER_MB))
            
            # Cap at maximum timeout
            if [[ $timeout -gt $MAX_TIMEOUT ]]; then
                timeout=$MAX_TIMEOUT
            fi
            
            # Log to stderr to avoid interfering with return value
            echo "Database ${db_name}: ${db_size_mb}MB, timeout: ${timeout}s" >&2
            echo $timeout
        else
            echo "Database ${db_name}: size not found, using base timeout ${BASE_TIMEOUT}s" >&2
            echo $BASE_TIMEOUT
        fi
    else
        echo "Database ${db_name}: info not available, using base timeout ${BASE_TIMEOUT}s" >&2
        echo $BASE_TIMEOUT
    fi
}

# Progress bar function
show_progress() {
    local step=$1
    local description="$2"
    local percent=$((step * 100 / TOTAL_STEPS))
    local filled=$((percent * PROGRESS_WIDTH / 100))
    local empty=$((PROGRESS_WIDTH - filled))
    
    # Create progress bar
    local bar=""
    for ((i=0; i<filled; i++)); do bar+="█"; done
    for ((i=0; i<empty; i++)); do bar+="░"; done
    
    # Clear current line and show progress
    printf "\r\033[K[%s] %3d%% - %s" "$bar" "$percent" "$description"
    
    # Log to file as well
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] PROGRESS: ${percent}% - ${description}" >> "${LOG_FILE}"
    
    # Add newline for intermediate steps to avoid conflicts with other output
    if [[ $step -lt $TOTAL_STEPS ]]; then
        echo ""
    else
        echo ""
    fi
}

# Update progress function
update_progress() {
    CURRENT_STEP=$((CURRENT_STEP + 1))
    show_progress $CURRENT_STEP "$1"
    
    # Also show simplified progress line for better visibility
    local percent=$((CURRENT_STEP * 100 / TOTAL_STEPS))
    log "🔄 Progress: Step ${CURRENT_STEP}/${TOTAL_STEPS} (${percent}%) - $1"
}

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

update_progress "Prerequisites checked"

# Change to backup directory
cd "${BACKUP_DIR}" || error_exit "Failed to change to backup directory"

log "Starting CouchDB backup process"
update_progress "Initializing backup process"

# Remove existing backup if present
if [[ -f "${BACKUP_NAME}" ]]; then
    log "Removing existing backup: ${BACKUP_NAME}"
    rm -f "${BACKUP_NAME}" || error_exit "Failed to remove existing backup"
fi

# Check if CouchDB is running (initial check)
log "Checking if CouchDB container is running..."
if ! docker ps --format "{{.Names}}" | grep -q "^${COUCHDB_CONTAINER}$" && \
   ! [[ "$(docker inspect -f '{{.State.Running}}' "${COUCHDB_CONTAINER}" 2>/dev/null)" == "true" ]] && \
   ! curl -s --connect-timeout 2 "${COUCHDB_HOST_URL}/_up" >/dev/null 2>&1; then
    error_exit "CouchDB container '${COUCHDB_CONTAINER}' is not running"
fi
log "CouchDB container is running"
update_progress "Container status verified"

# Create backup using CouchDB replication API
log "Creating backup: ${BACKUP_NAME}"
log "Using CouchDB replication API for safe backup"

# Create temporary directory for backup
TEMP_BACKUP_DIR="${BACKUP_DIR}/temp_$(date +%s)"
mkdir -p "${TEMP_BACKUP_DIR}"

# Function to check if container is running
check_container_health() {
    # Try multiple methods to check container status
    local container_running=false
    
    # Method 1: Check by name format
    if docker ps --format "{{.Names}}" | grep -q "^${COUCHDB_CONTAINER}$"; then
        container_running=true
    # Method 2: Check by container inspection
    elif docker inspect "${COUCHDB_CONTAINER}" >/dev/null 2>&1 && \
         [[ "$(docker inspect -f '{{.State.Running}}' "${COUCHDB_CONTAINER}" 2>/dev/null)" == "true" ]]; then
        container_running=true
    # Method 3: Try to connect to CouchDB API
    elif curl -s --connect-timeout 2 "${COUCHDB_HOST_URL}/_up" >/dev/null 2>&1; then
        container_running=true
    fi
    
    if [[ "${container_running}" == "false" ]]; then
        log "WARNING: CouchDB container is not running, waiting for restart..."
        sleep 10
        
        # Retry check after waiting
        if docker ps --format "{{.Names}}" | grep -q "^${COUCHDB_CONTAINER}$" || \
           [[ "$(docker inspect -f '{{.State.Running}}' "${COUCHDB_CONTAINER}" 2>/dev/null)" == "true" ]] || \
           curl -s --connect-timeout 2 "${COUCHDB_HOST_URL}/_up" >/dev/null 2>&1; then
            log "CouchDB container is now running"
        else
            error_exit "CouchDB container failed to restart"
        fi
    fi
}

# Get list of all databases (excluding system databases)
log "Fetching database list..."
check_container_health
update_progress "Fetching database list"

# Try to use direct host access first, fall back to docker exec if needed
if curl -s --connect-timeout 5 "${COUCHDB_HOST_URL}/_all_dbs" >/dev/null 2>&1; then
    log "Using direct host access to CouchDB API"
    DBS=$(curl -s "${COUCHDB_HOST_URL}/_all_dbs" | \
        sed 's/\[//;s/\]//;s/"//g' | \
        tr ',' '\n' | \
        grep -v '^_')
    USE_HOST_API=true
else
    log "Using docker exec to access CouchDB API"
    DBS=$(docker exec "${COUCHDB_CONTAINER}" curl -s "${COUCHDB_URL}/_all_dbs" | \
        sed 's/\[//;s/\]//;s/"//g' | \
        tr ',' '\n' | \
        grep -v '^_')
    USE_HOST_API=false
fi

if [[ -z "${DBS}" ]]; then
    log "No user databases found to backup"
    rmdir "${TEMP_BACKUP_DIR}"
else
    # Export each database with health checks and delays
    DB_COUNT=0
    TOTAL_DBS=$(echo "${DBS}" | wc -w)
    log "Found ${TOTAL_DBS} databases to backup"
    
    for db in ${DBS}; do
        log "Backing up database: ${db}"
        
        # Check container health periodically
        if (( DB_COUNT % BACKUP_BATCH_SIZE == 0 )); then
            check_container_health
        fi
        
        # Add small delay to reduce load
        sleep 0.5
        
        # Calculate adaptive timeout for this database
        DB_TIMEOUT=$(calculate_timeout "${db}" "${USE_HOST_API}")
        
        # Ensure timeout is a valid number
        if ! [[ "$DB_TIMEOUT" =~ ^[0-9]+$ ]]; then
            log "WARNING: Invalid timeout calculated for ${db} (got: '$DB_TIMEOUT'), using default"
            DB_TIMEOUT=$BASE_TIMEOUT
        fi
        
        # Use direct API or docker exec based on availability
        if [[ "${USE_HOST_API}" == "true" ]]; then
            # Direct API access
            log "Starting backup of ${db} (timeout: ${DB_TIMEOUT}s)..."
            if timeout ${DB_TIMEOUT} curl -s "${COUCHDB_HOST_URL}/${db}/_all_docs?include_docs=true" \
                > "${TEMP_BACKUP_DIR}/${db}.json" 2>/dev/null; then
                
                if [[ ! -s "${TEMP_BACKUP_DIR}/${db}.json" ]]; then
                    log "WARNING: Database ${db} appears to be empty"
                else
                    file_size=$(du -h "${TEMP_BACKUP_DIR}/${db}.json" | cut -f1)
                    log "✓ Database ${db} backed up successfully (${file_size})"
                fi
            else
                exit_code=$?
                if [[ $exit_code -eq 124 ]]; then
                    log "ERROR: Database ${db} backup timed out after ${DB_TIMEOUT}s"
                else
                    log "ERROR: Database ${db} backup failed (exit code: $exit_code)"
                fi
                log "Continuing with other databases..."
            fi
        else
            # Docker exec method
            log "Starting backup of ${db} via docker exec (timeout: ${DB_TIMEOUT}s)..."
            if timeout ${DB_TIMEOUT} docker exec "${COUCHDB_CONTAINER}" curl -s "${COUCHDB_URL}/${db}/_all_docs?include_docs=true" \
                > "${TEMP_BACKUP_DIR}/${db}.json" 2>/dev/null; then
                
                if [[ ! -s "${TEMP_BACKUP_DIR}/${db}.json" ]]; then
                    log "WARNING: Database ${db} appears to be empty"
                else
                    file_size=$(du -h "${TEMP_BACKUP_DIR}/${db}.json" | cut -f1)
                    log "✓ Database ${db} backed up successfully (${file_size})"
                fi
            else
                exit_code=$?
                if [[ $exit_code -eq 124 ]]; then
                    log "ERROR: Database ${db} backup timed out after ${DB_TIMEOUT}s"
                else
                    log "ERROR: Database ${db} backup failed (exit code: $exit_code)"
                fi
                log "Continuing with other databases..."
            fi
        fi
        
        # Show database backup progress
        db_progress=$(((DB_COUNT + 1) * 100 / TOTAL_DBS))
        log "  └── Database progress: $((DB_COUNT + 1))/$TOTAL_DBS ($db_progress%) - $db"
        
        ((DB_COUNT++))
    done
    
    update_progress "Database export completed (${TOTAL_DBS} databases)"
    
    # Also backup global configuration
    log "Backing up CouchDB configuration..."
    check_container_health
    sleep 0.5
    
    if [[ "${USE_HOST_API}" == "true" ]]; then
        # Direct API access
        if timeout 30 curl -s "${COUCHDB_HOST_URL}/_node/_local/_config" \
            > "${TEMP_BACKUP_DIR}/_config.json"; then
            log "Configuration backed up successfully"
        else
            log "WARNING: Failed to backup configuration, but continuing"
        fi
    else
        # Docker exec method
        if timeout 30 docker exec "${COUCHDB_CONTAINER}" curl -s "${COUCHDB_URL}/_node/_local/_config" \
            > "${TEMP_BACKUP_DIR}/_config.json"; then
            log "Configuration backed up successfully"
        else
            log "WARNING: Failed to backup configuration, but continuing"
        fi
    fi
    
    update_progress "Configuration backup completed"
    
    # Create compressed archive
    log "Creating compressed archive..."
    cd "${BACKUP_DIR}"
    if nice -n ${NICE_LEVEL} ionice -c ${IONICE_CLASS} \
        tar czf "${BACKUP_NAME}" \
        --transform "s|^temp_[0-9]*|couchdb|" \
        "$(basename "${TEMP_BACKUP_DIR}")"; then
        
        log "Backup created successfully"
        log "Backup size: $(du -h "${BACKUP_NAME}" | cut -f1)"
        
        update_progress "Archive created ($(du -h "${BACKUP_NAME}" | cut -f1))"
        
        # Clean up temporary directory
        rm -rf "${TEMP_BACKUP_DIR}"
    else
        rm -rf "${TEMP_BACKUP_DIR}"
        error_exit "Failed to create backup archive"
    fi
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

# Show upload progress indicator
upload_start_time=$(date +%s)
file_size_mb=$(du -m "${BACKUP_NAME}" | cut -f1)
log "📤 Starting upload of ${file_size_mb}MB file... (this may take several minutes)"

# Function to show upload progress
show_upload_progress() {
    local start_time=$1
    local file_size_mb=$2
    while true; do
        current_time=$(date +%s)
        elapsed=$((current_time - start_time))
        
        # Estimate progress based on time (rough estimation)
        if [[ $elapsed -gt 0 ]]; then
            # Rough estimate: 1MB per 10 seconds at 1MB bandwidth limit
            estimated_progress=$((elapsed * 100 / (file_size_mb * 10)))
            if [[ $estimated_progress -gt 100 ]]; then
                estimated_progress=100
            fi
            printf "\r  🔄 Upload progress: ~%d%% (%ds elapsed)" "$estimated_progress" "$elapsed"
        fi
        sleep 2
    done
}

# Start background progress indicator
show_upload_progress "$upload_start_time" "$file_size_mb" &
progress_pid=$!

# Use mc with progress output - capture exit code properly
upload_output=""
if upload_output=$("${MC_BIN}" cp --limit-upload "${UPLOAD_BANDWIDTH}" "${BACKUP_NAME}" "${S3_BUCKET}/" 2>&1); then
    # Kill progress indicator
    kill $progress_pid 2>/dev/null
    wait $progress_pid 2>/dev/null
    
    upload_end_time=$(date +%s)
    upload_duration=$((upload_end_time - upload_start_time))
    printf "\r\033[K"  # Clear progress line
    log "✅ Upload completed in ${upload_duration} seconds"
    log "Upload details: ${upload_output}"
    update_progress "Backup uploaded to S3"
else
    # Kill progress indicator
    kill $progress_pid 2>/dev/null
    wait $progress_pid 2>/dev/null
    printf "\r\033[K"  # Clear progress line
    log "❌ Upload failed. Output: ${upload_output}"
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

update_progress "Cleanup completed - Backup process finished"

echo ""
echo "=========================================="
log "🎉 BACKUP PROCESS COMPLETED SUCCESSFULLY 🎉"
log "Backup file: ${BACKUP_NAME}"
log "Backup size: $(du -h "${BACKUP_NAME}" | cut -f1)"
log "Uploaded to S3: ${S3_BUCKET}/${BACKUP_NAME}"
echo "=========================================="

# Final container health check
check_container_health
log "CouchDB container is running normally after backup"

# Return to home directory
cd ~ || true/