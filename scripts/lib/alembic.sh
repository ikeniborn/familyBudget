#!/bin/bash
#
# alembic.sh - Alembic Database Migrations Management
#
# Module for managing database migrations using Alembic.
# Replaces the old schema-based migration system with proper versioned migrations.
#
# Dependencies: config.sh, utils.sh, docker.sh
#
# Functions:
#   - alembic_check_status()   - Check current migration version
#   - alembic_check_pending()  - Check for pending migrations
#   - alembic_upgrade()        - Apply all pending migrations
#   - alembic_downgrade()      - Rollback last migration
#   - alembic_reset()          - Full database reset (DROP + CREATE + UPGRADE)
#   - alembic_history()        - Show migration history
#

# =============================================================================
# ALEMBIC CONFIGURATION
# =============================================================================

# Alembic command wrapper (runs inside backend container)
# Must specify config file path and run from /app directory
alembic_cmd() {
    local alembic_args="$*"
    compose_cmd exec -T backend bash -c "cd /app && alembic -c backend/db/migrations/alembic.ini $alembic_args"
}

# =============================================================================
# STATUS CHECK FUNCTIONS
# =============================================================================

# Check current Alembic migration version
# Returns: 0 if success, 1 if error
# Outputs: Current revision ID
alembic_check_status() {
    step "Checking current Alembic migration version..."

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        error "PostgreSQL service is not healthy, cannot check migration status"
        return 1
    fi

    # Check current revision
    local current_revision=$(alembic_cmd current 2>/dev/null | tail -1)

    if [[ -z "$current_revision" ]]; then
        warning "No Alembic migrations applied yet (fresh database)"
        info "Current revision: (empty)"
        return 0
    fi

    info "Current Alembic revision: $current_revision"
    return 0
}

# Check for pending Alembic migrations
# Returns: 0 if no pending, 1 if pending migrations exist
alembic_check_pending() {
    step "Checking for pending Alembic migrations..."

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        error "PostgreSQL service is not healthy"
        return 1
    fi

    # Get current revision
    local current=$(alembic_cmd current 2>/dev/null | tail -1 | awk '{print $1}')

    # Get head revision
    local head=$(alembic_cmd heads 2>/dev/null | tail -1 | awk '{print $1}')

    if [[ -z "$current" ]]; then
        warning "No migrations applied (fresh database)"
        info "Pending migrations: ALL (upgrade to: $head)"
        return 1
    fi

    if [[ "$current" == "$head" ]]; then
        success "Database is up to date (revision: $current)"
        return 0
    else
        warning "Database needs migration"
        info "Current revision: $current"
        info "Target revision:  $head"
        return 1
    fi
}

# Show Alembic migration history
# Returns: 0 if success
alembic_history() {
    step "Alembic migration history..."

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        error "PostgreSQL service is not healthy"
        return 1
    fi

    info "Fetching migration history..."
    alembic_cmd history --verbose

    return 0
}

# =============================================================================
# MIGRATION EXECUTION FUNCTIONS
# =============================================================================

# Apply all pending Alembic migrations (upgrade to head)
# Returns: 0 if success, 1 if error
# Usage: alembic_upgrade [target_revision]
#   target_revision: Optional revision ID (default: head)
alembic_upgrade() {
    local target="${1:-head}"

    step "Applying Alembic migrations (target: $target)..."

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        error "PostgreSQL service is not healthy, cannot apply migrations"
        return 1
    fi

    # Check current status
    alembic_check_status

    # Apply migrations
    info "Executing: alembic upgrade $target"

    if alembic_cmd upgrade "$target" >> "$LOG_FILE" 2>&1; then
        success "Alembic migrations applied successfully"

        # Show new revision
        alembic_check_status

        return 0
    else
        error "Alembic upgrade failed!"
        cat "$LOG_FILE" | tail -20
        return 1
    fi
}

# Rollback last Alembic migration (downgrade -1)
# Returns: 0 if success, 1 if error
# Usage: alembic_downgrade [steps]
#   steps: Optional number of steps to downgrade (default: 1)
alembic_downgrade() {
    local steps="${1:--1}"

    warning "DANGER: Rolling back Alembic migration (downgrade $steps)"

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        error "PostgreSQL service is not healthy, cannot rollback migrations"
        return 1
    fi

    # Check current status
    alembic_check_status

    # Confirm downgrade
    read -p "Are you sure you want to rollback migrations? This may LOSE DATA! (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        info "Rollback cancelled by user"
        return 1
    fi

    # Execute downgrade
    info "Executing: alembic downgrade $steps"

    if alembic_cmd downgrade "$steps" >> "$LOG_FILE" 2>&1; then
        success "Alembic downgrade completed"

        # Show new revision
        alembic_check_status

        return 0
    else
        error "Alembic downgrade failed!"
        cat "$LOG_FILE" | tail -20
        return 1
    fi
}

