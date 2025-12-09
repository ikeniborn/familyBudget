#!/bin/bash
################################################################################
# Family Budget - PostgreSQL Volume Migration Script
################################################################################
#
# Description:
#   Safely migrates PostgreSQL data from bind mount volume to Docker managed volume.
#   Handles the specific case where Docker created a volume with bind mount driver_opts.
#
# PRODUCTION REALITY:
#   - docker-compose.yml defines postgres_data with driver_opts (bind mount)
#   - Docker creates volume "budget_postgres_data" pointing to /opt/budget/data/postgres
#   - Data exists in BOTH:
#     * /opt/budget/data/postgres (bind mount source)
#     * /var/lib/docker/volumes/budget_postgres_data/_data (volume mountpoint)
#   - These are the SAME data (bind mount mechanism)
#
# MIGRATION STRATEGY:
#   1. Create SQL backup via pg_dump
#   2. Stop PostgreSQL
#   3. Remove old bind mount volume (budget_postgres_data)
#   4. Create new Docker managed volume (budget_postgres_data)
#   5. Copy data from /opt/budget/data/postgres to new volume
#   6. Backup original bind mount directory
#   7. Update docker-compose.yml via deploy.sh
#
# CRITICAL SAFETY FEATURES:
#   - Full pg_dump backup BEFORE any changes
#   - File count verification after copy
#   - Original data preserved in /opt/budget/data/postgres.backup
#   - docker-compose.yml backup before modification
#   - Rollback capability via --rollback flag
#
# Usage:
#   cd ~/familyBudget
#   sudo ./scripts/migrate_to_docker_volume.sh           # Run migration
#   sudo ./scripts/migrate_to_docker_volume.sh --check   # Check current status
#   sudo ./scripts/migrate_to_docker_volume.sh --rollback # Rollback to bind mount
#
# Requirements:
#   - Run from repository directory (~/familyBudget), NOT from /opt/budget
#   - Root privileges (sudo)
#   - Docker running
#   - PostgreSQL container healthy
#   - Sufficient disk space (2x PostgreSQL data size)
#
# Exit Codes:
#   0 - Success
#   1 - Pre-migration check failed
#   2 - Backup failed
#   3 - Data copy failed
#   4 - Verification failed
#   5 - User cancelled
#
################################################################################

set -euo pipefail

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DEPLOY_DIR="${DEPLOY_DIR:-/opt/budget}"

# Paths
BIND_MOUNT_PATH="$DEPLOY_DIR/data/postgres"
BACKUP_BIND_MOUNT_PATH="$DEPLOY_DIR/data/postgres.backup"
BACKUP_DIR="$DEPLOY_DIR/backups"
COMPOSE_FILE="$DEPLOY_DIR/docker-compose.yml"
LOG_DIR="$DEPLOY_DIR/logs"
LOG_FILE="$LOG_DIR/migration_$(date +%Y%m%d_%H%M%S).log"

# Docker volume names
# Current volume (bind mount) and target volume (Docker managed) have the SAME name
# We need to remove old and create new with same name
OLD_VOLUME_NAME="budget_postgres_data"
NEW_VOLUME_NAME="budget_postgres_data"
TEMP_VOLUME_NAME="budget_postgres_data_migration_temp"

# Container name
POSTGRES_CONTAINER="familybudget-postgres"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Logging Functions
# =============================================================================

ensure_log_dir() {
    mkdir -p "$LOG_DIR"
    touch "$LOG_FILE" 2>/dev/null || {
        # Fallback to /tmp if can't write to LOG_DIR
        LOG_FILE="/tmp/migration_$(date +%Y%m%d_%H%M%S).log"
        touch "$LOG_FILE"
    }
}

log() {
    local level="$1"
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    echo -e "[${timestamp}] [${level}] ${message}" | tee -a "$LOG_FILE"
}

