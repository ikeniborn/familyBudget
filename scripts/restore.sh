#!/bin/bash
################################################################################
# Family Budget - PostgreSQL Restore Script
################################################################################
#
# Description:
#   Interactive PostgreSQL database restore with backup validation.
#   - Local backup selection with metadata
#   - S3 backup download and restore
#   - Safety backup before restore
#   - Explicit approval gate
#
# Usage:
#   ./restore.sh [--backup-file <path>] [--yes] [--verbose]
#
# Options:
#   --backup-file <path>  Specify backup file (skip interactive menu)
#   --yes                 Skip confirmation prompts (USE WITH CAUTION)
#   --verbose             Enable verbose logging
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
#   1 - Restore failed
#   2 - Configuration error
#   3 - User cancelled
#   4 - Validation failed
#
################################################################################

set -e

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Ensure BACKUP_DIR is always absolute path
if [[ -n "${BACKUP_DIR:-}" ]]; then
    BACKUP_DIR="$(cd "${PROJECT_ROOT}" && realpath -m "${BACKUP_DIR}")"
else
    BACKUP_DIR="${PROJECT_ROOT}/backups"
fi

LOG_DIR="${LOG_DIR:-${BACKUP_DIR}/logs}"
TEMP_DIR="/tmp/familybudget_restore"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATE_YMD=$(date +%Y%m%d)
LOG_FILE="${LOG_DIR}/restore_${DATE_YMD}.log"
SAFETY_BACKUP="safety_backup_before_restore_${TIMESTAMP}.sql.gz"

# S3 settings
S3_ENDPOINT_URL="${S3_ENDPOINT_URL:-https://storage.yandexcloud.net}"

# Options
AUTO_YES=false
VERBOSE=false
BACKUP_FILE=""

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

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
    echo -e "${BLUE}ℹ${NC}  $*"
}

log_warn() {
    log "WARN" "$@"
    echo -e "${YELLOW}⚠${NC}  $*"
}

log_error() {
    log "ERROR" "$@"
    echo -e "${RED}✗${NC}  $*"
}

log_success() {
    log "SUCCESS" "$@"
    echo -e "${GREEN}✓${NC}  $*"
}

debug() {
    if [ "$VERBOSE" = true ]; then
        log "DEBUG" "$@"
    fi
}

