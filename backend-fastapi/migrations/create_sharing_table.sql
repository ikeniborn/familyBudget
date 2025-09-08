-- Create t_d_sharing table for user data sharing
-- Migration: create_sharing_table.sql  
-- Created: 2025-09-08

-- Create sharing table
CREATE TABLE t_d_sharing (
    sharing_id SERIAL PRIMARY KEY,
    owner_user_id INTEGER NOT NULL,
    shared_with_user_id INTEGER NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    permission_type VARCHAR(20) NOT NULL DEFAULT 'read',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_dttm TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    
    -- Foreign key constraints
    CONSTRAINT fk_t_d_sharing_owner_user_id FOREIGN KEY (owner_user_id) REFERENCES t_d_user(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_t_d_sharing_shared_with_user_id FOREIGN KEY (shared_with_user_id) REFERENCES t_d_user(user_id) ON DELETE CASCADE,
    
    -- Check constraints
    CONSTRAINT ck_t_d_sharing_resource_type CHECK (resource_type IN ('nomenclature', 'cost_center', 'financial_center', 'product')),
    CONSTRAINT ck_t_d_sharing_permission_type CHECK (permission_type IN ('read', 'write')),
    CONSTRAINT ck_t_d_sharing_different_users CHECK (owner_user_id != shared_with_user_id),
    
    -- Unique constraint to prevent duplicate sharing
    CONSTRAINT uq_t_d_sharing_owner_shared_resource UNIQUE (owner_user_id, shared_with_user_id, resource_type, resource_id)
);

-- Create indexes for performance
CREATE INDEX ix_t_d_sharing_owner_user_id ON t_d_sharing(owner_user_id);
CREATE INDEX ix_t_d_sharing_shared_with_user_id ON t_d_sharing(shared_with_user_id);
CREATE INDEX ix_t_d_sharing_resource_type ON t_d_sharing(resource_type);
CREATE INDEX ix_t_d_sharing_owner_resource ON t_d_sharing(owner_user_id, resource_type);
CREATE INDEX ix_t_d_sharing_shared_resource ON t_d_sharing(shared_with_user_id, resource_type);
CREATE INDEX ix_t_d_sharing_active ON t_d_sharing(is_active) WHERE is_active = true;

-- Comments
COMMENT ON TABLE t_d_sharing IS 'Table for managing data sharing between users';
COMMENT ON COLUMN t_d_sharing.owner_user_id IS 'User who owns the data';
COMMENT ON COLUMN t_d_sharing.shared_with_user_id IS 'User who receives shared access';  
COMMENT ON COLUMN t_d_sharing.resource_type IS 'Type of resource being shared';
COMMENT ON COLUMN t_d_sharing.resource_id IS 'Specific resource ID, NULL means all resources of type';
COMMENT ON COLUMN t_d_sharing.permission_type IS 'Type of permission: read or write';
COMMENT ON COLUMN t_d_sharing.is_active IS 'Whether the sharing is currently active';