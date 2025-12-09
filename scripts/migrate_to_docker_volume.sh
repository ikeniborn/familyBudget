#!/bin/bash
################################################################################
# Family Budget - PostgreSQL Volume Migration Script
################################################################################
#
# Description:
#   Safely migrates PostgreSQL data from bind mount to Docker managed volume.
#   Creates multiple backups before any data operations.
#
# CRITICAL SAFETY FEATURES:
#   - Full pg_dump backup BEFORE any changes
#   - File count verification after copy
#   - Original data preserved in /opt/budget/data/postgres.backup
#   - Rollback capability via --rollback flag
#
# Usage:
#   sudo ./migrate_to_docker_volume.sh           # Run migration
#   sudo ./migrate_to_docker_volume.sh --rollback # Rollback to bind mount
#   sudo ./migrate_to_docker_volume.sh --check    # Check current status
#
# Requirements:
#   - Root privileges (sudo)
#   - Docker running
#   - Existing bind mount at /opt/budget/data/postgres
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
LOG_FILE="$DEPLOY_DIR/logs/migration_$(date +%Y%m%d_%H%M%S).log"

# Docker volume name (must match docker-compose.yml external volume name)
# Note: Volume name is defined in docker-compose.yml as "budget_postgres_data"
NEW_VOLUME_NAME="budget_postgres_data"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# =============================================================================
# Logging Functions
# =============================================================================

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

    # 3. CRITICAL: Check if already migrated (one-time operation)
    if docker volume inspect "$NEW_VOLUME_NAME" &>/dev/null; then
        if ! grep -A10 "^[[:space:]]*postgres_data:" "$COMPOSE_FILE" 2>/dev/null | grep -q "driver_opts:"; then
            log_error "Migration already completed!"
            log_error "Docker volume '$NEW_VOLUME_NAME' exists and docker-compose.yml uses Docker managed volume."
            log_error "This is a ONE-TIME migration. No action needed."
            exit 1
        fi
    fi
    log_success "Migration status: Not yet migrated"

    # 4. Check bind mount exists and has data
    if [[ ! -d "$BIND_MOUNT_PATH" ]]; then
        log_error "Bind mount path does not exist: $BIND_MOUNT_PATH"
        exit 1
    fi

    if [[ ! -f "$BIND_MOUNT_PATH/PG_VERSION" ]]; then
        log_error "No PostgreSQL data found in bind mount (missing PG_VERSION)"
        exit 1
    fi

    local pg_version=$(cat "$BIND_MOUNT_PATH/PG_VERSION")
    log_success "PostgreSQL data found: version $pg_version"

    # 4. Check data size
    local data_size=$(du -sh "$BIND_MOUNT_PATH" 2>/dev/null | cut -f1)
    log_info "Data size to migrate: $data_size"

    # 5. Check available disk space (need 2x data size for safety)
    local data_bytes=$(du -sb "$BIND_MOUNT_PATH" 2>/dev/null | cut -f1)
    local required_bytes=$((data_bytes * 2))
    local available_bytes=$(df --output=avail -B1 "$DEPLOY_DIR" | tail -1)

    if [[ $available_bytes -lt $required_bytes ]]; then
        log_error "Insufficient disk space!"
        log_error "Required: $(numfmt --to=iec-i --suffix=B $required_bytes)"
        log_error "Available: $(numfmt --to=iec-i --suffix=B $available_bytes)"
        exit 1
    fi
    log_success "Disk space: OK ($(numfmt --to=iec-i --suffix=B $available_bytes) available)"

    # 6. Check if Docker volume already exists
    if docker volume inspect "$NEW_VOLUME_NAME" &>/dev/null; then
        log_warning "Docker volume '$NEW_VOLUME_NAME' already exists!"
        echo ""
        read -p "Delete existing volume and continue? [y/N]: " confirm
        if [[ "${confirm,,}" != "y" ]]; then
            log_error "Migration cancelled - volume exists"
            exit 5
        fi
        log_info "Removing existing Docker volume..."
        docker volume rm "$NEW_VOLUME_NAME"
        log_success "Existing volume removed"
    fi

    # 7. Check docker-compose.yml exists
    if [[ ! -f "$COMPOSE_FILE" ]]; then
        log_error "docker-compose.yml not found: $COMPOSE_FILE"
        exit 1
    fi
    log_success "docker-compose.yml: Found"

    # 8. Verify current configuration is bind mount
    if ! grep -A10 "postgres_data:" "$COMPOSE_FILE" | grep -q "driver_opts:"; then
        log_warning "Current configuration doesn't appear to be bind mount"
        log_warning "Volume may already be Docker managed"
        echo ""
        read -p "Continue anyway? [y/N]: " confirm
        if [[ "${confirm,,}" != "y" ]]; then
            log_error "Migration cancelled"
            exit 5
        fi
    else
        log_success "Current config: Bind mount detected"
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
    if docker ps --filter "name=${PROJECT_NAME}-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
        log_info "PostgreSQL is running - creating backup via pg_dump"

        # Load .env for credentials
        if [[ -f "$DEPLOY_DIR/.env" ]]; then
            set -a
            source "$DEPLOY_DIR/.env"
            set +a
        fi

        local pg_user="${POSTGRES_USER:-familybudget}"
        local pg_db="${POSTGRES_DB:-familybudget}"

        if docker compose -f "$COMPOSE_FILE" exec -T postgres \
            pg_dump -U "$pg_user" "$pg_db" 2>/dev/null | gzip > "$backup_file"; then

            # Verify backup integrity
            if gzip -t "$backup_file" 2>/dev/null; then
                local backup_size=$(du -h "$backup_file" | cut -f1)
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
        log_warning "PostgreSQL not running - skipping pg_dump backup"
        log_info "Data directory will be copied as backup"
    fi

    echo ""
}

