-- Database Performance Analysis
-- Runs EXPLAIN ANALYZE on critical queries

\echo '=========================================='
\echo 'DATABASE PERFORMANCE ANALYSIS'
\echo '=========================================='
\echo ''

-- Get a test user for queries
\echo 'Finding test user...'
SELECT id, username INTO TEMPORARY TABLE test_user_temp
FROM t_d_user
WHERE is_current = true
LIMIT 1;

\echo 'Test user selected:'
SELECT * FROM test_user_temp;
\echo ''

-- Set variables for date ranges
\set today 'CURRENT_DATE'
\set month_start 'DATE_TRUNC(\'month\', CURRENT_DATE)'
\set year_start 'DATE_TRUNC(\'year\', CURRENT_DATE)'
\set days_30_ago 'CURRENT_DATE - INTERVAL \'30 days\''
\set days_90_ago 'CURRENT_DATE - INTERVAL \'90 days\''

\echo '=========================================='
\echo 'QUERY 1: List Facts (filtered by date)'
\echo '=========================================='
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM t_f_budget_fact
WHERE user_id = (SELECT id FROM test_user_temp)
  AND fact_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND fact_date <= CURRENT_DATE
ORDER BY fact_date DESC, id DESC
LIMIT 100;
\echo ''

\echo '=========================================='
\echo 'QUERY 2: Facts Summary (aggregation with JOIN)'
\echo '=========================================='
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  a.type,
  SUM(f.amount) as total,
  COUNT(*) as count
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE f.user_id = (SELECT id FROM test_user_temp)
  AND f.fact_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND f.fact_date <= CURRENT_DATE
  AND a.is_current = true
GROUP BY a.type;
\echo ''

\echo '=========================================='
\echo 'QUERY 3: Category Breakdown (pie chart)'
\echo '=========================================='
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  a.name,
  SUM(f.amount) as total
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE f.user_id = (SELECT id FROM test_user_temp)
  AND a.type = 'expense'
  AND f.fact_date >= DATE_TRUNC('month', CURRENT_DATE)
  AND f.fact_date <= CURRENT_DATE
  AND a.is_current = true
GROUP BY a.name
ORDER BY total DESC;
\echo ''

\echo '=========================================='
\echo 'QUERY 4: Trends (30-day line chart)'
\echo '=========================================='
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  f.fact_date,
  a.type,
  SUM(f.amount) as total
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE f.user_id = (SELECT id FROM test_user_temp)
  AND f.fact_date >= CURRENT_DATE - INTERVAL '30 days'
  AND f.fact_date <= CURRENT_DATE
  AND a.is_current = true
GROUP BY f.fact_date, a.type
ORDER BY f.fact_date;
\echo ''

\echo '=========================================='
\echo 'QUERY 5: Waterfall Chart (yearly aggregation)'
\echo '=========================================='
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  EXTRACT(MONTH FROM f.fact_date) as month,
  a.type,
  a.id as article_id,
  a.name as article_name,
  SUM(f.amount) as total
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE f.user_id = (SELECT id FROM test_user_temp)
  AND f.fact_date >= DATE_TRUNC('year', CURRENT_DATE)
  AND f.fact_date <= CURRENT_DATE
  AND a.is_current = true
GROUP BY EXTRACT(MONTH FROM f.fact_date), a.type, a.id, a.name
ORDER BY month;
\echo ''

\echo '=========================================='
\echo 'QUERY 6: Heatmap (90-day expense patterns)'
\echo '=========================================='
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT
  f.fact_date,
  SUM(f.amount) as total
FROM t_f_budget_fact f
JOIN t_d_article a ON f.article_id = a.id
WHERE f.user_id = (SELECT id FROM test_user_temp)
  AND a.type = 'expense'
  AND f.fact_date >= CURRENT_DATE - INTERVAL '90 days'
  AND f.fact_date <= CURRENT_DATE
  AND a.is_current = true
GROUP BY f.fact_date;
\echo ''

\echo '=========================================='
\echo 'QUERY 7: List Articles (with global)'
\echo '=========================================='
EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT * FROM t_d_article
WHERE (user_id = (SELECT id FROM test_user_temp) OR is_global = true)
  AND is_current = true
LIMIT 100;
\echo ''

\echo '=========================================='
\echo 'QUERY 8: Article Subtree (closure table)'
\echo '=========================================='
-- Get first root article
SELECT id INTO TEMPORARY TABLE root_article_temp
FROM t_d_article
WHERE user_id = (SELECT id FROM test_user_temp)
  AND is_current = true
  AND parent_id IS NULL
LIMIT 1;

\echo 'Root article selected:'
SELECT * FROM root_article_temp;
\echo ''

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT a.*
FROM t_d_article a
JOIN t_d_article_hierarchy h ON a.id = h.descendant_id
WHERE h.ancestor_id = (SELECT id FROM root_article_temp)
  AND a.is_current = true;
\echo ''

\echo '=========================================='
\echo 'QUERY 9: Article Ancestors (breadcrumb)'
\echo '=========================================='
-- Get a leaf article
SELECT id INTO TEMPORARY TABLE leaf_article_temp
FROM t_d_article
WHERE user_id = (SELECT id FROM test_user_temp)
  AND is_current = true
  AND parent_id IS NOT NULL
LIMIT 1;

\echo 'Leaf article selected:'
SELECT * FROM leaf_article_temp;
\echo ''

EXPLAIN (ANALYZE, BUFFERS, VERBOSE)
SELECT a.*
FROM t_d_article a
JOIN t_d_article_hierarchy h ON a.id = h.ancestor_id
WHERE h.descendant_id = (SELECT id FROM leaf_article_temp)
  AND h.depth > 0
  AND a.is_current = true
ORDER BY h.depth DESC;
\echo ''

\echo '=========================================='
\echo 'PERFORMANCE ANALYSIS COMPLETE'
\echo '=========================================='
\echo ''
\echo 'Key metrics to evaluate:'
\echo '  - Execution Time: should be < 50ms for most queries'
\echo '  - Index Usage: look for "Index Scan" vs "Seq Scan"'
\echo '  - Buffers: check "Shared Hit Blocks" ratio'
\echo '  - Rows: compare "rows" (estimate) vs "actual rows"'
\echo ''
\echo 'Performance thresholds:'
\echo '  ✅ < 10ms: Excellent'
\echo '  ⚠️  10-50ms: Good'
\echo '  🔴 > 50ms: Needs optimization'
\echo ''

-- Cleanup
DROP TABLE IF EXISTS test_user_temp;
DROP TABLE IF EXISTS root_article_temp;
DROP TABLE IF EXISTS leaf_article_temp;
