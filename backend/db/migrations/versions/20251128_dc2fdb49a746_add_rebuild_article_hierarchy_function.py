"""add rebuild_article_hierarchy_closure_table function

Revision ID: dc2fdb49a746
Revises: 7922e6509813
Create Date: 2025-11-28 20:55:00.000000

Add PostgreSQL function to rebuild Article Hierarchy Closure Table.

This function rebuilds the t_d_article_hierarchy closure table from scratch
based on the parent_id adjacency list in t_d_article table.

Use cases:
1. After data migration when closure table is corrupted or empty
2. Manual maintenance when hierarchy integrity is questionable
3. Development/testing when hierarchy needs to be reset

The function:
- Clears existing t_d_article_hierarchy records
- Rebuilds self-references (depth=0)
- Rebuilds direct parent-child (depth=1)
- Rebuilds transitive relationships (depth>1) using recursive CTE
- Returns total count of hierarchy records created

Usage:
    SELECT rebuild_article_hierarchy_closure_table();

Performance: O(N*D) where N=articles count, D=max hierarchy depth
Typical execution: <100ms for 100 articles with depth 5
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'dc2fdb49a746'
down_revision: str | None = '7922e6509813'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create rebuild_article_hierarchy_closure_table function."""

    op.execute("""
        CREATE OR REPLACE FUNCTION rebuild_article_hierarchy_closure_table()
        RETURNS INTEGER AS $$
        DECLARE
            inserted_count INTEGER := 0;
        BEGIN
            -- Clear existing closure table
            DELETE FROM t_d_article_hierarchy;

            -- Insert self-references (depth = 0)
            -- Every article is an ancestor/descendant of itself
            INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
            SELECT id, id, 0
            FROM t_d_article;

            GET DIAGNOSTICS inserted_count = ROW_COUNT;

            -- Insert direct parent-child relationships (depth = 1)
            -- For articles with parent_id, create direct relationship
            INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
            SELECT parent_id, id, 1
            FROM t_d_article
            WHERE parent_id IS NOT NULL;

            -- Insert transitive relationships (depth > 1)
            -- Recursively find all ancestor-descendant pairs
            WITH RECURSIVE hierarchy_paths AS (
                -- Base: direct parent-child (already inserted above, but needed for recursion)
                SELECT parent_id as ancestor_id, id as descendant_id, 1 as depth
                FROM t_d_article
                WHERE parent_id IS NOT NULL

                UNION ALL

                -- Recursive: parent's ancestors + current node
                -- For each path (A -> B) and article C where C.parent_id = B,
                -- create path (A -> C) with depth incremented
                SELECT h.ancestor_id, a.id as descendant_id, h.depth + 1
                FROM hierarchy_paths h
                JOIN t_d_article a ON a.parent_id = h.descendant_id
            )
            INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
            SELECT DISTINCT ancestor_id, descendant_id, depth
            FROM hierarchy_paths
            WHERE depth > 1  -- Skip depth=1 (already inserted)
            ON CONFLICT DO NOTHING;

            -- Return total count of inserted records
            SELECT COUNT(*) INTO inserted_count FROM t_d_article_hierarchy;

            RETURN inserted_count;
        END;
        $$ LANGUAGE plpgsql;

        -- Add comment documenting the function
        COMMENT ON FUNCTION rebuild_article_hierarchy_closure_table() IS
        'Rebuilds Article Hierarchy Closure Table from parent_id adjacency list.
        Returns total count of hierarchy records created.
        Use after data migration or when closure table integrity is questionable.';
    """)


def downgrade() -> None:
    """Drop rebuild_article_hierarchy_closure_table function."""

    op.execute("""
        DROP FUNCTION IF EXISTS rebuild_article_hierarchy_closure_table();
    """)
