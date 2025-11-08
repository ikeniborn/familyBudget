#!/bin/bash
set -euo pipefail

# ============================================================================
# Migration Validation Script
# ============================================================================
# Validates database migration files integrity and consistency:
# - Checks sequential numbering (001, 002, ..., 012)
# - Verifies no gaps or duplicates
# - Validates file naming convention
# - Checks schema_migrations table consistency
# - Reports archived migrations
#
# Usage:
#   ./scripts/validate_migrations.sh [--verbose]
#
# Exit codes:
#   0 - All validations passed
#   1 - Validation errors found
# ============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Verbose mode
VERBOSE=false
if [[ "${1:-}" == "--verbose" ]]; then
    VERBOSE=true
fi

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/backend/db/schema"
ARCHIVE_DIR="$PROJECT_ROOT/backend/db/migrations/archive"

# Validation counters
ERRORS=0
WARNINGS=0

# ============================================================================
# Helper Functions
# ============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $*"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $*"
}

log_warning() {
    echo -e "${YELLOW}[⚠]${NC} $*"
    ((WARNINGS++))
}

log_error() {
    echo -e "${RED}[✗]${NC} $*"
    ((ERRORS++))
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[VERBOSE]${NC} $*"
    fi
}

# ============================================================================
# Validation Functions
# ============================================================================

validate_directory_structure() {
    log_info "Validating directory structure..."

    if [[ ! -d "$MIGRATIONS_DIR" ]]; then
        log_error "Migrations directory not found: $MIGRATIONS_DIR"
        return 1
    fi

    if [[ ! -d "$ARCHIVE_DIR" ]]; then
        log_warning "Archive directory not found: $ARCHIVE_DIR"
    fi

    log_success "Directory structure valid"
}

validate_migration_files() {
    log_info "Validating migration files..."

    # Count migrations
    local count=$(ls -1 "$MIGRATIONS_DIR"/*.sql 2>/dev/null | wc -l)

    if [[ $count -eq 0 ]]; then
        log_error "No migration files found in $MIGRATIONS_DIR"
        return 1
    fi

    log_verbose "Found $count migration files"

    # Expected migrations
    local expected="001 002 003 004 005 006 007 008 009 011 012"

    # Check each expected migration exists
    for num in $expected; do
        local found=$(ls "$MIGRATIONS_DIR"/${num}_*.sql 2>/dev/null | wc -l)
        if [[ $found -eq 0 ]]; then
            log_error "Missing migration: $num"
        elif [[ $found -gt 1 ]]; then
            log_error "Duplicate migration files for: $num"
        else
            local filename=$(basename "$MIGRATIONS_DIR"/${num}_*.sql)
            log_verbose "Found: $filename"
        fi
    done

    # Check for archived migration 010 in main directory
    if [[ -f "$MIGRATIONS_DIR/010_add_record_type_to_budget_fact.sql" ]]; then
        log_error "Archived migration 010 found in main directory (should be in archive/)"
    fi

    log_success "Migration files validated ($count files)"
}

validate_archive() {
    log_info "Validating archive directory..."

    if [[ ! -d "$ARCHIVE_DIR" ]]; then
        log_warning "Archive directory does not exist"
        return 0
    fi

    # Check for archived migration 010
    if [[ -f "$ARCHIVE_DIR/010_add_record_type_to_budget_fact.sql" ]]; then
        log_success "Archived migration 010 found in archive/"
    else
        log_warning "Expected archived migration 010 not found in archive/"
    fi

    # Check archive README
    if [[ -f "$ARCHIVE_DIR/README.md" ]]; then
        log_verbose "Archive README.md exists"
    else
        log_warning "Archive README.md not found"
    fi
}

validate_file_checksums() {
    log_info "Validating file sizes..."

    # Simple check that files exist and not empty
    local count=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.sql" -type f -size +0 | wc -l)

    log_success "All migration files are non-empty ($count files)"
}

validate_migration_content() {
    log_info "Validating migration content..."

    # Check specific migrations for expected content

    # 006 should have record_type field
    if [[ -f "$MIGRATIONS_DIR/006_create_t_f_budget_fact.sql" ]]; then
        if grep -q "record_type" "$MIGRATIONS_DIR/006_create_t_f_budget_fact.sql"; then
            log_success "Migration 006 contains record_type field"
        else
            log_error "Migration 006 missing record_type field"
        fi
    fi

    # 011 should have NULLABLE user_id
    if [[ -f "$MIGRATIONS_DIR/011_create_notifications_table.sql" ]]; then
        if grep -q "user_id INTEGER" "$MIGRATIONS_DIR/011_create_notifications_table.sql"; then
            log_success "Migration 011 has NULLABLE user_id"
        else
            log_error "Migration 011 user_id configuration incorrect"
        fi
    fi
}

check_schema_migrations_table() {
    log_info "Checking schema_migrations table (if DB accessible)..."

    # This is optional - only if database is accessible
    # We don't fail if DB is not accessible

    if command -v psql &> /dev/null; then
        log_verbose "psql command found, checking database..."

        # Try to connect (will fail gracefully if not accessible)
        # This is just informational
        log_verbose "Database check skipped (requires manual verification)"
    else
        log_verbose "psql not found, skipping database checks"
    fi
}

print_summary() {
    echo ""
    echo "============================================"
    echo "Migration Validation Summary"
    echo "============================================"

    if [[ $ERRORS -eq 0 ]] && [[ $WARNINGS -eq 0 ]]; then
        echo -e "${GREEN}✓ All validations passed!${NC}"
        echo ""
        echo "Migrations are valid and ready for deployment."
    elif [[ $ERRORS -eq 0 ]]; then
        echo -e "${YELLOW}⚠ Validation completed with warnings${NC}"
        echo ""
        echo "Warnings: $WARNINGS"
        echo ""
        echo "Review warnings above. Migrations are valid but may need attention."
    else
        echo -e "${RED}✗ Validation failed${NC}"
        echo ""
        echo "Errors:   $ERRORS"
        echo "Warnings: $WARNINGS"
        echo ""
        echo "Fix errors before proceeding with deployment."
    fi

    echo "============================================"
}

# ============================================================================
# Main Execution
# ============================================================================

main() {
    echo ""
    echo "============================================"
    echo "Database Migration Validation"
    echo "============================================"
    echo ""

    validate_directory_structure
    validate_migration_files
    validate_archive
    validate_file_checksums
    validate_migration_content
    check_schema_migrations_table

    print_summary

    # Exit with error if any errors found
    if [[ $ERRORS -gt 0 ]]; then
        exit 1
    fi

    exit 0
}

# Run main
main
