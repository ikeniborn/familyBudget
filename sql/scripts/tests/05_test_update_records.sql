-- Test 5: Update Records (SCD Type 2 Pattern)
-- Purpose: Test UPDATE operations and SCD Type 2 versioning

-- SCD Type 2 Update: Close old version and create new version
-- Update TEST_001 with new amount

-- Step 1: Close old version
UPDATE test_parallel_executor
SET
    is_current = FALSE,
    valid_to = CURRENT_TIMESTAMP,
    updated_at = CURRENT_TIMESTAMP
WHERE code = 'TEST_001' AND is_current = TRUE;

-- Step 2: Create new version
INSERT INTO test_parallel_executor (code, name, amount, is_current, valid_from)
SELECT
    code,
    name,
    amount * 2, -- Double the amount
    TRUE,
    CURRENT_TIMESTAMP
FROM test_parallel_executor
WHERE code = 'TEST_001' AND is_current = FALSE
ORDER BY valid_to DESC
LIMIT 1;

-- Batch update: Increase amount by 10% for records with code > TEST_050
UPDATE test_parallel_executor
SET
    amount = amount * 1.10,
    updated_at = CURRENT_TIMESTAMP
WHERE code > 'TEST_050' AND is_current = TRUE;

-- Verify updates
SELECT
    'SCD Type 2 versioning' AS test_name,
    code,
    amount,
    is_current,
    valid_from,
    valid_to
FROM test_parallel_executor
WHERE code = 'TEST_001'
ORDER BY valid_from;

SELECT
    'Batch update stats' AS test_name,
    COUNT(*) AS updated_records,
    AVG(amount) AS avg_amount,
    MIN(updated_at) AS first_update,
    MAX(updated_at) AS last_update
FROM test_parallel_executor
WHERE code > 'TEST_050' AND is_current = TRUE;
