-- Data Consolidation Script for Reference Tables
-- Phase 1: Convert user-isolated to admin-managed shared reference data
--
-- This script should be run AFTER the Alembic migration 5ef4678b70a0
-- which adds the necessary columns and schema changes.
--
-- WARNING: This script will permanently consolidate duplicate reference data.
-- Create a full backup before running this script.

-- ========================================================================
-- PHASE 1: CONSOLIDATE FINANCIAL CENTERS
-- ========================================================================

-- Create temporary mapping table for financial centers
CREATE TEMP TABLE temp_financial_center_mapping AS
WITH deduplicated_centers AS (
    -- Find the "master" record for each unique name (earliest by ID)
    SELECT
        financial_center_name,
        MIN(financial_center_id) as master_id,
        ARRAY_AGG(financial_center_id ORDER BY financial_center_id) as all_ids
    FROM t_d_financial_center
    GROUP BY financial_center_name
    HAVING COUNT(*) > 1
),
mapping_data AS (
    -- Create mapping for duplicates to master records
    SELECT
        unnest(all_ids) as old_id,
        master_id as new_id,
        financial_center_name
    FROM deduplicated_centers
)
SELECT * FROM mapping_data WHERE old_id != new_id;

-- Show what will be consolidated
SELECT
    'Financial Centers to consolidate:' as info,
    COUNT(*) as duplicate_records,
    COUNT(DISTINCT new_id) as unique_centers
FROM temp_financial_center_mapping;

-- Update registry references to point to master records
UPDATE t_f_registry
SET financial_center_id = m.new_id
FROM temp_financial_center_mapping m
WHERE t_f_registry.financial_center_id = m.old_id;

-- Log consolidation actions
INSERT INTO consolidation_log (table_name, action, old_id, new_id, consolidated_name, consolidated_at)
SELECT
    't_d_financial_center',
    'consolidated',
    old_id,
    new_id,
    financial_center_name,
    NOW()
FROM temp_financial_center_mapping;

-- Delete duplicate records
DELETE FROM t_d_financial_center
WHERE financial_center_id IN (
    SELECT old_id FROM temp_financial_center_mapping
);

-- Set user_id to NULL for shared records (making them globally available)
UPDATE t_d_financial_center
SET user_id = NULL,
    description = COALESCE(description, 'Consolidated from user-specific records'),
    updated_at = NOW()
WHERE financial_center_id IN (
    SELECT DISTINCT new_id FROM temp_financial_center_mapping
);

-- ========================================================================
-- PHASE 2: CONSOLIDATE COST CENTERS
-- ========================================================================

-- Create temporary mapping table for cost centers
CREATE TEMP TABLE temp_cost_center_mapping AS
WITH deduplicated_centers AS (
    SELECT
        cost_center_name,
        MIN(cost_center_id) as master_id,
        ARRAY_AGG(cost_center_id ORDER BY cost_center_id) as all_ids
    FROM t_d_cost_center
    GROUP BY cost_center_name
    HAVING COUNT(*) > 1
),
mapping_data AS (
    SELECT
        unnest(all_ids) as old_id,
        master_id as new_id,
        cost_center_name
    FROM deduplicated_centers
)
SELECT * FROM mapping_data WHERE old_id != new_id;

-- Show what will be consolidated
SELECT
    'Cost Centers to consolidate:' as info,
    COUNT(*) as duplicate_records,
    COUNT(DISTINCT new_id) as unique_centers
FROM temp_cost_center_mapping;

-- Update registry references
UPDATE t_f_registry
SET cost_center_id = m.new_id
FROM temp_cost_center_mapping m
WHERE t_f_registry.cost_center_id = m.old_id;

-- Log consolidation actions
INSERT INTO consolidation_log (table_name, action, old_id, new_id, consolidated_name, consolidated_at)
SELECT
    't_d_cost_center',
    'consolidated',
    old_id,
    new_id,
    cost_center_name,
    NOW()
FROM temp_cost_center_mapping;

-- Delete duplicates
DELETE FROM t_d_cost_center
WHERE cost_center_id IN (
    SELECT old_id FROM temp_cost_center_mapping
);

-- Set user_id to NULL for shared records
UPDATE t_d_cost_center
SET user_id = NULL,
    description = COALESCE(description, 'Consolidated from user-specific records'),
    updated_at = NOW()
WHERE cost_center_id IN (
    SELECT DISTINCT new_id FROM temp_cost_center_mapping
);

-- ========================================================================
-- PHASE 3: CONSOLIDATE NOMENCLATURES
-- ========================================================================

-- Create temporary mapping table for nomenclatures
CREATE TEMP TABLE temp_nomenclature_mapping AS
WITH deduplicated_nomenclatures AS (
    SELECT
        nomenclature_name,
        MIN(nomenclature_id) as master_id,
        ARRAY_AGG(nomenclature_id ORDER BY nomenclature_id) as all_ids
    FROM t_d_nomenclature
    GROUP BY nomenclature_name
    HAVING COUNT(*) > 1
),
mapping_data AS (
    SELECT
        unnest(all_ids) as old_id,
        master_id as new_id,
        nomenclature_name
    FROM deduplicated_nomenclatures
)
SELECT * FROM mapping_data WHERE old_id != new_id;

