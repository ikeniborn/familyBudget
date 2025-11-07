-- ============================================================================
-- Verification: t_d_article_hierarchy created by triggers
-- Description: Verify that hierarchy was auto-created correctly
-- ============================================================================

-- 1. Check total records in hierarchy
SELECT 'Total hierarchy records:' as check_name, COUNT(*) as count
FROM t_d_article_hierarchy;

-- 2. Check self-references (depth=0) - should equal total articles
SELECT 'Self-references (depth=0):' as check_name, COUNT(*) as count
FROM t_d_article_hierarchy
WHERE depth = 0;

-- 3. Check parent-child relationships (depth=1)
SELECT 'Parent-child relationships (depth=1):' as check_name, COUNT(*) as count
FROM t_d_article_hierarchy
WHERE depth = 1;

-- 4. Verify specific relationship: Зарплата -> Премия
SELECT
    'Зарплата -> Премия relationship:' as check_name,
    h.ancestor_id,
    h.descendant_id,
    h.depth,
    a1.name as ancestor_name,
    a2.name as descendant_name
FROM t_d_article_hierarchy h
JOIN t_d_article a1 ON h.ancestor_id = a1.id
JOIN t_d_article a2 ON h.descendant_id = a2.id
WHERE a1.name = 'Зарплата'
  AND a2.name = 'Премия'
  AND h.depth = 1;

-- 5. List all parent-child relationships
SELECT
    a1.name as parent,
    a2.name as child,
    h.depth
FROM t_d_article_hierarchy h
JOIN t_d_article a1 ON h.ancestor_id = a1.id
JOIN t_d_article a2 ON h.descendant_id = a2.id
WHERE h.depth = 1
  AND a1.is_current = true
  AND a2.is_current = true
ORDER BY a1.name, a2.name;

-- 6. Verify no orphaned children (all children have parent in hierarchy)
SELECT 'Orphaned children (should be 0):' as check_name, COUNT(*) as count
FROM t_d_article a
WHERE a.parent_id IS NOT NULL
  AND a.is_current = true
  AND NOT EXISTS (
    SELECT 1 FROM t_d_article_hierarchy h
    WHERE h.descendant_id = a.id AND h.depth = 1
  );
