-- ============================================================================
-- Schema DDL: 003_core_hierarchy.sql
-- Description: Article hierarchy (Closure Table pattern) with performance indexes
-- Version: 5.0.0 (Base Schema)
-- Date: 2025-11-08
-- ============================================================================
--
-- This file contains the hierarchy table for article categories:
-- - t_d_article_hierarchy: Closure Table for efficient hierarchy queries
--
-- Pattern: Closure Table (pre-computed transitive closure)
-- Complexity: O(1) for subtree/ancestor queries
--
-- DO NOT MODIFY in Production Mode - use Alembic migrations instead!
-- ============================================================================

-- ============================================================================
-- TABLE: t_d_article_hierarchy
-- Purpose: Closure Table for article hierarchy (transitive closure)
-- Pattern: Closure Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_d_article_hierarchy (
    -- Primary key
    id SERIAL PRIMARY KEY,
    
    -- Foreign keys (both reference articles)
    ancestor_id INT NOT NULL REFERENCES t_d_article(id) ON DELETE CASCADE,
    descendant_id INT NOT NULL REFERENCES t_d_article(id) ON DELETE CASCADE,
    
    -- Depth of relationship (0 = self, 1 = direct child, 2 = grandchild, etc.)
    depth INT NOT NULL CHECK (depth >= 0),
    
    -- Unique constraint: one path per ancestor-descendant pair
    CONSTRAINT uq_article_hierarchy_path
        UNIQUE (ancestor_id, descendant_id),
    
    -- Self-reference check
    CONSTRAINT check_hierarchy_self_reference
        CHECK (
            (ancestor_id = descendant_id AND depth = 0) OR
            (ancestor_id != descendant_id AND depth > 0)
        )
);

-- ============================================================================
-- BASIC INDEXES
-- ============================================================================

-- Index on ancestor_id for subtree queries
CREATE INDEX IF NOT EXISTS idx_article_hierarchy_ancestor
    ON t_d_article_hierarchy(ancestor_id);

-- Index on descendant_id for ancestor queries
CREATE INDEX IF NOT EXISTS idx_article_hierarchy_descendant
    ON t_d_article_hierarchy(descendant_id);

-- Index on depth for level-based queries
CREATE INDEX IF NOT EXISTS idx_article_hierarchy_depth
    ON t_d_article_hierarchy(depth);

-- Composite index for subtree with depth filtering
CREATE INDEX IF NOT EXISTS idx_article_hierarchy_ancestor_depth
    ON t_d_article_hierarchy(ancestor_id, depth);

-- ============================================================================
-- PERFORMANCE INDEXES (from 009_create_additional_indexes.sql)
-- ============================================================================

-- Covering index for subtree queries
CREATE INDEX IF NOT EXISTS idx_hierarchy_ancestor_depth_covering
    ON t_d_article_hierarchy(ancestor_id, depth)
    INCLUDE (descendant_id);

COMMENT ON INDEX idx_hierarchy_ancestor_depth_covering IS
    'Covering index for subtree queries. Supports: SELECT descendant_id FROM t_d_article_hierarchy WHERE ancestor_id = ? AND depth > 0';

-- Covering index for ancestor queries
CREATE INDEX IF NOT EXISTS idx_hierarchy_descendant_depth_covering
    ON t_d_article_hierarchy(descendant_id, depth)
    INCLUDE (ancestor_id);

COMMENT ON INDEX idx_hierarchy_descendant_depth_covering IS
    'Covering index for ancestor queries. Supports: SELECT ancestor_id FROM t_d_article_hierarchy WHERE descendant_id = ? AND depth > 0';

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON TABLE t_d_article_hierarchy IS
    'Closure Table for article hierarchy. Stores all ancestor-descendant relationships with pre-computed depths. Enables O(1) complexity for subtree/ancestor queries.';

COMMENT ON COLUMN t_d_article_hierarchy.depth IS
    'Depth of relationship: 0 = self-reference, 1 = direct parent-child, 2 = grandparent-grandchild, etc.';

-- ============================================================================
-- EXAMPLE QUERIES
-- ============================================================================

-- Query 1: Get all descendants of article (subtree)
-- SELECT a.id, a.name, h.depth
-- FROM t_d_article a
-- JOIN t_d_article_hierarchy h ON a.id = h.descendant_id
-- WHERE h.ancestor_id = ? AND h.depth > 0
-- ORDER BY h.depth, a.name;

-- Query 2: Get all ancestors of article (path to root)
-- SELECT a.id, a.name, h.depth
-- FROM t_d_article a
-- JOIN t_d_article_hierarchy h ON a.id = h.ancestor_id
-- WHERE h.descendant_id = ? AND h.depth > 0
-- ORDER BY h.depth DESC;

-- Query 3: Check if article is descendant of another
-- SELECT EXISTS(
--     SELECT 1 FROM t_d_article_hierarchy
--     WHERE ancestor_id = ? AND descendant_id = ?
-- );

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
