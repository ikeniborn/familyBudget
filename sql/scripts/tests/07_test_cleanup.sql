-- Test 7: Cleanup Test Artifacts
-- Purpose: Remove all test data and objects from database

-- Drop all indexes first
DROP INDEX IF EXISTS idx_test_code_current;
DROP INDEX IF EXISTS idx_test_valid_period;
DROP INDEX IF EXISTS idx_test_amount;

-- Drop test table
DROP TABLE IF EXISTS test_parallel_executor CASCADE;

-- Verify cleanup
SELECT
    'Cleanup verification' AS test_name,
    COUNT(*) AS remaining_tables
FROM pg_tables
WHERE tablename = 'test_parallel_executor';

SELECT
    'Index cleanup verification' AS test_name,
    COUNT(*) AS remaining_indexes
FROM pg_indexes
WHERE tablename = 'test_parallel_executor';

-- Should return 0 for both queries if cleanup successful
