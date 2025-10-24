-- ============================================================================
-- Migration: 014_remove_code_and_is_global_fields.sql
-- Description: Remove code and is_global fields from dimension tables
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-23
-- Reason: Simplify data model - remove unused fields not in original PRD
-- ============================================================================

-- ============================================================================
-- SUMMARY OF CHANGES
-- ============================================================================
-- 1. Remove 'code' field from:
--    - t_d_article
--    - t_d_financial_center
--    - t_d_cost_center
-- 2. Remove 'is_global' field from:
--    - t_d_article
--    - t_d_financial_center
--    - t_d_cost_center
-- 3. Migrate global records to have user_id (set to admin user)
-- 4. Drop related constraints and indexes
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Migrate global records to admin user
-- ============================================================================
-- Find first admin user and assign global records to them
DO $$
DECLARE
    admin_user_id INT;
BEGIN
    -- Get first admin user ID
    SELECT id INTO admin_user_id
    FROM t_d_user
    WHERE is_admin = TRUE AND is_current = TRUE
    ORDER BY id ASC
    LIMIT 1;

    -- If admin exists, migrate global records
    IF admin_user_id IS NOT NULL THEN
        -- Migrate global articles
        UPDATE t_d_article
        SET user_id = admin_user_id
        WHERE is_global = TRUE AND user_id IS NULL;

        -- Migrate global financial centers
        UPDATE t_d_financial_center
        SET user_id = admin_user_id
        WHERE is_global = TRUE AND user_id IS NULL;

        -- Migrate global cost centers
        UPDATE t_d_cost_center
        SET user_id = admin_user_id
        WHERE is_global = TRUE AND user_id IS NULL;

        RAISE NOTICE 'Migrated global records to admin user ID: %', admin_user_id;
    ELSE
        RAISE WARNING 'No admin user found. Global records will remain with NULL user_id.';
    END IF;
END $$;

-- ============================================================================
-- STEP 2: Drop constraints that reference code and is_global
-- ============================================================================

-- t_d_article constraints
ALTER TABLE t_d_article DROP CONSTRAINT IF EXISTS check_article_global_code;
ALTER TABLE t_d_article DROP CONSTRAINT IF EXISTS check_article_global_user;
ALTER TABLE t_d_article DROP CONSTRAINT IF EXISTS check_article_user_ownership;

-- t_d_financial_center constraints
ALTER TABLE t_d_financial_center DROP CONSTRAINT IF EXISTS check_financial_center_global_code;
ALTER TABLE t_d_financial_center DROP CONSTRAINT IF EXISTS check_financial_center_global_user;
ALTER TABLE t_d_financial_center DROP CONSTRAINT IF EXISTS check_financial_center_user_ownership;

-- t_d_cost_center constraints
ALTER TABLE t_d_cost_center DROP CONSTRAINT IF EXISTS check_cost_center_global_code;
ALTER TABLE t_d_cost_center DROP CONSTRAINT IF EXISTS check_cost_center_global_user;
ALTER TABLE t_d_cost_center DROP CONSTRAINT IF EXISTS check_cost_center_user_ownership;

-- ============================================================================
-- STEP 3: Drop indexes that reference code and is_global
-- ============================================================================

-- t_d_article indexes
DROP INDEX IF EXISTS idx_article_user_code_current;
DROP INDEX IF EXISTS idx_article_global_code_current;
DROP INDEX IF EXISTS idx_article_code;
DROP INDEX IF EXISTS idx_article_global;
DROP INDEX IF EXISTS idx_article_global_current;

-- t_d_financial_center indexes
DROP INDEX IF EXISTS idx_financial_center_user_code_current;
DROP INDEX IF EXISTS idx_financial_center_global_code_current;
DROP INDEX IF EXISTS idx_financial_center_code;
DROP INDEX IF EXISTS idx_financial_center_global;

-- t_d_cost_center indexes
DROP INDEX IF EXISTS idx_cost_center_user_code_current;
DROP INDEX IF EXISTS idx_cost_center_global_code_current;
DROP INDEX IF EXISTS idx_cost_center_code;
DROP INDEX IF EXISTS idx_cost_center_global;