print_banner() {
    echo ""
    echo "========================================" | tee -a "$LOG_FILE"
    echo "   PostgreSQL Database Restore" | tee -a "$LOG_FILE"
    echo "========================================" | tee -a "$LOG_FILE"
    echo "" | tee -a "$LOG_FILE"
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

stop_application_services() {
    log_info "Stopping application services (backend, bot)..."

    # Check which services are running
    local running_services=""
    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps --status running | grep -q backend; then
        running_services="backend"
    fi
    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps --status running | grep -q bot; then
        running_services="${running_services} bot"
    fi

    if [ -z "$running_services" ]; then
        log_info "No application services running"
        return 0
    fi

    # Stop services
    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" stop backend bot 2>/dev/null; then
        log_success "Stopped services: ${running_services}"
    else
        log_warn "Some services may not have stopped cleanly"
    fi

    # Wait for connections to close
    sleep 2
    return 0
}

start_application_services() {
    log_info "Starting application services..."

    # Start backend first (bot depends on it)
    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" start backend 2>/dev/null; then
        log_info "Backend started, waiting for health check..."
        # Wait for backend to become healthy
        local max_wait=60
        local waited=0
        while [ $waited -lt $max_wait ]; do
            if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps | grep backend | grep -q "healthy"; then
                log_success "Backend is healthy"
                break
            fi
            sleep 2
            waited=$((waited + 2))
        done

        if [ $waited -ge $max_wait ]; then
            log_warn "Backend health check timeout, continuing anyway"
        fi
    fi

    # Start bot if it was part of the profile
    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps -a | grep -q bot; then
        docker compose -f "${PROJECT_ROOT}/docker-compose.yml" start bot 2>/dev/null
        log_success "Bot started"
    fi

    return 0
}

terminate_database_connections() {
    log_info "Terminating active database connections..."

    # Get count of active connections
    local conn_count=$(docker compose -f "${PROJECT_ROOT}/docker-compose.yml" exec -T postgres \
        psql -U "$POSTGRES_USER" -d postgres -t -c \
        "SELECT COUNT(*) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" 2>/dev/null | tr -d ' ')

    if [ -z "$conn_count" ] || [ "$conn_count" = "0" ]; then
        log_info "No active connections to terminate"
        return 0
    fi

    log_info "Terminating $conn_count active connection(s)..."

    # Terminate all connections to the database
    docker compose -f "${PROJECT_ROOT}/docker-compose.yml" exec -T postgres \
        psql -U "$POSTGRES_USER" -d postgres -c \
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${POSTGRES_DB}' AND pid <> pg_backend_pid();" > /dev/null 2>&1

    # Wait a moment for connections to close
    sleep 1

    log_success "Database connections terminated"
    return 0
}

list_local_backups() {
    echo ""
    echo "📂 Local backups in $BACKUP_DIR:"
    echo ""

    local backups=()
    while IFS= read -r file; do
        backups+=("$file")
    done < <(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | sort -r)

    if [ ${#backups[@]} -eq 0 ]; then
        echo "   No local backups found"
        return 1
    fi

    local idx=1
    for backup in "${backups[@]}"; do
        local filename=$(basename "$backup")
        local size=$(du -h "$backup" | cut -f1)
        local date=$(stat -c %y "$backup" | cut -d' ' -f1,2 | cut -d'.' -f1)

        printf "   %2d) %-40s %8s  %s\n" "$idx" "$filename" "$size" "$date"
        ((idx++))
    done

    echo ""
    return 0
}

check_s3_config() {
    if [ -z "$S3_ACCESS_KEY_ID" ] || [ -z "$S3_SECRET_ACCESS_KEY" ] || [ -z "$S3_BUCKET_NAME" ]; then
        return 1
    fi

    # Export as AWS_* for aws-cli compatibility
    export AWS_ACCESS_KEY_ID="$S3_ACCESS_KEY_ID"
    export AWS_SECRET_ACCESS_KEY="$S3_SECRET_ACCESS_KEY"

    return 0
}

list_s3_backups() {
    echo ""
    echo "☁️  S3 backups in bucket: $S3_BUCKET_NAME"
    echo ""

    if ! check_s3_config; then
        log_warn "S3 credentials not configured"
        return 1
    fi

    # Check if python3 and boto3 are available
    if ! command -v python3 &> /dev/null; then
        log_error "python3 not found (required for S3)"
        return 1
    fi

    if ! python3 -c "import boto3" 2>/dev/null; then
        log_error "boto3 not found (install with: pip3 install boto3)"
        return 1
    fi

    # List S3 backups using Python
    python3 - <<EOF
import sys
try:
    import boto3
    from botocore.exceptions import ClientError
    from datetime import datetime

    s3_client = boto3.client(
        's3',
        endpoint_url='$S3_ENDPOINT_URL',
        aws_access_key_id='$S3_ACCESS_KEY_ID',
        aws_secret_access_key='$S3_SECRET_ACCESS_KEY',
        region_name='us-east-1'
    )

    paginator = s3_client.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket='$S3_BUCKET_NAME')

    backups = []
    for page in pages:
        if 'Contents' not in page:
            continue
        for obj in page['Contents']:
            key = obj['Key']
            if key.endswith('.sql.gz') and 'backup_' in key:
                backups.append({
                    'key': key,
                    'size': obj['Size'],
                    'modified': obj['LastModified']
                })

    # Sort by modified date (newest first)
    backups.sort(key=lambda x: x['modified'], reverse=True)

    if not backups:
        print("   No S3 backups found")
        sys.exit(1)

    for idx, backup in enumerate(backups, 1):
        filename = backup['key'].split('/')[-1]
        size_mb = backup['size'] / 1024 / 1024
        date_str = backup['modified'].strftime('%Y-%m-%d %H:%M:%S')
        print(f"   {idx:2d}) {filename:40s} {size_mb:8.2f} MB  {date_str}")

    sys.exit(0)

except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
EOF

    local exit_code=$?
    echo ""
    return $exit_code
}

select_backup_interactively() {
    print_banner

    echo "Please select backup source:"
    echo ""
    echo "  1) Local backups (${BACKUP_DIR})"
    echo "  2) S3 backups (${S3_BUCKET_NAME:-not configured})"
    echo "  3) Cancel"
    echo ""
    read -p "Your choice [1-3]: " choice

    case $choice in
        1)
            if ! list_local_backups; then
                log_error "No local backups available"
                return 1
            fi

            read -p "Select backup number (or 'q' to cancel): " backup_num

            if [ "$backup_num" = "q" ]; then
                log_info "Restore cancelled by user"
                return 3
            fi

            # Get selected backup
            local backups=()
            while IFS= read -r file; do
                backups+=("$file")
            done < <(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | sort -r)

            local idx=$((backup_num - 1))
            if [ $idx -lt 0 ] || [ $idx -ge ${#backups[@]} ]; then
                log_error "Invalid backup number"
                return 1
            fi

            BACKUP_FILE="${backups[$idx]}"
            log_info "Selected: $(basename "$BACKUP_FILE")"
            return 0
            ;;

        2)
            if ! list_s3_backups; then
                log_error "No S3 backups available"
                return 1
            fi

            read -p "Select backup number (or 'q' to cancel): " backup_num

            if [ "$backup_num" = "q" ]; then
                log_info "Restore cancelled by user"
                return 3
            fi

            # Download selected S3 backup
            local selected_key=$(python3 - <<EOF
import sys
try:
    import boto3

    s3_client = boto3.client(
        's3',
        endpoint_url='$S3_ENDPOINT_URL',
        aws_access_key_id='$S3_ACCESS_KEY_ID',
        aws_secret_access_key='$S3_SECRET_ACCESS_KEY',
        region_name='us-east-1'
    )

    paginator = s3_client.get_paginator('list_objects_v2')
    pages = paginator.paginate(Bucket='$S3_BUCKET_NAME')

    backups = []
    for page in pages:
        if 'Contents' not in page:
            continue
        for obj in page['Contents']:
            key = obj['Key']
            if key.endswith('.sql.gz') and 'backup_' in key:
                backups.append({'key': key, 'modified': obj['LastModified']})

    backups.sort(key=lambda x: x['modified'], reverse=True)

    if $backup_num > 0 and $backup_num <= len(backups):
        print(backups[$backup_num - 1]['key'])
        sys.exit(0)
    else:
        sys.exit(1)

except Exception:
    sys.exit(1)
EOF
)

            if [ $? -ne 0 ] || [ -z "$selected_key" ]; then
                log_error "Invalid backup number"
                return 1
            fi

            # Download S3 backup to temp directory
            mkdir -p "$TEMP_DIR"
            local temp_file="$TEMP_DIR/$(basename "$selected_key")"

            log_info "Downloading S3 backup..."

            python3 - <<EOF
import sys
try:
    import boto3

    s3_client = boto3.client(
        's3',
        endpoint_url='$S3_ENDPOINT_URL',
        aws_access_key_id='$S3_ACCESS_KEY_ID',
        aws_secret_access_key='$S3_SECRET_ACCESS_KEY',
        region_name='us-east-1'
    )

    s3_client.download_file('$S3_BUCKET_NAME', '$selected_key', '$temp_file')
    print("Download complete")
    sys.exit(0)

except Exception as e:
    print(f"ERROR: {e}", file=sys.stderr)
    sys.exit(1)
EOF

            if [ $? -ne 0 ]; then
                log_error "Failed to download S3 backup"
                return 1
            fi

            BACKUP_FILE="$temp_file"
            log_success "Downloaded: $(basename "$BACKUP_FILE")"
            return 0
            ;;

        3)
            log_info "Restore cancelled by user"
            return 3
            ;;

        *)
            log_error "Invalid choice"
            return 1
            ;;
    esac
}

