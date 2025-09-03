-- Add missing fields to financial_center table
ALTER TABLE t_d_financial_center 
ADD COLUMN IF NOT EXISTS financial_center_order INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS user_id INTEGER,
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add index for user_id
CREATE INDEX IF NOT EXISTS idx_financial_center_user_id ON t_d_financial_center(user_id);

-- Add index for order
CREATE INDEX IF NOT EXISTS idx_financial_center_order ON t_d_financial_center(financial_center_order);