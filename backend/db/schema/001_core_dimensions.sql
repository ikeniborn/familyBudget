-- ============================================================================
-- Schema DDL: 001_core_dimensions.sql
-- Description: Core dimension tables (Users, Articles, FinancialCenters, CostCenters)
-- Version: 5.0.0 (Base Schema)
-- Date: 2025-11-08
-- ============================================================================
--
-- This file contains the base schema for all core dimension tables:
-- - t_d_user: User dimension with SCD Type 2
-- - t_d_article: Article/category dimension with SCD Type 2 + hierarchy
-- - t_d_financial_center: Financial center dimension (bank accounts) with SCD Type 2
-- - t_d_cost_center: Cost center dimension (projects) with SCD Type 2
--
-- Characteristics:
-- - Idempotent (safe to run multiple times - uses IF NOT EXISTS)
-- - Self-contained (includes all indexes and constraints)
-- - Optimized for performance (covering indexes from 009)
--
-- DO NOT MODIFY in Production Mode - use Alembic migrations instead!
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
    phone_number VARCHAR(20),
    is_admin BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- SCD Type 2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_user_valid_dates
        CHECK (valid_from < valid_to)
);

-- Unique index: only one current record per telegram_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_telegram_current
    ON t_d_user(telegram_id, is_current)
    WHERE is_current = TRUE;

-- Index on is_current for filtering
CREATE INDEX IF NOT EXISTS idx_user_current
    ON t_d_user(is_current)
    WHERE is_current = TRUE;

-- Covering index for Telegram OAuth lookup (from 009)
CREATE INDEX IF NOT EXISTS idx_user_telegram_current_covering
    ON t_d_user(telegram_id, is_current)
    INCLUDE (id, username, first_name, last_name, is_admin)
    WHERE is_current = TRUE;

-- Comments
COMMENT ON TABLE t_d_user IS
    'User dimension table with SCD Type 2 for tracking historical changes. Manages user authentication via Telegram.';

COMMENT ON COLUMN t_d_user.telegram_id IS
    'Telegram user ID (natural key)';

COMMENT ON COLUMN t_d_user.is_admin IS
    'Admin flag: TRUE = can manage dimension tables (articles, financial centers, cost centers)';

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
    is_active BOOLEAN NOT NULL DEFAULT TRUE,

    -- SCD Type 2 fields
    valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    CONSTRAINT check_article_valid_dates
        CHECK (valid_from < valid_to),
    
    CONSTRAINT check_article_no_self_reference
        CHECK (parent_id IS NULL OR parent_id != id)
);

-- Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_article_code_current
    ON t_d_article(code, is_current)
    WHERE is_current = TRUE AND code IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_article_user_id
    ON t_d_article(user_id);

CREATE INDEX IF NOT EXISTS idx_article_parent_id
    ON t_d_article(parent_id);

CREATE INDEX IF NOT EXISTS idx_article_code
    ON t_d_article(code)
    WHERE code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_article_type
    ON t_d_article(type);

CREATE INDEX IF NOT EXISTS idx_article_current
    ON t_d_article(is_current)
    WHERE is_current = TRUE;

-- Archived categories indexes
CREATE INDEX IF NOT EXISTS idx_article_active
    ON t_d_article(is_active)
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_article_active_current
    ON t_d_article(is_active, is_current)
    WHERE is_active = TRUE AND is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_article_user_current
    ON t_d_article(user_id, is_current)
    WHERE user_id IS NOT NULL AND is_current = TRUE;

CREATE INDEX IF NOT EXISTS idx_article_valid_from
    ON t_d_article(valid_from);

CREATE INDEX IF NOT EXISTS idx_article_valid_to
    ON t_d_article(valid_to);

-- Covering index for current articles (from 009)
CREATE INDEX IF NOT EXISTS idx_article_current_type_name_covering
    ON t_d_article(is_current, type)
    INCLUDE (id, name, parent_id, code)
    WHERE is_current = TRUE;

-- Covering index for article code lookup (from 009)
CREATE INDEX IF NOT EXISTS idx_article_code_current_covering
    ON t_d_article(code, is_current)
    INCLUDE (id, name, type)
    WHERE code IS NOT NULL AND is_current = TRUE;

-- Comments
COMMENT ON TABLE t_d_article IS
    'Articles/categories dimension table with SCD Type 2. Supports hierarchical structure via parent_id. Shared across all users (managed by admins).';

COMMENT ON COLUMN t_d_article.is_active IS
    'Active status flag. TRUE = visible in UI dropdowns, FALSE = archived (hidden from selection but visible in analytics with "(архив)" label). Archiving is recursive.';

-- ============================================================================
-- TABLE: t_d_financial_center
-- Purpose: Financial centers dimension (bank accounts) with SCD Type 2
-- Pattern: SCD Type 2 (Slowly Changing Dimension Type 2)
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
    CONSTRAINT check_fc_valid_dates
        CHECK (valid_from < valid_to)
);

-- Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_fc_code_current
    ON t_d_financial_center(code, is_current)
    WHERE is_current = TRUE AND code IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_fc_user_id
    ON t_d_financial_center(user_id);

CREATE INDEX IF NOT EXISTS idx_fc_current
    ON t_d_financial_center(is_current)
    WHERE is_current = TRUE;

-- Covering index for current financial centers (from 009)
CREATE INDEX IF NOT EXISTS idx_fc_current_covering
    ON t_d_financial_center(is_current)
    INCLUDE (id, name, code, description)
    WHERE is_current = TRUE;

-- Comments
COMMENT ON TABLE t_d_financial_center IS
    'Financial centers dimension (bank accounts, cash, cards). Shared across all users (managed by admins).';

-- ============================================================================
-- TABLE: t_d_cost_center
-- Purpose: Cost centers dimension (projects) with SCD Type 2
-- Pattern: SCD Type 2 (Slowly Changing Dimension Type 2)
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_d_cost_center (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign keys
    user_id INT REFERENCES t_d_user(id) ON DELETE CASCADE,
    
    -- Business keys
    code VARCHAR(50),
    
    -- Cost center attributes
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
    CONSTRAINT check_cc_valid_dates
        CHECK (valid_from < valid_to)
);

-- Partial unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_cc_code_current
    ON t_d_cost_center(code, is_current)
    WHERE is_current = TRUE AND code IS NOT NULL;

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_cc_user_id
    ON t_d_cost_center(user_id);

CREATE INDEX IF NOT EXISTS idx_cc_current
    ON t_d_cost_center(is_current)
    WHERE is_current = TRUE;

-- Covering index for current cost centers (from 009)
CREATE INDEX IF NOT EXISTS idx_cc_current_covering
    ON t_d_cost_center(is_current)
    INCLUDE (id, name, code, description)
    WHERE is_current = TRUE;

-- Comments
COMMENT ON TABLE t_d_cost_center IS
    'Cost centers dimension (projects, trips, events). Shared across all users (managed by admins).';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
