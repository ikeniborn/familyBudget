-- ============================================================================
-- Migration: 006_create_t_f_budget_fact.sql
-- Description: Create budget fact table with monthly partitioning
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-09
-- Task: TASK-002 (Fact table DDL)
-- ============================================================================

-- ============================================================================
-- TABLE: t_f_budget_fact
-- Purpose: Budget transactions fact table (income/expense records)
-- Pattern: Fact table with monthly RANGE partitioning
-- ============================================================================

-- ============================================================================
-- IMPORTANT NOTES:
--
-- This is a partitioned table using PostgreSQL declarative partitioning.
-- Partitioning by month enables:
-- 1. Efficient queries by date range (partition pruning)
-- 2. Easier data archiving/deletion of old partitions
-- 3. Better performance for analytical queries
--
-- Partition strategy: RANGE partitioning on fact_date (monthly)
-- Example partitions:
-- - t_f_budget_fact_2025_01 (2025-01-01 to 2025-02-01)
-- - t_f_budget_fact_2025_02 (2025-02-01 to 2025-03-01)
-- - etc.
--
-- New partitions can be created manually or via automated job.
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_f_budget_fact (
    -- Primary key (surrogate key)
    id BIGSERIAL,

    -- Foreign keys to dimensions (SCD2 aware - store dimension ids at transaction time)
    user_id INT NOT NULL,
    article_id INT NOT NULL,
    financial_center_id INT,
    cost_center_id INT,

    -- Fact attributes
    fact_date DATE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    description TEXT,

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Constraints
    -- Foreign keys reference dimension tables (no ON DELETE CASCADE for facts!)
    CONSTRAINT fk_budget_fact_user
        FOREIGN KEY (user_id) REFERENCES t_d_user(id),

    CONSTRAINT fk_budget_fact_article
        FOREIGN KEY (article_id) REFERENCES t_d_article(id),

    CONSTRAINT fk_budget_fact_financial_center
        FOREIGN KEY (financial_center_id) REFERENCES t_d_financial_center(id),

    CONSTRAINT fk_budget_fact_cost_center
        FOREIGN KEY (cost_center_id) REFERENCES t_d_cost_center(id),

    -- Business rules
    CONSTRAINT check_budget_fact_amount_not_zero
        CHECK (amount != 0),

    CONSTRAINT check_budget_fact_date_range
        CHECK (fact_date >= '2020-01-01' AND fact_date <= '2099-12-31'),

    -- Primary key includes partition key for partitioned table
    PRIMARY KEY (id, fact_date)

) PARTITION BY RANGE (fact_date);

-- ============================================================================
-- INDEXES ON PARENT TABLE
-- ============================================================================
-- Note: Indexes are automatically created on child partitions

-- Index on user_id for filtering by user
CREATE INDEX IF NOT EXISTS idx_budget_fact_user_id
    ON t_f_budget_fact(user_id);

-- Index on article_id for filtering by article/category
CREATE INDEX IF NOT EXISTS idx_budget_fact_article_id
    ON t_f_budget_fact(article_id);

-- Index on financial_center_id
CREATE INDEX IF NOT EXISTS idx_budget_fact_financial_center_id
    ON t_f_budget_fact(financial_center_id)
    WHERE financial_center_id IS NOT NULL;

-- Index on cost_center_id
CREATE INDEX IF NOT EXISTS idx_budget_fact_cost_center_id
    ON t_f_budget_fact(cost_center_id)
    WHERE cost_center_id IS NOT NULL;

-- Index on fact_date for time-based queries
CREATE INDEX IF NOT EXISTS idx_budget_fact_date
    ON t_f_budget_fact(fact_date);

-- Composite index for common query pattern: user + date range
CREATE INDEX IF NOT EXISTS idx_budget_fact_user_date
    ON t_f_budget_fact(user_id, fact_date DESC);

-- Composite index for common query pattern: user + article + date
CREATE INDEX IF NOT EXISTS idx_budget_fact_user_article_date
    ON t_f_budget_fact(user_id, article_id, fact_date DESC);

-- Index on created_at for audit queries
CREATE INDEX IF NOT EXISTS idx_budget_fact_created_at
    ON t_f_budget_fact(created_at);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE t_f_budget_fact IS
    'Budget transactions fact table with monthly RANGE partitioning. ' ||
    'Stores all income and expense records. ' ||
    'References dimension tables at the time of transaction (SCD2 aware).';

COMMENT ON COLUMN t_f_budget_fact.id IS
    'Surrogate key (auto-increment primary key)';

COMMENT ON COLUMN t_f_budget_fact.user_id IS
    'Foreign key to t_d_user dimension (owner of transaction)';

COMMENT ON COLUMN t_f_budget_fact.article_id IS
    'Foreign key to t_d_article dimension (category/article of transaction)';

COMMENT ON COLUMN t_f_budget_fact.financial_center_id IS
    'Foreign key to t_d_financial_center dimension (bank account, wallet, etc). NULL allowed.';

COMMENT ON COLUMN t_f_budget_fact.cost_center_id IS
    'Foreign key to t_d_cost_center dimension (project, department, etc). NULL allowed.';

COMMENT ON COLUMN t_f_budget_fact.fact_date IS
    'Transaction date (partition key). Date when income/expense occurred.';

COMMENT ON COLUMN t_f_budget_fact.amount IS
    'Transaction amount. Positive for income, negative for expense.';

COMMENT ON COLUMN t_f_budget_fact.description IS
    'Optional description or notes about the transaction';

