#!/bin/bash
#
# postgres.sh - PostgreSQL Management
#
# This module provides functions for managing PostgreSQL data directory,
# permissions, and integrity checking.
#
# Usage:
#   source scripts/lib/config.sh
#   source scripts/lib/utils.sh
#   source scripts/lib/postgres.sh
#
# Dependencies:
#   - config.sh (for DEPLOY_DIR, POSTGRES_WAS_STOPPED)
#   - utils.sh (for logging functions, check_root_privileges)
#

# =============================================================================
# POSTGRESQL UID DETECTION
# =============================================================================

# Get PostgreSQL UID from Docker image
get_postgres_uid_from_image() {
    local image="${1:-postgres:16-alpine}"

    # Try to get UID from running container first (faster)
    local uid=$(docker run --rm --entrypoint id "$image" -u postgres 2>/dev/null | grep -oP 'uid=\K[0-9]+' || echo "")

    if [[ -n "$uid" ]]; then
        echo "$uid"
        return 0
    fi

    # Fallback: Known defaults
    # postgres:16-alpine uses UID 70
    # postgres:16 (Debian) uses UID 999
    if [[ "$image" == *"alpine"* ]]; then
        echo "70"
    else
        echo "999"
    fi
}

# =============================================================================
# POSTGRESQL CRITICAL DIRECTORIES VERIFICATION (PRE-START CHECK)
# =============================================================================

