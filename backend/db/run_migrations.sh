#!/bin/bash

# ============================================================================
# Script: run_migrations.sh
# Description: Master migration runner for Family Budget database
# Author: ClaudeCode Implementation System
# Date: 2025-10-09
# Task: TASK-007
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/schema"
# Use /app/logs mounted volume instead of read-only backend/db directory
LOG_FILE="/app/logs/migrations.log"
MIGRATION_TRACKING_TABLE="schema_migrations"

# Database connection parameters
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-familybudget_db}"
DB_USER="${DB_USER:-familybudget}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# Functions
# ============================================================================

log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✓ $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ✗ $1"
}

log_warning() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ⚠ $1"
}

# Check if psql is installed
check_psql() {
    if ! command -v psql &> /dev/null; then
        log_error "psql command not found. Please install PostgreSQL client."
        exit 1
    fi
}

# Test database connection
test_connection() {
    log "Testing database connection..."

    if PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c "SELECT 1" &>/dev/null; then
        log_success "Database connection successful"
        return 0
    else
        log_error "Cannot connect to database"
        log_error "Host: ${DB_HOST}:${DB_PORT}"
        log_error "Database: ${DB_NAME}"
        log_error "User: ${DB_USER}"
        return 1
    fi
}

# Create migration tracking table
create_tracking_table() {
    log "Creating migration tracking table..."

    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" <<EOF
CREATE TABLE IF NOT EXISTS ${MIGRATION_TRACKING_TABLE} (
    id SERIAL PRIMARY KEY,
    migration_file VARCHAR(255) NOT NULL UNIQUE,
    applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    execution_time_ms INT,
    checksum VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_schema_migrations_file
    ON ${MIGRATION_TRACKING_TABLE}(migration_file);

COMMENT ON TABLE ${MIGRATION_TRACKING_TABLE} IS
    'Tracks applied database migrations';
EOF

    if [ $? -eq 0 ]; then
        log_success "Migration tracking table ready"
    else
        log_error "Failed to create tracking table"
        exit 1
    fi
}

# Check if migration was already applied
is_migration_applied() {
    local migration_file="$1"

    local count=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c \
        "SELECT COUNT(*) FROM ${MIGRATION_TRACKING_TABLE} WHERE migration_file = '${migration_file}'" | tr -d ' ')

    if [ "${count}" -gt 0 ]; then
        return 0  # Already applied
    else
        return 1  # Not applied
    fi
}

# Check if migration file changed since last application
check_migration_changed() {
    local migration_file="$1"
    local migration_path="${MIGRATIONS_DIR}/${migration_file}"

    if [ ! -f "${migration_path}" ]; then
        return 1  # File doesn't exist
    fi

    local current_checksum=$(calculate_checksum "${migration_path}")
    local stored_checksum=$(PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c \
        "SELECT checksum FROM ${MIGRATION_TRACKING_TABLE} WHERE migration_file = '${migration_file}'" | tr -d ' ')

    if [ -z "${stored_checksum}" ]; then
        return 1  # No checksum stored (old migration)
    fi

    if [ "${current_checksum}" != "${stored_checksum}" ]; then
        return 0  # Changed
    else
        return 1  # Not changed
    fi
}

# Calculate file checksum
calculate_checksum() {
    local file="$1"
    sha256sum "${file}" | awk '{print $1}'
}

# Apply single migration
apply_migration() {
    local migration_file="$1"
    local migration_path="${MIGRATIONS_DIR}/${migration_file}"
    local is_reapply="${2:-false}"  # Optional parameter: true if reapplying

    if [ ! -f "${migration_path}" ]; then
        log_error "Migration file not found: ${migration_file}"
        return 1
    fi

    if [ "${is_reapply}" = "true" ]; then
        log_warning "Re-applying migration: ${migration_file}"
    else
        log "Applying migration: ${migration_file}"
    fi

    local start_time=$(date +%s%3N)
    local checksum=$(calculate_checksum "${migration_path}")

    # Execute migration
    if PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -f "${migration_path}" >> "${LOG_FILE}" 2>&1; then
        local end_time=$(date +%s%3N)
        local execution_time=$((end_time - start_time))

        # Record or update migration
        if [ "${is_reapply}" = "true" ]; then
            # Update existing record
            PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c \
                "UPDATE ${MIGRATION_TRACKING_TABLE}
                 SET checksum = '${checksum}',
                     applied_at = CURRENT_TIMESTAMP,
                     execution_time_ms = ${execution_time}
                 WHERE migration_file = '${migration_file}'" >> "${LOG_FILE}" 2>&1
        else
            # Insert new record
            PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c \
                "INSERT INTO ${MIGRATION_TRACKING_TABLE} (migration_file, execution_time_ms, checksum)
                 VALUES ('${migration_file}', ${execution_time}, '${checksum}')" >> "${LOG_FILE}" 2>&1
        fi

        if [ "${is_reapply}" = "true" ]; then
            log_success "Migration re-applied successfully (${execution_time}ms)"
        else
            log_success "Migration applied successfully (${execution_time}ms)"
        fi
        return 0
    else
        log_error "Migration failed. Check ${LOG_FILE} for details."
        return 1
    fi
}

