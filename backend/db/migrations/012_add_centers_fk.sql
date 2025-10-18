-- ============================================================================
-- Migration: 012_add_centers_fk.sql
-- Description: Add financial_center_id and cost_center_id foreign keys to budget facts
-- Author: Claude
-- Date: 2025-10-14
-- Task: TASK-008 (EPIC-002)
-- ============================================================================

-- ============================================================================
-- STEP 1: Add nullable foreign key columns
-- ============================================================================

-- Add financial_center_id column (nullable)
ALTER TABLE t_f_budget_fact
ADD COLUMN IF NOT EXISTS financial_center_id INTEGER;

-- Add cost_center_id column (nullable)
ALTER TABLE t_f_budget_fact
ADD COLUMN IF NOT EXISTS cost_center_id INTEGER;

-- ============================================================================
-- STEP 2: Add foreign key constraints
-- ============================================================================

-- Foreign key to t_d_financial_center
ALTER TABLE t_f_budget_fact
ADD CONSTRAINT fk_fact_financial_center
    FOREIGN KEY (financial_center_id)
    REFERENCES t_d_financial_center(id)
    ON DELETE SET NULL;

-- Foreign key to t_d_cost_center
ALTER TABLE t_f_budget_fact
ADD CONSTRAINT fk_fact_cost_center
    FOREIGN KEY (cost_center_id)
    REFERENCES t_d_cost_center(id)
    ON DELETE SET NULL;

-- ============================================================================
-- STEP 3: Create indexes for foreign keys
-- ============================================================================

-- Index on financial_center_id for efficient filtering
CREATE INDEX IF NOT EXISTS idx_fact_financial_center
    ON t_f_budget_fact(financial_center_id)
    WHERE financial_center_id IS NOT NULL;

-- Index on cost_center_id for efficient filtering
CREATE INDEX IF NOT EXISTS idx_fact_cost_center
    ON t_f_budget_fact(cost_center_id)
    WHERE cost_center_id IS NOT NULL;

-- Composite index for queries filtering by both centers
CREATE INDEX IF NOT EXISTS idx_fact_centers_composite
    ON t_f_budget_fact(financial_center_id, cost_center_id)
    WHERE financial_center_id IS NOT NULL OR cost_center_id IS NOT NULL;

-- ============================================================================
-- STEP 4: Add comments
-- ============================================================================

COMMENT ON COLUMN t_f_budget_fact.financial_center_id IS
    'Foreign key to t_d_financial_center. Identifies the financial center (bank account, wallet, cash) where the transaction occurred. NULL if not specified.';

COMMENT ON COLUMN t_f_budget_fact.cost_center_id IS
    'Foreign key to t_d_cost_center. Identifies the cost center (project, department, budget group) for the transaction. NULL if not specified.';

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify columns were added
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 't_f_budget_fact'
--   AND column_name IN ('financial_center_id', 'cost_center_id');

-- Verify foreign key constraints
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 't_f_budget_fact'
--   AND constraint_name LIKE 'fk_fact_%center';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 't_f_budget_fact'
--   AND indexname LIKE 'idx_fact_%center%';

-- ============================================================================
-- ROLLBACK SCRIPT (if needed)
-- ============================================================================

-- To rollback this migration, run:
-- DROP INDEX IF EXISTS idx_fact_centers_composite;
-- DROP INDEX IF EXISTS idx_fact_cost_center;
-- DROP INDEX IF EXISTS idx_fact_financial_center;
-- ALTER TABLE t_f_budget_fact DROP CONSTRAINT IF EXISTS fk_fact_cost_center;
-- ALTER TABLE t_f_budget_fact DROP CONSTRAINT IF EXISTS fk_fact_financial_center;
-- ALTER TABLE t_f_budget_fact DROP COLUMN IF EXISTS cost_center_id;
-- ALTER TABLE t_f_budget_fact DROP COLUMN IF EXISTS financial_center_id;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. Columns are nullable to maintain backward compatibility
-- 2. Existing records will have NULL for both center fields
-- 3. Future records can optionally specify centers
-- 4. ON DELETE SET NULL ensures facts are preserved if a center is deleted
-- 5. Indexes are partial (WHERE NOT NULL) for efficiency
-- 6. No default centers are created - this is handled at application layer

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
