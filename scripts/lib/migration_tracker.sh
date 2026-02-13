#!/bin/bash
#
# migration_tracker.sh - Migration Change Detection
#
# Module for tracking changes in Alembic migration files
# Detects when existing migrations are modified and triggers reapply (downgrade/upgrade)
#
# Dependencies: config.sh, utils.sh
#

# =============================================================================
# CONFIGURATION
# =============================================================================

# Checksum file location (persistent across deployments)
MIGRATION_CHECKSUMS_FILE="${DEPLOY_DIR}/.migration_checksums"

# =============================================================================
# CHECKSUM FUNCTIONS
# =============================================================================

# Calculate checksums for all migration files
# Returns: sorted list of "checksum filename" pairs
calculate_migration_checksums() {
    local migrations_dir="$1"

    if [[ ! -d "$migrations_dir" ]]; then
        error "Migrations directory not found: $migrations_dir"
        return 1
    fi

    # Find all .py files in versions/ directory and calculate md5 checksums
    find "$migrations_dir/versions" -name "*.py" -type f 2>/dev/null | \
        sort | \
        xargs md5sum 2>/dev/null || true
}

# Save current checksums to file
save_migration_checksums() {
    local migrations_dir="$1"
    local checksums

    checksums=$(calculate_migration_checksums "$migrations_dir")

    if [[ -z "$checksums" ]]; then
        warning "No migration files found to track"
        return 0
    fi

    echo "$checksums" > "$MIGRATION_CHECKSUMS_FILE"
    info "Saved checksums for $(echo "$checksums" | wc -l) migration files"
    return 0
}

# Load previous checksums from file
load_previous_checksums() {
    if [[ -f "$MIGRATION_CHECKSUMS_FILE" ]]; then
        cat "$MIGRATION_CHECKSUMS_FILE"
    else
        echo ""  # No previous checksums
    fi
}

# =============================================================================
# CHANGE DETECTION
# =============================================================================

# Detect changed migration files
# Compares previous and current checksums
# Returns: list of changed migration files (full paths)
detect_changed_migrations() {
    local migrations_dir="$1"
    local previous_checksums="$2"
    local current_checksums

    current_checksums=$(calculate_migration_checksums "$migrations_dir")

    if [[ -z "$previous_checksums" ]]; then
        info "No previous checksums found - first deployment or checksums cleared" >&2
        return 0
    fi

    if [[ -z "$current_checksums" ]]; then
        warning "No current migration files found" >&2
        return 0
    fi

    # Compare checksums and extract changed files
    # Format: "checksum filename" for each line
    local changed_files
    changed_files=$(comm -13 \
        <(echo "$previous_checksums" | sort) \
        <(echo "$current_checksums" | sort) \
        2>/dev/null | awk '{print $2}')

    echo "$changed_files"
}

# Extract revision ID from migration file
# Args: migration_file_path
# Returns: revision ID (12 character hex string)
extract_revision_from_file() {
    local migration_file="$1"

    if [[ ! -f "$migration_file" ]]; then
        error "Migration file not found: $migration_file"
        return 1
    fi

    # Extract revision from line like: revision: str = 'b2232d851007'
    grep -oP "^revision:\s*str\s*=\s*['\"]([a-f0-9]{12})['\"]" "$migration_file" | \
        grep -oP "[a-f0-9]{12}" || echo "unknown"
}

# =============================================================================
# REAPPLY LOGIC
# =============================================================================

# Reapply single migration (downgrade then upgrade)
# Args: revision_id
# Returns: 0 on success, 1 on failure
reapply_single_migration() {
    local revision="$1"

    if [[ -z "$revision" || "$revision" == "unknown" ]]; then
        error "Invalid revision ID: $revision"
        return 1
    fi

    info "Reapplying migration: $revision"
    echo ""

    # Step 1: Downgrade (rollback this migration)
    step "Step 1/2: Downgrading migration $revision..."
    # Use python -m alembic for distroless compatibility (no bash/sh in distroless)
    if ! compose_cmd exec -T backend python -m alembic -c backend/db/migrations/alembic.ini downgrade -1 2>&1 | tee -a "$LOG_FILE"; then
        error "Failed to downgrade migration $revision"
        error "Manual intervention required"
        return 1
    fi

    success "Downgrade completed"
    echo ""

    # Step 2: Upgrade (apply updated version)
    step "Step 2/2: Upgrading migration $revision..."
    # Use python -m alembic for distroless compatibility (no bash/sh in distroless)
    if ! compose_cmd exec -T backend python -m alembic -c backend/db/migrations/alembic.ini upgrade head 2>&1 | tee -a "$LOG_FILE"; then
        error "Failed to upgrade migration $revision"
        error "Database may be in inconsistent state"
        error "Manual intervention required"
        return 1
    fi

    success "Upgrade completed"
    echo ""

    success "Migration $revision reapplied successfully"
    return 0
}