# Reapply specific migration (force)
reapply_migration() {
    local migration_file="$1"

    if ! is_migration_applied "${migration_file}"; then
        log_error "Cannot reapply '${migration_file}' - not applied yet. Use 'run' instead."
        return 1
    fi

    log_warning "Force reapplying migration: ${migration_file}"
    log_warning "This will re-execute the migration SQL!"

    apply_migration "${migration_file}" "true"
}

# List pending migrations
list_pending_migrations() {
    log "Checking for pending migrations..."

    local pending=()

    for file in "${MIGRATIONS_DIR}"/*.sql; do
        local basename=$(basename "${file}")

        if ! is_migration_applied "${basename}"; then
            pending+=("${basename}")
        fi
    done

    if [ ${#pending[@]} -eq 0 ]; then
        log_success "No pending migrations"
        return 1
    else
        log_warning "Found ${#pending[@]} pending migration(s):"
        for migration in "${pending[@]}"; do
            echo "  - ${migration}"
        done
        return 0
    fi
}

# Apply all pending migrations
apply_all_migrations() {
    local failed=0
    local applied=0
    local skipped=0
    local changed=0

    log "Starting migration process..."
    echo ""

    # Sort migration files numerically
    for file in $(ls "${MIGRATIONS_DIR}"/*.sql | sort -V); do
        local basename=$(basename "${file}")

        if is_migration_applied "${basename}"; then
            # Check if migration file changed
            if check_migration_changed "${basename}"; then
                log_warning "⚠️  CHANGED: ${basename}"
                log_warning "    Migration file was modified since last application!"
                log_warning "    Use 'reapply ${basename}' to re-run if needed"
                changed=$((changed + 1))
            fi
            skipped=$((skipped + 1))
            continue
        fi

        if apply_migration "${basename}" "false"; then
            applied=$((applied + 1))
        else
            failed=$((failed + 1))
            log_error "Stopping migration process due to failure"
            break
        fi

        echo ""
    done

    echo ""
    log "========================================"
    log "Migration Summary:"
    log "  Applied:  ${applied}"
    log "  Skipped:  ${skipped}"
    if [ ${changed} -gt 0 ]; then
        log_warning "  Changed:  ${changed} (review recommended!)"
    fi
    log "  Failed:   ${failed}"
    log "========================================"

    if [ ${failed} -gt 0 ]; then
        log_error "Migration process completed with errors"
        exit 1
    elif [ ${changed} -gt 0 ]; then
        log_warning "Some migrations were modified after being applied"
        log_warning "Review changes and use 'reapply <file>' if needed"
    else
        log_success "Migration process completed successfully"
    fi
}

# Show migration status
show_status() {
    log "Migration Status:"
    echo ""

    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -c \
        "SELECT
            migration_file,
            applied_at,
            execution_time_ms || 'ms' as duration
         FROM ${MIGRATION_TRACKING_TABLE}
         ORDER BY id;"

    echo ""
    list_pending_migrations || true
}

# Show help
show_help() {
    cat <<EOF
Usage: $0 [COMMAND] [ARGS]

Family Budget Database Migration Runner

Commands:
  run                      Apply all pending migrations (default)
  status                   Show migration status
  reapply <migration.sql>  Force re-apply specific migration
  help                     Show this help message

Environment Variables:
  DB_HOST       Database host (default: localhost)
  DB_PORT       Database port (default: 5432)
  DB_NAME       Database name (default: familybudget_db)
  DB_USER       Database user (default: familybudget)
  DB_PASSWORD   Database password (required)

Examples:
  # Apply all pending migrations
  DB_PASSWORD=secret ./run_migrations.sh

  # Check migration status
  DB_PASSWORD=secret ./run_migrations.sh status

  # Re-apply modified migration
  DB_PASSWORD=secret ./run_migrations.sh reapply 009_create_additional_indexes.sql

  # Using environment file
  set -a && source .env && set +a
  ./run_migrations.sh run

Migration Change Detection:
  - Each migration is tracked with SHA256 checksum
  - If migration file changes after being applied, warning is shown
  - Use 'reapply' command to re-execute changed migration

EOF
}

# ============================================================================
# Main
# ============================================================================

main() {
    local command="${1:-run}"

    case "${command}" in
        run)
            log "========================================"
            log "Family Budget - Database Migrations"
            log "========================================"
            echo ""

            check_psql
            test_connection || exit 1
            create_tracking_table

            echo ""
            apply_all_migrations
            ;;

        status)
            check_psql
            test_connection || exit 1
            create_tracking_table
            show_status
            ;;

        reapply)
            if [ -z "${2:-}" ]; then
                log_error "Missing migration file argument"
                echo ""
                echo "Usage: $0 reapply <migration_file.sql>"
                echo "Example: $0 reapply 009_create_additional_indexes.sql"
                exit 1
            fi

            local migration_file="$2"
            log "========================================"
            log "Family Budget - Migration Reapply"
            log "========================================"
            echo ""

            check_psql
            test_connection || exit 1
            create_tracking_table

            echo ""
            reapply_migration "${migration_file}"
            ;;

        help|--help|-h)
            show_help
            ;;

        *)
            log_error "Unknown command: ${command}"
            echo ""
            show_help
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