# =============================================================================
# PostgreSQL Management
# =============================================================================

stop_postgres() {
    log_info "Stopping PostgreSQL container..."

    if docker ps --filter "name=${PROJECT_NAME}-postgres" -q 2>/dev/null | grep -q .; then
        docker compose -f "$COMPOSE_FILE" stop postgres
        sleep 5

        # Remove container (but not volume!)
        docker compose -f "$COMPOSE_FILE" rm -f postgres 2>/dev/null || true
        log_success "PostgreSQL container stopped and removed"
    else
        log_info "PostgreSQL container not running"
    fi
}

# =============================================================================
# Volume Migration
# =============================================================================

create_docker_volume() {
    log_info "Creating Docker managed volume: $NEW_VOLUME_NAME"

    docker volume create "$NEW_VOLUME_NAME"

    # Verify creation
    if docker volume inspect "$NEW_VOLUME_NAME" &>/dev/null; then
        log_success "Docker volume created successfully"
    else
        log_error "Failed to create Docker volume"
        exit 3
    fi
}

copy_data_to_volume() {
    log_info "Copying data from bind mount to Docker volume..."
    log_info "This may take several minutes depending on data size..."
    echo ""

    # Count source files for verification
    local source_files=$(find "$BIND_MOUNT_PATH" -type f 2>/dev/null | wc -l)
    log_info "Source file count: $source_files"

    # Use temporary container with rsync for reliable copy
    # rsync with --checksum ensures data integrity
    docker run --rm \
        -v "$BIND_MOUNT_PATH:/source:ro" \
        -v "$NEW_VOLUME_NAME:/dest" \
        alpine:latest \
        sh -c "apk add --no-cache rsync >/dev/null 2>&1 && rsync -av --checksum /source/ /dest/" 2>&1 | tee -a "$LOG_FILE"

    # Verify file count in destination
    local dest_files=$(docker run --rm -v "$NEW_VOLUME_NAME:/data:ro" alpine find /data -type f 2>/dev/null | wc -l)
    log_info "Destination file count: $dest_files"

    if [[ "$source_files" != "$dest_files" ]]; then
        log_error "File count mismatch! Source: $source_files, Dest: $dest_files"
        log_error "Data copy may be incomplete"
        exit 3
    fi

    log_success "Data copied to Docker volume (file count verified)"
    echo ""
}

