-- Update nomenclature table structure
-- First add missing columns if they don't exist
ALTER TABLE t_d_nomenclature 
ADD COLUMN IF NOT EXISTS nomenclature_order INTEGER,
ADD COLUMN IF NOT EXISTS nomenclature_type VARCHAR(20) DEFAULT 'EXPENSE',
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS user_id INTEGER,
ADD COLUMN IF NOT EXISTS parent_id INTEGER,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Now remove the order column as per requirement
ALTER TABLE t_d_nomenclature 
DROP COLUMN IF EXISTS nomenclature_order;

-- Add unique constraint on nomenclature_name per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_nomenclature_name_user_unique 
ON t_d_nomenclature(nomenclature_name, user_id)
WHERE user_id IS NOT NULL;

-- Add unique constraint for system-wide nomenclatures (where user_id is NULL)
CREATE UNIQUE INDEX IF NOT EXISTS idx_nomenclature_name_system_unique 
ON t_d_nomenclature(nomenclature_name)
WHERE user_id IS NULL;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_nomenclature_user_id ON t_d_nomenclature(user_id);
CREATE INDEX IF NOT EXISTS idx_nomenclature_parent_id ON t_d_nomenclature(parent_id);