validate_backup_file() {
    log_info "Validating backup file..."

    if [ ! -f "$BACKUP_FILE" ]; then
        log_error "Backup file not found: $BACKUP_FILE"
        return 1
    fi

    # Test gzip integrity
    if ! gzip -t "$BACKUP_FILE" 2>/dev/null; then
        log_error "Backup file is corrupted (gzip test failed)"
        return 1
    fi

    log_success "Backup file integrity: OK"

    # Extract first 100 lines to check SQL structure
    log_info "Checking SQL structure..."

    if ! zcat "$BACKUP_FILE" | head -n 100 | grep -q "PostgreSQL database dump"; then
        log_warn "Backup file may not be a valid PostgreSQL dump"
        return 1
    fi

    log_success "SQL structure: Valid PostgreSQL dump"
    return 0
}

create_safety_backup() {
    log_info "Creating safety backup before restore..."

    local safety_path="${BACKUP_DIR}/${SAFETY_BACKUP}"

    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" exec -T postgres \
        pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "$safety_path"; then

        chmod 644 "$safety_path"
        local backup_size=$(du -h "$safety_path" | cut -f1)
        log_success "Safety backup created: $SAFETY_BACKUP ($backup_size)"
        echo "   Location: $safety_path"
        return 0
    else
        log_error "Failed to create safety backup"
        return 1
    fi
}

