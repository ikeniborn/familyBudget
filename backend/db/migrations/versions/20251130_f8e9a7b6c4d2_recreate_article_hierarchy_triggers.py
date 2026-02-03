"""recreate article hierarchy triggers

Revision ID: f8e9a7b6c4d2
Revises: a8f3b9d4c621
Create Date: 2025-11-30 18:00:00.000000

Recreates Article Hierarchy Closure Table triggers that were lost during SCD2→SCD1 migration.

Problem:
- Triggers were dropped during table schema changes
- ArticleHierarchy (closure table) not updating automatically
- Archive/restore operations failing (returned 0 archived articles)

Solution:
- Recreate trigger functions (insert/update/delete)
- Recreate triggers on t_d_article table
- Call rebuild_article_hierarchy_closure_table() to populate existing data

Triggers:
1. trg_article_hierarchy_insert_after - Auto-populate closure table on INSERT
2. trg_article_hierarchy_update_after - Rebuild paths on parent_id change
3. trg_article_hierarchy_delete_before - Clean up paths on DELETE

Usage:
    alembic upgrade head  # Auto-applies and rebuilds closure table
"""
from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = 'f8e9a7b6c4d2'
down_revision: str | None = 'a8f3b9d4c621'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Recreate Article Hierarchy triggers and rebuild closure table."""

    # =========================================================================
    # STEP 1: Create trigger functions
    # =========================================================================

    # INSERT trigger: Add new article to closure table
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_article_hierarchy_insert()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Self-reference (depth = 0)
            INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
            VALUES (NEW.id, NEW.id, 0);

            -- If has parent, copy all parent's ancestors + add edge to parent
            IF NEW.parent_id IS NOT NULL THEN
                -- Add direct parent-child edge (depth = 1)
                INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
                VALUES (NEW.parent_id, NEW.id, 1);

                -- Copy parent's ancestors (depth + 1)
                INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
                SELECT ancestor_id, NEW.id, depth + 1
                FROM t_d_article_hierarchy
                WHERE descendant_id = NEW.parent_id
                  AND depth > 0;  -- Skip self-reference
            END IF;

            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    # UPDATE trigger: Rebuild paths when parent_id changes
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_article_hierarchy_update()
        RETURNS TRIGGER AS $$
        DECLARE
            child_record RECORD;
            ancestor_record RECORD;
        BEGIN
            -- Only rebuild if parent_id actually changed
            IF OLD.parent_id IS DISTINCT FROM NEW.parent_id THEN
                -- Delete all paths where this article is a descendant (except self-reference)
                DELETE FROM t_d_article_hierarchy
                WHERE descendant_id = NEW.id
                  AND depth > 0;

                -- Delete all paths to this article's descendants
                DELETE FROM t_d_article_hierarchy
                WHERE ancestor_id IN (
                    SELECT ancestor_id
                    FROM t_d_article_hierarchy
                    WHERE descendant_id = NEW.id
                      AND depth = 0
                )
                AND descendant_id IN (
                    SELECT descendant_id
                    FROM t_d_article_hierarchy
                    WHERE ancestor_id = NEW.id
                      AND depth > 0
                );

                -- Rebuild paths for new parent
                IF NEW.parent_id IS NOT NULL THEN
                    -- Add direct parent-child edge
                    INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
                    VALUES (NEW.parent_id, NEW.id, 1)
                    ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;

                    -- Add paths from new parent's ancestors to this article
                    INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
                    SELECT ancestor_id, NEW.id, depth + 1
                    FROM t_d_article_hierarchy
                    WHERE descendant_id = NEW.parent_id
                      AND depth > 0
                    ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;

                    -- Rebuild paths to this article's descendants
                    FOR child_record IN (
                        SELECT descendant_id
                        FROM t_d_article_hierarchy
                        WHERE ancestor_id = NEW.id
                          AND depth > 0
                    ) LOOP
                        FOR ancestor_record IN (
                            SELECT ancestor_id, depth
                            FROM t_d_article_hierarchy
                            WHERE descendant_id = NEW.id
                        ) LOOP
                            INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
                            SELECT ancestor_record.ancestor_id, child_record.descendant_id, ancestor_record.depth + child_depth.depth
                            FROM t_d_article_hierarchy child_depth
                            WHERE child_depth.ancestor_id = NEW.id
                              AND child_depth.descendant_id = child_record.descendant_id
                            ON CONFLICT (ancestor_id, descendant_id) DO NOTHING;
                        END LOOP;
                    END LOOP;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql
    """)

    # DELETE trigger: Cleanup paths
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_article_hierarchy_delete()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Paths are auto-deleted via FK CASCADE in t_d_article_hierarchy
            -- This trigger is just for logging/debugging
            RAISE NOTICE 'Article % deleted, hierarchy paths will be cascaded', OLD.id;
            RETURN OLD;
        END;
        $$ LANGUAGE plpgsql
    """)

    # =========================================================================
    # STEP 2: Create triggers on t_d_article table
    # =========================================================================

    # Drop existing triggers if any (idempotent)
    op.execute("DROP TRIGGER IF EXISTS trg_article_hierarchy_insert_after ON t_d_article")
    op.execute("DROP TRIGGER IF EXISTS trg_article_hierarchy_update_after ON t_d_article")
    op.execute("DROP TRIGGER IF EXISTS trg_article_hierarchy_delete_before ON t_d_article")

    # Create INSERT trigger
    op.execute("""
        CREATE TRIGGER trg_article_hierarchy_insert_after
            AFTER INSERT ON t_d_article
            FOR EACH ROW
            EXECUTE FUNCTION trg_article_hierarchy_insert()
    """)

    # Create UPDATE trigger (only fires when parent_id changes)
    op.execute("""
        CREATE TRIGGER trg_article_hierarchy_update_after
            AFTER UPDATE ON t_d_article
            FOR EACH ROW
            WHEN (OLD.parent_id IS DISTINCT FROM NEW.parent_id)
            EXECUTE FUNCTION trg_article_hierarchy_update()
    """)

    # Create DELETE trigger
    op.execute("""
        CREATE TRIGGER trg_article_hierarchy_delete_before
            BEFORE DELETE ON t_d_article
            FOR EACH ROW
            EXECUTE FUNCTION trg_article_hierarchy_delete()
    """)

    # =========================================================================
    # STEP 3: Rebuild closure table for existing articles
    # =========================================================================

    print("Rebuilding article hierarchy closure table...")
    result = op.get_bind().execute(text("SELECT rebuild_article_hierarchy_closure_table()"))
    count = result.scalar()
    print(f"✓ Rebuilt closure table: {count} hierarchy records created")


def downgrade() -> None:
    """Drop Article Hierarchy triggers and functions."""

    # Drop triggers
    op.execute("DROP TRIGGER IF EXISTS trg_article_hierarchy_insert_after ON t_d_article")
    op.execute("DROP TRIGGER IF EXISTS trg_article_hierarchy_update_after ON t_d_article")
    op.execute("DROP TRIGGER IF EXISTS trg_article_hierarchy_delete_before ON t_d_article")

    # Drop trigger functions
    op.execute("DROP FUNCTION IF EXISTS trg_article_hierarchy_delete() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS trg_article_hierarchy_update() CASCADE")
    op.execute("DROP FUNCTION IF EXISTS trg_article_hierarchy_insert() CASCADE")

    print("⚠ Closure table triggers removed. Run rebuild_article_hierarchy_closure_table() manually if needed.")