COMMENT ON COLUMN t_f_budget_fact.created_at IS
    'Audit: Timestamp when this record was created';

COMMENT ON COLUMN t_f_budget_fact.updated_at IS
    'Audit: Timestamp of last update to this record';

-- ============================================================================
-- INITIAL PARTITIONS
-- ============================================================================
-- Create partitions for current year and next year
-- Additional partitions can be created on-demand or via automated job

-- 2025 partitions
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_01 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-01-01') TO ('2025-02-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_02 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-02-01') TO ('2025-03-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_03 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-03-01') TO ('2025-04-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_04 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-04-01') TO ('2025-05-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_05 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-05-01') TO ('2025-06-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_06 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-06-01') TO ('2025-07-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_07 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-07-01') TO ('2025-08-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_08 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-08-01') TO ('2025-09-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_09 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-09-01') TO ('2025-10-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_10 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_11 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-11-01') TO ('2025-12-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2025_12 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2025-12-01') TO ('2026-01-01');

-- 2026 partitions (for future data)
CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_01 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_02 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_03 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_04 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_05 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-05-01') TO ('2026-06-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_06 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-06-01') TO ('2026-07-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_07 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-07-01') TO ('2026-08-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_08 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-08-01') TO ('2026-09-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_09 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-09-01') TO ('2026-10-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_10 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-10-01') TO ('2026-11-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_11 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-11-01') TO ('2026-12-01');

CREATE TABLE IF NOT EXISTS t_f_budget_fact_2026_12 PARTITION OF t_f_budget_fact
    FOR VALUES FROM ('2026-12-01') TO ('2027-01-01');

-- ============================================================================
-- PARTITION MAINTENANCE FUNCTION
-- ============================================================================
-- Function to create new monthly partition dynamically

CREATE OR REPLACE FUNCTION create_budget_fact_partition(p_year INT, p_month INT)
RETURNS TEXT AS $$
DECLARE
    partition_name TEXT;
    start_date DATE;
    end_date DATE;
BEGIN
    -- Calculate partition dates
    start_date := make_date(p_year, p_month, 1);
    end_date := start_date + INTERVAL '1 month';

    -- Generate partition name
    partition_name := format('t_f_budget_fact_%s_%s',
                            p_year,
                            lpad(p_month::TEXT, 2, '0'));

    -- Check if partition already exists
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name
    ) THEN
        RETURN format('Partition %s already exists', partition_name);
    END IF;

    -- Create partition
    EXECUTE format('CREATE TABLE %I PARTITION OF t_f_budget_fact FOR VALUES FROM (%L) TO (%L)',
                   partition_name,
                   start_date,
                   end_date);

    RETURN format('Partition %s created successfully for date range %s to %s',
                  partition_name,
                  start_date,
                  end_date);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION create_budget_fact_partition(INT, INT) IS
    'Creates a new monthly partition for t_f_budget_fact table. ' ||
    'Usage: SELECT create_budget_fact_partition(2027, 1); -- Creates partition for Jan 2027';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Insert expense record
-- INSERT INTO t_f_budget_fact (user_id, article_id, financial_center_id, fact_date, amount, description)
-- VALUES (1, 5, 2, '2025-10-09', -150.50, 'Продукты в Ашан');

-- Insert income record
-- INSERT INTO t_f_budget_fact (user_id, article_id, financial_center_id, fact_date, amount, description)
-- VALUES (1, 3, 1, '2025-10-01', 80000.00, 'Зарплата октябрь');

-- Query user transactions for current month
-- SELECT f.fact_date, a.name as article, f.amount, f.description
-- FROM t_f_budget_fact f
-- JOIN t_d_article a ON f.article_id = a.id
-- WHERE f.user_id = 1
--   AND f.fact_date >= date_trunc('month', CURRENT_DATE)
--   AND f.fact_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
-- ORDER BY f.fact_date DESC;

-- Query total income/expense by month
-- SELECT
--     date_trunc('month', fact_date)::DATE as month,
--     SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
--     SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expense,
--     SUM(amount) as net
-- FROM t_f_budget_fact
-- WHERE user_id = 1
--   AND fact_date >= '2025-01-01'
--   AND fact_date < '2026-01-01'
-- GROUP BY 1
-- ORDER BY 1;

-- Create new partition for future month
-- SELECT create_budget_fact_partition(2027, 1);

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify parent table exists
-- SELECT table_name, table_type
-- FROM information_schema.tables
-- WHERE table_name = 't_f_budget_fact';

-- List all partitions
-- SELECT
--     nmsp_parent.nspname AS parent_schema,
--     parent.relname AS parent,
--     child.relname AS child,
--     pg_get_expr(child.relpartbound, child.oid) AS partition_expression
-- FROM pg_inherits
-- JOIN pg_class parent ON pg_inherits.inhparent = parent.oid
-- JOIN pg_class child ON pg_inherits.inhrelid = child.oid
-- JOIN pg_namespace nmsp_parent ON nmsp_parent.oid = parent.relnamespace
-- WHERE parent.relname = 't_f_budget_fact'
-- ORDER BY child.relname;

-- Verify indexes
-- SELECT schemaname, tablename, indexname
-- FROM pg_indexes
-- WHERE tablename LIKE 't_f_budget_fact%'
-- ORDER BY tablename, indexname;

-- Verify constraints
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 't_f_budget_fact';

-- Check partition pruning (EXPLAIN should show only relevant partition)
-- EXPLAIN SELECT * FROM t_f_budget_fact
-- WHERE fact_date >= '2025-10-01' AND fact_date < '2025-11-01';

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