approval_gate() {
    if [ "$AUTO_YES" = true ]; then
        log_warn "Auto-yes enabled, skipping confirmation"
        return 0
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${RED}⚠  WARNING: DATABASE RESTORE${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "This operation will:"
    echo "  1. STOP backend and bot services"
    echo "  2. TERMINATE all database connections"
    echo "  3. DROP existing database: $POSTGRES_DB"
    echo "  4. CREATE new database from backup"
    echo "  5. RESTART application services"
    echo ""
    echo -e "${RED}ALL current data will be LOST!${NC}"
    echo ""
    echo "Backup file:"
    echo "  $(basename "$BACKUP_FILE")"
    echo "  $(du -h "$BACKUP_FILE" | cut -f1)"
    echo ""
    echo "Safety backup:"
    echo "  $SAFETY_BACKUP"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    read -p "Type 'yes' to proceed with restore: " confirmation

    if [ "$confirmation" != "yes" ]; then
        log_info "Restore cancelled (confirmation not received)"
        return 1
    fi

    log_info "User confirmed restore operation"
    return 0
}

perform_restore() {
    log_info "Starting database restore..."

    # Stop application services to release database connections
    stop_application_services

    # Terminate any remaining connections
    terminate_database_connections

    # Drop existing database and recreate
    log_info "Dropping existing database..."

    if ! docker compose -f "${PROJECT_ROOT}/docker-compose.yml" exec -T postgres \
        psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"; then
        log_error "Failed to drop database"
        log_error "Attempting to restart services..."
        start_application_services
        return 1
    fi

    log_info "Creating new database..."

    if ! docker compose -f "${PROJECT_ROOT}/docker-compose.yml" exec -T postgres \
        psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"; then
        log_error "Failed to create database"
        log_error "Attempting to restart services..."
        start_application_services
        return 1
    fi

    # Restore from backup
    log_info "Restoring from backup (this may take a while)..."

    if zcat "$BACKUP_FILE" | docker compose -f "${PROJECT_ROOT}/docker-compose.yml" exec -T postgres \
        psql -U "$POSTGRES_USER" "$POSTGRES_DB" > /dev/null 2>&1; then

        log_success "Database restore completed"

        # Restart application services
        start_application_services

        return 0
    else
        log_error "Database restore failed"
        log_error "You can restore from safety backup: $SAFETY_BACKUP"
        log_error "Attempting to restart services..."
        start_application_services
        return 1
    fi
}

cleanup() {
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
        debug "Cleaned up temporary directory: $TEMP_DIR"
    fi
}

generate_restore_report() {
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${GREEN}   RESTORE SUMMARY${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "Database: $POSTGRES_DB"
    echo "Restored from: $(basename "$BACKUP_FILE")"
    echo "Safety backup: $SAFETY_BACKUP"
    echo "Log file: $LOG_FILE"
    echo ""

    # Show service status
    echo "Service Status:"
    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps | grep backend | grep -q "healthy"; then
        echo -e "  Backend:  ${GREEN}✓ healthy${NC}"
    else
        echo -e "  Backend:  ${YELLOW}⚠ starting${NC}"
    fi

    if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps -a | grep -q bot; then
        if docker compose -f "${PROJECT_ROOT}/docker-compose.yml" ps | grep bot | grep -q "Up"; then
            echo -e "  Bot:      ${GREEN}✓ running${NC}"
        else
            echo -e "  Bot:      ${YELLOW}⚠ starting${NC}"
        fi
    fi

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --backup-file)
                BACKUP_FILE="$2"
                shift 2
                ;;
            --yes)
                AUTO_YES=true
                shift
                ;;
            --verbose)
                VERBOSE=true
                shift
                ;;
            *)
                echo "Unknown option: $1"
                echo "Usage: $0 [--backup-file <path>] [--yes] [--verbose]"
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
    else
        echo "ERROR: .env file not found at $PROJECT_ROOT/.env"
        exit 2
    fi

    # Create directories
    mkdir -p "$BACKUP_DIR"
    mkdir -p "$LOG_DIR"

    # Ensure cleanup on exit
    trap cleanup EXIT INT TERM

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

    # Select backup file interactively if not provided
    if [ -z "$BACKUP_FILE" ]; then
        if ! select_backup_interactively; then
            exit_code=$?
            if [ $exit_code -eq 3 ]; then
                exit 3  # User cancelled
            else
                exit 1  # Error
            fi
        fi
    fi

    # Validate backup file
    if ! validate_backup_file; then
        log_error "Backup validation failed"
        exit 4
    fi

    # Create safety backup
    if ! create_safety_backup; then
        log_error "Failed to create safety backup"
        exit 1
    fi

    # Approval gate
    if ! approval_gate; then
        exit 3
    fi

    # Perform restore
    if ! perform_restore; then
        log_error "Restore failed"
        log_error "Database may be in inconsistent state"
        log_error "Restore from safety backup: ${BACKUP_DIR}/${SAFETY_BACKUP}"
        exit 1
    fi

    # Generate report
    generate_restore_report

    log_success "Restore completed successfully"
    exit 0
}

# Run main
main "$@"
