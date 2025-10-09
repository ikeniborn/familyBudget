-- ============================================================================
-- Migration: 008_create_scd2_triggers.sql
-- Description: Create SCD Type 2 triggers for automatic versioning
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-09
-- Task: TASK-004 (Triggers для SCD2)
-- ============================================================================

-- ============================================================================
-- OVERVIEW
--
-- This migration creates PostgreSQL triggers to automatically maintain
-- SCD Type 2 (Slowly Changing Dimension Type 2) versioning for dimension tables.
--
-- SCD Type 2 Logic:
-- When a business attribute changes in a dimension record:
-- 1. Close current version: SET is_current = FALSE, valid_to = NOW()
-- 2. Insert new version: INSERT with is_current = TRUE, valid_from = NOW()
--
-- Benefits:
-- - Automatic historical tracking
-- - Time-travel queries (as of specific date)
-- - Audit trail for all changes
-- - Referential integrity with fact tables
-- ============================================================================

-- ============================================================================
-- TRIGGER FUNCTION: SCD2 for t_d_user
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_scd2_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if this is the current record
    IF OLD.is_current = FALSE THEN
        RAISE EXCEPTION 'Cannot update non-current record (id=%). Update the current version instead.', OLD.id;
    END IF;

    -- Check if any tracked business attributes changed
    -- Tracked: username, first_name, last_name, is_admin
    -- Not tracked: SCD2 fields (valid_from, valid_to, is_current), audit fields (created_at, updated_at)
    IF (OLD.username IS DISTINCT FROM NEW.username)
       OR (OLD.first_name IS DISTINCT FROM NEW.first_name)
       OR (OLD.last_name IS DISTINCT FROM NEW.last_name)
       OR (OLD.is_admin IS DISTINCT FROM NEW.is_admin)
    THEN
        -- Step 1: Close current version
        UPDATE t_d_user
        SET is_current = FALSE,
            valid_to = NOW(),
            updated_at = NOW()
        WHERE id = OLD.id;

        -- Step 2: Insert new version
        INSERT INTO t_d_user (
            telegram_id,
            username,
            first_name,
            last_name,
            is_admin,
            valid_from,
            valid_to,
            is_current,
            created_at,
            updated_at
        ) VALUES (
            NEW.telegram_id,
            NEW.username,
            NEW.first_name,
            NEW.last_name,
            NEW.is_admin,
            NOW(),                          -- valid_from = NOW()
            '9999-12-31 23:59:59'::TIMESTAMP, -- valid_to = far future
            TRUE,                            -- is_current = TRUE
            NOW(),                           -- created_at = NOW()
            NOW()                            -- updated_at = NOW()
        );

        -- Prevent the original UPDATE from executing
        RETURN NULL;
    ELSE
        -- No tracked attributes changed, allow update (e.g., updated_at only)
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trg_scd2_user() IS
    'SCD Type 2 trigger for t_d_user. ' ||
    'Tracks changes to: username, first_name, last_name, is_admin. ' ||
    'Automatically closes current version and creates new version on change.';

-- ============================================================================
-- TRIGGER FUNCTION: SCD2 for t_d_article
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_scd2_article()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if this is the current record
    IF OLD.is_current = FALSE THEN
        RAISE EXCEPTION 'Cannot update non-current record (id=%). Update the current version instead.', OLD.id;
    END IF;

    -- Check if any tracked business attributes changed
    -- Tracked: name, type, code, is_global
    -- Not tracked: parent_id (handled by hierarchy triggers), SCD2 fields, audit fields
    IF (OLD.name IS DISTINCT FROM NEW.name)
       OR (OLD.type IS DISTINCT FROM NEW.type)
       OR (OLD.code IS DISTINCT FROM NEW.code)
       OR (OLD.is_global IS DISTINCT FROM NEW.is_global)
    THEN
        -- Step 1: Close current version
        UPDATE t_d_article
        SET is_current = FALSE,
            valid_to = NOW(),
            updated_at = NOW()
        WHERE id = OLD.id;

        -- Step 2: Insert new version
        INSERT INTO t_d_article (
            user_id,
            parent_id,
            code,
            name,
            type,
            is_global,
            valid_from,
            valid_to,
            is_current,
            created_at,
            updated_at
        ) VALUES (
            NEW.user_id,
            NEW.parent_id,
            NEW.code,
            NEW.name,
            NEW.type,
            NEW.is_global,
            NOW(),
            '9999-12-31 23:59:59'::TIMESTAMP,
            TRUE,
            NOW(),
            NOW()
        );

        -- Prevent the original UPDATE from executing
        RETURN NULL;
    ELSE
        -- No tracked attributes changed, allow update
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trg_scd2_article() IS
    'SCD Type 2 trigger for t_d_article. ' ||
    'Tracks changes to: name, type, code, is_global. ' ||
    'parent_id changes handled by hierarchy triggers.';

