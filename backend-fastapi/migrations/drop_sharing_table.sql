-- Drop t_d_sharing table and related constraints/indexes
-- Migration: drop_sharing_table.sql
-- Created: 2025-09-16
-- Purpose: Remove sharing functionality from Family Budget

-- Drop indexes first
DROP INDEX IF EXISTS ix_t_d_sharing_owner_user_id;
DROP INDEX IF EXISTS ix_t_d_sharing_shared_with_user_id;
DROP INDEX IF EXISTS ix_t_d_sharing_resource_type;
DROP INDEX IF EXISTS ix_t_d_sharing_owner_resource;
DROP INDEX IF EXISTS ix_t_d_sharing_shared_resource;
DROP INDEX IF EXISTS ix_t_d_sharing_active;
DROP INDEX IF EXISTS ix_t_d_sharing_sharing_id;

-- Drop constraints
ALTER TABLE IF EXISTS t_d_sharing DROP CONSTRAINT IF EXISTS fk_t_d_sharing_owner_user_id;
ALTER TABLE IF EXISTS t_d_sharing DROP CONSTRAINT IF EXISTS fk_t_d_sharing_shared_with_user_id;
ALTER TABLE IF EXISTS t_d_sharing DROP CONSTRAINT IF EXISTS ck_t_d_sharing_resource_type;
ALTER TABLE IF EXISTS t_d_sharing DROP CONSTRAINT IF EXISTS ck_t_d_sharing_permission_type;
ALTER TABLE IF EXISTS t_d_sharing DROP CONSTRAINT IF EXISTS ck_t_d_sharing_different_users;
ALTER TABLE IF EXISTS t_d_sharing DROP CONSTRAINT IF EXISTS uq_t_d_sharing_owner_shared_resource;

-- Drop the table
DROP TABLE IF EXISTS t_d_sharing;

-- Log removal (only if migration_log table exists)
INSERT INTO migration_log (migration_name, executed_at, description)
SELECT 'drop_sharing_table', NOW(), 'Removed sharing functionality - dropped t_d_sharing table'
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'migration_log');