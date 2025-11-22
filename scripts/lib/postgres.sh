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

    # Remove stale postmaster.pid lock file (from failed startup attempts)
    if [[ -f "$postgres_data_dir/postmaster.pid" ]]; then
        warning "Found stale PostgreSQL lock file (postmaster.pid)"
        info "Removing lock file from previous failed startup..."
        if sudo rm -f "$postgres_data_dir/postmaster.pid"; then
            success "Lock file removed"
        else
            warning "Failed to remove lock file (continuing anyway)"
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

    # Remove stale postmaster.pid lock file (from failed startup attempts)
    if [[ -f "$postgres_data_dir/postmaster.pid" ]]; then
        warning "Found stale PostgreSQL lock file (postmaster.pid)"
        info "Removing lock file from previous failed startup..."
        if sudo rm -f "$postgres_data_dir/postmaster.pid"; then
            success "Lock file removed"
        else
            warning "Failed to remove lock file (continuing anyway)"
        fi
    fi

    # Check and fix ownership UNCONDITIONALLY (even if PostgreSQL is running)
    local current_owner=$(stat -c '%u:%g' "$postgres_data_dir" 2>/dev/null || echo "unknown")

    if [[ "$current_owner" != "$target_uid:$target_gid" ]]; then
        warning "Incorrect ownership detected: $current_owner (expected $target_uid:$target_gid)"
        info "Fixing ownership recursively (CRITICAL for PostgreSQL startup)..."

        # Stop PostgreSQL if running (permissions must be fixed before start)
        if docker ps --filter "name=familybudget-postgres" --filter "status=running" -q 2>/dev/null | grep -q .; then
            warning "PostgreSQL is running - stopping temporarily to fix permissions..."
            docker compose -f "$DEPLOY_DIR/docker-compose.yml" stop postgres --timeout 30 >> "$LOG_FILE" 2>&1 || true
            sleep 2
        fi

        if sudo chown -R $target_uid:$target_gid "$postgres_data_dir"; then
            success "Ownership corrected to $target_uid:$target_gid (recursive)"
        else
            error "Failed to fix ownership - PostgreSQL may fail to start!"
            return 1
        fi
    else
        # Ownership looks correct on parent - verify recursively
        info "Verifying ownership consistency (parent: $current_owner)..."
        if sudo chown -R $target_uid:$target_gid "$postgres_data_dir" 2>/dev/null; then
            success "PostgreSQL permissions validated: $target_uid:$target_gid (recursive)"
        else
            warning "Failed to recursively verify ownership (continuing anyway)"
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