-- ============================================================================
-- TRIGGER FUNCTION: SCD2 for t_d_financial_center
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_scd2_financial_center()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if this is the current record
    IF OLD.is_current = FALSE THEN
        RAISE EXCEPTION 'Cannot update non-current record (id=%). Update the current version instead.', OLD.id;
    END IF;

    -- Check if any tracked business attributes changed
    -- Tracked: name, description, code, is_global
    IF (OLD.name IS DISTINCT FROM NEW.name)
       OR (OLD.description IS DISTINCT FROM NEW.description)
       OR (OLD.code IS DISTINCT FROM NEW.code)
       OR (OLD.is_global IS DISTINCT FROM NEW.is_global)
    THEN
        -- Step 1: Close current version
        UPDATE t_d_financial_center
        SET is_current = FALSE,
            valid_to = NOW(),
            updated_at = NOW()
        WHERE id = OLD.id;

        -- Step 2: Insert new version
        INSERT INTO t_d_financial_center (
            user_id,
            code,
            name,
            description,
            is_global,
            valid_from,
            valid_to,
            is_current,
            created_at,
            updated_at
        ) VALUES (
            NEW.user_id,
            NEW.code,
            NEW.name,
            NEW.description,
            NEW.is_global,
            NOW(),
            '9999-12-31 23:59:59'::TIMESTAMP,
            TRUE,
            NOW(),
            NOW()
        );

        -- Prevent the original UPDATE from executing
        RETURN NULL;
    ELSE
        -- No tracked attributes changed, allow update
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trg_scd2_financial_center() IS
    'SCD Type 2 trigger for t_d_financial_center. ' ||
    'Tracks changes to: name, description, code, is_global.';

-- ============================================================================
-- TRIGGER FUNCTION: SCD2 for t_d_cost_center
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_scd2_cost_center()
RETURNS TRIGGER AS $$
BEGIN
    -- Only process if this is the current record
    IF OLD.is_current = FALSE THEN
        RAISE EXCEPTION 'Cannot update non-current record (id=%). Update the current version instead.', OLD.id;
    END IF;

    -- Check if any tracked business attributes changed
    -- Tracked: name, description, code, is_global
    IF (OLD.name IS DISTINCT FROM NEW.name)
       OR (OLD.description IS DISTINCT FROM NEW.description)
       OR (OLD.code IS DISTINCT FROM NEW.code)
       OR (OLD.is_global IS DISTINCT FROM NEW.is_global)
    THEN
        -- Step 1: Close current version
        UPDATE t_d_cost_center
        SET is_current = FALSE,
            valid_to = NOW(),
            updated_at = NOW()
        WHERE id = OLD.id;

        -- Step 2: Insert new version
        INSERT INTO t_d_cost_center (
            user_id,
            code,
            name,
            description,
            is_global,
            valid_from,
            valid_to,
            is_current,
            created_at,
            updated_at
        ) VALUES (
            NEW.user_id,
            NEW.code,
            NEW.name,
            NEW.description,
            NEW.is_global,
            NOW(),
            '9999-12-31 23:59:59'::TIMESTAMP,
            TRUE,
            NOW(),
            NOW()
        );

        -- Prevent the original UPDATE from executing
        RETURN NULL;
    ELSE
        -- No tracked attributes changed, allow update
        NEW.updated_at := NOW();
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION trg_scd2_cost_center() IS
    'SCD Type 2 trigger for t_d_cost_center. ' ||
    'Tracks changes to: name, description, code, is_global.';

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Trigger for t_d_user
CREATE TRIGGER trg_scd2_user_before_update
    BEFORE UPDATE ON t_d_user
    FOR EACH ROW
    EXECUTE FUNCTION trg_scd2_user();

-- Trigger for t_d_article
CREATE TRIGGER trg_scd2_article_before_update
    BEFORE UPDATE ON t_d_article
    FOR EACH ROW
    EXECUTE FUNCTION trg_scd2_article();

