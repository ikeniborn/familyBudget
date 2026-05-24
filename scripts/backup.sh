#!/bin/bash
################################################################################
# Family Budget - PostgreSQL Backup Script
################################################################################
#
# Description:
#   Automated PostgreSQL backup with local storage and S3 upload.
#   - Daily: Local compressed backup with 7-day retention
#   - Daily: S3 upload with 28-day retention (if S3 configured)
#
# Usage:
#   ./backup.sh [--force-s3] [--verbose]
#
# Options:
#   --force-s3    Force S3 upload regardless of day
#   --verbose     Enable verbose logging
#
# Environment Variables Required:
#   POSTGRES_USER         PostgreSQL username
#   POSTGRES_DB           PostgreSQL database name
#   POSTGRES_PASSWORD     PostgreSQL password (optional, for non-Docker mode)
#
# Environment Variables Optional (for S3):
#   S3_ACCESS_KEY_ID       S3/Yandex Object Storage access key
#   S3_SECRET_ACCESS_KEY   S3/Yandex Object Storage secret key
#   S3_BUCKET_NAME         S3 bucket name
#   S3_ENDPOINT_URL        S3 endpoint URL (default: https://storage.yandexcloud.net)
#
# Exit Codes:
#   0 - Success
#   1 - Backup failed
#   2 - Configuration error
#   3 - Lock file exists (another instance running)
#   4 - S3 upload failed (backup still saved locally)
#
# TASK-051: S3 Backup Script (EPIC-005)
################################################################################

set -e

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Ensure BACKUP_DIR is always absolute path
# If BACKUP_DIR is set but relative, convert to absolute
if [[ -n "${BACKUP_DIR:-}" ]]; then
    # Convert relative path to absolute (resolves ./backups to /opt/budget/backups)
    BACKUP_DIR="$(cd "${PROJECT_ROOT}" && realpath -m "${BACKUP_DIR}")"
else
    BACKUP_DIR="${PROJECT_ROOT}/backups"
fi

LOG_DIR="${LOG_DIR:-${BACKUP_DIR}/logs}"
LOCK_FILE="/tmp/familybudget_backup.lock"

# Backup settings
LOCAL_RETENTION_DAYS=3
S3_RETENTION_DAYS=7
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_YMD=$(date +%Y%m%d)
BACKUP_FILENAME="backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
LOG_FILE="${LOG_DIR}/backup_${DATE_YMD}.log"

# S3 settings
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-https://storage.yandexcloud.net}"
S3_PATH="postgresql-backups/$(date +%Y/%m)/${BACKUP_FILENAME}"

# Options
FORCE_S3=false
VERBOSE=false

# ============================================================================
# Functions
# ============================================================================

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo "[${timestamp}] [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() {
    log "INFO" "$@"
}

log_warn() {
    log "WARN" "$@"
}

log_error() {
    log "ERROR" "$@"
}

log_success() {
    log "SUCCESS" "$@"
}

debug() {
    if [ "$VERBOSE" = true ]; then
        log "DEBUG" "$@"
    fi
}

print_banner() {
    echo "========================================" | tee -a "$LOG_FILE"
    echo "Family Budget - PostgreSQL Backup" | tee -a "$LOG_FILE"
    echo "Started: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
}

print_footer() {
    echo "========================================" | tee -a "$LOG_FILE"
    echo "Backup completed: $(date '+%Y-%m-%d %H:%M:%S')" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
}

check_dependencies() {
    log_info "Checking dependencies..."

    local missing_deps=()

    if ! command -v docker &> /dev/null; then
        missing_deps+=("docker")
    fi

    if ! command -v gzip &> /dev/null; then
        missing_deps+=("gzip")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_error "Please install: apt-get install ${missing_deps[*]}"
        return 1
    fi

    log_success "All dependencies found"
    return 0
}

check_environment() {
    log_info "Checking environment variables..."

    if [ -z "$POSTGRES_USER" ]; then
        log_error "POSTGRES_USER not set"
        return 1
    fi

    if [ -z "$POSTGRES_DB" ]; then
        log_error "POSTGRES_DB not set"
        return 1
    fi

    debug "POSTGRES_USER: $POSTGRES_USER"
    debug "POSTGRES_DB: $POSTGRES_DB"
    debug "BACKUP_DIR: $BACKUP_DIR"

    log_success "Environment variables validated"
    return 0
}

check_docker() {
    log_info "Checking Docker container..."

    if ! docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps | grep -q postgres; then
        log_error "PostgreSQL container not found or not running"
        log_error "Please start with: docker compose up -d"
        return 1
    fi

    log_success "PostgreSQL container is running"
    return 0
}