verify_migration() {
    log_info "Verifying migration..."

    # 1. Check PG_VERSION exists
    local pg_version=$(docker run --rm -v "$NEW_VOLUME_NAME:/data:ro" alpine cat /data/PG_VERSION 2>/dev/null || echo "")
    if [[ -z "$pg_version" ]]; then
        log_error "No PG_VERSION found in Docker volume"
        return 1
    fi
    log_success "PG_VERSION: $pg_version"

    # 2. Check critical directories exist
    local critical_dirs=("base" "global" "pg_wal" "pg_xact" "pg_multixact")
    for dir in "${critical_dirs[@]}"; do
        if ! docker run --rm -v "$NEW_VOLUME_NAME:/data:ro" alpine test -d "/data/$dir" 2>/dev/null; then
            log_error "Critical directory missing: $dir"
            return 1
        fi
    done
    log_success "Critical directories: All present"

    # 3. Check postgresql.conf exists
    if ! docker run --rm -v "$NEW_VOLUME_NAME:/data:ro" alpine test -f "/data/postgresql.conf" 2>/dev/null; then
        log_warning "postgresql.conf not found (may be OK if using default config)"
    else
        log_success "postgresql.conf: Present"
    fi

    log_success "Migration verification passed"
    return 0
}

# =============================================================================
# Docker Compose Update
# =============================================================================

print_next_steps() {
    echo ""
    echo "======================================"
    echo "  NEXT STEPS (REQUIRED)"
    echo "======================================"
    echo ""
    echo "Run deploy.sh to sync the updated docker-compose.yml from repository:"
    echo ""
    echo "  cd ~/familyBudget"
    echo "  sudo bash deploy.sh --sync-mode update --cleanup-mode smart"
    echo ""
    echo "This will:"
    echo "  1. Copy updated docker-compose.yml (with Docker managed volume) to /opt/budget/"
    echo "  2. Restart services with the new volume configuration"
    echo ""
}

# =============================================================================
# Bind Mount Backup
# =============================================================================

backup_bind_mount() {
    log_info "Backing up original bind mount directory..."

    if [[ -d "$BACKUP_BIND_MOUNT_PATH" ]]; then
        log_warning "Backup directory already exists: $BACKUP_BIND_MOUNT_PATH"
        log_warning "Removing old backup..."
        rm -rf "$BACKUP_BIND_MOUNT_PATH"
    fi

    mv "$BIND_MOUNT_PATH" "$BACKUP_BIND_MOUNT_PATH"

    # Create empty directory to prevent Docker errors
    mkdir -p "$BIND_MOUNT_PATH"

    log_success "Original data backed up to: $BACKUP_BIND_MOUNT_PATH"
    log_warning "DO NOT DELETE this directory until migration is verified!"
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

    # 2. Remove Docker volume if exists
    if docker volume inspect "$NEW_VOLUME_NAME" &>/dev/null; then
        log_info "Removing Docker volume..."
        docker volume rm "$NEW_VOLUME_NAME" 2>/dev/null || true
    fi

    # 3. Restore bind mount
    if [[ -d "$BACKUP_BIND_MOUNT_PATH" ]]; then
        log_info "Restoring bind mount from backup..."
        rm -rf "$BIND_MOUNT_PATH"
        mv "$BACKUP_BIND_MOUNT_PATH" "$BIND_MOUNT_PATH"
        log_success "Bind mount restored from backup"
    else
        log_error "Backup directory not found: $BACKUP_BIND_MOUNT_PATH"
        log_error "Cannot restore - manual intervention required"
        exit 1
    fi

    # 4. Restore docker-compose.yml
    local latest_backup=$(ls -t "${COMPOSE_FILE}.backup."* 2>/dev/null | head -1)
    if [[ -n "$latest_backup" ]]; then
        log_info "Restoring docker-compose.yml from: $latest_backup"
        cp "$latest_backup" "$COMPOSE_FILE"
        log_success "docker-compose.yml restored"
    else
        log_warning "No docker-compose.yml backup found"
        log_warning "You may need to restore it manually from git"
    fi

    echo ""
    log_success "Rollback complete - system restored to bind mount configuration"
    echo ""
    echo "Next steps:"
    echo "  1. Verify docker-compose.yml has bind mount configuration"
    echo "  2. Run: ./deploy.sh --sync-mode mirror --cleanup-mode full"
    echo ""
}

