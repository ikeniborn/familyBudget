-- Remove order field and add unique constraint on name
ALTER TABLE t_d_financial_center 
DROP COLUMN IF EXISTS financial_center_order;

-- Drop old index if exists
DROP INDEX IF EXISTS idx_financial_center_order;

-- Add unique constraint on financial_center_name per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_center_name_user_unique 
ON t_d_financial_center(financial_center_name, user_id)
WHERE user_id IS NOT NULL;

-- Add unique constraint for system-wide financial centers (where user_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_financial_center_name_system_unique 
ON t_d_financial_center(financial_center_name)
WHERE user_id IS NULL;