create_lock() {
    if [ -f "$LOCK_FILE" ]; then
        local pid=$(cat "$LOCK_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            log_error "Another backup instance is running (PID: $pid)"
            return 1
        else
            log_warn "Stale lock file found, removing..."
            rm -f "$LOCK_FILE"
        fi
    fi

    echo $$ > "$LOCK_FILE"
    log_info "Lock file created (PID: $$)"
    return 0
}

remove_lock() {
    if [ -f "$LOCK_FILE" ]; then
        rm -f "$LOCK_FILE"
        log_info "Lock file removed"
    fi
}

perform_backup() {
    log_info "Starting PostgreSQL backup..."
    log_info "Target: $BACKUP_PATH"

    # Perform pg_dump via Docker
    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" exec -T postgres \
        pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_PATH"; then

        # Set file permissions: 644 (readable by all, writable by owner)
        # This allows backend container to read the backup file for health checks
        chmod 644 "$BACKUP_PATH"

        local backup_size=$(du -h "$BACKUP_PATH" | cut -f1)
        log_success "Backup created: $BACKUP_PATH ($backup_size)"
        return 0
    else
        log_error "Backup failed"
        rm -f "$BACKUP_PATH"
        return 1
    fi
}

rotate_local_backups() {
    log_info "Rotating local backups (retention: $LOCAL_RETENTION_DAYS days)..."

    local deleted_count=0
    local old_backups

    # Get list of old backups (protected from set -e)
    old_backups=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +${LOCAL_RETENTION_DAYS} 2>/dev/null || true)

    if [ -n "$old_backups" ]; then
        while IFS= read -r file; do
            if [ -f "$file" ]; then
                rm -f "$file"
                deleted_count=$((deleted_count + 1))  # Safe increment (no exit code issue)
                debug "Deleted: $file"
            fi
        done <<< "$old_backups"
    fi

    if [ $deleted_count -gt 0 ]; then
        log_info "Deleted $deleted_count old backup(s)"
    else
        debug "No old backups to delete"
    fi
}

should_upload_to_s3() {
    # Check if forced via --force-s3 flag
    if [ "$FORCE_S3" = true ]; then
        log_info "S3 upload forced via --force-s3 flag"
        return 0
    fi

    # S3 upload happens DAILY if S3 is configured
    # This ensures backups are uploaded every day to S3 for redundancy
    log_info "S3 upload scheduled (daily)"
    return 0
}

check_s3_config() {
    debug "Checking S3 configuration..."

    # Check S3_* variables from .env (matches docker-compose.yml naming)
    if [ -z "$S3_ACCESS_KEY_ID" ] || [ -z "$S3_SECRET_ACCESS_KEY" ] || [ -z "$S3_BUCKET_NAME" ]; then
        log_warn "S3 credentials not configured, skipping upload"
        log_warn "Set S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET_NAME to enable"
        return 1
    fi

    # Export as AWS_* for aws-cli compatibility
    export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"

    debug "S3_BUCKET_NAME: $S3_BUCKET_NAME"
    debug "S3_ENDPOINT_URL: $S3_ENDPOINT_URL"
    debug "AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}***"

    return 0
}

upload_to_s3() {
    log_info "Uploading to S3: s3://${S3_BUCKET_NAME}/${S3_PATH}"

    # Check if python3 and boto3 are available
    if ! command -v python3 &> /dev/null; then
        log_error "python3 not found"
        log_error "Install with: apt-get install python3"
        return 1
    fi

    if ! python3 -c "import boto3" 2>/dev/null; then
        log_error "boto3 not found"
        log_error "Install with: pip3 install boto3"
        return 1
    fi

    # Upload with retry logic (3 attempts)
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "Upload attempt $attempt/$max_attempts..."

        if python3 "$SCRIPT_DIR/s3_backup.py" upload \
            "$BACKUP_PATH" \
            "$S3_PATH" \
            --bucket "$S3_BUCKET_NAME" \
            --endpoint-url "$S3_ENDPOINT_URL" \
            --quiet 2>&1 | tee -a "$LOG_FILE"; then

            log_success "Uploaded to S3: s3://${S3_BUCKET_NAME}/${S3_PATH}"
            return 0
        else
            log_warn "Upload attempt $attempt failed"

            if [ $attempt -lt $max_attempts ]; then
                local wait_time=$((attempt * 10))
                log_info "Retrying in ${wait_time}s..."
                sleep $wait_time
            fi

            ((attempt++))
        fi
    done

    log_error "S3 upload failed after $max_attempts attempts"
    log_error "Backup is still saved locally: $BACKUP_PATH"
    return 1
}