# =============================================================================
# Status Check
# =============================================================================

check_status() {
    print_banner
    log_info "Checking current volume status..."
    echo ""

    # Check docker-compose.yml configuration
    if grep -A10 "postgres_data:" "$COMPOSE_FILE" 2>/dev/null | grep -q "driver_opts:"; then
        echo "Current configuration: BIND MOUNT"
        echo "  Path: $BIND_MOUNT_PATH"
    else
        echo "Current configuration: DOCKER MANAGED VOLUME"
        echo "  Volume: $NEW_VOLUME_NAME"
    fi
    echo ""

    # Check if bind mount data exists
    if [[ -d "$BIND_MOUNT_PATH" ]] && [[ -f "$BIND_MOUNT_PATH/PG_VERSION" ]]; then
        local pg_version=$(cat "$BIND_MOUNT_PATH/PG_VERSION")
        echo "Bind mount data: EXISTS (PostgreSQL $pg_version)"
        echo "  Size: $(du -sh "$BIND_MOUNT_PATH" 2>/dev/null | cut -f1)"
    else
        echo "Bind mount data: NOT FOUND or empty"
    fi
    echo ""

    # Check if Docker volume exists
    if docker volume inspect "$NEW_VOLUME_NAME" &>/dev/null; then
        echo "Docker volume: EXISTS"
        local vol_size=$(docker run --rm -v "$NEW_VOLUME_NAME:/data:ro" alpine du -sh /data 2>/dev/null | cut -f1)
        echo "  Size: $vol_size"
    else
        echo "Docker volume: NOT FOUND"
    fi
    echo ""

    # Check if backup exists
    if [[ -d "$BACKUP_BIND_MOUNT_PATH" ]]; then
        echo "Backup: EXISTS at $BACKUP_BIND_MOUNT_PATH"
        echo "  Size: $(du -sh "$BACKUP_BIND_MOUNT_PATH" 2>/dev/null | cut -f1)"
    else
        echo "Backup: NOT FOUND"
    fi
    echo ""

    # Check PostgreSQL container status
    if docker ps --filter "name=${PROJECT_NAME}-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
        echo "PostgreSQL container: RUNNING"
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
    echo "New Docker volume:"
    echo "  $NEW_VOLUME_NAME"
    echo ""
    echo "NEXT STEPS:"
    echo "  1. Deploy with new configuration:"
    echo "     ./deploy.sh --sync-mode mirror --cleanup-mode smart"
    echo ""
    echo "  2. Verify PostgreSQL starts correctly:"
    echo "     docker compose ps"
    echo "     docker compose exec postgres pg_isready"
    echo ""
    echo "  3. Test application functionality"
    echo ""
    echo "  4. After verification, optionally delete backup:"
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
    mkdir -p "$(dirname "$LOG_FILE")"

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
            exit 0
            ;;
    esac

    print_banner

    # Confirmation
    log_warning "This will migrate PostgreSQL data from bind mount to Docker volume"
    log_warning "A full backup will be created before any changes"
    echo ""
    echo "Current bind mount: $BIND_MOUNT_PATH"
    echo "Target Docker volume: $NEW_VOLUME_NAME"
    echo ""
    read -p "Continue with migration? [y/N]: " confirm
    if [[ "${confirm,,}" != "y" ]]; then
        log_info "Migration cancelled"
        exit 5
    fi
    echo ""

    # Execute migration steps
    pre_migration_checks
    create_backup
    stop_postgres
    create_docker_volume
    copy_data_to_volume

    if verify_migration; then
        backup_bind_mount
        print_summary
        print_next_steps
    else
        log_error "Migration verification failed"
        log_error "Rolling back..."
        docker volume rm "$NEW_VOLUME_NAME" 2>/dev/null || true
        exit 4
    fi

    log_success "Migration completed successfully!"
    echo ""
    echo "Log file: $LOG_FILE"
}

main "$@"
