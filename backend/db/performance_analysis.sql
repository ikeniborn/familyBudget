-- DATABASE PERFORMANCE ANALYSIS & TUNING SCRIPT - TASK-015
-- Run: psql -d familybudget -f performance_analysis.sql

\timing on

-- 1. TABLE SIZES
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size,
    pg_total_relation_size(schemaname||'.'||tablename) AS size_bytes
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY size_bytes DESC;

-- 2. INDEX USAGE
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC;

-- 3. SLOW QUERIES (if pg_stat_statements enabled)
-- SELECT query, calls, mean_exec_time, total_exec_time 
-- FROM pg_stat_statements 
-- ORDER BY mean_exec_time DESC 
-- LIMIT 10;

-- 4. VACUUM ANALYZE (run manually)
VACUUM ANALYZE t_f_budget_fact;
VACUUM ANALYZE t_d_article;
VACUUM ANALYZE t_d_user;

\timing off
