-- PGlite Schema v7: Add Missing Financial Center Columns
-- Fix for users who applied v6 before ADD COLUMN statements were added
-- This migration adds description, code, updated_at if they don't exist

ALTER TABLE local_financial_centers
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE local_financial_centers
  ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE local_financial_centers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