# Verify and create critical PostgreSQL directories BEFORE starting services
# This lightweight check ensures essential directories exist, preventing FATAL errors
# at startup. Runs ALWAYS, even during selective restarts (no backup, no heavy checks).
#
# Background:
#   PostgreSQL initdb may not create all required system directories, or they may be
#   missing after incomplete migrations, corrupted backups, or bind mount issues.
#   Missing directories (pg_notify, pg_dynshmem, etc.) cause FATAL startup errors.
#
# When it runs:
#   - Called BEFORE start_services() in deploy.sh
#   - Runs even if POSTGRES_WAS_STOPPED=false (selective restart)
#   - Only creates directories; check_and_repair_postgres_data() handles full integrity
#
# Safety:
#   - Only touches stopped PostgreSQL containers (checks container status first)
#   - Creates only missing directories (no destructive operations)
#   - Sets correct ownership (70:70 for Alpine) and permissions (0700)
#
verify_postgres_critical_directories() {
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    # Skip if data directory doesn't exist or is empty (fresh installation)
    if [[ ! -d "$postgres_data_dir" ]] || [[ -z "$(ls -A "$postgres_data_dir" 2>/dev/null)" ]]; then
        return 0
    fi

    # Skip if not a PostgreSQL data directory
    if [[ ! -f "$postgres_data_dir/PG_VERSION" ]]; then
        return 0
    fi

    # CRITICAL: Only run when PostgreSQL is NOT running
    # Running this check on active database could cause corruption
    if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
        info "PostgreSQL is running - skipping directory check (will verify after next stop)"
        return 0
    fi

    # List of critical directories that MUST exist for PostgreSQL to start
    local critical_dirs=(
        "pg_notify"           # LISTEN/NOTIFY subsystem (FATAL if missing!)
        "pg_dynshmem"         # Dynamic shared memory
        "pg_stat"             # Statistics collector
        "pg_snapshots"        # Transaction snapshots
        "pg_commit_ts"        # Commit timestamps
        "pg_serial"           # Serializable transaction tracking
        "pg_replslot"         # Replication slots
        "pg_twophase"         # Two-phase commit
        "pg_tblspc"           # Tablespaces
        "pg_logical/snapshots"  # Logical replication snapshots
        "pg_logical/mappings"   # Logical replication type mappings
    )

    local missing_dirs=()

    # Check each critical directory
    for dir in "${critical_dirs[@]}"; do
        if [[ ! -d "$postgres_data_dir/$dir" ]]; then
            missing_dirs+=("$dir")
        fi
    done

    # If all directories present, no action needed
    if [[ ${#missing_dirs[@]} -eq 0 ]]; then
        return 0
    fi

    # Report missing directories (non-fatal, will auto-create)
    info "Detected ${#missing_dirs[@]} missing critical PostgreSQL directories"

    # Get target UID for correct ownership (Alpine uses 70:70)
    local target_uid=$(get_postgres_uid_from_image "postgres:16-alpine")
    local target_gid="$target_uid"

    # Create missing directories with correct ownership and permissions
    local created=0
    for dir in "${missing_dirs[@]}"; do
        local dir_path="$postgres_data_dir/$dir"

        if sudo mkdir -p "$dir_path" 2>/dev/null; then
            sudo chown $target_uid:$target_gid "$dir_path" 2>/dev/null
            sudo chmod 0700 "$dir_path" 2>/dev/null
            created=$((created + 1))
        else
            warning "Failed to create directory: $dir (PostgreSQL may fail to start)"
        fi
    done

    if [[ $created -gt 0 ]]; then
        success "Created $created missing PostgreSQL directories (ownership: $target_uid:$target_gid, permissions: 0700)"
    fi

    return 0
}

# =============================================================================
# POSTGRESQL DIRECTORY INITIALIZATION
# =============================================================================

# Initialize PostgreSQL data directory with correct permissions
initialize_postgres_directory() {
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    # Skip if PostgreSQL is still running (selective restart - avoid conflicts)
    if [[ "${POSTGRES_WAS_STOPPED}" == "false" ]]; then
        info "Skipping PostgreSQL permissions verification (PostgreSQL is still running)"
        info "Permissions will be verified after PostgreSQL stops"
        return 0
    fi

    # Detect PostgreSQL UID from existing data OR from Docker image
    local target_uid
    local target_gid

    if [[ -d "$postgres_data_dir/base" ]]; then
        # Data exists - detect current owner from base/ directory
        target_uid=$(stat -c '%u' "$postgres_data_dir/base" 2>/dev/null)
        target_gid=$(stat -c '%g' "$postgres_data_dir/base" 2>/dev/null)

        if [[ -z "$target_uid" ]] || [[ -z "$target_gid" ]]; then
            # stat failed - get from image
            target_uid=$(get_postgres_uid_from_image "postgres:16-alpine")
            target_gid="$target_uid"
            info "Failed to detect UID from data, using image default: $target_uid:$target_gid"
        else
            info "Detected existing PostgreSQL UID from data: $target_uid:$target_gid"
        fi
    else
        # No data - get UID from Docker image dynamically
        target_uid=$(get_postgres_uid_from_image "postgres:16-alpine")
        target_gid="$target_uid"
        info "No existing data - using PostgreSQL UID from image: $target_uid:$target_gid (postgres:16-alpine)"
    fi

    # Remove stale postmaster.pid lock file (ONLY if PostgreSQL is NOT running!)
    if [[ -f "$postgres_data_dir/postmaster.pid" ]]; then
        # Check if PostgreSQL is actually running
        if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
            info "PostgreSQL is running - lock file is valid (NOT stale)"
        else
            warning "Found stale PostgreSQL lock file (postmaster.pid)"
            info "PostgreSQL is stopped - safe to remove lock file..."
            if sudo rm -f "$postgres_data_dir/postmaster.pid"; then
                success "Lock file removed"
            else
                warning "Failed to remove lock file (continuing anyway)"
            fi
        fi
    fi

    # Create directory if doesn't exist
    if [[ ! -d "$postgres_data_dir" ]]; then
        info "Creating PostgreSQL data directory..."
        if sudo mkdir -p "$postgres_data_dir"; then
            # Set ownership to detected/default postgres user
            sudo chown $target_uid:$target_gid "$postgres_data_dir"
            sudo chmod 0700 "$postgres_data_dir"
            success "PostgreSQL data directory created with correct permissions ($target_uid:$target_gid)"
        else
            error "Failed to create PostgreSQL data directory"
            return 1
        fi
    else
        # Directory exists - verify/fix ownership RECURSIVELY
        info "Verifying PostgreSQL data directory permissions..."
        local current_owner=$(stat -c '%u:%g' "$postgres_data_dir" 2>/dev/null || echo "unknown")

        if [[ "$current_owner" != "$target_uid:$target_gid" ]]; then
            warning "Incorrect ownership: $current_owner (expected $target_uid:$target_gid)"
            info "Fixing ownership recursively (including all subdirectories)..."
            if sudo chown -R $target_uid:$target_gid "$postgres_data_dir"; then
                success "Ownership corrected to $target_uid:$target_gid (recursive)"
            else
                error "Failed to fix ownership"
                return 1
            fi
        else
            # Even if parent ownership is correct, ensure ALL subdirectories match
            info "Parent directory ownership correct, verifying subdirectories..."
            if sudo chown -R $target_uid:$target_gid "$postgres_data_dir" 2>/dev/null; then
                success "PostgreSQL data directory permissions verified ($target_uid:$target_gid, recursive)"
            else
                warning "Failed to recursively verify ownership (continuing anyway)"
            fi
        fi
    fi

    return 0
}

# =============================================================================
# POSTGRESQL PERMISSIONS VALIDATION (ALWAYS RUNS)
# =============================================================================

# Validate and fix PostgreSQL permissions UNCONDITIONALLY
# This function runs ALWAYS before service start, regardless of POSTGRES_WAS_STOPPED
# Use case: Smart cleanup may skip PostgreSQL restart, but permissions still need validation
validate_postgres_permissions_always() {
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    step "Validating PostgreSQL Permissions (Pre-Service Check)"

    # Skip if data directory doesn't exist or is empty
    if [[ ! -d "$postgres_data_dir" ]] || [[ -z "$(ls -A "$postgres_data_dir" 2>/dev/null)" ]]; then
        info "PostgreSQL data directory empty or doesn't exist - will be initialized by container"
        return 0
    fi

    # Skip if this is NOT a PostgreSQL data directory
    if [[ ! -f "$postgres_data_dir/PG_VERSION" ]]; then
        info "No PG_VERSION found - not a PostgreSQL data directory"
        return 0
    fi

    # ALWAYS use UID from Docker image (correct source of truth)
    # Do NOT use UID from existing data - it may be wrong after rsync from dev
    local target_uid=$(get_postgres_uid_from_image "postgres:16-alpine")
    local target_gid="$target_uid"

    info "Target PostgreSQL UID from Docker image: $target_uid:$target_gid (postgres:16-alpine)"

    # Check PostgreSQL running status FIRST (critical for safe permission handling)
    local postgres_is_running=false
    if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
        postgres_is_running=true
    fi

    # Remove stale postmaster.pid lock file (ONLY if PostgreSQL is NOT running!)
    if [[ -f "$postgres_data_dir/postmaster.pid" ]]; then
        if [[ "$postgres_is_running" == "true" ]]; then
            info "PostgreSQL is running - lock file is valid (NOT stale)"
        else
            warning "Found stale PostgreSQL lock file (postmaster.pid)"
            info "PostgreSQL is stopped - safe to remove lock file..."
            if sudo rm -f "$postgres_data_dir/postmaster.pid"; then
                success "Lock file removed"
            else
                warning "Failed to remove lock file (continuing anyway)"
            fi
        fi
    fi

    # Check ownership
    local current_owner=$(stat -c '%u:%g' "$postgres_data_dir" 2>/dev/null || echo "unknown")

    if [[ "$current_owner" != "$target_uid:$target_gid" ]]; then
        warning "Incorrect ownership detected: $current_owner (expected $target_uid:$target_gid)"
        info "Fixing ownership recursively (CRITICAL for PostgreSQL startup)..."

        # CRITICAL: Stop PostgreSQL if running (permissions cannot be changed while DB is active)
        if [[ "$postgres_is_running" == "true" ]]; then
            warning "PostgreSQL is running - stopping temporarily to fix permissions..."
            docker compose -f "$DEPLOY_DIR/docker-compose.yml" stop postgres --timeout 30 >> "$LOG_FILE" 2>&1 || true
            sleep 2
            info "PostgreSQL stopped - safe to fix permissions"
        fi

        if sudo chown -R $target_uid:$target_gid "$postgres_data_dir"; then
            success "Ownership corrected to $target_uid:$target_gid (recursive)"
        else
            error "Failed to fix ownership - PostgreSQL may fail to start!"
            return 1
        fi
    else
        # Ownership correct on parent directory
        info "Parent directory ownership correct: $current_owner"

        # CRITICAL SAFEGUARD: DO NOT run chown -R if PostgreSQL is running!
        # Running chown on active database files causes corruption
        if [[ "$postgres_is_running" == "true" ]]; then
            success "PostgreSQL is running - skipping recursive permission check (ownership already correct)"
            info "Recursive verification will run on next deployment when PostgreSQL stops"
        else
            # PostgreSQL is stopped - safe to verify recursively
            info "PostgreSQL is stopped - verifying ownership consistency recursively..."
            if sudo chown -R $target_uid:$target_gid "$postgres_data_dir" 2>/dev/null; then
                success "PostgreSQL permissions validated: $target_uid:$target_gid (recursive)"
            else
                warning "Failed to recursively verify ownership (continuing anyway)"
            fi
        fi
    fi

    return 0
}

# =============================================================================
# POSTGRESQL DATA INTEGRITY CHECK AND REPAIR
# =============================================================================

# Check and repair PostgreSQL data directory structure
check_and_repair_postgres_data() {
    local sync_mode="${1:-}"
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    # Skip integrity check if clean sync was used (everything will be recreated)
    if [[ "$sync_mode" == "clean" ]]; then
        info "Skipping PostgreSQL integrity check (clean sync mode - will be initialized fresh)"
        return 0
    fi

    # Skip if PostgreSQL was NOT stopped (selective restart - prevents race conditions)
    if [[ "${POSTGRES_WAS_STOPPED}" == "false" ]]; then
        info "Skipping PostgreSQL integrity check (PostgreSQL is still running)"
        warning "Integrity check would cause race conditions with running database"
        info "If you need to repair data, use cleanup option [3] Full cleanup to stop PostgreSQL first"
        return 0
    fi

    # Skip if data directory doesn't exist or is empty
    if [[ ! -d "$postgres_data_dir" ]] || [[ -z "$(ls -A "$postgres_data_dir" 2>/dev/null)" ]]; then
        info "PostgreSQL data directory is empty or doesn't exist - will be initialized by container"
        return 0
    fi

    # Check if this is a PostgreSQL data directory
    if [[ ! -f "$postgres_data_dir/PG_VERSION" ]]; then
        info "No PG_VERSION found - not a PostgreSQL data directory"
        return 0
    fi

    step "Checking PostgreSQL data directory integrity..."

    # List of required system directories for PostgreSQL 16
    # Including subdirectories that must exist for proper operation
    local required_dirs=(
        "pg_commit_ts"
        "pg_dynshmem"
        "pg_notify"
        "pg_replslot"
        "pg_serial"
        "pg_snapshots"
        "pg_stat"
        "pg_stat_tmp"
        "pg_tblspc"
        "pg_twophase"
        "pg_logical/snapshots"
        "pg_logical/mappings"
    )

    local missing_dirs=()
    local needs_repair=false

    # Check each required directory
    for dir in "${required_dirs[@]}"; do
        if [[ ! -d "$postgres_data_dir/$dir" ]]; then
            missing_dirs+=("$dir")
            needs_repair=true
        fi
    done

    # If all directories present, no repair needed
    if [[ "$needs_repair" == "false" ]]; then
        success "PostgreSQL data directory structure is valid"
        return 0
    fi

    # Report missing directories
    warning "PostgreSQL data directory is corrupted!"
    warning "Missing ${#missing_dirs[@]} system directories:"
    for dir in "${missing_dirs[@]}"; do
        echo "  ✗ $dir"
    done
    echo ""

    # Create backup before any modifications
    info "Creating backup before modifications..."
    local backup_file="$HOME/postgres_data_backup_$(date +%Y%m%d_%H%M%S).tar.gz"
    if sudo tar -czf "$backup_file" -C "$DEPLOY_DIR/data" postgres/ 2>/dev/null; then
        success "Backup created: $backup_file"
    else
        warning "Failed to create backup (continuing anyway)"
    fi
    echo ""

    # If severely corrupted (missing 50%+ directories), better to recreate
    local total_dirs=${#required_dirs[@]}
    local missing_count=${#missing_dirs[@]}
    local corruption_percent=$((missing_count * 100 / total_dirs))

    if [[ $corruption_percent -ge 50 ]]; then
        warning "Corruption level: $corruption_percent% ($missing_count of $total_dirs directories missing)"
        warning "Directory is severely corrupted - recreation recommended"
        echo ""

        # Check if there's any real user data worth preserving
        local has_user_data=false
        if [[ -d "$postgres_data_dir/base" ]] && [[ -n "$(ls -A "$postgres_data_dir/base" 2>/dev/null)" ]]; then
            has_user_data=true
        fi

        if [[ "$has_user_data" == "false" ]]; then
            info "No user databases found - safe to recreate"
            info "Deleting corrupted directory and allowing PostgreSQL to initialize fresh..."
            echo ""

            # Delete corrupted directory
            if sudo rm -rf "$postgres_data_dir"/* 2>/dev/null; then
                success "Corrupted directory deleted"
                info "PostgreSQL will initialize clean structure on first start"
                return 0
            else
                error "Failed to delete corrupted directory"
                return 1
            fi
        else
            warning "User databases detected - attempting repair to preserve data..."
            echo ""
        fi
    fi

    # Automatically repair (for minor corruption or when user data exists)
    info "Attempting to repair PostgreSQL data directory structure..."
    echo ""

    # Detect existing UID from data to ensure consistency
    local target_uid=999
    local target_gid=999
    if [[ -d "$postgres_data_dir/base" ]]; then
        target_uid=$(stat -c '%u' "$postgres_data_dir/base" 2>/dev/null || echo "999")
        target_gid=$(stat -c '%g' "$postgres_data_dir/base" 2>/dev/null || echo "999")
        info "Detected existing PostgreSQL UID: $target_uid:$target_gid"
    fi
    echo ""

    # Create missing directories with correct ownership and permissions
    local repaired=0
    for dir in "${missing_dirs[@]}"; do
        local dir_path="$postgres_data_dir/$dir"

        info "Creating: $dir"

        if sudo mkdir -p "$dir_path" 2>/dev/null; then
            # Set ownership to detected postgres user UID
            sudo chown $target_uid:$target_gid "$dir_path" 2>/dev/null

            # Set permissions to 0700 (drwx------)
            sudo chmod 0700 "$dir_path" 2>/dev/null

            success "  ✓ Created and configured: $dir"
            repaired=$((repaired + 1))
        else
            error "  ✗ Failed to create: $dir"
            return 1
        fi
    done

    echo ""
    success "PostgreSQL data directory repaired: $repaired directories created"
    info "PostgreSQL will initialize these directories on startup"
    echo ""

    # Verify ownership of all directories to ensure consistency
    info "Verifying ownership of all PostgreSQL directories..."
    if sudo chown -R $target_uid:$target_gid "$postgres_data_dir" 2>/dev/null; then
        success "All directories have correct ownership ($target_uid:$target_gid)"
    else
        warning "Failed to set ownership on some directories (continuing anyway)"
    fi

    return 0
}

# =============================================================================
# POST-START INTEGRITY VERIFICATION (CRITICAL SAFEGUARD)
# =============================================================================

# Verify PostgreSQL health and data integrity AFTER service start
# This runs ALWAYS regardless of POSTGRES_WAS_STOPPED to catch corruption early
# Returns:
#   0 - PostgreSQL healthy and data intact
#   1 - PostgreSQL unhealthy or data corrupted (requires intervention)
verify_postgres_health_post_start() {
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    step "Verifying PostgreSQL Health (Post-Start Safeguard)"

    # Wait for PostgreSQL container to be running
    local max_wait=30
    local elapsed=0
    local postgres_running=false

    info "Waiting for PostgreSQL container to start (max ${max_wait}s)..."
    while [[ $elapsed -lt $max_wait ]]; do
        if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
            postgres_running=true
            break
        fi
        sleep 2
        elapsed=$((elapsed + 2))
    done

    if [[ "$postgres_running" == "false" ]]; then
        error "PostgreSQL container failed to start within ${max_wait}s"
        return 1
    fi

    success "PostgreSQL container is running"

    # Check if PostgreSQL is accepting connections (health check)
    info "Checking PostgreSQL connection health..."
    local health_check_passed=false
    max_wait=60
    elapsed=0

    while [[ $elapsed -lt $max_wait ]]; do
        if docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T postgres pg_isready -U "${POSTGRES_USER:-familybudget}" > /dev/null 2>&1; then
            health_check_passed=true
            break
        fi
        sleep 3
        elapsed=$((elapsed + 3))
        echo -n "."
    done
    echo ""

    if [[ "$health_check_passed" == "false" ]]; then
        warning "PostgreSQL is NOT accepting connections after ${max_wait}s"

        # Check for corruption indicators in logs
        info "Checking PostgreSQL logs for corruption indicators..."
        local logs=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" logs --tail=50 postgres 2>/dev/null || echo "")

        if echo "$logs" | grep -qi "could not open directory\|no such file or directory\|data directory.*corrupt"; then
            error "PostgreSQL corruption detected in logs!"
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🚨 CRITICAL: PostgreSQL Data Corruption Detected"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "Last 50 lines of PostgreSQL logs:"
            echo "──────────────────────────────────────────────────────────────"
            echo "$logs"
            echo "──────────────────────────────────────────────────────────────"
            echo ""

            # Check for missing critical directories
            local missing_critical_dirs=()
            local critical_dirs=("pg_notify" "pg_dynshmem" "pg_stat" "pg_wal")

            for dir in "${critical_dirs[@]}"; do
                if [[ ! -d "$postgres_data_dir/$dir" ]]; then
                    missing_critical_dirs+=("$dir")
                fi
            done

            if [[ ${#missing_critical_dirs[@]} -gt 0 ]]; then
                error "Missing critical directories: ${missing_critical_dirs[*]}"
                echo ""
                echo "💡 RECOVERY OPTIONS:"
                echo ""
                echo "Option 1 (RECOMMENDED): Automatic repair with full cleanup"
                echo "  cd ~/familyBudget && sudo bash deploy.sh"
                echo "  → Select: Cleanup [3] Full cleanup"
                echo ""
                echo "Option 2: Manual restoration from backup"
                echo "  bash scripts/restore.sh"
                echo "  → Select backup from list"
                echo ""
                echo "Option 3: Manual repair (DANGEROUS)"
                echo "  sudo bash scripts/lib/postgres.sh repair_postgres_manually"
                echo ""
            fi

            return 1
        else
            warning "PostgreSQL is slow to start but no corruption detected in logs"
            info "This may be normal for large databases"
        fi
    else
        success "PostgreSQL is accepting connections"
    fi

    # Data integrity check (only if PostgreSQL is running and accepting connections)
    # If pg_isready passed, PostgreSQL initialized correctly with all required directories
    # No need for additional directory checks - they are created automatically by PostgreSQL
    if [[ "$health_check_passed" == "true" ]]; then
        success "Data directory structure is valid (PostgreSQL initialized successfully)"
    fi

    return 0
}

# =============================================================================
# SAFETY BACKUP BEFORE DEPLOYMENT (PRODUCTION SAFEGUARD)
# =============================================================================

# Create safety backup before any deployment that may affect PostgreSQL
# This provides rollback capability if corruption occurs
# Returns:
#   0 - Backup created successfully
#   1 - Backup failed (BLOCKS deployment)
create_deployment_safety_backup() {
    local backup_reason="${1:-deployment}"

    step "Creating Safety Backup (Pre-Deployment Safeguard)"

    # Check if PostgreSQL is running
    local postgres_running=false
    if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
        postgres_running=true
    fi

    if [[ "$postgres_running" == "false" ]]; then
        info "PostgreSQL is not running - skipping safety backup"
        info "Backup will be created after PostgreSQL starts"
        return 0
    fi

    # Create backup directory if doesn't exist
    local backup_dir="$DEPLOY_DIR/backups"
    if [[ ! -d "$backup_dir" ]]; then
        sudo mkdir -p "$backup_dir" 2>/dev/null || true
    fi

    # Generate backup filename
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$backup_dir/safety_backup_${backup_reason}_${timestamp}.sql.gz"

    info "Creating safety backup: $(basename "$backup_file")"
    info "This provides rollback capability if deployment fails"

    # Execute pg_dump (use familybudget user from .env)
    local pg_user="${POSTGRES_USER:-familybudget}"
    local pg_db="${POSTGRES_DB:-familybudget}"

    if docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T postgres \
        pg_dump -U "$pg_user" "$pg_db" 2>/dev/null | gzip > "$backup_file" 2>/dev/null; then

        # Verify backup file size (should be > 0 bytes)
        local backup_size=$(stat -c%s "$backup_file" 2>/dev/null || echo "0")
        if [[ $backup_size -lt 100 ]]; then
            warning "Backup file is suspiciously small (${backup_size} bytes)"
            warning "This may indicate backup failure"
            rm -f "$backup_file" 2>/dev/null || true
            return 1
        fi

        success "Safety backup created: $(basename "$backup_file") ($(numfmt --to=iec-i --suffix=B $backup_size))"

        # Keep only last 5 safety backups to save space
        local backup_count=$(ls -1 "$backup_dir"/safety_backup_*.sql.gz 2>/dev/null | wc -l)
        if [[ $backup_count -gt 5 ]]; then
            info "Removing old safety backups (keeping last 5)..."
            ls -t "$backup_dir"/safety_backup_*.sql.gz | tail -n +6 | xargs rm -f 2>/dev/null || true
        fi

        return 0
    else
        error "Failed to create safety backup"
        error "This is a CRITICAL safety failure - deployment should not proceed"

        echo ""
        echo "💡 TROUBLESHOOTING:"
        echo "  1. Check PostgreSQL is healthy: docker compose logs postgres"
        echo "  2. Check disk space: df -h"
        echo "  3. Check backup directory permissions: ls -ld $backup_dir"
        echo ""

        return 1
    fi
}

# =============================================================================
# PRE-DEPLOYMENT HEALTH CHECK (CRITICAL SAFEGUARD)
# =============================================================================

# Check PostgreSQL health BEFORE deployment starts
# This prevents deployment from proceeding if PostgreSQL is already corrupted
# Returns:
#   0 - PostgreSQL healthy or not running (safe to proceed)
#   1 - PostgreSQL corrupted or unhealthy (requires Full cleanup)
check_postgres_health_pre_deploy() {
    local postgres_data_dir="$DEPLOY_DIR/data/postgres"

    step "Pre-Deployment PostgreSQL Health Check"

    # Check if PostgreSQL container exists
    local postgres_exists=false
    if docker ps -a --filter "name=familybudget-postgres" -q 2>/dev/null | grep -q .; then
        postgres_exists=true
    fi

    if [[ "$postgres_exists" == "false" ]]; then
        info "PostgreSQL container does not exist - fresh deployment"
        return 0
    fi

    # Check if PostgreSQL is running
    local postgres_running=false
    if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
        postgres_running=true
    fi

    if [[ "$postgres_running" == "false" ]]; then
        warning "PostgreSQL container exists but is NOT running"

        # Check container status
        local container_status=$(docker ps -a --filter "name=familybudget-postgres" --format "{{.Status}}" 2>/dev/null || echo "unknown")
        warning "Container status: $container_status"

        # If container is in restart loop - likely corrupted
        if echo "$container_status" | grep -qi "restarting"; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🚨 CRITICAL: PostgreSQL Data Corruption Detected (Pre-Deploy)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "PostgreSQL container is restarting continuously."
            echo "This indicates corrupted data directory."
            echo ""
            echo "Last 30 lines of PostgreSQL logs:"
            echo "──────────────────────────────────────────────────────────────"
            docker logs familybudget-postgres --tail=30 2>&1 || echo "Failed to get logs"
            echo "──────────────────────────────────────────────────────────────"
            echo ""
            echo "💡 AUTOMATIC RECOVERY:"
            echo ""
            echo "Deployment will AUTOMATICALLY switch to Full Cleanup mode"
            echo "to repair corrupted PostgreSQL data directory."
            echo ""
            echo "This will:"
            echo "  1. Stop all containers"
            echo "  2. Repair PostgreSQL data directory (pg_notify, etc.)"
            echo "  3. Restart PostgreSQL"
            echo "  4. Continue deployment normally"
            echo ""
            echo "DATA IS PRESERVED (volumes NOT deleted)."
            echo ""
            return 1
        fi

        # Container stopped but not restarting - safe to proceed
        info "PostgreSQL stopped cleanly - safe to proceed with deployment"
        return 0
    fi

    # PostgreSQL is running - check if it's accepting connections
    info "PostgreSQL is running - checking connection health..."

    local health_check_passed=false
    local max_attempts=3
    local attempt=0

    while [[ $attempt -lt $max_attempts ]]; do
        if docker compose -f "$DEPLOY_DIR/docker-compose.yml" exec -T postgres pg_isready -U "${POSTGRES_USER:-familybudget}" > /dev/null 2>&1; then
            health_check_passed=true
            break
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    if [[ "$health_check_passed" == "false" ]]; then
        warning "PostgreSQL is running but NOT accepting connections"

        # Check logs for corruption indicators
        local logs=$(docker compose -f "$DEPLOY_DIR/docker-compose.yml" logs --tail=30 postgres 2>/dev/null || echo "")

        if echo "$logs" | grep -qi "could not open directory\|no such file or directory\|data directory.*corrupt"; then
            echo ""
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo "🚨 CRITICAL: PostgreSQL Data Corruption Detected (Pre-Deploy)"
            echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
            echo ""
            echo "Last 30 lines of PostgreSQL logs:"
            echo "──────────────────────────────────────────────────────────────"
            echo "$logs"
            echo "──────────────────────────────────────────────────────────────"
            echo ""
            echo "💡 AUTOMATIC RECOVERY:"
            echo ""
            echo "Deployment will AUTOMATICALLY switch to Full Cleanup mode"
            echo "to repair corrupted PostgreSQL data directory."
            echo ""
            return 1
        fi

        warning "PostgreSQL slow but no corruption indicators found"
        info "Proceeding with deployment - post-start checks will catch issues"
    else
        success "PostgreSQL is healthy and accepting connections"
    fi

    return 0
}
