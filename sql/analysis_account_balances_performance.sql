-- Performance Analysis for Account Balances Queries
-- File: sql/analysis_account_balances_performance.sql
-- Purpose: Analyze query performance for /api/v1/analytics/account-balances-html endpoint

-- ==============================================================================
-- 1. CHECK TABLE PARTITIONING
-- ==============================================================================

-- Show partition scheme for t_f_budget_fact
SELECT
    nmsp_parent.nspname AS parent_schema,
    parent.relname AS parent_table,
    nmsp_child.nspname AS partition_schema,
    child.relname AS partition_name,
    pg_get_expr(child.relpartbound, child.oid) AS partition_bound
FROM pg_inherits
JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
JOIN pg_class child ON pg_inherits.inhrelid = child.oid
JOIN pg_namespace nmsp_parent ON nmsp_parent.oid = parent.relnamespace
JOIN pg_namespace nmsp_child ON nmsp_child.oid = child.relnamespace
WHERE parent.relname = 't_f_budget_fact'
ORDER BY partition_name;

-- ==============================================================================
-- 2. CHECK EXISTING INDEXES
-- ==============================================================================

-- List all indexes on t_f_budget_fact and its partitions
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename LIKE 't_f_budget_fact%'
ORDER BY tablename, indexname;

-- Index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan AS index_scans,
    idx_tup_read AS tuples_read,
    idx_tup_fetch AS tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE tablename LIKE 't_f_budget_fact%'
ORDER BY idx_scan DESC;

-- ==============================================================================
-- 3. ANALYZE OPENING BALANCE QUERY (fact_date < month_start)
-- ==============================================================================

-- Simulate current month: December 2025
-- month_start = 2025-12-01
-- Opening balance: all transactions BEFORE 2025-12-01

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    f.financial_center_id,
    (
        SUM(CASE WHEN a.type IN ('income', 'credit') THEN f.amount ELSE 0 END) -
        SUM(CASE WHEN a.type IN ('expense', 'debit') THEN f.amount ELSE 0 END)
    ) AS balance
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE
    f.fact_date < '2025-12-01'
    AND f.record_type = 'fact'
    AND f.financial_center_id IS NOT NULL
GROUP BY f.financial_center_id;

-- ==============================================================================
-- 4. ANALYZE CURRENT MONTH MOVEMENTS QUERY (fact_date >= month_start AND <= today)
-- ==============================================================================

-- Simulate: movements from 2025-12-01 to 2025-12-13 (today)

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
    f.financial_center_id,
    (
        SUM(CASE WHEN a.type IN ('income', 'credit') THEN f.amount ELSE 0 END) -
        SUM(CASE WHEN a.type IN ('expense', 'debit') THEN f.amount ELSE 0 END)
    ) AS balance
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE
    f.fact_date >= '2025-12-01'
    AND f.fact_date <= '2025-12-13'
    AND f.record_type = 'fact'
    AND f.financial_center_id IS NOT NULL
GROUP BY f.financial_center_id;

-- ==============================================================================
-- 5. TABLE STATISTICS
-- ==============================================================================

-- Row count per partition
SELECT
    schemaname,
    tablename,
    n_live_tup AS live_rows,
    n_dead_tup AS dead_rows,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE tablename LIKE 't_f_budget_fact%'
ORDER BY tablename;

-- Total table size (including partitions)
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
FROM pg_tables
WHERE tablename LIKE 't_f_budget_fact%'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ==============================================================================
-- 6. RECOMMENDED COMPOSITE INDEX (if missing)
-- ==============================================================================

-- Current indexes cover:
-- - idx_budget_fact_fc_date: (financial_center_id, fact_date DESC)
-- - idx_budget_fact_record_type: (record_type)
-- - idx_budget_fact_article_id: (article_id)
--
-- Potential optimization: Create composite index covering all WHERE conditions
--
-- NOTE: Only create if EXPLAIN shows full table scans or inefficient index usage

