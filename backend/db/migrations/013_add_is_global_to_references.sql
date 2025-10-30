-- ============================================================================
-- Migration: 013_add_is_global_to_references.sql
-- Description: Add is_global flag to reference tables for global shared records
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-30
-- Task: Задача 8 - Global справочники для всех пользователей
-- ============================================================================

-- ============================================================================
-- OVERVIEW:
-- This migration adds is_global flag to Article, FinancialCenter, and CostCenter
-- tables to support global (shared) records visible to all users.
--
-- Global records:
-- - is_global = TRUE: Visible to all users (created by admins)
-- - is_global = FALSE: User-specific records (default)
-- - user_id still tracks the creator for audit purposes
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add is_global column to t_d_article
-- ============================================================================
ALTER TABLE t_d_article
ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN t_d_article.is_global IS
'Global flag: if TRUE, article is shared across all users (default: FALSE)';

-- ============================================================================
-- STEP 2: Add is_global column to t_d_financial_center
-- ============================================================================
ALTER TABLE t_d_financial_center
ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN t_d_financial_center.is_global IS
'Global flag: if TRUE, financial center is shared across all users (default: FALSE)';

-- ============================================================================
-- STEP 3: Add is_global column to t_d_cost_center
-- ============================================================================
ALTER TABLE t_d_cost_center
ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN t_d_cost_center.is_global IS
'Global flag: if TRUE, cost center is shared across all users (default: FALSE)';

-- ============================================================================
-- STEP 4: Create indexes on is_global for performance
-- ============================================================================

-- Index for Article table (global + current records)
CREATE INDEX IF NOT EXISTS idx_article_is_global
ON t_d_article(is_global)
WHERE is_current = TRUE;

-- Index for FinancialCenter table (global + current records)
CREATE INDEX IF NOT EXISTS idx_financial_center_is_global
ON t_d_financial_center(is_global)
WHERE is_current = TRUE;

-- Index for CostCenter table (global + current records)
CREATE INDEX IF NOT EXISTS idx_cost_center_is_global
ON t_d_cost_center(is_global)
WHERE is_current = TRUE;

-- ============================================================================
-- STEP 5: Add composite indexes for common query patterns
-- ============================================================================

-- Composite index for Article: (is_global, user_id, is_current)
-- Optimizes queries like: WHERE (is_global = TRUE OR user_id = ?) AND is_current = TRUE
CREATE INDEX IF NOT EXISTS idx_article_global_user_current
ON t_d_article(is_global, user_id, is_current);

-- Composite index for FinancialCenter: (is_global, user_id, is_current)
CREATE INDEX IF NOT EXISTS idx_financial_center_global_user_current
ON t_d_financial_center(is_global, user_id, is_current);

-- Composite index for CostCenter: (is_global, user_id, is_current)
CREATE INDEX IF NOT EXISTS idx_cost_center_global_user_current
ON t_d_cost_center(is_global, user_id, is_current);

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    -- Verify columns exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 't_d_article' AND column_name = 'is_global'
    ) THEN
        RAISE EXCEPTION 'Migration failed: is_global column not added to t_d_article';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 't_d_financial_center' AND column_name = 'is_global'
    ) THEN
        RAISE EXCEPTION 'Migration failed: is_global column not added to t_d_financial_center';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 't_d_cost_center' AND column_name = 'is_global'
    ) THEN
        RAISE EXCEPTION 'Migration failed: is_global column not added to t_d_cost_center';
    END IF;

    -- Log success
    RAISE NOTICE 'Migration 013 completed successfully';
    RAISE NOTICE '- Added is_global column to t_d_article';
    RAISE NOTICE '- Added is_global column to t_d_financial_center';
    RAISE NOTICE '- Added is_global column to t_d_cost_center';
    RAISE NOTICE '- Created indexes for performance optimization';
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK SCRIPT (for reference, DO NOT execute)
-- ============================================================================
-- BEGIN;
-- ALTER TABLE t_d_article DROP COLUMN IF EXISTS is_global;
-- ALTER TABLE t_d_financial_center DROP COLUMN IF EXISTS is_global;
-- ALTER TABLE t_d_cost_center DROP COLUMN IF EXISTS is_global;
-- DROP INDEX IF EXISTS idx_article_is_global;
-- DROP INDEX IF EXISTS idx_financial_center_is_global;
-- DROP INDEX IF EXISTS idx_cost_center_is_global;
-- DROP INDEX IF EXISTS idx_article_global_user_current;
-- DROP INDEX IF EXISTS idx_financial_center_global_user_current;
-- DROP INDEX IF EXISTS idx_cost_center_global_user_current;
-- COMMIT;
