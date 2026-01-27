-- PGlite Schema v5: Expand Article Types
-- Add support for 'debit' and 'credit' article types
-- Created: 2026-01-27
--
-- Background: API returns articles with types: income, expense, debit, credit
-- Previous schema only allowed: income, expense
-- This caused constraint violation during reference data sync

-- Drop old CHECK constraint
ALTER TABLE local_articles
  DROP CONSTRAINT IF EXISTS local_articles_type_check;

-- Add new CHECK constraint with all 4 types
ALTER TABLE local_articles
  ADD CONSTRAINT local_articles_type_check
  CHECK (type IN ('income', 'expense', 'debit', 'credit'));
