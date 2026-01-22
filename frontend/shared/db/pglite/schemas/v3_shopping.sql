-- PGlite Schema v3: Shopping Lists
-- Phase 3: Full Offline Support for Shopping Lists
-- Created: 2026-01-22

-- ========================================
-- REFERENCE DATA (Read-Only from Server)
-- ========================================

-- Stores (shopping locations)
CREATE TABLE IF NOT EXISTS local_stores (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Product Groups (categories with hierarchy)
CREATE TABLE IF NOT EXISTS local_product_groups (
  id INTEGER PRIMARY KEY,
  parent_id INTEGER,
  name TEXT NOT NULL,
  code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Product Group Hierarchy (Closure Table for fast queries)
CREATE TABLE IF NOT EXISTS local_product_group_hierarchy (
  ancestor_id INTEGER NOT NULL,
  descendant_id INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id)
);

-- ========================================
-- TRANSACTIONAL DATA (User Mutations)
-- ========================================

-- Shopping Lists (Header table)
CREATE TABLE IF NOT EXISTS local_shopping_lists (
  id INTEGER,                       -- Server ID (null for pending creates)
  temp_id TEXT PRIMARY KEY,         -- Client-side UUID
  creator_id INTEGER NOT NULL,      -- Audit only (NOT for filtering)

  -- Business attributes
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,

  -- Sync tracking
  sync_status TEXT NOT NULL CHECK (sync_status IN ('synced', 'pending', 'conflict', 'deleted')) DEFAULT 'synced',
  sync_hash TEXT,
  content_hash TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP

  -- Note: No foreign key constraints for offline-first mode
  -- FK integrity will be validated on server during sync
);

-- Shopping List Items (Lines table)
CREATE TABLE IF NOT EXISTS local_shopping_list_items (
  id INTEGER,
  temp_id TEXT PRIMARY KEY,
  creator_id INTEGER NOT NULL,

  -- Foreign keys (temp_id for offline creates)
  shopping_list_temp_id TEXT NOT NULL,
  store_id INTEGER NOT NULL,
  product_group_id INTEGER NOT NULL,

  -- Business attributes
  product_name TEXT NOT NULL,
  quantity NUMERIC(10, 3),
  unit TEXT,
  comment TEXT,

  -- Completion status
  is_completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMP,

  -- Sync tracking (LWW + optimistic locking)
  sync_status TEXT NOT NULL CHECK (sync_status IN ('synced', 'pending', 'conflict', 'deleted')) DEFAULT 'synced',
  sync_hash TEXT,
  content_hash TEXT,
  version INTEGER DEFAULT 1,

  -- Soft delete
  deleted_at TIMESTAMP,
  last_modified_by INTEGER,

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP

  -- Note: No foreign key constraints for offline-first mode
  -- FK integrity will be validated on server during sync
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Stores indexes
CREATE INDEX IF NOT EXISTS idx_stores_active
  ON local_stores(is_active) WHERE is_active = true;

-- Product Groups indexes
CREATE INDEX IF NOT EXISTS idx_product_groups_parent
  ON local_product_groups(parent_id);
CREATE INDEX IF NOT EXISTS idx_product_groups_active
  ON local_product_groups(is_active) WHERE is_active = true;

-- Product Group Hierarchy indexes
CREATE INDEX IF NOT EXISTS idx_pgh_ancestor
  ON local_product_group_hierarchy(ancestor_id);
CREATE INDEX IF NOT EXISTS idx_pgh_descendant
  ON local_product_group_hierarchy(descendant_id);
CREATE INDEX IF NOT EXISTS idx_pgh_depth
  ON local_product_group_hierarchy(depth);

-- Shopping Lists indexes
CREATE INDEX IF NOT EXISTS idx_shopping_lists_id
  ON local_shopping_lists(id) WHERE id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shopping_lists_sync_status
  ON local_shopping_lists(sync_status);
CREATE INDEX IF NOT EXISTS idx_shopping_lists_active
  ON local_shopping_lists(is_active) WHERE is_active = true;

-- Shopping List Items indexes
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_id
  ON local_shopping_list_items(id) WHERE id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_list
  ON local_shopping_list_items(shopping_list_temp_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_store
  ON local_shopping_list_items(store_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_product_group
  ON local_shopping_list_items(product_group_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_completed
  ON local_shopping_list_items(is_completed);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_sync_status
  ON local_shopping_list_items(sync_status);
CREATE INDEX IF NOT EXISTS idx_shopping_list_items_deleted
  ON local_shopping_list_items(deleted_at) WHERE deleted_at IS NULL;
