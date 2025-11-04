#!/bin/bash
# ============================================================================
# Remote Re-apply Migration 013
# For use on production server via SSH
# ============================================================================

set -e

echo "=== Re-applying Migration 013 on Production ==="
echo ""
echo "⚠️  This will:"
echo "  1. DROP t_recommended_amounts table"
echo "  2. Re-apply migration 013 with updated logic"
echo "  3. Recalculate recommended amounts"
echo ""
read -p "Continue? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Cancelled"
    exit 0
fi

echo ""
echo "Step 1/4: Dropping old table and functions..."

docker exec familybudget-postgres psql -U familybudget familybudget <<'SQL'
-- Drop table and functions
DROP TABLE IF EXISTS t_recommended_amounts CASCADE;
DROP FUNCTION IF EXISTS k_means_1d(numeric[], integer) CASCADE;
DROP FUNCTION IF EXISTS smart_round(numeric) CASCADE;
DROP FUNCTION IF EXISTS calculate_recommended_amounts(integer, text, text, text, integer) CASCADE;
DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE;

-- Remove tracking
DELETE FROM schema_migrations WHERE migration_file = '013_create_recommended_amounts_table.sql';
SQL

echo "✓ Cleanup completed"
echo ""

echo "Step 2/4: Re-applying migration from deployed files..."

docker exec familybudget-postgres psql -U familybudget familybudget \
    -f /docker-entrypoint-initdb.d/013_create_recommended_amounts_table.sql

echo "✓ Migration applied"
echo ""

echo "Step 3/4: Adding tracking record..."

docker exec familybudget-postgres psql -U familybudget familybudget <<'SQL'
INSERT INTO schema_migrations (migration_file, execution_time_ms, checksum)
VALUES ('013_create_recommended_amounts_table.sql', 0, 'reapplied')
ON CONFLICT (migration_file) DO NOTHING;
SQL

echo "✓ Tracking updated"
echo ""

echo "Step 4/4: Running recalculation..."

docker exec familybudget-postgres psql -U familybudget familybudget <<'SQL'
SELECT recalculate_recommended_amounts();

-- Show results
SELECT
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE article_id IS NULL) as global,
    COUNT(*) FILTER (WHERE article_id IS NOT NULL) as category_specific
FROM t_recommended_amounts;
SQL

echo ""
echo "=== Done! ==="
echo ""
echo "Verify at: https://budget-dev.ikeniborn.ru/"
echo "  1. Open transaction modal"
echo "  2. Change category"
echo "  3. Check if amount buttons update"
