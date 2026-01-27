-- PGlite Schema v1: Reference Data
-- Phase 1: Articles, Financial Centers, Cost Centers, Article Hierarchy
-- Created: 2026-01-21

-- Migration tracking table (created first)
CREATE TABLE IF NOT EXISTS local_schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT NOW()
);

-- Reference data tables

-- Articles (income/expense categories with hierarchical support)
CREATE TABLE IF NOT EXISTS local_articles (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  parent_id INTEGER,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Financial Centers (bank accounts, wallets, cards)
-- Matches backend model FinancialCenter (SCD Type 1)
CREATE TABLE IF NOT EXISTS local_financial_centers (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  code TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Cost Centers (projects, departments)
CREATE TABLE IF NOT EXISTS local_cost_centers (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Closure table for article hierarchy
-- Enables fast queries for all ancestors/descendants
CREATE TABLE IF NOT EXISTS local_article_hierarchy (
  ancestor_id INTEGER NOT NULL,
  descendant_id INTEGER NOT NULL,
  depth INTEGER NOT NULL,
  PRIMARY KEY (ancestor_id, descendant_id),
  FOREIGN KEY (ancestor_id) REFERENCES local_articles(id) ON DELETE CASCADE,
  FOREIGN KEY (descendant_id) REFERENCES local_articles(id) ON DELETE CASCADE
);

-- Sync metadata (tracks last sync timestamp per entity type)
CREATE TABLE IF NOT EXISTS local_sync_metadata (
  entity_type TEXT PRIMARY KEY,
  last_sync_timestamp TIMESTAMP,
  sync_version INTEGER DEFAULT 1,
  total_records INTEGER DEFAULT 0,
  metadata JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance

-- Articles indexes
CREATE INDEX IF NOT EXISTS idx_articles_user_type ON local_articles(user_id, type);
CREATE INDEX IF NOT EXISTS idx_articles_parent ON local_articles(parent_id);
CREATE INDEX IF NOT EXISTS idx_articles_active ON local_articles(is_active) WHERE is_active = true;

-- Financial Centers indexes
CREATE INDEX IF NOT EXISTS idx_financial_centers_user ON local_financial_centers(user_id);
CREATE INDEX IF NOT EXISTS idx_financial_centers_active ON local_financial_centers(is_active) WHERE is_active = true;

-- Cost Centers indexes
CREATE INDEX IF NOT EXISTS idx_cost_centers_user ON local_cost_centers(user_id);
CREATE INDEX IF NOT EXISTS idx_cost_centers_active ON local_cost_centers(is_active) WHERE is_active = true;

-- Article Hierarchy indexes
CREATE INDEX IF NOT EXISTS idx_hierarchy_ancestor ON local_article_hierarchy(ancestor_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_descendant ON local_article_hierarchy(descendant_id);
CREATE INDEX IF NOT EXISTS idx_hierarchy_depth ON local_article_hierarchy(depth);
