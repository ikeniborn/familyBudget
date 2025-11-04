#!/bin/bash
# ============================================================================
# Script: reapply_migration_013.sh
# Description: Re-apply migration 013 after content changes (Development Mode)
# ============================================================================
#
# PROBLEM:
#   Migration 013 was modified but deploy script skipped it because
#   schema_migrations table tracks by filename, not content.
#
# SOLUTION:
#   1. Remove tracking record for migration 013
#   2. Re-apply the updated migration
#   3. Verify results in t_recommended_amounts
#
# USAGE:
#   # On production server:
#   cd ~/familyBudget
#   ./scripts/reapply_migration_013.sh
#
# ============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
MIGRATION_FILE="013_create_recommended_amounts_table.sql"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}[$(date +'%H:%M:%S')]${NC} ✓ $1"; }
error() { echo -e "${RED}[$(date +'%H:%M:%S')]${NC} ✗ $1"; }
warning() { echo -e "${YELLOW}[$(date +'%H:%M:%S')]${NC} ⚠ $1"; }

# ============================================================================
# Step 1: Verify prerequisites
# ============================================================================

log "========================================"
log "Re-apply Migration 013"
log "========================================"
echo ""

# Check if running from git repository
if [[ ! -d "$PROJECT_ROOT/.git" ]]; then
    error "Must run from git repository directory"
    exit 1
fi

# Check if migration file exists
if [[ ! -f "$PROJECT_ROOT/backend/db/migrations/$MIGRATION_FILE" ]]; then
    error "Migration file not found: $MIGRATION_FILE"
    exit 1
fi

# Check if docker compose is running
if ! docker compose ps | grep -q "familybudget-postgres.*Up"; then
    error "PostgreSQL container is not running"
    error "Run: docker compose up -d postgres"
    exit 1
fi

success "Prerequisites verified"
echo ""

# ============================================================================
# Step 2: Show current state
# ============================================================================

log "Checking current migration status..."

# Check if migration 013 is tracked
MIGRATION_EXISTS=$(docker compose exec -T postgres psql -U familybudget familybudget -t -c \
    "SELECT EXISTS(SELECT 1 FROM schema_migrations WHERE migration_file = '$MIGRATION_FILE');" \
    2>/dev/null | tr -d ' \n')

if [[ "$MIGRATION_EXISTS" == "t" ]]; then
    warning "Migration 013 is marked as applied in schema_migrations"

    APPLIED_AT=$(docker compose exec -T postgres psql -U familybudget familybudget -t -c \
        "SELECT applied_at FROM schema_migrations WHERE migration_file = '$MIGRATION_FILE';" \
        2>/dev/null | xargs)

    log "  Applied at: $APPLIED_AT"
else
    log "Migration 013 not found in schema_migrations (will apply fresh)"
fi

# Check t_recommended_amounts table
TABLE_EXISTS=$(docker compose exec -T postgres psql -U familybudget familybudget -t -c \
    "SELECT EXISTS(SELECT FROM information_schema.tables WHERE table_name = 't_recommended_amounts');" \
    2>/dev/null | tr -d ' \n')

if [[ "$TABLE_EXISTS" == "t" ]]; then
    RECORD_COUNT=$(docker compose exec -T postgres psql -U familybudget familybudget -t -c \
        "SELECT COUNT(*) FROM t_recommended_amounts;" 2>/dev/null | tr -d ' ')

    CATEGORY_COUNT=$(docker compose exec -T postgres psql -U familybudget familybudget -t -c \
        "SELECT COUNT(*) FROM t_recommended_amounts WHERE article_id IS NOT NULL;" 2>/dev/null | tr -d ' ')

    log "Current t_recommended_amounts state:"
    log "  Total records: $RECORD_COUNT"
    log "  Category-specific: $CATEGORY_COUNT"
    log "  Global: $((RECORD_COUNT - CATEGORY_COUNT))"
else
    log "Table t_recommended_amounts does not exist yet"
fi

echo ""

# ============================================================================
# Step 3: Confirmation prompt
# ============================================================================

warning "This will:"
warning "  1. DROP t_recommended_amounts table and all data"
warning "  2. Remove migration 013 tracking record"
warning "  3. Re-apply migration 013 with updated logic"
warning "  4. Recalculate recommended amounts"
echo ""

read -p "Continue? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    log "Cancelled by user"
    exit 0
fi

echo ""

# ============================================================================
# Step 4: Drop table and remove tracking
# ============================================================================

log "Step 1/3: Cleaning up old migration state..."

