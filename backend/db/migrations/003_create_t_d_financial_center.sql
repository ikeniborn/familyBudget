-- ============================================================================
-- Migration: 003_create_t_d_financial_center.sql
-- Description: Create financial centers dimension table with SCD Type 2
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-09
-- Task: TASK-001 (ST-002)
-- ============================================================================

-- ============================================================================
-- TABLE: t_d_financial_center
-- Purpose: Financial centers dimension (bank accounts, wallets, cash)
-- Pattern: SCD Type 2
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_d_financial_center (
    -- Primary key
    id SERIAL PRIMARY KEY,

    -- Foreign keys
    user_id INT REFERENCES t_d_user(id) ON DELETE CASCADE,

    -- Business keys
    code VARCHAR(50),

    -- Financial center attributes
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_global BOOLEAN NOT NULL DEFAULT FALSE,

    -- SCD Type 2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    -- Valid date range check
    CONSTRAINT check_financial_center_valid_dates
        CHECK (valid_from < valid_to),

    -- Global financial centers must have code
    CONSTRAINT check_financial_center_global_code
        CHECK (NOT is_global OR (is_global AND code IS NOT NULL)),

    -- Global financial centers cannot have user_id
    CONSTRAINT check_financial_center_global_user
        CHECK (NOT is_global OR (is_global AND user_id IS NULL)),

    -- User financial centers must have user_id
    CONSTRAINT check_financial_center_user_ownership
        CHECK (is_global OR (NOT is_global AND user_id IS NOT NULL))
);

-- ============================================================================
-- PARTIAL UNIQUE INDEXES (replace inline constraints with WHERE clauses)
-- ============================================================================
-- PostgreSQL does not support partial unique constraints as inline table constraints.
-- We must create partial unique indexes separately.

-- Only one current record per user + code combination (for user financial centers)
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_center_user_code_current
    ON t_d_financial_center(user_id, code, is_current)
    WHERE is_current = TRUE AND user_id IS NOT NULL;

-- Only one current record per code for global financial centers
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_center_global_code_current
    ON t_d_financial_center(code, is_current)
    WHERE is_current = TRUE AND is_global = TRUE;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on user_id for filtering user financial centers
CREATE INDEX IF NOT EXISTS idx_financial_center_user_id
    ON t_d_financial_center(user_id);

-- Index on code for lookups
CREATE INDEX IF NOT EXISTS idx_financial_center_code
    ON t_d_financial_center(code)
    WHERE code IS NOT NULL;

-- Index on current records only
CREATE INDEX IF NOT EXISTS idx_financial_center_current
    ON t_d_financial_center(is_current)
    WHERE is_current = TRUE;

-- Index on global flag
CREATE INDEX IF NOT EXISTS idx_financial_center_global
    ON t_d_financial_center(is_global)
    WHERE is_global = TRUE;

-- Composite index for current user financial centers
CREATE INDEX IF NOT EXISTS idx_financial_center_user_current
    ON t_d_financial_center(user_id, is_current)
    WHERE user_id IS NOT NULL AND is_current = TRUE;

-- Composite index for current global financial centers
CREATE INDEX IF NOT EXISTS idx_financial_center_global_current
    ON t_d_financial_center(is_global, is_current)
    WHERE is_global = TRUE AND is_current = TRUE;

-- Index on valid date range for time-travel queries
CREATE INDEX IF NOT EXISTS idx_financial_center_valid_from
    ON t_d_financial_center(valid_from);

CREATE INDEX IF NOT EXISTS idx_financial_center_valid_to
    ON t_d_financial_center(valid_to);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE t_d_financial_center IS
    'Financial centers dimension table with SCD Type 2 for tracking historical changes. Stores bank accounts, wallets, cash, and other financial entities. Can be user-specific or global (shared across all users).';

COMMENT ON COLUMN t_d_financial_center.id IS
    'Surrogate key (auto-increment primary key)';

COMMENT ON COLUMN t_d_financial_center.user_id IS
    'Foreign key to t_d_user. NULL for global financial centers, required for user financial centers.';

COMMENT ON COLUMN t_d_financial_center.code IS
    'Business code for financial center (required for global, optional for user-specific)';

COMMENT ON COLUMN t_d_financial_center.name IS
    'Financial center name (e.g., "Сбербанк", "Наличные", "Тинькофф")';

COMMENT ON COLUMN t_d_financial_center.description IS
    'Optional description or notes about the financial center';

COMMENT ON COLUMN t_d_financial_center.is_global IS
    'Flag indicating if financial center is global (shared) or user-specific';

COMMENT ON COLUMN t_d_financial_center.valid_from IS
    'SCD2: Start date of record validity (inclusive)';

COMMENT ON COLUMN t_d_financial_center.valid_to IS
    'SCD2: End date of record validity (exclusive). 9999-12-31 for current records.';

COMMENT ON COLUMN t_d_financial_center.is_current IS
    'SCD2: Flag indicating current (active) record version';

COMMENT ON COLUMN t_d_financial_center.created_at IS
    'Audit: Timestamp when this version was created';

COMMENT ON COLUMN t_d_financial_center.updated_at IS
    'Audit: Timestamp of last update to this version';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Insert global financial center
-- INSERT INTO t_d_financial_center (code, name, description, is_global)
-- VALUES ('BANK_SBER', 'Сбербанк', 'Главная карта Сбербанка', TRUE);

-- Insert user-specific financial center
-- INSERT INTO t_d_financial_center (user_id, name, description, is_global)
-- VALUES (1, 'Наличные', 'Кошелёк наличными', FALSE);

-- Query current financial centers for user
-- SELECT * FROM t_d_financial_center
-- WHERE user_id = 1 AND is_current = TRUE;

-- Query global financial centers
-- SELECT * FROM t_d_financial_center
-- WHERE is_global = TRUE AND is_current = TRUE;

-- Time-travel query (financial centers as of specific date)
-- SELECT *
-- FROM t_d_financial_center
-- WHERE '2025-01-01'::TIMESTAMP BETWEEN valid_from AND valid_to;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table exists
-- SELECT table_name, table_type
-- FROM information_schema.tables
-- WHERE table_name = 't_d_financial_center';

-- Verify columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 't_d_financial_center'
-- ORDER BY ordinal_position;

-- Verify constraints
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 't_d_financial_center';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 't_d_financial_center';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
