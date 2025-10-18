-- ============================================================================
-- Migration: 009_create_additional_indexes.sql
-- Description: Create additional indexes for query optimization
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-09
-- Task: TASK-006 (Additional indexes)
-- ============================================================================

-- ============================================================================
-- OVERVIEW
--
-- This migration creates additional indexes optimized for common query patterns
-- in the Family Budget application. These indexes are designed to:
--
-- 1. Improve performance of frequent queries (user facts, analytics)
-- 2. Enable index-only scans (covering indexes)
-- 3. Support efficient aggregations (GROUP BY queries)
-- 4. Optimize sorting operations (ORDER BY queries)
--
-- Index Strategy:
-- - Composite indexes for multi-column filters
-- - Covering indexes to avoid table lookups
-- - Partial indexes for filtered queries (WHERE clauses)
-- - DESC ordering for time-based queries (recent first)
-- ============================================================================

-- ============================================================================
-- INDEXES FOR t_f_budget_fact (Fact Table)
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
-- INDEXES FOR t_d_article (Article/Category Dimension)
-- ============================================================================

-- Covering index for user's current articles with hierarchy
-- Query: Get user's categories for dropdown
CREATE INDEX IF NOT EXISTS idx_article_user_current_type_name_covering
    ON t_d_article(user_id, is_current, type)
    INCLUDE (id, name, parent_id)
    WHERE is_current = TRUE;

COMMENT ON INDEX idx_article_user_current_type_name_covering IS
    'Covering index for user article lists. Supports: SELECT id, name, type, parent_id FROM t_d_article WHERE user_id = ? AND is_current = TRUE AND type = ?';

-- Index for global articles lookup
CREATE INDEX IF NOT EXISTS idx_article_global_current_type
    ON t_d_article(is_global, is_current, type)
    INCLUDE (id, name, code)
    WHERE is_global = TRUE AND is_current = TRUE;

COMMENT ON INDEX idx_article_global_current_type IS
    'Covering index for global articles. Supports: SELECT id, name, code FROM t_d_article WHERE is_global = TRUE AND is_current = TRUE';

-- Index for article code lookup
CREATE INDEX IF NOT EXISTS idx_article_code_current
    ON t_d_article(code, is_current)
    INCLUDE (id, name, type)
    WHERE code IS NOT NULL AND is_current = TRUE;

COMMENT ON INDEX idx_article_code_current IS
    'Index for article lookup by code. Supports: SELECT * FROM t_d_article WHERE code = ? AND is_current = TRUE';

-- ============================================================================
-- INDEXES FOR t_d_user (User Dimension)
-- ============================================================================

-- Covering index for Telegram OAuth lookup
CREATE INDEX IF NOT EXISTS idx_user_telegram_current_covering
    ON t_d_user(telegram_id, is_current)
    INCLUDE (id, username, first_name, last_name, is_admin)
    WHERE is_current = TRUE;

COMMENT ON INDEX idx_user_telegram_current_covering IS
    'Covering index for Telegram OAuth. Supports: SELECT id, username, first_name, last_name, is_admin FROM t_d_user WHERE telegram_id = ? AND is_current = TRUE';

-- ============================================================================
-- INDEXES FOR t_d_financial_center (Financial Center Dimension)
-- ============================================================================

-- Covering index for user's financial centers
CREATE INDEX IF NOT EXISTS idx_fc_user_current_covering
    ON t_d_financial_center(user_id, is_current)
    INCLUDE (id, name, code, description)
    WHERE is_current = TRUE;

COMMENT ON INDEX idx_fc_user_current_covering IS
    'Covering index for user financial centers. Supports: SELECT id, name, code, description FROM t_d_financial_center WHERE user_id = ? AND is_current = TRUE';

-- ============================================================================
-- INDEXES FOR t_d_cost_center (Cost Center Dimension)
-- ============================================================================

-- Covering index for user's cost centers
CREATE INDEX IF NOT EXISTS idx_cc_user_current_covering
    ON t_d_cost_center(user_id, is_current)
    INCLUDE (id, name, code, description)
    WHERE is_current = TRUE;

COMMENT ON INDEX idx_cc_user_current_covering IS
    'Covering index for user cost centers. Supports: SELECT id, name, code, description FROM t_d_cost_center WHERE user_id = ? AND is_current = TRUE';

-- ============================================================================
-- INDEXES FOR t_d_article_hierarchy (Closure Table)
-- ============================================================================

-- Covering index for subtree queries
CREATE INDEX IF NOT EXISTS idx_hierarchy_ancestor_depth_covering
    ON t_d_article_hierarchy(ancestor_id, depth)
    INCLUDE (descendant_id);

