-- ============================================================================
-- Migration: 010_add_record_type_to_budget_fact.sql
-- Description: Add record_type column to support plan vs fact distinction
-- Author: Claude Code (Phase 2 Implementation)
-- Date: 2025-10-14
-- Task: TASK-001, TASK-002 (Phase 2: Telegram Bot - Plan vs Fact)
-- ============================================================================

-- ============================================================================
-- BUSINESS REQUIREMENT
-- ============================================================================
-- Enable distinction between:
-- - "fact": Actual income/expense transactions (historical data)
-- - "plan": Planned/budgeted amounts for future periods
--
-- This allows:
-- - Budget planning with future dates
-- - Plan vs Fact comparison analytics
-- - Flexible date constraints based on record type
-- ============================================================================

-- ============================================================================
-- STEP 1: Add record_type column
-- ============================================================================

ALTER TABLE t_f_budget_fact
ADD COLUMN IF NOT EXISTS record_type VARCHAR(10) DEFAULT 'fact';

COMMENT ON COLUMN t_f_budget_fact.record_type IS
    'Record type: "fact" for actual transactions, "plan" for budget plans';

-- ============================================================================
-- STEP 2: Update existing records to 'fact' (if any have NULL)
-- ============================================================================

UPDATE t_f_budget_fact
SET record_type = 'fact'
WHERE record_type IS NULL;

-- ============================================================================
-- STEP 3: Add NOT NULL constraint after data cleanup
-- ============================================================================

ALTER TABLE t_f_budget_fact
ALTER COLUMN record_type SET NOT NULL;

-- ============================================================================
-- STEP 4: Add CHECK constraint for valid record types
-- ============================================================================

ALTER TABLE t_f_budget_fact
DROP CONSTRAINT IF EXISTS check_record_type;

ALTER TABLE t_f_budget_fact
ADD CONSTRAINT check_record_type
    CHECK (record_type IN ('fact', 'plan'));

-- ============================================================================
-- STEP 5: Modify date constraint to allow future dates for plans
-- ============================================================================

-- Drop old date constraint
ALTER TABLE t_f_budget_fact
DROP CONSTRAINT IF EXISTS check_budget_fact_date_range;

-- Add new conditional date constraint (idempotent)
-- - For 'fact': date cannot be in future (realistic constraint)
-- - For 'plan': date can be in future (budget planning)
-- - Both: date must be within reasonable range (2020-2099)

-- Drop constraint if exists (for idempotency)
ALTER TABLE t_f_budget_fact
DROP CONSTRAINT IF EXISTS check_budget_fact_date_range_by_type;

ALTER TABLE t_f_budget_fact
ADD CONSTRAINT check_budget_fact_date_range_by_type
    CHECK (
        -- All records: within reasonable range
        (fact_date >= '2020-01-01' AND fact_date <= '2099-12-31')
        AND
        -- For 'fact' records: cannot be in future
        (record_type != 'fact' OR fact_date <= CURRENT_DATE)
    );

-- ============================================================================
-- STEP 6: Create index on record_type for filtering
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_budget_fact_record_type
    ON t_f_budget_fact(record_type);

-- Composite index for common query: user + record_type + date
CREATE INDEX IF NOT EXISTS idx_budget_fact_user_type_date
    ON t_f_budget_fact(user_id, record_type, fact_date DESC);

-- ============================================================================
-- STEP 7: Update amount constraint for signed amounts
-- ============================================================================

-- Note: The existing check_budget_fact_amount_not_zero already enforces != 0
-- We'll document the convention:
-- - Income (article.type='income'): amount > 0 (positive)
-- - Expense (article.type='expense'): amount < 0 (negative)
-- This convention is enforced at application level (backend/bot)

COMMENT ON COLUMN t_f_budget_fact.amount IS
    'Transaction amount with sign convention: positive (+) for income, negative (-) for expense. Sign is automatically applied by application layer based on article type.';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Insert actual expense (fact)
-- INSERT INTO t_f_budget_fact (user_id, article_id, fact_date, amount, record_type, description)
-- VALUES (1, 5, '2025-10-14', -150.50, 'fact', 'Groceries at supermarket');

-- Insert actual income (fact)
-- INSERT INTO t_f_budget_fact (user_id, article_id, fact_date, amount, record_type, description)
-- VALUES (1, 3, '2025-10-01', 5000.00, 'fact', 'October salary');

-- Insert planned expense (plan) for future month
-- INSERT INTO t_f_budget_fact (user_id, article_id, fact_date, amount, record_type, description)
-- VALUES (1, 5, '2025-11-15', -200.00, 'plan', 'Planned groceries for November');

-- Insert planned income (plan) for future month
-- INSERT INTO t_f_budget_fact (user_id, article_id, fact_date, amount, record_type, description)
-- VALUES (1, 3, '2025-11-01', 5000.00, 'plan', 'Expected November salary');

-- Query plan vs fact comparison
-- SELECT
--     record_type,
--     SUM(CASE WHEN amount > 0 THEN amount ELSE 0 END) as total_income,
--     SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expense
-- FROM t_f_budget_fact
-- WHERE user_id = 1
--   AND fact_date >= '2025-11-01'
--   AND fact_date < '2025-12-01'
-- GROUP BY record_type;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify column was added
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 't_f_budget_fact'
--   AND column_name = 'record_type';

-- Verify constraints
-- SELECT constraint_name, constraint_type, check_clause
-- FROM information_schema.table_constraints tc
-- LEFT JOIN information_schema.check_constraints cc
--     ON tc.constraint_name = cc.constraint_name
-- WHERE tc.table_name = 't_f_budget_fact'
--   AND tc.constraint_type = 'CHECK';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 't_f_budget_fact'
--   AND indexname LIKE '%record_type%';

-- Test future date for plan (should succeed)
-- INSERT INTO t_f_budget_fact (user_id, article_id, fact_date, amount, record_type, description)
-- VALUES (1, 1, CURRENT_DATE + INTERVAL '30 days', 1000.00, 'plan', 'Test plan for future');

-- Test future date for fact (should FAIL)
-- INSERT INTO t_f_budget_fact (user_id, article_id, fact_date, amount, record_type, description)
-- VALUES (1, 1, CURRENT_DATE + INTERVAL '1 day', 1000.00, 'fact', 'Test fact for future - should fail');

-- ============================================================================
-- ROLLBACK PROCEDURE (if needed)
-- ============================================================================

-- To rollback this migration:
-- ALTER TABLE t_f_budget_fact DROP COLUMN IF EXISTS record_type CASCADE;
-- ALTER TABLE t_f_budget_fact DROP CONSTRAINT IF EXISTS check_budget_fact_date_range_by_type;
-- ALTER TABLE t_f_budget_fact ADD CONSTRAINT check_budget_fact_date_range
--     CHECK (fact_date >= '2020-01-01' AND fact_date <= '2099-12-31');

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
