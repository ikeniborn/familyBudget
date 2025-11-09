#!/bin/bash

# ============================================================================
# Script: run_migrations.sh
# Description: Alembic migration runner for Family Budget database
# Author: ClaudeCode Implementation System
# Date: 2025-11-09
# Version: 2.0 (Alembic-based)
# ============================================================================
#
# This script is a wrapper around Alembic for managing database migrations.
# It replaces the old schema-based migration system with proper versioned migrations.
#
# Previous version (v1.0) used backend/db/schema/*.sql files with custom tracking.
# Current version (v2.0) uses Alembic migrations in backend/db/migrations/versions/.
#
# ============================================================================

set -e  # Exit on error
set -u  # Exit on undefined variable

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"
ALEMBIC_INI="${MIGRATIONS_DIR}/alembic.ini"
LOG_FILE="/app/logs/migrations.log"

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
MAGENTA='\033[0;35m'
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

log_info() {
    echo -e "${MAGENTA}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} ℹ $1"
}

# Check if alembic is installed
check_alembic() {
    if ! command -v alembic &> /dev/null; then
        log_error "alembic command not found. Please install Alembic."
        log_error "Run: pip install alembic"
        exit 1
    fi
}

# Check if psql is installed
check_psql() {
    if ! command -v psql &> /dev/null; then
        log_warning "psql command not found (optional for status checks)"
    fi
}

# Test database connection
test_connection() {
    log "Testing database connection..."

    if command -v psql &> /dev/null; then
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
    else
        log_warning "Skipping connection test (psql not available)"
        return 0
    fi
}

# Get current Alembic revision
get_current_revision() {
    local current=$(cd "${MIGRATIONS_DIR}" && alembic current 2>/dev/null | tail -1 | awk '{print $1}' || echo "")
    echo "$current"
}

# Get head Alembic revision
get_head_revision() {
    local head=$(cd "${MIGRATIONS_DIR}" && alembic heads 2>/dev/null | tail -1 | awk '{print $1}' || echo "")
    echo "$head"
}

# Apply all pending migrations (alembic upgrade head)
apply_all_migrations() {
    log "Starting Alembic migration process..."
    echo ""

    local start_time=$(date +%s)

    # Execute alembic upgrade
    log_info "Executing: alembic upgrade head"

    if cd "${MIGRATIONS_DIR}" && alembic upgrade head >> "${LOG_FILE}" 2>&1; then
        local end_time=$(date +%s)
        local execution_time=$((end_time - start_time))

        log_success "Migrations applied successfully (${execution_time}s)"

        # Show new revision
        local new_revision=$(get_current_revision)
        if [ -n "$new_revision" ]; then
            log_info "Current database revision: $new_revision"
        fi

        return 0
    else
        log_error "Alembic upgrade failed. Check ${LOG_FILE} for details."
        log_error "Last 20 lines of log:"
        tail -20 "${LOG_FILE}"
        return 1
    fi
}

# Rollback last migration (alembic downgrade -1)
downgrade_migration() {
    local steps="${1:--1}"

    log_warning "DANGER: Rolling back Alembic migration (downgrade $steps)"
    log_warning "This may LOSE DATA!"

    echo ""
    read -p "Are you sure you want to rollback? Type 'yes' to confirm: " confirm
    if [[ "$confirm" != "yes" ]]; then
        log_info "Rollback cancelled by user"
        return 1
    fi

    echo ""
    log_info "Executing: alembic downgrade $steps"

    if cd "${MIGRATIONS_DIR}" && alembic downgrade "$steps" >> "${LOG_FILE}" 2>&1; then
        log_success "Downgrade completed"

        # Show new revision
        local new_revision=$(get_current_revision)
        if [ -n "$new_revision" ]; then
            log_info "Current database revision: $new_revision"
        else
            log_warning "Database is now at base (no migrations applied)"
        fi

        return 0
    else
        log_error "Alembic downgrade failed. Check ${LOG_FILE} for details."
        tail -20 "${LOG_FILE}"
        return 1
    fi
}

# Show migration status
show_status() {
    log "Alembic Migration Status:"
    echo ""

    # Get current and head revisions
    local current=$(get_current_revision)
    local head=$(get_head_revision)

    if [ -z "$current" ]; then
        log_warning "No migrations applied (fresh database)"
        log_info "Current revision: (empty)"
    else
        log_info "Current revision: $current"
    fi

    if [ -n "$head" ]; then
        log_info "Latest revision:  $head"
    fi

    echo ""

    # Check if database is up to date
    if [ -z "$current" ]; then
        log_warning "Database needs initialization"
        log_info "Run: $0 run"
    elif [ "$current" = "$head" ]; then
        log_success "Database is up to date"
    else
        log_warning "Database needs migration"
        log_info "Run: $0 run"
    fi

    echo ""
    log "Migration History (last 10):"
    echo ""

    cd "${MIGRATIONS_DIR}" && alembic history --verbose | head -30

    return 0
}

# Show current revision only
show_current() {
    local current=$(get_current_revision)

    if [ -z "$current" ]; then
        log_warning "No migrations applied"
        echo "(empty)"
    else
        log_info "Current revision:"
        cd "${MIGRATIONS_DIR}" && alembic current
    fi

    return 0
}

# Show help
show_help() {
    cat <<EOF
Usage: $0 [COMMAND] [ARGS]

Family Budget Alembic Migration Runner

Commands:
  run                      Apply all pending migrations (default)
  status                   Show migration status and history
  current                  Show current database revision
  downgrade [steps]        Rollback migrations (default: -1)
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

  # Rollback last migration
  DB_PASSWORD=secret ./run_migrations.sh downgrade

  # Rollback 2 migrations
  DB_PASSWORD=secret ./run_migrations.sh downgrade -2

  # Using environment file
  set -a && source .env && set +a
  ./run_migrations.sh run

Alembic Workflow:
  1. Development Mode (before v5.0.0):
     - Database schema managed via backend/db/schema/*.sql
     - Full recreation on each deploy
     - Alembic not used

  2. Production Mode (after v5.0.0):
     - Database schema managed via Alembic migrations
     - Incremental migrations only
     - backend/db/schema/ deprecated

Migration Files:
  - Location: backend/db/migrations/versions/
  - Format: YYYYMMDD_REV_description.py
  - Baseline: 20251109_001_baseline_schema_v5_0_0.py

For more info on Alembic, see: https://alembic.sqlalchemy.org/

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
            log "Family Budget - Alembic Migrations"
            log "========================================"
            echo ""

            check_alembic
            check_psql
            test_connection || log_warning "Connection test skipped"

            echo ""
            apply_all_migrations
            ;;

        status)
            check_alembic
            check_psql
            test_connection || log_warning "Connection test skipped"
            show_status
            ;;

        current)
            check_alembic
            show_current
            ;;

        downgrade)
            local steps="${2:--1}"

            log "========================================"
            log "Family Budget - Migration Rollback"
            log "========================================"
            echo ""

            check_alembic
            check_psql
            test_connection || exit 1

            echo ""
            downgrade_migration "$steps"
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