-- Show what will be consolidated
SELECT
    'Nomenclatures to consolidate:' as info,
    COUNT(*) as duplicate_records,
    COUNT(DISTINCT new_id) as unique_nomenclatures
FROM temp_nomenclature_mapping;

-- Update registry references
UPDATE t_f_registry
SET nomenclature_id = m.new_id
FROM temp_nomenclature_mapping m
WHERE t_f_registry.nomenclature_id = m.old_id;

-- Update product_nomenclature references
UPDATE t_d_product_nomenclature
SET nomenclature_id = m.new_id
FROM temp_nomenclature_mapping m
WHERE t_d_product_nomenclature.nomenclature_id = m.old_id;

-- Log consolidation actions
INSERT INTO consolidation_log (table_name, action, old_id, new_id, consolidated_name, consolidated_at)
SELECT
    't_d_nomenclature',
    'consolidated',
    old_id,
    new_id,
    nomenclature_name,
    NOW()
FROM temp_nomenclature_mapping;

-- Delete duplicates
DELETE FROM t_d_nomenclature
WHERE nomenclature_id IN (
    SELECT old_id FROM temp_nomenclature_mapping
);

-- Set user_id to NULL for shared records
UPDATE t_d_nomenclature
SET user_id = NULL,
    description = COALESCE(description, 'Consolidated from user-specific records'),
    updated_at = NOW()
WHERE nomenclature_id IN (
    SELECT DISTINCT new_id FROM temp_nomenclature_mapping
);

-- ========================================================================
-- PHASE 4: CLEANUP AND VALIDATION
-- ========================================================================

-- Create admin role for managing shared reference data
INSERT INTO t_d_user (telegram_id, username, full_name, is_admin, is_active)
VALUES (0, 'system_admin', 'System Administrator', TRUE, TRUE)
ON CONFLICT (telegram_id) DO UPDATE SET
    is_admin = TRUE,
    updated_at = NOW();

-- Get admin user ID
DO $$
DECLARE
    admin_user_id INTEGER;
BEGIN
    SELECT user_id INTO admin_user_id
    FROM t_d_user
    WHERE telegram_id = 0 OR is_admin = TRUE
    ORDER BY user_id
    LIMIT 1;

    -- Update managed_by for all shared records to admin
    UPDATE t_d_financial_center
    SET managed_by = admin_user_id
    WHERE user_id IS NULL;

    UPDATE t_d_cost_center
    SET managed_by = admin_user_id
    WHERE user_id IS NULL;

    UPDATE t_d_nomenclature
    SET managed_by = admin_user_id
    WHERE user_id IS NULL;

    -- Update periods to be shared as well
    UPDATE t_d_period
    SET user_id = NULL
    WHERE period_id IN (
        SELECT DISTINCT period_id
        FROM t_f_registry
    );

END $$;

-- ========================================================================
-- VALIDATION QUERIES
-- ========================================================================

-- Final validation - show consolidation results
SELECT
    'CONSOLIDATION SUMMARY' as info,
    '' as separator;

SELECT
    'Financial Centers' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as shared_records,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_specific_records
FROM t_d_financial_center
UNION ALL
SELECT
    'Cost Centers' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as shared_records,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_specific_records
FROM t_d_cost_center
UNION ALL
SELECT
    'Nomenclatures' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as shared_records,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_specific_records
FROM t_d_nomenclature
UNION ALL
SELECT
    'Periods' as table_name,
    COUNT(*) as total_records,
    COUNT(CASE WHEN user_id IS NULL THEN 1 END) as shared_records,
    COUNT(CASE WHEN user_id IS NOT NULL THEN 1 END) as user_specific_records
FROM t_d_period;

-- Check for any orphaned registry records
SELECT
    'Registry validation' as check_name,
    COUNT(*) as total_registry_records,
    COUNT(CASE WHEN fc.financial_center_id IS NULL THEN 1 END) as missing_financial_centers,
    COUNT(CASE WHEN cc.cost_center_id IS NULL THEN 1 END) as missing_cost_centers,
    COUNT(CASE WHEN n.nomenclature_id IS NULL THEN 1 END) as missing_nomenclatures
FROM t_f_registry r
LEFT JOIN t_d_financial_center fc ON r.financial_center_id = fc.financial_center_id
LEFT JOIN t_d_cost_center cc ON r.cost_center_id = cc.cost_center_id
LEFT JOIN t_d_nomenclature n ON r.nomenclature_id = n.nomenclature_id;

-- Show consolidation log summary
SELECT
    table_name,
    COUNT(*) as records_consolidated,
    MIN(consolidated_at) as first_consolidation,
    MAX(consolidated_at) as last_consolidation
FROM consolidation_log
WHERE action = 'consolidated'
GROUP BY table_name;

-- ========================================================================
-- CREATE CONSOLIDATION LOG TABLE (if not exists)
-- ========================================================================
CREATE TABLE IF NOT EXISTS consolidation_log (
    log_id SERIAL PRIMARY KEY,
    table_name VARCHAR(50) NOT NULL,
    action VARCHAR(20) NOT NULL,
    old_id INTEGER,
    new_id INTEGER,
    consolidated_name VARCHAR(255),
    consolidated_at TIMESTAMP DEFAULT NOW()
);

COMMIT;