-- ============================================================================
-- Migration: 001_create_t_d_user.sql
-- Description: Create users dimension table with SCD Type 2
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-09
-- Task: TASK-001 (ST-002)
-- ============================================================================

-- ============================================================================
-- TABLE: t_d_user
-- Purpose: User dimension with SCD Type 2 for tracking user changes
-- Pattern: SCD Type 2 (Slowly Changing Dimension Type 2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_d_user (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Natural key / Business key
    telegram_id BIGINT NOT NULL,
    
    -- User attributes
    username VARCHAR(255),
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- SCD Type 2 fields
    -- These fields enable tracking of historical changes
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    -- Valid date range check
    CONSTRAINT check_user_valid_dates
        CHECK (valid_from < valid_to)
);

-- ============================================================================
-- PARTIAL UNIQUE INDEX (replaces inline constraint with WHERE clause)
-- ============================================================================
-- PostgreSQL does not support partial unique constraints as inline table constraints.
-- We must create partial unique indexes separately.

-- Only one current record per telegram_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_telegram_current
    ON t_d_user(telegram_id, is_current)
    WHERE is_current = TRUE;

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on telegram_id for fast lookups
CREATE INDEX IF NOT EXISTS idx_user_telegram_id
    ON t_d_user(telegram_id);

-- Index on current records only
CREATE INDEX IF NOT EXISTS idx_user_current 
    ON t_d_user(is_current) 
    WHERE is_current = TRUE;

-- Index on valid date range for time-travel queries
CREATE INDEX IF NOT EXISTS idx_user_valid_from 
    ON t_d_user(valid_from);

CREATE INDEX IF NOT EXISTS idx_user_valid_to 
    ON t_d_user(valid_to);

-- Composite index for admin users lookup
CREATE INDEX IF NOT EXISTS idx_user_admin_current 
    ON t_d_user(is_admin, is_current) 
    WHERE is_admin = TRUE AND is_current = TRUE;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE t_d_user IS 
    'User dimension table with SCD Type 2 for tracking historical changes. ' ||
    'Stores Telegram user information and admin status.';

COMMENT ON COLUMN t_d_user.id IS 
    'Surrogate key (auto-increment primary key)';

COMMENT ON COLUMN t_d_user.telegram_id IS 
    'Natural key - Telegram user ID (immutable)';

COMMENT ON COLUMN t_d_user.username IS 
    'Telegram username (can change, tracked via SCD2)';

COMMENT ON COLUMN t_d_user.first_name IS 
    'User first name from Telegram profile';

COMMENT ON COLUMN t_d_user.last_name IS 
    'User last name from Telegram profile';

COMMENT ON COLUMN t_d_user.is_admin IS 
    'Admin flag - grants access to admin panel';

COMMENT ON COLUMN t_d_user.valid_from IS 
    'SCD2: Start date of record validity (inclusive)';

COMMENT ON COLUMN t_d_user.valid_to IS 
    'SCD2: End date of record validity (exclusive). 9999-12-31 for current records.';

COMMENT ON COLUMN t_d_user.is_current IS 
    'SCD2: Flag indicating current (active) record version';

COMMENT ON COLUMN t_d_user.created_at IS 
    'Audit: Timestamp when this version was created';

COMMENT ON COLUMN t_d_user.updated_at IS 
    'Audit: Timestamp of last update to this version';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Insert new user (creates initial version with is_current = TRUE)
-- INSERT INTO t_d_user (telegram_id, username, first_name, last_name, is_admin)
-- VALUES (123456789, 'john_doe', 'John', 'Doe', FALSE);

-- Update user (SCD2 logic - handled by trigger in TASK-004)
-- 1. Set current record's is_current = FALSE, valid_to = NOW()
-- 2. Insert new record with updated values, is_current = TRUE

-- Query current users only
-- SELECT * FROM t_d_user WHERE is_current = TRUE;

-- Time-travel query (users as of specific date)
-- SELECT * 
-- FROM t_d_user 
-- WHERE '2025-01-01'::TIMESTAMP BETWEEN valid_from AND valid_to;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table exists
-- SELECT table_name, table_type 
-- FROM information_schema.tables 
-- WHERE table_name = 't_d_user';

-- Verify columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 't_d_user'
-- ORDER BY ordinal_position;

-- Verify constraints
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 't_d_user';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 't_d_user';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
