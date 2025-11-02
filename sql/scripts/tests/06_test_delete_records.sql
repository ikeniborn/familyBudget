-- Test 6: Delete Records
-- Purpose: Test DELETE operations and soft delete pattern

-- Hard delete: Remove specific records
DELETE FROM test_parallel_executor
WHERE code IN ('TEST_099', 'TEST_100');

-- Soft delete pattern: Mark as not current
UPDATE test_parallel_executor
SET
    is_current = FALSE,
    valid_to = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE code BETWEEN 'TEST_090' AND 'TEST_098';

-- Verify deletes
SELECT
    'Hard delete verification' AS test_name,
    COUNT(*) AS records_count,
    COUNT(*) FILTER (WHERE code IN ('TEST_099', 'TEST_100')) AS deleted_count
FROM test_parallel_executor;

SELECT
    'Soft delete verification' AS test_name,
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE is_current = TRUE) AS current_records,
    COUNT(*) FILTER (WHERE is_current = FALSE) AS archived_records
FROM test_parallel_executor
WHERE code BETWEEN 'TEST_090' AND 'TEST_098';

-- Overall statistics
SELECT
    'Final statistics' AS test_name,
    COUNT(*) AS total_records,
    COUNT(*) FILTER (WHERE is_current = TRUE) AS current_records,
    COUNT(*) FILTER (WHERE is_current = FALSE) AS historical_records,
    SUM(amount) AS total_amount
FROM test_parallel_executor;