docker compose exec -T postgres psql -U familybudget familybudget > /dev/null 2>&1 <<EOF
-- Drop table (CASCADE to drop dependent functions)
DROP TABLE IF EXISTS t_recommended_amounts CASCADE;

-- Drop functions
DROP FUNCTION IF EXISTS k_means_1d(numeric[], integer) CASCADE;
DROP FUNCTION IF EXISTS smart_round(numeric) CASCADE;
DROP FUNCTION IF EXISTS calculate_recommended_amounts(integer, text, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE;

-- Remove tracking record
DELETE FROM schema_migrations WHERE migration_file = '$MIGRATION_FILE';
EOF

if [[ $? -eq 0 ]]; then
    success "Old migration state cleaned"
else
    error "Failed to clean migration state"
    exit 1
fi

echo ""

# ============================================================================
# Step 5: Re-apply migration
# ============================================================================

log "Step 2/3: Re-applying migration 013..."

if docker compose exec -T postgres psql -U familybudget familybudget \
    < "$PROJECT_ROOT/backend/db/migrations/$MIGRATION_FILE" > /dev/null 2>&1; then
    success "Migration 013 re-applied successfully"
else
    error "Failed to apply migration 013"
    error "Check migration file for syntax errors"
    exit 1
fi

# Add tracking record
docker compose exec -T postgres psql -U familybudget familybudget > /dev/null 2>&1 <<EOF
INSERT INTO schema_migrations (migration_file, execution_time_ms, checksum)
VALUES ('$MIGRATION_FILE', 0, 'reapplied')
ON CONFLICT (migration_file) DO NOTHING;
EOF

echo ""

# ============================================================================
# Step 6: Run recalculation
# ============================================================================

log "Step 3/3: Running recalculation..."

docker compose exec -T postgres psql -U familybudget familybudget > /dev/null 2>&1 <<'SQL'
-- Full recalculation
SELECT recalculate_recommended_amounts();
SQL

if [[ $? -eq 0 ]]; then
    success "Recalculation completed"
else
    warning "Recalculation may have failed (check if there's enough transaction data)"
fi

echo ""

# ============================================================================
# Step 7: Verify results
# ============================================================================

log "========================================"
log "Verification Results"
log "========================================"
echo ""

# Get counts
TOTAL=$(docker compose exec -T postgres psql -U familybudget familybudget -t -c \
    "SELECT COUNT(*) FROM t_recommended_amounts;" 2>/dev/null | tr -d ' ')

CATEGORY_SPECIFIC=$(docker compose exec -T postgres psql -U familybudget familybudget -t -c \
    "SELECT COUNT(*) FROM t_recommended_amounts WHERE article_id IS NOT NULL;" 2>/dev/null | tr -d ' ')

GLOBAL=$(docker compose exec -T postgres psql -U familybudget familybudget -t -c \
    "SELECT COUNT(*) FROM t_recommended_amounts WHERE article_id IS NULL;" 2>/dev/null | tr -d ' ')

log "t_recommended_amounts:"
log "  Total records: $TOTAL"
log "  Category-specific: $CATEGORY_SPECIFIC"
log "  Global: $GLOBAL"

# Show sample data
echo ""
log "Sample category-specific recommendations:"
docker compose exec -T postgres psql -U familybudget familybudget -c \
    "SELECT
        a.name as category,
        ra.type,
        ra.record_type,
        ra.amounts,
        ra.metadata->>'sample_size' as sample_size,
        ra.metadata->>'source' as source
     FROM t_recommended_amounts ra
     LEFT JOIN t_d_article a ON ra.article_id = a.id AND a.is_current = true
     WHERE ra.article_id IS NOT NULL
     ORDER BY ra.last_updated DESC
     LIMIT 5;" 2>/dev/null

echo ""

# ============================================================================
# Success
# ============================================================================

if [[ $CATEGORY_SPECIFIC -gt 0 ]]; then
    success "✓ Migration 013 re-applied successfully!"
    success "✓ Category-specific recommendations created: $CATEGORY_SPECIFIC"
    log ""
    log "Next steps:"
    log "  1. Test web interface at https://budget-dev.ikeniborn.ru/"
    log "  2. Change category and verify dynamic buttons update"
    log "  3. Check API endpoint: /api/v1/analytics/recommended-amounts"
else
    warning "Migration applied but no category-specific recommendations created"
    warning "This is normal if:"
    warning "  - Transaction history is insufficient (need 20+ transactions per category)"
    warning "  - No transactions in last 90 days"
    log ""
    log "To manually trigger calculation:"
    log "  docker compose exec -T postgres psql -U familybudget familybudget -c \"SELECT recalculate_recommended_amounts();\""
fi

echo ""
log "Done!"