log_info() { log "INFO" "$@"; }
log_success() { echo -e "${GREEN}[SUCCESS]${NC} $*" | tee -a "$LOG_FILE"; }
log_warning() { echo -e "${YELLOW}[WARNING]${NC} $*" | tee -a "$LOG_FILE"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*" | tee -a "$LOG_FILE"; }

print_banner() {
    echo ""
    echo "=========================================="
    echo "  PostgreSQL Volume Migration"
    echo "  Bind Mount -> Docker Managed Volume"
    echo "=========================================="
    echo ""
}

# =============================================================================
# Utility Functions
# =============================================================================

# Check if volume uses bind mount (has driver_opts)
is_bind_mount_volume() {
    local volume_name="$1"
    local options
    options=$(docker volume inspect "$volume_name" --format '{{json .Options}}' 2>/dev/null || echo "{}")

    # Check if Options contains "device" key (bind mount indicator)
    if echo "$options" | grep -q '"device"'; then
        return 0  # Is bind mount
    else
        return 1  # Is Docker managed
    fi
}

# Get volume data size
get_volume_size() {
    local volume_name="$1"
    docker run --rm -v "$volume_name:/data:ro" alpine du -sh /data 2>/dev/null | cut -f1 || echo "unknown"
}

# Count files in volume
get_volume_file_count() {
    local volume_name="$1"
    docker run --rm -v "$volume_name:/data:ro" alpine find /data -type f 2>/dev/null | wc -l || echo "0"
}

# Check PostgreSQL version in volume
get_pg_version_from_volume() {
    local volume_name="$1"
    docker run --rm -v "$volume_name:/data:ro" alpine cat /data/PG_VERSION 2>/dev/null || echo ""
}

# =============================================================================
# Pre-Migration Checks
# =============================================================================

pre_migration_checks() {
    log_info "Running pre-migration checks..."

    # 1. Check root privileges
    if [[ $EUID -ne 0 ]]; then
        log_error "This script must be run as root (sudo)"
        exit 1
    fi
    log_success "Root privileges: OK"

    # 2. Check Docker is running
    if ! docker info &>/dev/null; then
        log_error "Docker is not running"
        exit 1
    fi
    log_success "Docker: Running"

    # 3. Check if old volume exists
    if ! docker volume inspect "$OLD_VOLUME_NAME" &>/dev/null; then
        log_error "Volume '$OLD_VOLUME_NAME' does not exist"
        log_error "Nothing to migrate"
        exit 1
    fi
    log_success "Source volume: $OLD_VOLUME_NAME exists"

    # 4. Check if it's actually a bind mount volume
    if ! is_bind_mount_volume "$OLD_VOLUME_NAME"; then
        log_error "Volume '$OLD_VOLUME_NAME' is already a Docker managed volume!"
        log_error "Migration already completed or not needed."
        echo ""
        echo "Current volume info:"
        docker volume inspect "$OLD_VOLUME_NAME" --format 'Driver: {{.Driver}}, Options: {{.Options}}'
        exit 1
    fi
    log_success "Volume type: Bind mount (migration needed)"

    # 5. Check PostgreSQL data exists in volume
    local pg_version
    pg_version=$(get_pg_version_from_volume "$OLD_VOLUME_NAME")
    if [[ -z "$pg_version" ]]; then
        log_error "No PostgreSQL data found in volume (missing PG_VERSION)"
        exit 1
    fi
    log_success "PostgreSQL data found: version $pg_version"

    # 6. Check data size
    local data_size
    data_size=$(get_volume_size "$OLD_VOLUME_NAME")
    log_info "Data size to migrate: $data_size"

    # 7. Check available disk space (need 2x data size for safety)
    local data_bytes
    data_bytes=$(docker run --rm -v "$OLD_VOLUME_NAME:/data:ro" alpine du -sb /data 2>/dev/null | cut -f1 || echo "0")
    local required_bytes=$((data_bytes * 2))
    local available_bytes
    available_bytes=$(df --output=avail -B1 /var/lib/docker 2>/dev/null | tail -1 || echo "0")

    if [[ $available_bytes -lt $required_bytes ]]; then
        log_error "Insufficient disk space!"
        log_error "Required: $(numfmt --to=iec-i --suffix=B $required_bytes 2>/dev/null || echo "$required_bytes bytes")"
        log_error "Available: $(numfmt --to=iec-i --suffix=B $available_bytes 2>/dev/null || echo "$available_bytes bytes")"
        exit 1
    fi
    log_success "Disk space: OK"

    # 8. Check PostgreSQL container is running (for backup)
    if docker ps --filter "name=$POSTGRES_CONTAINER" --filter "status=running" -q 2>/dev/null | grep -q .; then
        log_success "PostgreSQL container: Running (will create SQL backup)"
    else
        log_warning "PostgreSQL container not running - SQL backup will be skipped"
    fi

    # 9. Check docker-compose.yml exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "docker-compose.yml not found: $COMPOSE_FILE"
        exit 1
    fi
    log_success "docker-compose.yml: Found"

    # 10. Check temp volume doesn't exist
    if docker volume inspect "$TEMP_VOLUME_NAME" &>/dev/null; then
        log_warning "Temporary volume '$TEMP_VOLUME_NAME' already exists (from previous failed migration?)"
        echo ""
        read -p "Remove temporary volume and continue? [y/N]: " confirm
        if [[ "${confirm,,}" != "y" ]]; then
            log_error "Migration cancelled"
            exit 5
        fi
        docker volume rm "$TEMP_VOLUME_NAME" 2>/dev/null || true
    fi

    echo ""
    log_success "All pre-migration checks passed"
    echo ""
}

# =============================================================================
# Backup Functions
# =============================================================================

create_backup() {
    log_info "Creating full backup before migration..."

    # Ensure backup directory exists
    mkdir -p "$BACKUP_DIR"

    local backup_file="$BACKUP_DIR/pre_migration_$(date +%Y%m%d_%H%M%S).sql.gz"

    # Check if PostgreSQL is running
    if docker ps --filter "name=$POSTGRES_CONTAINER" --filter "status=running" -q 2>/dev/null | grep -q .; then
        log_info "PostgreSQL is running - creating backup via pg_dump"

        # Load .env for credentials
        if [[ -f "$DEPLOY_DIR/.env" ]]; then
            set -a
            # shellcheck source=/dev/null
            source "$DEPLOY_DIR/.env"
            set +a
        fi

        local pg_user="${POSTGRES_USER:-familybudget}"
        local pg_db="${POSTGRES_DB:-familybudget}"

        if docker exec "$POSTGRES_CONTAINER" \
            pg_dump -U "$pg_user" "$pg_db" 2>/dev/null | gzip > "$backup_file"; then

            # Verify backup integrity
            if gzip -t "$backup_file" 2>/dev/null; then
                local backup_size
                backup_size=$(du -h "$backup_file" | cut -f1)
                log_success "Backup created: $backup_file ($backup_size)"

                # Verify SQL structure
                if zcat "$backup_file" | head -n 100 | grep -q "PostgreSQL database dump"; then
                    log_success "Backup integrity: Valid PostgreSQL dump"
                else
                    log_warning "Backup may not be a valid PostgreSQL dump"
                fi
            else
                log_error "Backup file is corrupted (gzip test failed)"
                exit 2
            fi
        else
            log_error "Failed to create backup via pg_dump"
            exit 2
        fi
    else
        log_warning "PostgreSQL not running - skipping SQL backup"
        log_info "Data will be copied from bind mount directory as backup"
    fi

    echo ""
}

# =============================================================================
# Docker Compose Backup
# =============================================================================

backup_compose_file() {
    local backup_path="${COMPOSE_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
    cp "$COMPOSE_FILE" "$backup_path"
    log_success "docker-compose.yml backed up to: $backup_path"
}

# =============================================================================
# PostgreSQL Management
# =============================================================================

stop_all_services() {
    log_info "Stopping all services..."

    cd "$DEPLOY_DIR" || exit 1

    # Stop all containers
    if docker compose ps -q 2>/dev/null | grep -q .; then
        docker compose down --timeout 60
        sleep 5
        log_success "All services stopped"
    else
        log_info "No services running"
    fi
}

# =============================================================================
# Volume Migration
# =============================================================================

create_temp_volume() {
    log_info "Creating temporary Docker managed volume: $TEMP_VOLUME_NAME"

    docker volume create "$TEMP_VOLUME_NAME"

    # Verify creation and it's not bind mount
    if docker volume inspect "$TEMP_VOLUME_NAME" &>/dev/null; then
        if is_bind_mount_volume "$TEMP_VOLUME_NAME"; then
            log_error "Temporary volume was created as bind mount - unexpected!"
            exit 3
        fi
        log_success "Temporary Docker managed volume created"
    else
        log_error "Failed to create temporary Docker volume"
        exit 3
    fi
}

copy_data_to_temp_volume() {
    log_info "Copying data from bind mount volume to temporary volume..."
    log_info "This may take several minutes depending on data size..."
    echo ""

    # Count source files for verification
    local source_files
    source_files=$(get_volume_file_count "$OLD_VOLUME_NAME")
    log_info "Source file count: $source_files"

    # Use temporary container with rsync for reliable copy
    # Mount OLD volume (bind mount) as source, TEMP volume as destination
    docker run --rm \
        -v "$OLD_VOLUME_NAME:/source:ro" \
        -v "$TEMP_VOLUME_NAME:/dest" \
        alpine:latest \
        sh -c "apk add --no-cache rsync >/dev/null 2>&1 && rsync -av --checksum /source/ /dest/" 2>&1 | tee -a "$LOG_FILE"

    # Verify file count in destination
    local dest_files
    dest_files=$(get_volume_file_count "$TEMP_VOLUME_NAME")
    log_info "Destination file count: $dest_files"

    if [[ "$source_files" != "$dest_files" ]]; then
        log_error "File count mismatch! Source: $source_files, Dest: $dest_files"
        log_error "Data copy may be incomplete"
        exit 3
    fi

    log_success "Data copied to temporary volume (file count verified)"
    echo ""
}

verify_temp_volume() {
    log_info "Verifying temporary volume..."

    # 1. Check PG_VERSION exists
    local pg_version
    pg_version=$(get_pg_version_from_volume "$TEMP_VOLUME_NAME")
    if [[ -z "$pg_version" ]]; then
        log_error "No PG_VERSION found in temporary volume"
        return 1
    fi
    log_success "PG_VERSION: $pg_version"

    # 2. Check critical directories exist
    local critical_dirs=("base" "global" "pg_wal" "pg_multixact")
    for dir in "${critical_dirs[@]}"; do
        if ! docker run --rm -v "$TEMP_VOLUME_NAME:/data:ro" alpine test -d "/data/$dir" 2>/dev/null; then
            log_error "Critical directory missing: $dir"
            return 1
        fi
    done
    log_success "Critical directories: All present"

    # 3. Check postgresql.conf or postgresql.auto.conf exists
    if docker run --rm -v "$TEMP_VOLUME_NAME:/data:ro" alpine test -f "/data/postgresql.conf" 2>/dev/null; then
        log_success "postgresql.conf: Present"
    elif docker run --rm -v "$TEMP_VOLUME_NAME:/data:ro" alpine test -f "/data/postgresql.auto.conf" 2>/dev/null; then
        log_success "postgresql.auto.conf: Present"
    else
        log_warning "No postgresql config found (may be OK for default config)"
    fi

    log_success "Temporary volume verification passed"
    return 0
}

swap_volumes() {
    log_info "Swapping volumes..."

    # 1. Remove old bind mount volume
    log_info "Removing old bind mount volume: $OLD_VOLUME_NAME"
    if ! docker volume rm "$OLD_VOLUME_NAME" 2>/dev/null; then
        log_error "Failed to remove old volume"
        log_error "Make sure all containers are stopped"
        exit 3
    fi
    log_success "Old volume removed"

    # 2. Rename temp volume to target name
    # Docker doesn't support volume rename, so we need to copy again
    log_info "Creating final Docker managed volume: $NEW_VOLUME_NAME"
    docker volume create "$NEW_VOLUME_NAME"

    log_info "Copying data from temporary to final volume..."
    docker run --rm \
        -v "$TEMP_VOLUME_NAME:/source:ro" \
        -v "$NEW_VOLUME_NAME:/dest" \
        alpine:latest \
        sh -c "cp -a /source/. /dest/" 2>&1 | tee -a "$LOG_FILE"

    # 3. Verify final volume
    local final_files
    final_files=$(get_volume_file_count "$NEW_VOLUME_NAME")
    local temp_files
    temp_files=$(get_volume_file_count "$TEMP_VOLUME_NAME")

    if [[ "$final_files" != "$temp_files" ]]; then
        log_error "Final volume file count mismatch!"
        exit 3
    fi
    log_success "Final volume created and verified"

    # 4. Remove temporary volume
    log_info "Removing temporary volume..."
    docker volume rm "$TEMP_VOLUME_NAME" 2>/dev/null || true
    log_success "Temporary volume removed"

    # 5. Verify new volume is Docker managed (not bind mount)
    if is_bind_mount_volume "$NEW_VOLUME_NAME"; then
        log_error "New volume is still a bind mount - something went wrong!"
        exit 3
    fi
    log_success "New volume is Docker managed"
}

# =============================================================================
# Bind Mount Backup
# =============================================================================

backup_bind_mount() {
    log_info "Backing up original bind mount directory..."

    if [[ ! -d "$BIND_MOUNT_PATH" ]]; then
        log_info "Bind mount directory does not exist, skipping backup"
        return 0
    fi

    if [[ -d "$BACKUP_BIND_MOUNT_PATH" ]]; then
        log_warning "Backup directory already exists: $BACKUP_BIND_MOUNT_PATH"
        log_warning "Removing old backup..."
        rm -rf "$BACKUP_BIND_MOUNT_PATH"
    fi

    mv "$BIND_MOUNT_PATH" "$BACKUP_BIND_MOUNT_PATH"

    # Create empty directory (optional, for cleanliness)
    mkdir -p "$BIND_MOUNT_PATH"

    log_success "Original data backed up to: $BACKUP_BIND_MOUNT_PATH"
    log_warning "DO NOT DELETE this directory until migration is fully verified!"
}

# =============================================================================
# Rollback
# =============================================================================

rollback() {
    print_banner
    log_warning "Rolling back migration..."
    echo ""

    # 1. Stop services
    log_info "Stopping services..."
    cd "$DEPLOY_DIR" && docker compose down 2>/dev/null || true

    # 2. Remove new Docker volume if exists
    if docker volume inspect "$NEW_VOLUME_NAME" &>/dev/null; then
        if ! is_bind_mount_volume "$NEW_VOLUME_NAME"; then
            log_info "Removing Docker managed volume..."
            docker volume rm "$NEW_VOLUME_NAME" 2>/dev/null || true
        fi
    fi

    # 3. Remove temp volume if exists
    if docker volume inspect "$TEMP_VOLUME_NAME" &>/dev/null; then
        docker volume rm "$TEMP_VOLUME_NAME" 2>/dev/null || true
    fi

    # 4. Restore bind mount directory
    if [[ -d "$BACKUP_BIND_MOUNT_PATH" ]]; then
        log_info "Restoring bind mount from backup..."
        rm -rf "$BIND_MOUNT_PATH"
        mv "$BACKUP_BIND_MOUNT_PATH" "$BIND_MOUNT_PATH"
        log_success "Bind mount directory restored"
    else
        log_warning "Backup directory not found: $BACKUP_BIND_MOUNT_PATH"
        log_warning "Bind mount may still exist at: $BIND_MOUNT_PATH"
    fi

    # 5. Restore docker-compose.yml
    local latest_backup
    latest_backup=$(ls -t "${COMPOSE_FILE}.backup."* 2>/dev/null | head -1 || echo "")
    if [[ -n "$latest_backup" ]]; then
        log_info "Restoring docker-compose.yml from: $latest_backup"
        cp "$latest_backup" "$COMPOSE_FILE"
        log_success "docker-compose.yml restored"
    else
        log_warning "No docker-compose.yml backup found"
        log_warning "You may need to restore it manually:"
        log_warning "  cd ~/familyBudget && git checkout docker-compose.yml"
    fi

    echo ""
    log_success "Rollback complete"
    echo ""
    echo "Next steps:"
    echo "  1. Verify docker-compose.yml has bind mount configuration"
    echo "  2. Run: cd ~/familyBudget && sudo bash deploy.sh"
    echo ""
}

# =============================================================================
# Status Check
# =============================================================================

check_status() {
    print_banner
    log_info "Checking current volume status..."
    echo ""

    # Check if volume exists
    if docker volume inspect "$OLD_VOLUME_NAME" &>/dev/null; then
        echo "Volume '$OLD_VOLUME_NAME': EXISTS"

        # Check if bind mount or Docker managed
        if is_bind_mount_volume "$OLD_VOLUME_NAME"; then
            echo "  Type: BIND MOUNT (migration needed)"
            local bind_path
            bind_path=$(docker volume inspect "$OLD_VOLUME_NAME" --format '{{index .Options "device"}}' 2>/dev/null || echo "unknown")
            echo "  Bind path: $bind_path"
        else
            echo "  Type: DOCKER MANAGED (migration complete or not needed)"
        fi

        # Check data
        local pg_version
        pg_version=$(get_pg_version_from_volume "$OLD_VOLUME_NAME")
        if [[ -n "$pg_version" ]]; then
            echo "  PostgreSQL version: $pg_version"
            echo "  Data size: $(get_volume_size "$OLD_VOLUME_NAME")"
            echo "  File count: $(get_volume_file_count "$OLD_VOLUME_NAME")"
        else
            echo "  PostgreSQL data: NOT FOUND"
        fi
    else
        echo "Volume '$OLD_VOLUME_NAME': NOT FOUND"
    fi
    echo ""

    # Check temp volume
    if docker volume inspect "$TEMP_VOLUME_NAME" &>/dev/null; then
        echo "Temporary volume '$TEMP_VOLUME_NAME': EXISTS (leftover from failed migration?)"
    fi
    echo ""

    # Check bind mount directory
    if [[ -d "$BIND_MOUNT_PATH" ]]; then
        if [[ -f "$BIND_MOUNT_PATH/PG_VERSION" ]]; then
            local pg_ver
            pg_ver=$(cat "$BIND_MOUNT_PATH/PG_VERSION")
            echo "Bind mount directory: EXISTS (PostgreSQL $pg_ver)"
            echo "  Path: $BIND_MOUNT_PATH"
            echo "  Size: $(du -sh "$BIND_MOUNT_PATH" 2>/dev/null | cut -f1)"
        else
            echo "Bind mount directory: EXISTS but empty or no PostgreSQL data"
        fi
    else
        echo "Bind mount directory: NOT FOUND"
    fi
    echo ""

    # Check backup
    if [[ -d "$BACKUP_BIND_MOUNT_PATH" ]]; then
        echo "Backup directory: EXISTS"
        echo "  Path: $BACKUP_BIND_MOUNT_PATH"
        echo "  Size: $(du -sh "$BACKUP_BIND_MOUNT_PATH" 2>/dev/null | cut -f1)"
    else
        echo "Backup directory: NOT FOUND"
    fi
    echo ""

    # Check docker-compose.yml
    if [[ -f "$COMPOSE_FILE" ]]; then
        if grep -A15 "postgres_data:" "$COMPOSE_FILE" 2>/dev/null | grep -q "driver_opts:"; then
            echo "docker-compose.yml: BIND MOUNT configuration"
        elif grep -A5 "postgres_data:" "$COMPOSE_FILE" 2>/dev/null | grep -q "external:"; then
            echo "docker-compose.yml: EXTERNAL volume (Docker managed)"
        else
            echo "docker-compose.yml: DOCKER MANAGED configuration"
        fi
    else
        echo "docker-compose.yml: NOT FOUND"
    fi
    echo ""

    # Check PostgreSQL container
    if docker ps --filter "name=$POSTGRES_CONTAINER" --filter "status=running" -q 2>/dev/null | grep -q .; then
        echo "PostgreSQL container: RUNNING"
        local health
        health=$(docker inspect "$POSTGRES_CONTAINER" --format='{{.State.Health.Status}}' 2>/dev/null || echo "unknown")
        echo "  Health: $health"
    else
        echo "PostgreSQL container: NOT RUNNING"
    fi
    echo ""
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    echo ""
    echo "=========================================="
    echo "     MIGRATION COMPLETE"
    echo "=========================================="
    echo ""
    echo "Old bind mount backed up to:"
    echo "  $BACKUP_BIND_MOUNT_PATH"
    echo ""
    echo "New Docker managed volume:"
    echo "  $NEW_VOLUME_NAME"
    echo ""
    echo "NEXT STEPS:"
    echo "  1. Update docker-compose.yml on server:"
    echo "     cd ~/familyBudget"
    echo "     git pull origin main  # or test branch"
    echo "     sudo bash deploy.sh --sync-mode update --cleanup-mode smart"
    echo ""
    echo "  2. Verify PostgreSQL starts correctly:"
    echo "     cd /opt/budget"
    echo "     docker compose ps"
    echo "     docker compose exec postgres pg_isready -U familybudget"
    echo ""
    echo "  3. Test application functionality"
    echo ""
    echo "  4. After full verification, optionally delete backup:"
    echo "     sudo rm -rf $BACKUP_BIND_MOUNT_PATH"
    echo ""
    echo "TO ROLLBACK if issues occur:"
    echo "  sudo $0 --rollback"
    echo ""
}

# =============================================================================
# Main
# =============================================================================

main() {
    # Create log directory
    ensure_log_dir

    # Handle command line arguments
    case "${1:-}" in
        --rollback)
            rollback
            exit 0
            ;;
        --check|--status)
            check_status
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [--rollback|--check|--help]"
            echo ""
            echo "Options:"
            echo "  (no args)   Run migration"
            echo "  --rollback  Rollback to bind mount"
            echo "  --check     Check current status"
            echo "  --help      Show this help"
            echo ""
            echo "IMPORTANT: Run this script from the repository directory:"
            echo "  cd ~/familyBudget"
            echo "  sudo ./scripts/migrate_to_docker_volume.sh"
            exit 0
            ;;
    esac

    print_banner

    # Show current status
    echo "Current configuration:"
    if docker volume inspect "$OLD_VOLUME_NAME" &>/dev/null; then
        if is_bind_mount_volume "$OLD_VOLUME_NAME"; then
            echo "  Volume: $OLD_VOLUME_NAME (bind mount)"
            echo "  Data size: $(get_volume_size "$OLD_VOLUME_NAME")"
        else
            log_error "Volume '$OLD_VOLUME_NAME' is already Docker managed!"
            log_error "Migration not needed."
            exit 1
        fi
    else
        log_error "Volume '$OLD_VOLUME_NAME' does not exist!"
        exit 1
    fi
    echo ""

    # Confirmation
    log_warning "This will migrate PostgreSQL data from bind mount to Docker managed volume"
    log_warning "A full SQL backup will be created before any changes"
    log_warning "Original bind mount data will be preserved in: $BACKUP_BIND_MOUNT_PATH"
    echo ""
    read -p "Continue with migration? [y/N]: " confirm
    if [[ "${confirm,,}" != "y" ]]; then
        log_info "Migration cancelled"
        exit 5
    fi
    echo ""

    # Execute migration steps
    pre_migration_checks
    backup_compose_file
    create_backup
    stop_all_services
    create_temp_volume
    copy_data_to_temp_volume

    if verify_temp_volume; then
        swap_volumes
        backup_bind_mount
        print_summary
    else
        log_error "Temporary volume verification failed"
        log_error "Cleaning up..."
        docker volume rm "$TEMP_VOLUME_NAME" 2>/dev/null || true
        exit 4
    fi

    log_success "Migration completed successfully!"
    echo ""
    echo "Log file: $LOG_FILE"
}

main "$@"
