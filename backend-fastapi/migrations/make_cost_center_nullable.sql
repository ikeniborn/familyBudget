-- Migration: Make cost_center_id nullable in t_f_registry
-- Date: 2025-09-03
-- Reason: Allow creating registry entries without specifying cost center (МВЗ)

ALTER TABLE t_f_registry ALTER COLUMN cost_center_id DROP NOT NULL;

-- Rollback command (if needed):
-- ALTER TABLE t_f_registry ALTER COLUMN cost_center_id SET NOT NULL;