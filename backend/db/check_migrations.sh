#!/bin/bash

# ============================================================================
# Script: check_migrations.sh
# Description: Check migration status and database health
# Author: ClaudeCode Implementation System
# Date: 2025-10-09
# Task: TASK-007
# ============================================================================

set -e
set -u

# ============================================================================
# Configuration
# ============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="${SCRIPT_DIR}/migrations"

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-familybudget_db}"
DB_USER="${DB_USER:-familybudget}"
DB_PASSWORD="${DB_PASSWORD:-}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================================================
# Functions
# ============================================================================

log() {
    echo -e "${BLUE}$1${NC}"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Execute SQL query
query() {
    PGPASSWORD="${DB_PASSWORD}" psql -h "${DB_HOST}" -p "${DB_PORT}" -U "${DB_USER}" -d "${DB_NAME}" -t -c "$1" 2>/dev/null
}

# Check database connection
check_connection() {
    if query "SELECT 1" &>/dev/null; then
        log_success "Database connection"
        return 0
    else
        log_error "Database connection failed"
        return 1
    fi
}

# Check tables exist
check_tables() {
    log ""
    log "=== Database Tables ==="

    local tables=(
        "t_d_user:Users dimension"
        "t_d_article:Articles dimension"
        "t_d_financial_center:Financial centers dimension"
        "t_d_cost_center:Cost centers dimension"
        "t_d_article_hierarchy:Hierarchy closure table"
        "t_f_budget_fact:Budget facts"
    )

    local missing=0

    for table_info in "${tables[@]}"; do
        IFS=":" read -r table desc <<< "${table_info}"

        local count=$(query "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '${table}'")

        if [ "${count}" -gt 0 ]; then
            log_success "${desc} (${table})"
        else
            log_error "${desc} (${table}) - MISSING"
            missing=$((missing + 1))
        fi
    done

    return ${missing}
}

# Check triggers
check_triggers() {
    log ""
    log "=== Triggers ==="

    local triggers=$(query "SELECT COUNT(*) FROM information_schema.triggers WHERE trigger_name LIKE 'trg_%'")

    if [ "${triggers}" -ge 7 ]; then
        log_success "${triggers} triggers installed"
    else
        log_warning "Only ${triggers} triggers found (expected 7+)"
    fi
}

# Check indexes
check_indexes() {
    log ""
    log "=== Indexes ==="

    local indexes=$(query "SELECT COUNT(*) FROM pg_indexes WHERE indexname LIKE 'idx_%'")

    if [ "${indexes}" -ge 60 ]; then
        log_success "${indexes} indexes created"
    else
        log_warning "Only ${indexes} indexes found (expected 60+)"
    fi
}

# Check partitions
check_partitions() {
    log ""
    log "=== Partitions (t_f_budget_fact) ==="

    local partitions=$(query "SELECT COUNT(*) FROM pg_class WHERE relname LIKE 't_f_budget_fact_%'")

    if [ "${partitions}" -ge 24 ]; then
        log_success "${partitions} partitions created"
    else
        log_warning "Only ${partitions} partitions found (expected 24+)"
    fi
}

# Check applied migrations
check_migrations() {
    log ""
    log "=== Applied Migrations ==="

    if ! query "SELECT 1 FROM schema_migrations LIMIT 1" &>/dev/null; then
        log_warning "schema_migrations table not found"
        log_warning "Run ./run_migrations.sh to initialize"
        return 1
    fi

    local applied=$(query "SELECT COUNT(*) FROM schema_migrations")
    local total=$(ls "${MIGRATIONS_DIR}"/*.sql 2>/dev/null | wc -l)

    log "Applied: ${applied} / ${total}"

    if [ "${applied}" -eq "${total}" ]; then
        log_success "All migrations applied"
    else
        log_warning "$((total - applied)) pending migration(s)"

        # List pending
        for file in $(ls "${MIGRATIONS_DIR}"/*.sql | sort -V); do
            local basename=$(basename "${file}")
            local exists=$(query "SELECT COUNT(*) FROM schema_migrations WHERE migration_file = '${basename}'")

            if [ "${exists}" -eq 0 ]; then
                log_warning "  Pending: ${basename}"
            fi
        done
    fi
}

# Check data integrity
check_integrity() {
    log ""
    log "=== Data Integrity ==="

    # Check for duplicate current records
    local dup_users=$(query "SELECT COUNT(*) FROM (SELECT telegram_id FROM t_d_user WHERE is_current = TRUE GROUP BY telegram_id HAVING COUNT(*) > 1) x")
    if [ "${dup_users}" -eq 0 ]; then
        log_success "No duplicate current users"
    else
        log_error "${dup_users} users with duplicate current records"
    fi

    # Check hierarchy integrity
    local orphaned=$(query "SELECT COUNT(*) FROM t_d_article a WHERE a.parent_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM t_d_article p WHERE p.id = a.parent_id)")
    if [ "${orphaned}" -eq 0 ]; then
        log_success "No orphaned articles"
    else
        log_warning "${orphaned} orphaned articles (parent not found)"
    fi
}

# Show database size
show_size() {
    log ""
    log "=== Database Size ==="

    query "SELECT pg_size_pretty(pg_database_size('${DB_NAME}')) as total_size"
}

# Show table sizes
show_table_sizes() {
    log ""
    log "=== Table Sizes ==="

    query "
    SELECT
        schemaname || '.' || tablename as table,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename LIKE 't_%'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10
    "
}

# ============================================================================
# Main
# ============================================================================

main() {
    log "========================================"
    log "Family Budget - Migration Status"
    log "========================================"

    if ! check_connection; then
        log_error "Cannot connect to database"
        log "Host: ${DB_HOST}:${DB_PORT}"
        log "Database: ${DB_NAME}"
        log "User: ${DB_USER}"
        exit 1
    fi

    check_tables || log_error "Some tables are missing!"
    check_triggers
    check_indexes
    check_partitions
    check_migrations
    check_integrity
    show_size
    show_table_sizes

    log ""
    log "========================================"
    log "Check complete"
    log "========================================"
}

main "$@"
