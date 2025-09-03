-- Update cost_center table structure
-- First add missing columns if they don't exist
ALTER TABLE t_d_cost_center 
ADD COLUMN IF NOT EXISTS cost_center_order INTEGER,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS user_id INTEGER,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Now remove the order column as per requirement
ALTER TABLE t_d_cost_center 
DROP COLUMN IF EXISTS cost_center_order;

-- Add unique constraint on cost_center_name per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_center_name_user_unique 
ON t_d_cost_center(cost_center_name, user_id)
WHERE user_id IS NOT NULL;

-- Add unique constraint for system-wide cost centers (where user_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cost_center_name_system_unique 
ON t_d_cost_center(cost_center_name)
WHERE user_id IS NULL;

-- Add index for user_id
CREATE INDEX IF NOT EXISTS idx_cost_center_user_id ON t_d_cost_center(user_id);