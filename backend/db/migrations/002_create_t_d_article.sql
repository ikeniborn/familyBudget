-- ============================================================================
-- Migration: 002_create_t_d_article.sql
-- Description: Create articles dimension table with SCD Type 2 and hierarchy
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-09
-- Task: TASK-001 (ST-002)
-- ============================================================================

-- ============================================================================
-- TABLE: t_d_article
-- Purpose: Budget categories/articles dimension with SCD Type 2 and hierarchy
-- Pattern: SCD Type 2 + Adjacency List (parent_id)
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_d_article (
    -- Primary key
    id SERIAL PRIMARY KEY,

    -- Foreign keys
    user_id INT REFERENCES t_d_user(id) ON DELETE CASCADE,
    parent_id INT REFERENCES t_d_article(id) ON DELETE SET NULL,

    -- Business keys
    code VARCHAR(50),

    -- Article attributes
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense')),

    -- SCD Type 2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    -- Valid date range check
    CONSTRAINT check_article_valid_dates
        CHECK (valid_from < valid_to),

    -- Prevent self-referencing (parent_id cannot be equal to id)
    CONSTRAINT check_article_no_self_reference
        CHECK (parent_id IS NULL OR parent_id != id)
);

-- ============================================================================
-- PARTIAL UNIQUE INDEXES (replace inline constraints with WHERE clauses)
-- ============================================================================
-- PostgreSQL does not support partial unique constraints as inline table constraints.
-- We must create partial unique indexes separately.

-- Only one current record per code (shared references model)
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_code_current
    ON t_d_article(code, is_current)
    WHERE is_current = TRUE AND code IS NOT NULL;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on user_id for filtering user articles
CREATE INDEX IF NOT EXISTS idx_article_user_id
    ON t_d_article(user_id);

-- Index on parent_id for hierarchy queries
CREATE INDEX IF NOT EXISTS idx_article_parent_id
    ON t_d_article(parent_id);

-- Index on code for lookups
CREATE INDEX IF NOT EXISTS idx_article_code
    ON t_d_article(code)
    WHERE code IS NOT NULL;

-- Index on type for filtering income/expense
CREATE INDEX IF NOT EXISTS idx_article_type
    ON t_d_article(type);

-- Index on current records only
CREATE INDEX IF NOT EXISTS idx_article_current
    ON t_d_article(is_current)
    WHERE is_current = TRUE;

-- Composite index for current user articles (audit trail)
CREATE INDEX IF NOT EXISTS idx_article_user_current
    ON t_d_article(user_id, is_current)
    WHERE user_id IS NOT NULL AND is_current = TRUE;

-- Index on valid date range for time-travel queries
CREATE INDEX IF NOT EXISTS idx_article_valid_from
    ON t_d_article(valid_from);

CREATE INDEX IF NOT EXISTS idx_article_valid_to
    ON t_d_article(valid_to);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE t_d_article IS
    'Articles/categories dimension table with SCD Type 2 for tracking historical changes. Supports hierarchical structure via parent_id (adjacency list). All articles are shared across all users (managed by admins).';

COMMENT ON COLUMN t_d_article.id IS
    'Surrogate key (auto-increment primary key)';

COMMENT ON COLUMN t_d_article.user_id IS
    'Foreign key to t_d_user (audit trail: who created the article). Used for tracking creator, not for access control.';

COMMENT ON COLUMN t_d_article.parent_id IS
    'Foreign key to parent article for hierarchy (adjacency list). NULL for root articles.';

COMMENT ON COLUMN t_d_article.code IS
    'Business code for article (unique identifier, e.g., "INCOME_SALARY")';

COMMENT ON COLUMN t_d_article.name IS
    'Article name (e.g., "Продукты", "Зарплата")';

COMMENT ON COLUMN t_d_article.type IS
    'Article type: "income" or "expense"';

COMMENT ON COLUMN t_d_article.valid_from IS
    'SCD2: Start date of record validity (inclusive)';

COMMENT ON COLUMN t_d_article.valid_to IS
    'SCD2: End date of record validity (exclusive). 9999-12-31 for current records.';

COMMENT ON COLUMN t_d_article.is_current IS
    'SCD2: Flag indicating current (active) record version';

COMMENT ON COLUMN t_d_article.created_at IS
    'Audit: Timestamp when this version was created';

COMMENT ON COLUMN t_d_article.updated_at IS
    'Audit: Timestamp of last update to this version';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Insert article (root level) - created by admin
-- INSERT INTO t_d_article (user_id, code, name, type)
-- VALUES (1, 'INCOME_SALARY', 'Зарплата', 'income');

-- Insert article without code
-- INSERT INTO t_d_article (user_id, name, type)
-- VALUES (1, 'Продукты', 'expense');

-- Insert child article (hierarchy)
-- INSERT INTO t_d_article (user_id, parent_id, name, type)
-- VALUES (1, 2, 'Молочные продукты', 'expense');

-- Query all current articles (shared, visible to all users)
-- SELECT * FROM t_d_article
-- WHERE is_current = TRUE;

-- Query hierarchy (all descendants of article)
-- Will use Closure Table (t_d_article_hierarchy) for efficient queries

-- Query articles by type
-- SELECT * FROM t_d_article
-- WHERE type = 'income' AND is_current = TRUE;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table exists
-- SELECT table_name, table_type
-- FROM information_schema.tables
-- WHERE table_name = 't_d_article';

-- Verify columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 't_d_article'
-- ORDER BY ordinal_position;

-- Verify constraints
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 't_d_article';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 't_d_article';

-- Verify foreign keys
-- SELECT
--     tc.constraint_name,
--     tc.table_name,
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 't_d_article';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