-- Composite index for opening balance query (fact_date < month_start):
-- CREATE INDEX CONCURRENTLY idx_budget_fact_fc_record_date_opening
-- ON t_f_budget_fact (financial_center_id, record_type, fact_date DESC)
-- WHERE record_type = 'fact' AND financial_center_id IS NOT NULL;

-- Composite index for current month query (fact_date >= month_start):
-- CREATE INDEX CONCURRENTLY idx_budget_fact_fc_record_date_current
-- ON t_f_budget_fact (financial_center_id, record_type, fact_date)
-- WHERE record_type = 'fact' AND financial_center_id IS NOT NULL;

-- ==============================================================================
-- 7. PARTITION PRUNING VERIFICATION
-- ==============================================================================

-- Check if partition pruning is working correctly
-- Expected: Should only scan t_f_budget_fact_2025_12 partition for current month query

EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM t_f_budget_fact
WHERE fact_date >= '2025-12-01' AND fact_date <= '2025-12-13';

-- Expected: Should scan multiple partitions (2023-01 to 2025-11) for opening balance
EXPLAIN (ANALYZE, BUFFERS)
SELECT COUNT(*)
FROM t_f_budget_fact
WHERE fact_date < '2025-12-01';

-- ==============================================================================
-- 8. QUERY PERFORMANCE BASELINE (before optimization)
-- ==============================================================================

-- Measure execution time for both queries
\timing on

-- Opening balance query
SELECT
    f.financial_center_id,
    (
        SUM(CASE WHEN a.type IN ('income', 'credit') THEN f.amount ELSE 0 END) -
        SUM(CASE WHEN a.type IN ('expense', 'debit') THEN f.amount ELSE 0 END)
    ) AS balance
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE
    f.fact_date < '2025-12-01'
    AND f.record_type = 'fact'
    AND f.financial_center_id IS NOT NULL
GROUP BY f.financial_center_id;

-- Current month movements query
SELECT
    f.financial_center_id,
    (
        SUM(CASE WHEN a.type IN ('income', 'credit') THEN f.amount ELSE 0 END) -
        SUM(CASE WHEN a.type IN ('expense', 'debit') THEN f.amount ELSE 0 END)
    ) AS balance
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE
    f.fact_date >= '2025-12-01'
    AND f.fact_date <= '2025-12-13'
    AND f.record_type = 'fact'
    AND f.financial_center_id IS NOT NULL
GROUP BY f.financial_center_id;

\timing off

-- ==============================================================================
-- 9. RECOMMENDATIONS
-- ==============================================================================

/*
ANALYSIS CHECKLIST:

1. ✅ PARTITION PRUNING:
   - Verify EXPLAIN shows only relevant partitions scanned
   - Opening balance: Should scan 2023-01 to 2025-11 (35 partitions)
   - Current month: Should scan ONLY 2025-12 (1 partition)

2. ✅ INDEX USAGE:
   - Check "Index Scan" vs "Seq Scan" in EXPLAIN output
   - Verify idx_budget_fact_fc_date or similar is used
   - JOIN on article_id should use idx_budget_fact_article_id

3. ⚠️ MISSING COMPOSITE INDEX:
   - If EXPLAIN shows multiple index scans or Bitmap Index Scan
   - Consider creating composite index covering all WHERE conditions
   - Use CONCURRENTLY to avoid locking during creation

4. ✅ STATISTICS:
   - Ensure tables are analyzed recently (last_autoanalyze < 1 week)
   - Run ANALYZE t_f_budget_fact if statistics are stale

5. ⚠️ QUERY OPTIMIZATION:
   - If opening balance query is slow (> 500ms)
   - Consider materialized view or caching strategy
   - Current month query should be fast (< 100ms)

6. ✅ PERFORMANCE TARGETS:
   - Opening balance query: < 500ms (acceptable), < 200ms (good)
   - Current month query: < 100ms (acceptable), < 50ms (good)
   - Combined endpoint: < 600ms (acceptable), < 300ms (good)
*/
