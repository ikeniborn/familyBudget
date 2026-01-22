-- PGlite Schema v4: Recurring Plans Optimization
-- Phase 4: Performance Indexes for Recurring Plans
-- Created: 2026-01-22
--
-- Purpose: Add performance indexes for local_recurring_plans table
-- (Table already exists in v2, this migration only adds indexes)

-- ========================================
-- RECURRING PLANS INDEXES FOR PERFORMANCE
-- ========================================

-- Index for filtering by user
CREATE INDEX IF NOT EXISTS idx_recurring_plans_user
  ON local_recurring_plans(user_id);

-- Index for filtering active plans
CREATE INDEX IF NOT EXISTS idx_recurring_plans_active
  ON local_recurring_plans(is_active) WHERE is_active = true;

-- Index for filtering by article
CREATE INDEX IF NOT EXISTS idx_recurring_plans_article
  ON local_recurring_plans(article_id);

-- Index for filtering by financial center
CREATE INDEX IF NOT EXISTS idx_recurring_plans_financial_center
  ON local_recurring_plans(financial_center_id);

-- Composite index for common query pattern (user + active)
CREATE INDEX IF NOT EXISTS idx_recurring_plans_user_active
  ON local_recurring_plans(user_id, is_active) WHERE is_active = true;

-- Index for frequency-based queries
CREATE INDEX IF NOT EXISTS idx_recurring_plans_frequency
  ON local_recurring_plans(frequency);
