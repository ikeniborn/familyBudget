-- Test 3: Create Indexes
-- Purpose: Verify index creation and performance optimization

-- Create unique constraint index
CREATE UNIQUE INDEX idx_test_code_current
ON test_parallel_executor (code, is_current)
WHERE is_current = TRUE;

-- Create index on valid_from/valid_to for SCD Type 2 queries
CREATE INDEX idx_test_valid_period
ON test_parallel_executor (valid_from, valid_to);

-- Create index on amount for range queries
CREATE INDEX idx_test_amount
ON test_parallel_executor (amount)
WHERE amount > 0;

-- Verify indexes creation
SELECT
    indexname,
    indexdef,
    tablespace
FROM pg_indexes
WHERE tablename = 'test_parallel_executor'
ORDER BY indexname;