COMMENT ON INDEX idx_hierarchy_ancestor_depth_covering IS
    'Covering index for subtree queries. Supports: SELECT descendant_id FROM t_d_article_hierarchy WHERE ancestor_id = ? AND depth > 0';

-- Covering index for ancestor queries
CREATE INDEX IF NOT EXISTS idx_hierarchy_descendant_depth_covering
    ON t_d_article_hierarchy(descendant_id, depth)
    INCLUDE (ancestor_id);

COMMENT ON INDEX idx_hierarchy_descendant_depth_covering IS
    'Covering index for ancestor queries. Supports: SELECT ancestor_id FROM t_d_article_hierarchy WHERE descendant_id = ? AND depth > 0';

-- ============================================================================
-- EXAMPLE QUERIES OPTIMIZED BY THESE INDEXES
-- ============================================================================

-- Query 1: Monthly user analytics (index-only scan)
-- EXPLAIN ANALYZE
-- SELECT DATE_TRUNC('month', fact_date) as month,
--        SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as income,
--        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as expense
-- FROM t_f_budget_fact
-- WHERE user_id = 1
--   AND fact_date >= '2025-01-01'
--   AND fact_date < '2026-01-01'
-- GROUP BY 1
-- ORDER BY 1;
-- Expected: Index Only Scan using idx_budget_fact_user_date_amount_covering

-- Query 2: Category breakdown for period
-- EXPLAIN ANALYZE
-- SELECT a.name, SUM(f.amount) as total
-- FROM t_f_budget_fact f
-- JOIN t_d_article a ON f.article_id = a.id
-- WHERE f.user_id = 1
--   AND f.fact_date >= '2025-10-01'
--   AND f.fact_date < '2025-11-01'
-- GROUP BY a.name
-- ORDER BY total DESC;
-- Expected: Index Scan using idx_budget_fact_user_article_date_covering

-- Query 3: User's current categories
-- EXPLAIN ANALYZE
-- SELECT id, name, type, parent_id
-- FROM t_d_article
-- WHERE user_id = 1
--   AND is_current = TRUE
--   AND type = 'expense'
-- ORDER BY name;
-- Expected: Index Only Scan using idx_article_user_current_type_name_covering

-- Query 4: Telegram OAuth lookup
-- EXPLAIN ANALYZE
-- SELECT id, username, first_name, last_name, is_admin
-- FROM t_d_user
-- WHERE telegram_id = 123456789
--   AND is_current = TRUE;
-- Expected: Index Only Scan using idx_user_telegram_current_covering

-- Query 5: Hierarchy subtree (all descendants)
-- EXPLAIN ANALYZE
-- SELECT a.id, a.name, h.depth
-- FROM t_d_article a
-- JOIN t_d_article_hierarchy h ON a.id = h.descendant_id
-- WHERE h.ancestor_id = 5
--   AND h.depth > 0
-- ORDER BY h.depth, a.name;
-- Expected: Index Only Scan using idx_hierarchy_ancestor_depth_covering

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- Index-Only Scans:
-- - Many indexes include INCLUDE clause with commonly selected columns
-- - This enables index-only scans (no table lookup required)
-- - Performance improvement: 2-5x faster for covered queries
--
-- Partial Indexes:
-- - Indexes with WHERE clauses are smaller and faster
-- - Used for commonly filtered columns (is_current, is_global, NOT NULL)
-- - Reduces index maintenance overhead
--
-- DESC Ordering:
-- - fact_date DESC for recent-first queries (common in dashboards)
-- - Avoids explicit sorting in queries
--
-- Index Size Estimation:
-- - t_f_budget_fact: ~10k facts/user → ~1MB indexes per user
-- - Dimension tables: ~100 records/user → ~10KB indexes per user
-- - Total for 100 users: ~100MB indexes (acceptable)

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all indexes created
-- SELECT schemaname, tablename, indexname, indexdef
-- FROM pg_indexes
-- WHERE indexname LIKE 'idx_%'
-- ORDER BY tablename, indexname;

-- Check index sizes
-- SELECT
--     schemaname,
--     tablename,
--     indexname,
--     pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes
-- WHERE indexrelname LIKE 'idx_%'
-- ORDER BY pg_relation_size(indexrelid) DESC;

-- Check index usage statistics
-- SELECT
--     schemaname,
--     tablename,
--     indexrelname,
--     idx_scan as scans,
--     idx_tup_read as tuples_read,
--     idx_tup_fetch as tuples_fetched
-- FROM pg_stat_user_indexes
-- WHERE indexrelname LIKE 'idx_%'
-- ORDER BY idx_scan DESC;

-- Test query performance with EXPLAIN ANALYZE
-- EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
-- SELECT ... FROM t_f_budget_fact WHERE ...;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
