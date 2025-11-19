#!/bin/bash
################################################################################
# Family Budget - PostgreSQL Backup Script
################################################################################
#
# Description:
#   Automated PostgreSQL backup with local storage and S3 upload.
#   - Daily: Local compressed backup with 7-day retention
#   - Weekly: S3 upload (Sundays) with 28-day retention
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
#   AWS_ACCESS_KEY_ID      Yandex Object Storage access key
#   AWS_SECRET_ACCESS_KEY  Yandex Object Storage secret key
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
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_ROOT}/backups}"
LOG_DIR="${LOG_DIR:-${BACKUP_DIR}/logs}"
LOCK_FILE="/tmp/familybudget_backup.lock"

# Backup settings
LOCAL_RETENTION_DAYS=7
S3_RETENTION_DAYS=28
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_YMD=$(date +%Y%m%d)
BACKUP_FILENAME="backup_${TIMESTAMP}.sql.gz"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILENAME}"
LOG_FILE="${LOG_DIR}/backup_${DATE_YMD}.log"

# S3 settings
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-https://storage.yandexcloud.net}"
S3_PATH="$(date +%Y/%m)/${BACKUP_FILENAME}"

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

create_directories() {
    # Create directories FIRST (before any logging to file)
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"

    chmod 700 "$BACKUP_DIR"
    chmod 700 "$LOG_DIR"

    # Now we can safely log (LOG_DIR exists)
    log_info "Creating backup directories..."
    log_success "Directories created: $BACKUP_DIR, $LOG_DIR"
}

perform_backup() {
    log_info "Starting PostgreSQL backup..."
    log_info "Target: $BACKUP_PATH"

    # Perform pg_dump via Docker
    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" exec -T postgres \
        pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$BACKUP_PATH"; then

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
    while IFS= read -r file; do
        rm -f "$file"
        ((deleted_count++))
        debug "Deleted: $file"
    done < <(find "$BACKUP_DIR" -name "backup_*.sql.gz" -mtime +${LOCAL_RETENTION_DAYS})

    if [ $deleted_count -gt 0 ]; then
        log_info "Deleted $deleted_count old backup(s)"
    else
        log_info "No old backups to delete"
    fi
}

should_upload_to_s3() {
    # Check if forced
    if [ "$FORCE_S3" = true ]; then
        log_info "S3 upload forced via --force-s3 flag"
        return 0
    fi

    # Check if it's Sunday (day 7 in ISO week)
    local day_of_week=$(date +%u)
    if [ "$day_of_week" -eq 7 ]; then
        log_info "Today is Sunday, S3 upload scheduled"
        return 0
    fi

    debug "Not Sunday (day $day_of_week), skipping S3 upload"
    return 1
}

check_s3_config() {
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ] || [ -z "$S3_BUCKET_NAME" ]; then
        log_warn "S3 credentials not configured, skipping upload"
        log_warn "Set AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME to enable"
        return 1
    fi

    debug "S3_BUCKET_NAME: $S3_BUCKET_NAME"
    debug "S3_ENDPOINT_URL: $S3_ENDPOINT_URL"

    return 0
}

upload_to_s3() {
    log_info "Uploading to S3: s3://${S3_BUCKET_NAME}/${S3_PATH}"

    # Check if aws-cli is available
    if ! command -v aws &> /dev/null; then
        log_error "aws-cli not found"
        log_error "Install with: apt-get install awscli"
        return 1
    fi

    # Upload with retry logic (3 attempts)
    local max_attempts=3
    local attempt=1

    while [ $attempt -le $max_attempts ]; do
        log_info "Upload attempt $attempt/$max_attempts..."

        if aws s3 cp "$BACKUP_PATH" \
            "s3://${S3_BUCKET_NAME}/${S3_PATH}" \
            --endpoint-url "$S3_ENDPOINT_URL" \
            --no-progress 2>&1 | tee -a "$LOG_FILE"; then

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

    # Calculate cutoff date
    local cutoff_date=$(date -d "$S3_RETENTION_DAYS days ago" +%Y-%m-%d)

    log_info "Deleting backups older than $cutoff_date"

    # List and delete old backups
    if aws s3 ls "s3://${S3_BUCKET_NAME}/" \
        --endpoint-url "$S3_ENDPOINT_URL" \
        --recursive | awk '{print $4}' | while read -r key; do

        # Extract date from filename (backup_YYYYMMDD_HHMMSS.sql.gz)
        local file_date=$(echo "$key" | grep -oP 'backup_\K\d{8}' || echo "")

        if [ -n "$file_date" ]; then
            local file_date_formatted=$(date -d "${file_date:0:4}-${file_date:4:2}-${file_date:6:2}" +%Y-%m-%d)

            if [[ "$file_date_formatted" < "$cutoff_date" ]]; then
                debug "Deleting old S3 backup: $key"
                aws s3 rm "s3://${S3_BUCKET_NAME}/${key}" \
                    --endpoint-url "$S3_ENDPOINT_URL" 2>&1 | tee -a "$LOG_FILE"
            fi
        fi
    done; then
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
    # Parse arguments
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

    # Initialize
    create_directories
    print_banner

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
