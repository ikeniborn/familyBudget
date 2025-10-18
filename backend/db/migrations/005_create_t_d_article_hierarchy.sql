-- ============================================================================
-- Migration: 005_create_t_d_article_hierarchy.sql
-- Description: Create Closure Table for article hierarchy
-- Author: ClaudeCode Implementation System
-- Date: 2025-10-09
-- Task: TASK-001 (ST-002), TASK-003 (Closure Table implementation)
-- ============================================================================

-- ============================================================================
-- TABLE: t_d_article_hierarchy
-- Purpose: Closure Table for efficient hierarchical queries on t_d_article
-- Pattern: Closure Table (stores all paths in hierarchy)
-- ============================================================================

-- ============================================================================
-- IMPORTANT NOTES:
--
-- This table stores ALL paths in the article hierarchy, including:
-- 1. Self-references (ancestor_id = descendant_id, depth = 0)
-- 2. Direct parent-child relationships (depth = 1)
-- 3. All ancestor-descendant relationships (depth > 1)
--
-- Example hierarchy:
--   Root (id=1)
--     └─ Child1 (id=2)
--          └─ Grandchild1 (id=3)
--
-- Closure table entries:
--   (1, 1, 0) -- Root to itself
--   (1, 2, 1) -- Root to Child1
--   (1, 3, 2) -- Root to Grandchild1
--   (2, 2, 0) -- Child1 to itself
--   (2, 3, 1) -- Child1 to Grandchild1
--   (3, 3, 0) -- Grandchild1 to itself
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_d_article_hierarchy (
    -- Composite primary key (ancestor, descendant)
    ancestor_id INT NOT NULL REFERENCES t_d_article(id) ON DELETE CASCADE,
    descendant_id INT NOT NULL REFERENCES t_d_article(id) ON DELETE CASCADE,

    -- Depth of relationship (0 = self, 1 = direct child, 2 = grandchild, etc.)
    depth INT NOT NULL CHECK (depth >= 0),

    -- Audit fields
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Primary key
    PRIMARY KEY (ancestor_id, descendant_id),

    -- Constraints
    -- Ensure depth = 0 only for self-references
    CONSTRAINT check_hierarchy_self_reference
        CHECK ((ancestor_id = descendant_id AND depth = 0) OR (ancestor_id != descendant_id AND depth > 0))
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Index on descendant_id for finding all ancestors of a node
CREATE INDEX IF NOT EXISTS idx_hierarchy_descendant
    ON t_d_article_hierarchy(descendant_id);

-- Index on ancestor_id for finding all descendants of a node
CREATE INDEX IF NOT EXISTS idx_hierarchy_ancestor
    ON t_d_article_hierarchy(ancestor_id);

-- Index on depth for filtering by level
CREATE INDEX IF NOT EXISTS idx_hierarchy_depth
    ON t_d_article_hierarchy(depth);

-- Composite index for finding direct children
CREATE INDEX IF NOT EXISTS idx_hierarchy_direct_children
    ON t_d_article_hierarchy(ancestor_id, depth)
    WHERE depth = 1;

-- Composite index for finding direct parents
CREATE INDEX IF NOT EXISTS idx_hierarchy_direct_parent
    ON t_d_article_hierarchy(descendant_id, depth)
    WHERE depth = 1;

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE t_d_article_hierarchy IS
    'Closure Table for efficient hierarchical queries on t_d_article. Stores all ancestor-descendant relationships with depth information. Maintained automatically via triggers on t_d_article (TASK-005).';

COMMENT ON COLUMN t_d_article_hierarchy.ancestor_id IS
    'Foreign key to t_d_article. The ancestor (parent/grandparent/etc) in the relationship.';

COMMENT ON COLUMN t_d_article_hierarchy.descendant_id IS
    'Foreign key to t_d_article. The descendant (child/grandchild/etc) in the relationship.';

COMMENT ON COLUMN t_d_article_hierarchy.depth IS
    'Depth of relationship: 0 = self-reference, 1 = direct child, 2 = grandchild, etc.';

COMMENT ON COLUMN t_d_article_hierarchy.created_at IS
    'Audit: Timestamp when this relationship was created';

-- ============================================================================
-- EXAMPLE USAGE
-- ============================================================================

-- Find all descendants of article with id=1 (children, grandchildren, etc.)
-- SELECT a.id, a.name, h.depth
-- FROM t_d_article a
-- JOIN t_d_article_hierarchy h ON a.id = h.descendant_id
-- WHERE h.ancestor_id = 1
--   AND h.depth > 0  -- Exclude self-reference
-- ORDER BY h.depth, a.name;

-- Find all ancestors of article with id=5 (parent, grandparent, etc.)
-- SELECT a.id, a.name, h.depth
-- FROM t_d_article a
-- JOIN t_d_article_hierarchy h ON a.id = h.ancestor_id
-- WHERE h.descendant_id = 5
--   AND h.depth > 0  -- Exclude self-reference
-- ORDER BY h.depth DESC;

-- Find direct children of article with id=1
-- SELECT a.id, a.name
-- FROM t_d_article a
-- JOIN t_d_article_hierarchy h ON a.id = h.descendant_id
-- WHERE h.ancestor_id = 1
--   AND h.depth = 1;

-- Find direct parent of article with id=5
-- SELECT a.id, a.name
-- FROM t_d_article a
-- JOIN t_d_article_hierarchy h ON a.id = h.ancestor_id
-- WHERE h.descendant_id = 5
--   AND h.depth = 1;

-- Find all leaf nodes (articles with no children)
-- SELECT a.id, a.name
-- FROM t_d_article a
-- WHERE a.is_current = TRUE
--   AND NOT EXISTS (
--     SELECT 1 FROM t_d_article_hierarchy h
--     WHERE h.ancestor_id = a.id AND h.depth = 1
--   );

-- Find all root nodes (articles with no parent)
-- SELECT a.id, a.name
-- FROM t_d_article a
-- WHERE a.is_current = TRUE
--   AND NOT EXISTS (
--     SELECT 1 FROM t_d_article_hierarchy h
--     WHERE h.descendant_id = a.id AND h.depth = 1
--   );

-- Get hierarchy depth for article with id=5
-- SELECT MAX(depth) as max_depth
-- FROM t_d_article_hierarchy
-- WHERE descendant_id = 5;

-- Get subtree count for article with id=1
-- SELECT COUNT(*) - 1 as descendant_count  -- Minus 1 for self-reference
-- FROM t_d_article_hierarchy
-- WHERE ancestor_id = 1;

-- ============================================================================
-- MAINTENANCE NOTES
-- ============================================================================

-- This table is automatically maintained by triggers (TASK-005):
--
-- 1. ON INSERT t_d_article:
--    - Insert self-reference (article_id, article_id, 0)
--    - Copy all ancestors from parent (if parent_id IS NOT NULL)
--
-- 2. ON UPDATE t_d_article (parent_id changes):
--    - Delete old ancestor paths
--    - Rebuild paths with new parent
--
-- 3. ON DELETE t_d_article:
--    - CASCADE delete automatically removes hierarchy entries
--
-- Manual rebuild procedure (if needed):
--
-- TRUNCATE t_d_article_hierarchy;
--
-- -- Insert self-references
-- INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
-- SELECT id, id, 0 FROM t_d_article WHERE is_current = TRUE;
--
-- -- Build hierarchy iteratively (repeat until no new rows inserted)
-- INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
-- SELECT h.ancestor_id, a.id, h.depth + 1
-- FROM t_d_article a
-- JOIN t_d_article_hierarchy h ON a.parent_id = h.descendant_id
-- WHERE NOT EXISTS (
--   SELECT 1 FROM t_d_article_hierarchy h2
--   WHERE h2.ancestor_id = h.ancestor_id
--     AND h2.descendant_id = a.id
-- );

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify table exists
-- SELECT table_name, table_type
-- FROM information_schema.tables
-- WHERE table_name = 't_d_article_hierarchy';

-- Verify columns
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 't_d_article_hierarchy'
-- ORDER BY ordinal_position;

-- Verify constraints
-- SELECT constraint_name, constraint_type
-- FROM information_schema.table_constraints
-- WHERE table_name = 't_d_article_hierarchy';

-- Verify indexes
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 't_d_article_hierarchy';

-- Verify foreign keys
-- SELECT
--     tc.constraint_name,
--     kcu.column_name,
--     ccu.table_name AS foreign_table_name,
--     ccu.column_name AS foreign_column_name
-- FROM information_schema.table_constraints AS tc
-- JOIN information_schema.key_column_usage AS kcu
--     ON tc.constraint_name = kcu.constraint_name
-- JOIN information_schema.constraint_column_usage AS ccu
--     ON ccu.constraint_name = tc.constraint_name
-- WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = 't_d_article_hierarchy';

-- Verify self-reference constraint
-- Should return empty set:
-- SELECT * FROM t_d_article_hierarchy
-- WHERE (ancestor_id = descendant_id AND depth != 0)
--    OR (ancestor_id != descendant_id AND depth = 0);

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
