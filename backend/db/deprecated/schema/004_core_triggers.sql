-- ============================================================================
-- Schema DDL: 004_core_triggers.sql
-- Description: Database triggers (Hierarchy + SCD Type 2)
-- Version: 5.0.0 (Base Schema)
-- Date: 2025-11-08
-- ============================================================================
--
-- This file contains all database triggers:
-- - Article hierarchy triggers (maintain Closure Table)
-- - SCD Type 2 triggers (update updated_at timestamps)
--
-- DO NOT MODIFY in Production Mode - use Alembic migrations instead!
-- ============================================================================

CREATE OR REPLACE FUNCTION get_article_depth(p_article_id INT)
RETURNS INT AS $$
DECLARE
    v_depth INT;
BEGIN
    SELECT COALESCE(MAX(depth), -1)
    INTO v_depth
    FROM t_d_article_hierarchy
    WHERE descendant_id = p_article_id;
    RETURN v_depth;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION get_article_depth(INT) IS
    'Returns the maximum depth of an article in the hierarchy. Returns -1 if article not found in hierarchy.';
CREATE OR REPLACE FUNCTION would_create_circular_reference(
    p_article_id INT,
    p_parent_id INT
)
RETURNS BOOLEAN AS $$
DECLARE
    v_is_circular BOOLEAN;
BEGIN
    -- Check if parent_id is a descendant of article_id
    -- If yes, adding parent_id as parent would create a cycle
    SELECT EXISTS (
        SELECT 1
        FROM t_d_article_hierarchy
        WHERE ancestor_id = p_article_id
          AND descendant_id = p_parent_id
    ) INTO v_is_circular;
    RETURN v_is_circular;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION would_create_circular_reference(INT, INT) IS
    'Checks if setting parent_id would create a circular reference. Returns TRUE if circular, FALSE otherwise.';
CREATE OR REPLACE FUNCTION trg_article_hierarchy_insert()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_depth INT;
    v_max_depth CONSTANT INT := 10;
BEGIN
    -- Only process current records
    IF NEW.is_current = FALSE THEN
        RETURN NEW;
    END IF;
    -- Step 1: Insert self-reference (depth = 0)
    INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
    VALUES (NEW.id, NEW.id, 0)
    ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
    -- Step 2: If article has parent, copy all parent's ancestors
    IF NEW.parent_id IS NOT NULL THEN
        -- Validate: Check for circular reference
        IF would_create_circular_reference(NEW.id, NEW.parent_id) THEN
            RAISE EXCEPTION 'Circular reference detected: article % cannot be child of % (would create cycle)',
                NEW.id, NEW.parent_id;
        END IF;
        -- Validate: Check max depth
        v_parent_depth := get_article_depth(NEW.parent_id);
        IF v_parent_depth >= v_max_depth THEN
            RAISE EXCEPTION 'Maximum hierarchy depth (%) exceeded: parent % is at depth %, cannot add child',
                v_max_depth, NEW.parent_id, v_parent_depth;
        END IF;
        -- Copy all ancestor paths from parent
        INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
        SELECT h.ancestor_id, NEW.id, h.depth + 1
        FROM t_d_article_hierarchy h
        WHERE h.descendant_id = NEW.parent_id
        ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION trg_article_hierarchy_insert() IS
    'Trigger function to maintain Closure Table on INSERT. Adds self-reference and copies all ancestor paths from parent. Validates circular references and max depth (10 levels).';
CREATE OR REPLACE FUNCTION trg_article_hierarchy_update()
RETURNS TRIGGER AS $$
DECLARE
    v_parent_depth INT;
    v_max_depth CONSTANT INT := 10;
    v_subtree_record RECORD;
