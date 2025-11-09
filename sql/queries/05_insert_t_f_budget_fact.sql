-- ============================================================================
-- INSERT: t_f_budget_fact
-- Description: Budget transactions (plan and fact records)
-- Generated: 2025-11-09 19:53:42
-- ============================================================================

-- IMPORTANT: Run 05_create_partitions_t_f_budget_fact.sql BEFORE this file!
-- Partitions must exist before inserting data.

-- Insert budget facts in batches (COMMIT every 1000 records)
-- record_type: 'fact' for actual transactions, 'plan' for budget

BEGIN;


-- Total: 0 budget fact records in 0 batches
-- Batch size: 1000 records per transaction