-- ============================================================================
-- STEP 4: Drop columns
-- ============================================================================

-- t_d_article
ALTER TABLE t_d_article DROP COLUMN IF EXISTS code;
ALTER TABLE t_d_article DROP COLUMN IF EXISTS is_global;

-- t_d_financial_center
ALTER TABLE t_d_financial_center DROP COLUMN IF EXISTS code;
ALTER TABLE t_d_financial_center DROP COLUMN IF EXISTS is_global;

-- t_d_cost_center
ALTER TABLE t_d_cost_center DROP COLUMN IF EXISTS code;
ALTER TABLE t_d_cost_center DROP COLUMN IF EXISTS is_global;

-- ============================================================================
-- STEP 5: Add new constraints to ensure data integrity
-- ============================================================================

-- All records must have user_id now (no more NULL)
-- Note: This assumes global records were migrated in STEP 1

-- t_d_article: user_id required
ALTER TABLE t_d_article
    ADD CONSTRAINT check_article_user_required
    CHECK (user_id IS NOT NULL);

-- t_d_financial_center: user_id required
ALTER TABLE t_d_financial_center
    ADD CONSTRAINT check_financial_center_user_required
    CHECK (user_id IS NOT NULL);

-- t_d_cost_center: user_id required
ALTER TABLE t_d_cost_center
    ADD CONSTRAINT check_cost_center_user_required
    CHECK (user_id IS NOT NULL);

-- ============================================================================
-- STEP 6: Add new unique indexes (replace code-based uniqueness with name-based)
-- ============================================================================

-- t_d_article: unique name per user per type
CREATE UNIQUE INDEX idx_article_user_name_type_current
    ON t_d_article(user_id, name, type, is_current)
    WHERE is_current = TRUE;

-- t_d_financial_center: unique name per user
CREATE UNIQUE INDEX idx_financial_center_user_name_current
    ON t_d_financial_center(user_id, name, is_current)
    WHERE is_current = TRUE;

-- t_d_cost_center: unique name per user
CREATE UNIQUE INDEX idx_cost_center_user_name_current
    ON t_d_cost_center(user_id, name, is_current)
    WHERE is_current = TRUE;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify columns removed
DO $$
DECLARE
    col_count INT;
BEGIN
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_name IN ('t_d_article', 't_d_financial_center', 't_d_cost_center')
      AND column_name IN ('code', 'is_global');

    IF col_count > 0 THEN
        RAISE WARNING 'Some code/is_global columns still exist! Count: %', col_count;
    ELSE
        RAISE NOTICE 'All code and is_global columns successfully removed';
    END IF;
END $$;

-- Verify no NULL user_id records exist
DO $$
DECLARE
    null_count INT;
BEGIN
    SELECT COUNT(*) INTO null_count
    FROM (
        SELECT id FROM t_d_article WHERE user_id IS NULL
        UNION ALL
        SELECT id FROM t_d_financial_center WHERE user_id IS NULL
        UNION ALL
        SELECT id FROM t_d_cost_center WHERE user_id IS NULL
    ) AS nulls;

    IF null_count > 0 THEN
        RAISE WARNING 'Found % records with NULL user_id', null_count;
    ELSE
        RAISE NOTICE 'All records have valid user_id';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK INSTRUCTIONS (if needed)
-- ============================================================================
-- If this migration needs to be rolled back, execute:
--
-- BEGIN;
-- -- Add columns back
-- ALTER TABLE t_d_article ADD COLUMN code VARCHAR(50);
-- ALTER TABLE t_d_article ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE t_d_financial_center ADD COLUMN code VARCHAR(50);
-- ALTER TABLE t_d_financial_center ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT FALSE;
-- ALTER TABLE t_d_cost_center ADD COLUMN code VARCHAR(50);
-- ALTER TABLE t_d_cost_center ADD COLUMN is_global BOOLEAN NOT NULL DEFAULT FALSE;
--
-- -- Recreate indexes and constraints (see original migrations 002-004)
-- COMMIT;
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
