-- Migration 014: Add is_active column to t_d_article table
-- Purpose: Enable archiving functionality for categories (inactive categories)
-- Date: 2025-11-08
-- Feature: Inactive Categories Management
--
-- Behavior:
-- - is_active = TRUE: Category is visible in dropdowns and analytics
-- - is_active = FALSE: Category is archived (hidden from selection, but visible in analytics with "(архив)" label)
-- - Archiving is recursive: when parent is archived, all children are archived too
-- - Restoring is recursive: when parent is restored, all children can be restored

-- Add is_active column with default TRUE
ALTER TABLE t_d_article
ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- Create index for active filtering (used in list queries)
CREATE INDEX IF NOT EXISTS idx_article_active
ON t_d_article(is_active)
WHERE is_active = TRUE;

-- Create composite index for the most common query pattern (active + current)
-- This optimizes: SELECT * FROM t_d_article WHERE is_active = TRUE AND is_current = TRUE
CREATE INDEX IF NOT EXISTS idx_article_active_current
ON t_d_article(is_active, is_current)
WHERE is_active = TRUE AND is_current = TRUE;

-- Add column comment for documentation
COMMENT ON COLUMN t_d_article.is_active IS
    'Active status flag. TRUE = category is visible in UI dropdowns (for facts/plans creation), FALSE = archived category (hidden from selection but still visible in analytics with "(архив)" label). Archiving is recursive - all child categories are archived when parent is archived.';

-- Verify migration
DO $$
BEGIN
    -- Check that column exists
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 't_d_article'
        AND column_name = 'is_active'
    ) THEN
        RAISE EXCEPTION 'Migration 014 failed: is_active column was not created';
    END IF;

    -- Check that indexes exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 't_d_article'
        AND indexname = 'idx_article_active'
    ) THEN
        RAISE EXCEPTION 'Migration 014 failed: idx_article_active index was not created';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 't_d_article'
        AND indexname = 'idx_article_active_current'
    ) THEN
        RAISE EXCEPTION 'Migration 014 failed: idx_article_active_current index was not created';
    END IF;

    RAISE NOTICE 'Migration 014 completed successfully: is_active column and indexes created';
END $$;
