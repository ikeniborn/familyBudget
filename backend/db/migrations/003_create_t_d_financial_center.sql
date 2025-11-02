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
        CHECK (valid_from < valid_to)
);

-- ============================================================================
-- PARTIAL UNIQUE INDEXES (replace inline constraints with WHERE clauses)
-- ============================================================================
-- PostgreSQL does not support partial unique constraints as inline table constraints.
-- We must create partial unique indexes separately.

-- Only one current record per code (shared references model)
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_center_code_current
    ON t_d_financial_center(code, is_current)
    WHERE is_current = TRUE AND code IS NOT NULL;

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

-- Composite index for current user financial centers (audit trail)
CREATE INDEX IF NOT EXISTS idx_financial_center_user_current
    ON t_d_financial_center(user_id, is_current)
    WHERE user_id IS NOT NULL AND is_current = TRUE;

-- Index on valid date range for time-travel queries
CREATE INDEX IF NOT EXISTS idx_financial_center_valid_from
    ON t_d_financial_center(valid_from);

CREATE INDEX IF NOT EXISTS idx_financial_center_valid_to
    ON t_d_financial_center(valid_to);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE t_d_financial_center IS
    'Financial centers dimension table with SCD Type 2 for tracking historical changes. Stores bank accounts, wallets, cash, and other financial entities. All financial centers are shared across all users (managed by admins).';

COMMENT ON COLUMN t_d_financial_center.id IS
    'Surrogate key (auto-increment primary key)';

COMMENT ON COLUMN t_d_financial_center.user_id IS
    'Foreign key to t_d_user (audit trail: who created the financial center). Used for tracking creator, not for access control.';

COMMENT ON COLUMN t_d_financial_center.code IS
    'Business code for financial center (unique identifier, e.g., "BANK_SBER")';

COMMENT ON COLUMN t_d_financial_center.name IS
    'Financial center name (e.g., "Сбербанк", "Наличные", "Тинькофф")';

COMMENT ON COLUMN t_d_financial_center.description IS
    'Optional description or notes about the financial center';

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

-- Insert financial center (created by admin)
-- INSERT INTO t_d_financial_center (user_id, code, name, description)
-- VALUES (1, 'BANK_SBER', 'Сбербанк', 'Главная карта Сбербанка');

-- Insert financial center without code
-- INSERT INTO t_d_financial_center (user_id, name, description)
-- VALUES (1, 'Наличные', 'Кошелёк наличными');

-- Query all current financial centers (shared, visible to all users)
-- SELECT * FROM t_d_financial_center
-- WHERE is_current = TRUE;

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
