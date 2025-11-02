-- Test 2: Create Test Table
-- Purpose: Verify DDL permissions and table creation

-- Drop test table if exists from previous run
DROP TABLE IF EXISTS test_parallel_executor CASCADE;

-- Create test table with SCD Type 2 pattern
CREATE TABLE test_parallel_executor (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    amount NUMERIC(15, 2) DEFAULT 0,
    is_current BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Verify table creation
SELECT
    tablename,
    schemaname,
    tablespace,
    hasindexes
FROM pg_tables
WHERE tablename = 'test_parallel_executor';