cleanup_s3_old_backups() {
    log_info "Cleaning up old S3 backups (retention: $S3_RETENTION_DAYS days)..."

    # Call s3_backup.py cleanup command
    if python3 "$SCRIPT_DIR/s3_backup.py" cleanup \
        --retention-days "$S3_RETENTION_DAYS" \
        --bucket "$S3_BUCKET_NAME" \
        --endpoint-url "$S3_ENDPOINT_URL" \
        --quiet 2>&1 | tee -a "$LOG_FILE"; then

        log_success "S3 cleanup completed"
        return 0
    else
        log_warn "S3 cleanup failed (non-critical)"
        return 0
    fi
}

generate_backup_report() {
    log_info "Generating backup report..."

    local total_local=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" | wc -l)
    local total_size=$(du -sh "$BACKUP_DIR" | cut -f1)

    echo "" | tee -a "$LOG_FILE"
    echo "=== Backup Summary ===" | tee -a "$LOG_FILE"
    echo "Backup file: $BACKUP_FILENAME" | tee -a "$LOG_FILE"
    echo "Local backups: $total_local" | tee -a "$LOG_FILE"
    echo "Total size: $total_size" | tee -a "$LOG_FILE"
    echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Parse arguments FIRST (before loading .env)
    while [[ $# -gt 0 ]]; do
        case $1 in
            --force-s3)
                FORCE_S3=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--force-s3] [--verbose]"
                exit 2
                ;;
        esac
    done

    # Load environment variables from .env
    if [ -f "$PROJECT_ROOT/.env" ]; then
        debug "Loading environment from: $PROJECT_ROOT/.env"
        set -a
        source "$PROJECT_ROOT/.env"
        set +a
        debug "Environment loaded successfully"
        # S3 configuration diagnostics
        debug "FORCE_S3: $FORCE_S3"
        debug "S3_ACCESS_KEY_ID: ${S3_ACCESS_KEY_ID:+set (${#S3_ACCESS_KEY_ID} chars)}"
        debug "S3_SECRET_ACCESS_KEY: ${S3_SECRET_ACCESS_KEY:+set (${#S3_SECRET_ACCESS_KEY} chars)}"
        debug "S3_BUCKET_NAME: ${S3_BUCKET_NAME:-not set}"
        debug "S3_ENDPOINT_URL: ${S3_ENDPOINT_URL:-not set}"
    else
        echo "ERROR: .env file not found at $PROJECT_ROOT/.env"
        echo "Expected location: $PROJECT_ROOT/.env"
        echo "Current SCRIPT_DIR: $SCRIPT_DIR"
        echo "Current PROJECT_ROOT: $PROJECT_ROOT"
        echo "Please ensure .env file exists in /opt/budget/.env"
        exit 2
    fi

    # Convert BACKUP_DIR to absolute path (in case .env has relative path)
    # This ensures ./backups becomes /opt/budget/backups
    if [[ -n "${BACKUP_DIR:-}" && "${BACKUP_DIR}" != /* ]]; then
        # Relative path detected, convert to absolute
        BACKUP_DIR="$(cd "${PROJECT_ROOT}" && realpath -m "${BACKUP_DIR}")"
        debug "BACKUP_DIR converted to absolute: $BACKUP_DIR"
    fi

    # Update dependent paths after BACKUP_DIR conversion
    LOG_DIR="${LOG_DIR:-${BACKUP_DIR}/logs}"
    BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
    LOG_FILE="${LOG_DIR}/backup_${DATE_YMD}.log"

    # Create directories NOW (after BACKUP_DIR conversion)
    # This ensures correct absolute paths are used
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"
    chmod 755 "$BACKUP_DIR"
    chmod 755 "$LOG_DIR"

    # Initialize
    print_banner
    log_info "Backup directories ready: $BACKUP_DIR, $LOG_DIR"

    # Create lock file
    if ! create_lock; then
        exit 3
    fi

    # Ensure lock is removed on exit
    trap remove_lock EXIT INT TERM

    # Pre-flight checks
    if ! check_dependencies; then
        exit 2
    fi

    if ! check_environment; then
        exit 2
    fi

    if ! check_docker; then
        exit 2
    fi

    # Perform backup
    if ! perform_backup; then
        log_error "Backup process failed"
        exit 1
    fi

    # Rotate local backups
    rotate_local_backups

    # S3 upload (if scheduled or forced)
    if should_upload_to_s3; then
        if check_s3_config; then
            if upload_to_s3; then
                cleanup_s3_old_backups
            else
                log_warn "S3 upload failed, but local backup is safe"
                # Don't exit, backup was successful locally
            fi
        fi
    fi

    # Generate report
    generate_backup_report

    # Finish
    print_footer
    log_success "Backup completed successfully"

    exit 0
}

# Run main
main "$@"
