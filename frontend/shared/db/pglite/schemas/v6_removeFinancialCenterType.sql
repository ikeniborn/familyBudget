-- PGlite Schema v6: Align Financial Centers with Backend Model
-- Backend model FinancialCenter doesn't have 'type'/'currency' fields
-- Add description, code, updated_at fields to match backend

-- Step 1: Drop old fields (type, currency)
ALTER TABLE local_financial_centers
  DROP CONSTRAINT IF EXISTS local_financial_centers_type_check;

ALTER TABLE local_financial_centers
  DROP COLUMN IF EXISTS type;

ALTER TABLE local_financial_centers
  DROP COLUMN IF EXISTS currency;

-- Step 2: Add new fields (description, code, updated_at)
ALTER TABLE local_financial_centers
  ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE local_financial_centers
  ADD COLUMN IF NOT EXISTS code TEXT;

ALTER TABLE local_financial_centers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