# Reapply multiple changed migrations
# Args: space-separated list of migration files
# Returns: 0 on success, 1 on failure
reapply_changed_migrations() {
    local changed_files="$1"
    local migrations_dir="$2"

    if [[ -z "$changed_files" ]]; then
        return 0
    fi

    warning "⚠️  Detected changed migration files:"
    echo "$changed_files" | while read -r file; do
        local revision=$(extract_revision_from_file "$file")
        echo "  - $(basename "$file") (revision: $revision)"
    done
    echo ""

    # User confirmation on production and staging (extra safety)
    if [[ "${ENVIRONMENT:-}" == "production" || "${ENVIRONMENT:-}" == "staging" ]]; then
        warning "⚠️  Migration changes will be automatically reapplied"
        warning "This will execute downgrade() then upgrade() for each migration"
        echo ""
        warning "Migrations to be reapplied:"
        echo "$changed_files" | while read -r file; do
            local revision=$(extract_revision_from_file "$file")
            echo "  - $(basename "$file") (revision: $revision)"
        done
        echo ""

        if [[ "${ENVIRONMENT:-}" == "production" ]]; then
            warning "⚠️  PRODUCTION ENVIRONMENT - Extra confirmation required"
            read -p "Type 'REAPPLY' to confirm (all caps): " confirm
            echo ""

            if [[ "$confirm" != "REAPPLY" ]]; then
                error "Reapply cancelled by user"
                warning "Database will continue using OLD migration version"
                warning "To apply changes later: ./deploy.sh --reapply-migration <revision>"
                return 1
            fi
        else
            # Staging - simple y/N confirmation
            read -p "Continue with auto-reapply? [y/N]: " -n 1 -r confirm
            echo ""

            if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
                info "Reapply cancelled by user"
                warning "Database will continue using OLD migration version"
                return 1
            fi
        fi
    else
        # Development - auto-reapply without confirmation
        info "Development environment detected - auto-reapplying without confirmation"
    fi
    echo ""

    # Reapply each changed migration
    local failed_migrations=()

    echo "$changed_files" | while read -r file; do
        local revision=$(extract_revision_from_file "$file")

        if [[ "$revision" == "unknown" ]]; then
            warning "Could not extract revision from $file - skipping"
            continue
        fi

        # Reapply this migration
        if ! reapply_single_migration "$revision"; then
            failed_migrations+=("$revision")
        fi
    done

    # Check if any migrations failed
    if [[ ${#failed_migrations[@]} -gt 0 ]]; then
        error "Failed to reapply migrations: ${failed_migrations[*]}"
        return 1
    fi

    success "All changed migrations reapplied successfully"
    return 0
}

# =============================================================================
# PUBLIC API
# =============================================================================

# Main function: check for changed migrations and reapply if needed
# Args: migrations_dir (e.g., "$DEPLOY_DIR/backend/db/migrations")
# Returns: 0 on success, 1 on failure
check_and_reapply_migrations() {
    local migrations_dir="$1"

    if [[ -z "$migrations_dir" ]]; then
        error "Migrations directory not specified"
        return 1
    fi

    step "Checking for changed migrations..."

    # Load previous checksums
    local previous_checksums
    previous_checksums=$(load_previous_checksums)

    # Detect changed migrations
    local changed_files
    changed_files=$(detect_changed_migrations "$migrations_dir" "$previous_checksums")

    if [[ -z "$changed_files" ]]; then
        info "No changed migrations detected"

        # Save current checksums for next deployment
        save_migration_checksums "$migrations_dir"
        return 0
    fi

    # Changed migrations detected - attempt reapply
    if reapply_changed_migrations "$changed_files" "$migrations_dir"; then
        success "Changed migrations handled successfully"

        # Save updated checksums
        save_migration_checksums "$migrations_dir"
        return 0
    else
        warning "Changed migrations detected but not reapplied"
        warning "Checksums not updated - will retry on next deployment"
        return 1
    fi
}

# Manual reapply of specific migration (used with --reapply-migration flag)
# Args: revision_id
# Returns: 0 on success, 1 on failure
manual_reapply_migration() {
    local revision="$1"

    if [[ -z "$revision" ]]; then
        error "Revision ID not specified"
        return 1
    fi

    warning "⚠️  MANUAL REAPPLY REQUESTED"
    warning "This will downgrade and upgrade migration: $revision"
    echo ""

    # Safety confirmation on production
    if [[ "${ENVIRONMENT:-}" == "production" ]]; then
        error "PRODUCTION ENVIRONMENT DETECTED"
        warning "Manual reapply may cause data loss if downgrade() drops data"
        echo ""
        read -p "Type 'REAPPLY' to confirm manual reapply on production: " confirm

        if [[ "$confirm" != "REAPPLY" ]]; then
            error "Manual reapply cancelled"
            return 1
        fi
    fi

    # Perform reapply
    if reapply_single_migration "$revision"; then
        success "Migration $revision reapplied successfully"
        return 0
    else
        error "Failed to reapply migration $revision"
        return 1
    fi
}
