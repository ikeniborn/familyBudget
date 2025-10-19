-- ============================================================================
-- Migration: 007_create_article_hierarchy_triggers.sql
-- Description: Create triggers for automatic Closure Table maintenance
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-09
-- Task: TASK-005 (Triggers для Closure Table)
-- Risk Mitigation: RISK-001 (Closure Table Complexity)
-- ============================================================================

-- ============================================================================
-- OVERVIEW
--
-- This migration creates PostgreSQL triggers to automatically maintain
-- the t_d_article_hierarchy Closure Table when records are inserted,
-- updated, or deleted in t_d_article.
--
-- Trigger Logic:
-- 1. INSERT: Add self-reference + copy all ancestor paths from parent
-- 2. UPDATE (parent_id change): Rebuild paths for entire subtree
-- 3. DELETE: CASCADE handled by FK constraint
--
-- Validations:
-- - Prevent circular references
-- - Enforce max hierarchy depth (10 levels)
-- - Only process current records (is_current = TRUE)
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTION: Get hierarchy depth for an article
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

-- ============================================================================
-- HELPER FUNCTION: Check if adding parent would create circular reference
-- ============================================================================

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

-- ============================================================================
-- TRIGGER FUNCTION: Insert article hierarchy paths
-- ============================================================================

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

-- ============================================================================
-- TRIGGER FUNCTION: Update article hierarchy paths
-- ============================================================================

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

-- ============================================================================
-- TRIGGER FUNCTION: Clean up hierarchy on article deletion
-- ============================================================================
-- Note: CASCADE on FK already handles deletion, but we add this for explicitness
-- and potential future custom logic

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

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Trigger for INSERT
DROP TRIGGER IF EXISTS trg_article_hierarchy_insert_after ON t_d_article;
CREATE TRIGGER trg_article_hierarchy_insert_after
    AFTER INSERT ON t_d_article
    FOR EACH ROW
    EXECUTE FUNCTION trg_article_hierarchy_insert();

-- Trigger for UPDATE
DROP TRIGGER IF EXISTS trg_article_hierarchy_update_after ON t_d_article;
CREATE TRIGGER trg_article_hierarchy_update_after
    AFTER UPDATE ON t_d_article
    FOR EACH ROW
    WHEN (OLD.parent_id IS DISTINCT FROM NEW.parent_id)
    EXECUTE FUNCTION trg_article_hierarchy_update();

-- Trigger for DELETE (optional, for explicitness)
DROP TRIGGER IF EXISTS trg_article_hierarchy_delete_before ON t_d_article;
CREATE TRIGGER trg_article_hierarchy_delete_before
    BEFORE DELETE ON t_d_article
    FOR EACH ROW
    EXECUTE FUNCTION trg_article_hierarchy_delete();

-- ============================================================================
-- COMMENTS ON TRIGGERS
-- ============================================================================

COMMENT ON TRIGGER trg_article_hierarchy_insert_after ON t_d_article IS
    'Maintains Closure Table on INSERT: adds self-reference and copies ancestor paths from parent';

COMMENT ON TRIGGER trg_article_hierarchy_update_after ON t_d_article IS
    'Maintains Closure Table on UPDATE: rebuilds paths when parent_id changes';

COMMENT ON TRIGGER trg_article_hierarchy_delete_before ON t_d_article IS
    'Logs article deletion (CASCADE handled by FK constraint)';

-- ============================================================================
-- EXAMPLE USAGE & TEST CASES
-- ============================================================================

-- Test Case 1: Insert root article (no parent)
-- INSERT INTO t_d_article (user_id, name, type, is_global, parent_id)
-- VALUES (1, 'Доходы', 'income', FALSE, NULL);
-- Expected: 1 row in hierarchy (self-reference with depth=0)

-- Test Case 2: Insert child article
-- INSERT INTO t_d_article (user_id, name, type, is_global, parent_id)
-- VALUES (1, 'Зарплата', 'income', FALSE, 1);
-- Expected: 2 rows in hierarchy (self-reference + parent path)

-- Test Case 3: Insert grandchild article
-- INSERT INTO t_d_article (user_id, name, type, is_global, parent_id)
-- VALUES (1, 'Бонусы', 'income', FALSE, 2);
-- Expected: 3 rows in hierarchy (self + parent + grandparent)

-- Test Case 4: Update parent_id (move article to different parent)
-- UPDATE t_d_article SET parent_id = 5 WHERE id = 2;
-- Expected: All paths for article 2 and its descendants are rebuilt

-- Test Case 5: Circular reference prevention
-- UPDATE t_d_article SET parent_id = 3 WHERE id = 1;
-- Expected: EXCEPTION 'Circular reference detected'

-- Test Case 6: Max depth validation
-- Create 11 levels of hierarchy
-- Expected: EXCEPTION 'Maximum hierarchy depth (10) exceeded'

-- Test Case 7: Delete article with children
-- DELETE FROM t_d_article WHERE id = 1;
-- Expected: Cascade deletion removes all hierarchy paths

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify triggers exist
-- SELECT trigger_name, event_manipulation, event_object_table
-- FROM information_schema.triggers
-- WHERE event_object_table = 't_d_article'
-- ORDER BY trigger_name;

-- Verify functions exist
-- SELECT routine_name, routine_type
-- FROM information_schema.routines
-- WHERE routine_name LIKE '%article_hierarchy%'
-- ORDER BY routine_name;

-- Test circular reference detection
-- SELECT would_create_circular_reference(1, 3);

-- Test depth calculation
-- SELECT id, name, get_article_depth(id) as depth
-- FROM t_d_article
-- WHERE is_current = TRUE;

-- Verify hierarchy integrity
-- Should return 0 rows (all depths should be consistent):
-- SELECT h1.ancestor_id, h1.descendant_id, h1.depth as calculated_depth,
--        (SELECT COUNT(*) - 1 FROM t_d_article_hierarchy h2
--         WHERE h2.ancestor_id = h1.ancestor_id
--           AND h2.descendant_id = h1.descendant_id) as actual_depth
-- FROM t_d_article_hierarchy h1
-- WHERE h1.depth != (
--     SELECT COUNT(*) - 1
--     FROM t_d_article a
--     START WITH a.id = h1.descendant_id
--     CONNECT BY PRIOR a.parent_id = a.id
-- );

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================
--
-- These triggers are executed synchronously during INSERT/UPDATE operations.
-- Performance considerations:
--
-- 1. INSERT: O(depth) - copies all ancestor paths from parent
--    - Best case (root): 1 insert (self-reference only)
--    - Worst case (depth 10): 11 inserts (self + 10 ancestors)
--
-- 2. UPDATE (parent_id change): O(subtree_size × depth)
--    - Rebuilds paths for entire subtree
--    - Can be expensive for large subtrees at deep levels
--    - Consider deferring hierarchy changes to batch jobs if needed
--
-- 3. DELETE: O(1) - CASCADE handled by database
--
-- For most family budget use cases (< 100 categories per user, < 5 levels deep),
-- performance should be acceptable (< 10ms per operation).
--
-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