-- Trigger for t_d_financial_center
CREATE TRIGGER trg_scd2_financial_center_before_update
    BEFORE UPDATE ON t_d_financial_center
    FOR EACH ROW
    EXECUTE FUNCTION trg_scd2_financial_center();

-- Trigger for t_d_cost_center
CREATE TRIGGER trg_scd2_cost_center_before_update
    BEFORE UPDATE ON t_d_cost_center
    FOR EACH ROW
    EXECUTE FUNCTION trg_scd2_cost_center();

-- ============================================================================
-- COMMENTS ON TRIGGERS
-- ============================================================================

COMMENT ON TRIGGER trg_scd2_user_before_update ON t_d_user IS
    'SCD Type 2: Automatically versions user records on attribute changes';

COMMENT ON TRIGGER trg_scd2_article_before_update ON t_d_article IS
    'SCD Type 2: Automatically versions article records on attribute changes';

COMMENT ON TRIGGER trg_scd2_financial_center_before_update ON t_d_financial_center IS
    'SCD Type 2: Automatically versions financial center records on attribute changes';

COMMENT ON TRIGGER trg_scd2_cost_center_before_update ON t_d_cost_center IS
    'SCD Type 2: Automatically versions cost center records on attribute changes';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Example 1: Update user (creates new version)
-- INSERT INTO t_d_user (telegram_id, username, first_name, is_admin)
-- VALUES (123456, 'john', 'John', FALSE);
--
-- UPDATE t_d_user
-- SET username = 'john_doe'
-- WHERE telegram_id = 123456 AND is_current = TRUE;
--
-- Result: 2 versions in table
-- - Version 1: username='john', is_current=FALSE, valid_to=NOW()
-- - Version 2: username='john_doe', is_current=TRUE, valid_from=NOW()

-- Example 2: Update non-tracked field (no versioning)
-- UPDATE t_d_user
-- SET updated_at = NOW()
-- WHERE telegram_id = 123456 AND is_current = TRUE;
--
-- Result: Same record updated (no new version)

-- Example 3: Query current version only
-- SELECT * FROM t_d_user WHERE is_current = TRUE;

-- Example 4: Time-travel query (as of specific date)
-- SELECT * FROM t_d_user
-- WHERE telegram_id = 123456
--   AND '2025-01-15'::TIMESTAMP BETWEEN valid_from AND valid_to;

-- Example 5: Query all versions (history)
-- SELECT id, username, valid_from, valid_to, is_current
-- FROM t_d_user
-- WHERE telegram_id = 123456
-- ORDER BY valid_from;

-- ============================================================================
-- IMPORTANT NOTES
-- ============================================================================

-- 1. ALWAYS update current records only
--    ✅ UPDATE t_d_user SET username = 'new' WHERE is_current = TRUE;
--    ❌ UPDATE t_d_user SET username = 'new' WHERE id = 5; -- May fail if not current

-- 2. Fact tables reference dimension IDs (not natural keys)
--    - Fact table stores dimension surrogate key (id) at transaction time
--    - This preserves historical reference even after dimension changes
--    - Example: If article name changes, old facts still reference old version

-- 3. Performance consideration
--    - Each tracked attribute change creates new row (INSERT + UPDATE)
--    - Minimal overhead for typical use case (< 5ms per operation)
--    - Historical table growth is predictable and manageable

-- 4. Trigger execution order
--    - SCD2 triggers run BEFORE UPDATE
--    - Hierarchy triggers run AFTER INSERT/UPDATE
--    - This ensures proper interaction between SCD2 and hierarchy maintenance

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify triggers exist
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE trigger_name LIKE 'trg_scd2%'
-- ORDER BY event_object_table, trigger_name;

-- Verify functions exist
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_name LIKE 'trg_scd2%'
-- ORDER BY routine_name;

-- Check for duplicate current records (should return 0 rows)
-- SELECT telegram_id, COUNT(*) as current_count
-- FROM t_d_user
-- WHERE is_current = TRUE
-- GROUP BY telegram_id
-- HAVING COUNT(*) > 1;

-- Check for overlapping date ranges (should return 0 rows)
-- SELECT u1.telegram_id, u1.id, u2.id
-- FROM t_d_user u1
-- JOIN t_d_user u2 ON u1.telegram_id = u2.telegram_id AND u1.id != u2.id
-- WHERE u1.valid_from < u2.valid_to
--   AND u1.valid_to > u2.valid_from;

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
