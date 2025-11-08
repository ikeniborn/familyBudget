-- ============================================================================
-- Schema DDL: 002_core_facts.sql
-- Description: Core fact table (BudgetFacts) with performance indexes
-- Version: 5.0.0 (Base Schema)
-- Date: 2025-11-08
-- ============================================================================
--
-- This file contains the fact table for budget transactions:
-- - t_f_budget_fact: Transaction fact table
--
-- Characteristics:
-- - Idempotent (IF NOT EXISTS)
-- - Includes all performance indexes (from 009)
-- - Optimized for analytics queries
--
-- DO NOT MODIFY in Production Mode - use Alembic migrations instead!
-- ============================================================================

-- ============================================================================
-- TABLE: t_f_budget_fact
-- Purpose: Budget transactions fact table
-- Pattern: Star Schema Fact Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_f_budget_fact (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign keys (dimensions)
    user_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
    article_id INT NOT NULL REFERENCES t_d_article(id) ON DELETE RESTRICT,
    financial_center_id INT REFERENCES t_d_financial_center(id) ON DELETE SET NULL,
    cost_center_id INT REFERENCES t_d_cost_center(id) ON DELETE SET NULL,
    
    -- Fact attributes
    amount DECIMAL(15, 2) NOT NULL,
    fact_date DATE NOT NULL,
    description TEXT,
    
    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT check_fact_amount_not_zero
        CHECK (amount != 0)
);

-- ============================================================================
-- BASIC INDEXES
-- ============================================================================

-- Index on user_id for filtering
CREATE INDEX IF NOT EXISTS idx_budget_fact_user_id
    ON t_f_budget_fact(user_id);

-- Index on article_id for category filtering
CREATE INDEX IF NOT EXISTS idx_budget_fact_article_id
    ON t_f_budget_fact(article_id);

-- Index on fact_date for time-based queries
CREATE INDEX IF NOT EXISTS idx_budget_fact_date
    ON t_f_budget_fact(fact_date DESC);

-- Index on financial_center_id
CREATE INDEX IF NOT EXISTS idx_budget_fact_fc_id
    ON t_f_budget_fact(financial_center_id)
    WHERE financial_center_id IS NOT NULL;

-- Index on cost_center_id
CREATE INDEX IF NOT EXISTS idx_budget_fact_cc_id
    ON t_f_budget_fact(cost_center_id)
    WHERE cost_center_id IS NOT NULL;

-- Composite index for user + date queries
CREATE INDEX IF NOT EXISTS idx_budget_fact_user_date
    ON t_f_budget_fact(user_id, fact_date DESC);

-- ============================================================================
-- PERFORMANCE INDEXES (from 009_create_additional_indexes.sql)
-- ============================================================================

-- Covering index for monthly user analytics
-- Query: Monthly totals by user
CREATE INDEX IF NOT EXISTS idx_budget_fact_user_date_amount_covering
    ON t_f_budget_fact(user_id, fact_date DESC)
    INCLUDE (amount, article_id);

COMMENT ON INDEX idx_budget_fact_user_date_amount_covering IS
    'Covering index for monthly user analytics queries. Supports: SELECT user_id, fact_date, SUM(amount) FROM t_f_budget_fact WHERE user_id = ? AND fact_date BETWEEN ? AND ? GROUP BY user_id, fact_date';

-- Covering index for article analytics
-- Query: Category breakdown (group by article)
CREATE INDEX IF NOT EXISTS idx_budget_fact_article_date_amount_covering
    ON t_f_budget_fact(article_id, fact_date DESC)
    INCLUDE (amount, user_id);

COMMENT ON INDEX idx_budget_fact_article_date_amount_covering IS
    'Covering index for article/category analytics. Supports: SELECT article_id, SUM(amount) FROM t_f_budget_fact WHERE article_id IN (...) AND fact_date BETWEEN ? AND ? GROUP BY article_id';

-- Index for financial center filtering
-- Query: Facts by financial center (bank account)
CREATE INDEX IF NOT EXISTS idx_budget_fact_fc_date
    ON t_f_budget_fact(financial_center_id, fact_date DESC)
    WHERE financial_center_id IS NOT NULL;

COMMENT ON INDEX idx_budget_fact_fc_date IS
    'Partial index for financial center queries. Supports: SELECT * FROM t_f_budget_fact WHERE financial_center_id = ? AND fact_date BETWEEN ? AND ?';

-- Index for cost center filtering
-- Query: Facts by cost center (project)
CREATE INDEX IF NOT EXISTS idx_budget_fact_cc_date
    ON t_f_budget_fact(cost_center_id, fact_date DESC)
    WHERE cost_center_id IS NOT NULL;

COMMENT ON INDEX idx_budget_fact_cc_date IS
    'Partial index for cost center queries. Supports: SELECT * FROM t_f_budget_fact WHERE cost_center_id = ? AND fact_date BETWEEN ? AND ?';

-- Covering index for user + article + date range queries
-- Query: User's transactions for specific category
CREATE INDEX IF NOT EXISTS idx_budget_fact_user_article_date_covering
    ON t_f_budget_fact(user_id, article_id, fact_date DESC)
    INCLUDE (amount, description, financial_center_id);

COMMENT ON INDEX idx_budget_fact_user_article_date_covering IS
    'Covering index for user + article queries. Supports: SELECT * FROM t_f_budget_fact WHERE user_id = ? AND article_id = ? AND fact_date BETWEEN ? AND ?';

-- Index for amount-based queries (e.g., large transactions)
-- Query: Find large expenses/incomes
CREATE INDEX IF NOT EXISTS idx_budget_fact_amount_date
    ON t_f_budget_fact(amount, fact_date DESC);

COMMENT ON INDEX idx_budget_fact_amount_date IS
    'Index for amount-based filtering. Supports: SELECT * FROM t_f_budget_fact WHERE amount > ? OR amount < ? ORDER BY fact_date DESC';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE t_f_budget_fact IS
    'Budget transactions fact table (Star Schema). Stores all income/expense transactions with references to dimension tables.';

COMMENT ON COLUMN t_f_budget_fact.amount IS
    'Transaction amount (positive = income, negative = expense). Must be non-zero.';

COMMENT ON COLUMN t_f_budget_fact.fact_date IS
    'Transaction date (business date, not created_at)';

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