# Full database reset with Alembic (DROP + CREATE + UPGRADE)
# WARNING: This will DELETE ALL DATA!
# Returns: 0 if success, 1 if error
alembic_reset() {
    error "DANGER: Full database reset requested!"
    warning "This will DELETE ALL DATA and recreate the database from scratch!"

    # Confirm reset
    read -p "Type 'DELETE ALL DATA' to confirm database reset: " confirm
    if [[ "$confirm" != "DELETE ALL DATA" ]]; then
        info "Database reset cancelled by user"
        return 1
    fi

    step "Resetting database with Alembic..."

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        error "PostgreSQL service is not healthy"
        return 1
    fi

    # Step 1: Drop database
    info "Step 1: Dropping database 'familybudget'..."
    if ! compose_cmd exec -T postgres psql -U familybudget -c "DROP DATABASE IF EXISTS familybudget;" postgres >> "$LOG_FILE" 2>&1; then
        error "Failed to drop database"
        return 1
    fi

    # Step 2: Create database
    info "Step 2: Creating database 'familybudget'..."
    if ! compose_cmd exec -T postgres psql -U familybudget -c "CREATE DATABASE familybudget;" postgres >> "$LOG_FILE" 2>&1; then
        error "Failed to create database"
        return 1
    fi

    # Step 3: Apply all migrations
    info "Step 3: Applying Alembic migrations from scratch..."
    if ! alembic_upgrade head; then
        error "Failed to apply migrations after database reset"
        return 1
    fi

    success "Database reset completed successfully"
    return 0
}

# =============================================================================
# MIGRATION CREATION (for development)
# =============================================================================

# Create new Alembic migration
# Usage: alembic_create_migration "migration_message"
alembic_create_migration() {
    local message="$1"

    if [[ -z "$message" ]]; then
        error "Migration message is required"
        info "Usage: alembic_create_migration \"add_new_table\""
        return 1
    fi

    step "Creating new Alembic migration: $message"

    # Execute alembic revision
    info "Executing: alembic revision -m \"$message\""

    if alembic_cmd revision -m "$message"; then
        success "Migration created successfully"
        info "Edit migration file in: backend/db/migrations/versions/"
        return 0
    else
        error "Failed to create migration"
        return 1
    fi
}

# Create auto-generated Alembic migration (from SQLModel changes)
# Usage: alembic_autogenerate_migration "migration_message"
alembic_autogenerate_migration() {
    local message="$1"

    if [[ -z "$message" ]]; then
        error "Migration message is required"
        info "Usage: alembic_autogenerate_migration \"add_user_preferences\""
        return 1
    fi

    step "Auto-generating Alembic migration: $message"

    # Execute alembic revision --autogenerate
    info "Executing: alembic revision --autogenerate -m \"$message\""

    if alembic_cmd revision --autogenerate -m "$message"; then
        success "Migration auto-generated successfully"
        warning "IMPORTANT: Review generated migration file before applying!"
        info "Migration file location: backend/db/migrations/versions/"
        return 0
    else
        error "Failed to auto-generate migration"
        return 1
    fi
}

# =============================================================================
# MAIN MIGRATION RUNNER (replaces run_migrations.sh logic)
# =============================================================================

# Main migration function (called by deploy.sh)
# Checks for pending migrations and applies them
# Also runs bootstrap script to create first admin user
# Returns: 0 if success, 1 if error
run_alembic_migrations() {
    if [[ "$RUN_MIGRATIONS" != "true" ]]; then
        info "Migrations disabled (RUN_MIGRATIONS=false)"
        return 0
    fi

    step "Running Alembic database migrations..."

    # Check if postgres service is healthy
    if ! compose_cmd ps | grep -q "familybudget-postgres.*healthy"; then
        error "PostgreSQL service is not healthy, cannot run migrations"
        return 1
    fi

    # Check for pending migrations
    if alembic_check_pending; then
        info "No pending migrations, database is up to date"
    else
        # Apply pending migrations
        if ! alembic_upgrade head; then
            error "Database migrations failed"
            return 1
        fi
        success "Database migrations completed successfully"
    fi

    # Admin user is created automatically by baseline migration (v5.1.0+)
    # The migration reads ADMIN_TELEGRAM_ID from environment and creates admin if not exists
    # See: backend/db/migrations/versions/20251110_e2558a31af07_baseline_v5_1_0_consolidated.py
    info "Admin user created automatically during migration (via ADMIN_TELEGRAM_ID)"

    return 0
}

# =============================================================================
# EXPORTS
# =============================================================================

# Export functions for use in other scripts
export -f alembic_cmd
export -f alembic_check_status
export -f alembic_check_pending
export -f alembic_history
export -f alembic_upgrade
export -f alembic_downgrade
export -f alembic_reset
export -f alembic_create_migration
export -f alembic_autogenerate_migration
export -f run_alembic_migrations
