-- PGlite Schema v6: Remove Financial Center Type Field
-- Backend model FinancialCenter doesn't have 'type' field
-- Remove CHECK constraint and drop column from local_financial_centers

-- Drop CHECK constraint first (if exists)
ALTER TABLE local_financial_centers
  DROP CONSTRAINT IF EXISTS local_financial_centers_type_check;

-- Drop type column
ALTER TABLE local_financial_centers
  DROP COLUMN IF EXISTS type;

-- Drop currency column as well (not in backend model)
ALTER TABLE local_financial_centers
  DROP COLUMN IF EXISTS currency;