BEGIN
    -- Only process current records
    IF NEW.is_current = FALSE THEN
        RETURN NEW;
    END IF;
    -- Only process if parent_id actually changed
    IF OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
        -- Validate: Check for circular reference (if new parent exists)
        IF NEW.parent_id IS NOT NULL THEN
            IF would_create_circular_reference(NEW.id, NEW.parent_id) THEN
                RAISE EXCEPTION 'Circular reference detected: article % cannot be moved under % (would create cycle)',
                    NEW.id, NEW.parent_id;
            END IF;
            -- Validate: Check max depth
            v_parent_depth := get_article_depth(NEW.parent_id);
            IF v_parent_depth >= v_max_depth THEN
                RAISE EXCEPTION 'Maximum hierarchy depth (%) exceeded: parent % is at depth %, cannot move subtree',
                    v_max_depth, NEW.parent_id, v_parent_depth;
            END IF;
        END IF;
        -- Step 1: Delete all ancestor paths for this article and its descendants
        -- (except self-references with depth = 0)
        DELETE FROM t_d_article_hierarchy
        WHERE descendant_id IN (
            -- Get all descendants of updated article (including itself)
            SELECT h.descendant_id
            FROM t_d_article_hierarchy h
            WHERE h.ancestor_id = NEW.id
        )
        AND depth > 0;
        -- Step 2: Rebuild paths for this article and all its descendants
        -- For each node in subtree (including root = NEW.id)
        FOR v_subtree_record IN
            SELECT h.descendant_id as node_id
            FROM t_d_article_hierarchy h
            WHERE h.ancestor_id = NEW.id
        LOOP
            -- Get the direct parent of this node
            DECLARE
                v_node_parent_id INT;
            BEGIN
                SELECT parent_id INTO v_node_parent_id
                FROM t_d_article a
                WHERE a.id = v_subtree_record.node_id
                  AND a.is_current = TRUE;
                -- If node has parent, copy all parent's ancestors
                IF v_node_parent_id IS NOT NULL THEN
                    INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
                    SELECT h.ancestor_id, v_subtree_record.node_id, h.depth + 1
                    FROM t_d_article_hierarchy h
                    WHERE h.descendant_id = v_node_parent_id
                    ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
                END IF;
            END;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION trg_article_hierarchy_update() IS
    'Trigger function to maintain Closure Table on UPDATE. Rebuilds all paths when parent_id changes. Validates circular references and max depth.';
CREATE OR REPLACE FUNCTION trg_article_hierarchy_delete()
RETURNS TRIGGER AS $$
BEGIN
    -- Cascade deletion is handled by FK constraint ON DELETE CASCADE
    -- This trigger is here for explicitness and potential future logic
    -- Log deletion (optional, for audit purposes)
    RAISE NOTICE 'Article % deleted, hierarchy paths will be cascaded', OLD.id;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION trg_article_hierarchy_delete() IS
    'Trigger function on DELETE. Cascade deletion handled by FK constraint. This trigger exists for explicitness and future extensibility.';
DROP TRIGGER IF EXISTS trg_article_hierarchy_insert_after ON t_d_article;
CREATE TRIGGER trg_article_hierarchy_insert_after
    AFTER INSERT ON t_d_article
    FOR EACH ROW
    EXECUTE FUNCTION trg_article_hierarchy_insert();
DROP TRIGGER IF EXISTS trg_article_hierarchy_update_after ON t_d_article;
CREATE TRIGGER trg_article_hierarchy_update_after
    AFTER UPDATE ON t_d_article
    FOR EACH ROW
    WHEN (OLD.parent_id IS DISTINCT FROM NEW.parent_id)
    EXECUTE FUNCTION trg_article_hierarchy_update();
DROP TRIGGER IF EXISTS trg_article_hierarchy_delete_before ON t_d_article;
CREATE TRIGGER trg_article_hierarchy_delete_before
    BEFORE DELETE ON t_d_article
    FOR EACH ROW
    EXECUTE FUNCTION trg_article_hierarchy_delete();
COMMENT ON TRIGGER trg_article_hierarchy_insert_after ON t_d_article IS
    'Maintains Closure Table on INSERT: adds self-reference and copies ancestor paths from parent';
COMMENT ON TRIGGER trg_article_hierarchy_update_after ON t_d_article IS
    'Maintains Closure Table on UPDATE: rebuilds paths when parent_id changes';
COMMENT ON TRIGGER trg_article_hierarchy_delete_before ON t_d_article IS
    'Logs article deletion (CASCADE handled by FK constraint)';

-- ============================================================================
-- SCD TYPE 2 TRIGGERS (from 008_create_scd2_triggers.sql)
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
    'SCD Type 2 trigger for t_d_user. Tracks changes to: username, first_name, last_name, is_admin. Automatically closes current version and creates new version on change.';
CREATE OR REPLACE FUNCTION trg_scd2_article()
RETURNS TRIGGER AS $$
DECLARE
    new_article_id INT;
    children_updated INT;
