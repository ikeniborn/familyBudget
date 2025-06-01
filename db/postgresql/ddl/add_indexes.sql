-- Add missing indexes for foreign keys in t_f_registry table
-- These indexes will significantly improve JOIN performance

-- Index on period_id (foreign key)
CREATE INDEX IF NOT EXISTS idx_t_f_registry_period_id 
ON t_f_registry (period_id);

-- Index on financial_center_id (foreign key)
CREATE INDEX IF NOT EXISTS idx_t_f_registry_financial_center_id 
ON t_f_registry (financial_center_id);

-- Index on cost_center_id (foreign key)
CREATE INDEX IF NOT EXISTS idx_t_f_registry_cost_center_id 
ON t_f_registry (cost_center_id);

-- Index on nomenclature_id (foreign key)
CREATE INDEX IF NOT EXISTS idx_t_f_registry_nomenclature_id 
ON t_f_registry (nomenclature_id);

-- Index on row_type_id (foreign key)
CREATE INDEX IF NOT EXISTS idx_t_f_registry_row_type_id 
ON t_f_registry (row_type_id);

-- Index on user_id (foreign key)
CREATE INDEX IF NOT EXISTS idx_t_f_registry_user_id 
ON t_f_registry (user_id);

-- Composite indexes for common query patterns
-- For reports filtering by financial_center and period
CREATE INDEX IF NOT EXISTS idx_t_f_registry_financial_period 
ON t_f_registry (financial_center_id, period_id);

-- For reports with row_type filtering
CREATE INDEX IF NOT EXISTS idx_t_f_registry_financial_period_rowtype 
ON t_f_registry (financial_center_id, period_id, row_type_id);

-- Index for period date range queries
CREATE INDEX IF NOT EXISTS idx_t_d_period_dt 
ON t_d_period (period_dt);

-- Index for nomenclature filters
CREATE INDEX IF NOT EXISTS idx_t_d_nomenclature_is_budget_fact 
ON t_d_nomenclature (is_budget, is_fact);

-- Index for telegram authentication
CREATE INDEX IF NOT EXISTS idx_t_d_user_telegram_id 
ON t_d_user (user_telegram_id);

-- Index for user login
CREATE INDEX IF NOT EXISTS idx_t_d_user_name 
ON t_d_user (user_name);

-- Analyze tables after creating indexes
ANALYZE t_f_registry;
ANALYZE t_d_period;
ANALYZE t_d_nomenclature;
ANALYZE t_d_user;
ANALYZE t_d_financial_center;
ANALYZE t_d_cost_center;
ANALYZE t_d_row_type;