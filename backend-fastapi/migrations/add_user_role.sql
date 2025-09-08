-- Add role field to t_d_user table
-- Migration: add_user_role.sql
-- Created: 2025-09-08

-- Add role column to user table
ALTER TABLE t_d_user ADD COLUMN user_role VARCHAR(20) NOT NULL DEFAULT 'user';

-- Create index on role for performance
CREATE INDEX ix_t_d_user_user_role ON t_d_user(user_role);

-- Set admin role for user_id = 1 (existing admin user)
UPDATE t_d_user SET user_role = 'admin' WHERE user_id = 1;

-- Add check constraint to ensure valid roles
ALTER TABLE t_d_user ADD CONSTRAINT ck_t_d_user_role CHECK (user_role IN ('admin', 'user'));

-- Comment on the column
COMMENT ON COLUMN t_d_user.user_role IS 'User role: admin or user';