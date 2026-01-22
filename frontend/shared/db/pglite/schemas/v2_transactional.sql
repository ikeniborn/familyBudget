-- PGlite Schema v2: Transactional Data
-- Phase 2: Budget Facts, Pending Operations, Sync Conflicts, Recurring Plans
-- Created: 2026-01-21

-- Budget Facts (transactional data with sync tracking)
CREATE TABLE IF NOT EXISTS local_budget_facts (
  id INTEGER,                       -- Server ID (null for pending creates)
  temp_id TEXT PRIMARY KEY,         -- Client-side temporary ID (UUID)
  user_id INTEGER NOT NULL,

  -- Foreign keys
  article_id INTEGER NOT NULL,
  financial_center_id INTEGER NOT NULL,
  cost_center_id INTEGER,

  -- Transaction data
  date DATE NOT NULL,
  amount NUMERIC(12, 2) NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('fact', 'plan')),
  comment TEXT,

  -- Transfer tracking
  transfer_group_id TEXT,
  is_transfer BOOLEAN DEFAULT false,

  -- Sync tracking
  sync_status TEXT NOT NULL CHECK (sync_status IN ('synced', 'pending', 'conflict', 'deleted')) DEFAULT 'synced',
  sync_hash TEXT,                   -- MD5 hash for conflict detection
  content_hash TEXT,                -- Content hash for deduplication

  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  synced_at TIMESTAMP

  -- Note: No foreign key constraints for offline-first mode
  -- FK integrity will be validated on server during sync
);

-- Pending operations queue (client-side only)
CREATE TABLE IF NOT EXISTS local_pending_operations (
  id SERIAL PRIMARY KEY,
  operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
  entity_type TEXT NOT NULL DEFAULT 'fact',
  temp_id TEXT,                     -- For creates
  server_id INTEGER,                -- For updates/deletes

  -- Operation payload (JSON)
  payload JSONB NOT NULL,

  -- Retry tracking
  attempts INTEGER DEFAULT 0,
  max_attempts INTEGER DEFAULT 3,
  last_error TEXT,

  -- Deduplication
  content_hash TEXT UNIQUE,         -- Prevent duplicate operations

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Sync conflicts log
CREATE TABLE IF NOT EXISTS local_sync_conflicts (
  id SERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  temp_id TEXT,

  -- Conflict data
  local_version JSONB,
  server_version JSONB,

  -- Resolution
  resolution TEXT CHECK (resolution IN ('server', 'client', 'merged', 'pending')),
  resolved_at TIMESTAMP,

  created_at TIMESTAMP DEFAULT NOW()
);

-- Recurring Plans (lightweight reference data)
CREATE TABLE IF NOT EXISTS local_recurring_plans (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  article_id INTEGER NOT NULL,
  financial_center_id INTEGER NOT NULL,
  cost_center_id INTEGER,

  amount NUMERIC(12, 2) NOT NULL,
  day_of_month INTEGER,
  frequency TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMP DEFAULT NOW()

  -- Note: No foreign key constraints for offline-first mode
  -- FK integrity will be validated on server during sync
);

-- Indexes for performance

-- Budget Facts indexes
CREATE INDEX IF NOT EXISTS idx_facts_user_date ON local_budget_facts(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_facts_article ON local_budget_facts(article_id);
CREATE INDEX IF NOT EXISTS idx_facts_financial_center ON local_budget_facts(financial_center_id);
CREATE INDEX IF NOT EXISTS idx_facts_sync_status ON local_budget_facts(sync_status);
CREATE INDEX IF NOT EXISTS idx_facts_temp_id ON local_budget_facts(temp_id) WHERE temp_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_facts_transfer_group ON local_budget_facts(transfer_group_id) WHERE transfer_group_id IS NOT NULL;

-- Pending Operations indexes
CREATE INDEX IF NOT EXISTS idx_pending_ops_status ON local_pending_operations(operation, attempts);
CREATE INDEX IF NOT EXISTS idx_pending_ops_temp_id ON local_pending_operations(temp_id) WHERE temp_id IS NOT NULL;

-- Sync Conflicts indexes
CREATE INDEX IF NOT EXISTS idx_conflicts_pending ON local_sync_conflicts(resolution) WHERE resolution = 'pending';