BEGIN
    -- Only process if this is the current record
    IF OLD.is_current = FALSE THEN
        RAISE EXCEPTION 'Cannot update non-current record (id=%). Update the current version instead.', OLD.id;
    END IF;
    -- Check if any tracked business attributes changed
    -- Tracked: name, type
    -- Not tracked: parent_id (handled by hierarchy triggers), SCD2 fields, audit fields
    -- Note: code and is_global fields were removed in migration 014
    IF (OLD.name IS DISTINCT FROM NEW.name)
       OR (OLD.type IS DISTINCT FROM NEW.type)
    THEN
        -- Step 1: Close current version
        -- Use clock_timestamp() to ensure valid_from < valid_to constraint
        UPDATE t_d_article
        SET is_current = FALSE,
            valid_to = clock_timestamp(),
            updated_at = clock_timestamp()
        WHERE id = OLD.id;
        -- Step 2: Insert new version
        INSERT INTO t_d_article (
            user_id,
            parent_id,
            name,
            type,
            valid_from,
            valid_to,
            is_current,
            created_at,
            updated_at
        ) VALUES (
            NEW.user_id,
            NEW.parent_id,
            NEW.name,
            NEW.type,
            clock_timestamp(),
            '9999-12-31 23:59:59'::TIMESTAMP,
            TRUE,
            NOW(),
            clock_timestamp()
        )
        RETURNING id INTO new_article_id;
        -- Step 3: Update parent_id for all direct children
        -- When parent is versioned (new ID), redirect children to new version
        -- This maintains parent-child relationships across SCD Type 2 versioning
        UPDATE t_d_article
        SET parent_id = new_article_id,
            updated_at = clock_timestamp()
        WHERE parent_id = OLD.id
          AND is_current = TRUE;
        -- Get count of updated children (for logging)
        GET DIAGNOSTICS children_updated = ROW_COUNT;
        -- Log the version creation (useful for debugging)
        RAISE NOTICE 'Created new article version: old_id=%, new_id=%, updated % children',
            OLD.id, new_article_id, children_updated;
        -- Prevent the original UPDATE from executing
        RETURN NULL;
    ELSE
        -- No tracked attributes changed, allow update
        NEW.updated_at := clock_timestamp();
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;
COMMENT ON FUNCTION trg_scd2_article() IS
    'SCD Type 2 trigger for t_d_article. Tracks changes to: name, type. parent_id changes handled by hierarchy triggers. Children automatically follow parent to new version.';
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
    'SCD Type 2 trigger for t_d_financial_center. Tracks changes to: name, description, code, is_global.';
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
    'SCD Type 2 trigger for t_d_cost_center. Tracks changes to: name, description, code, is_global.';
DROP TRIGGER IF EXISTS trg_scd2_user_before_update ON t_d_user;
CREATE TRIGGER trg_scd2_user_before_update
    BEFORE UPDATE ON t_d_user
    FOR EACH ROW
    EXECUTE FUNCTION trg_scd2_user();
DROP TRIGGER IF EXISTS trg_scd2_article_before_update ON t_d_article;
CREATE TRIGGER trg_scd2_article_before_update
    BEFORE UPDATE ON t_d_article
    FOR EACH ROW
    EXECUTE FUNCTION trg_scd2_article();
DROP TRIGGER IF EXISTS trg_scd2_financial_center_before_update ON t_d_financial_center;
CREATE TRIGGER trg_scd2_financial_center_before_update
    BEFORE UPDATE ON t_d_financial_center
    FOR EACH ROW
    EXECUTE FUNCTION trg_scd2_financial_center();
DROP TRIGGER IF EXISTS trg_scd2_cost_center_before_update ON t_d_cost_center;
CREATE TRIGGER trg_scd2_cost_center_before_update
    BEFORE UPDATE ON t_d_cost_center
    FOR EACH ROW
    EXECUTE FUNCTION trg_scd2_cost_center();
COMMENT ON TRIGGER trg_scd2_user_before_update ON t_d_user IS
    'SCD Type 2: Automatically versions user records on attribute changes';
COMMENT ON TRIGGER trg_scd2_article_before_update ON t_d_article IS
    'SCD Type 2: Automatically versions article records on attribute changes';
COMMENT ON TRIGGER trg_scd2_financial_center_before_update ON t_d_financial_center IS
    'SCD Type 2: Automatically versions financial center records on attribute changes';
COMMENT ON TRIGGER trg_scd2_cost_center_before_update ON t_d_cost_center IS
    'SCD Type 2: Automatically versions cost center records on attribute changes';
