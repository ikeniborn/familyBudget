"""add_unique_constraint_article_parent_name_type

Revision ID: c4e9f1a2b3d0
Revises: b3d9f5e7c2a1
Create Date: 2026-04-08 12:00:00.000000

Adds a partial unique index on t_d_article to prevent duplicate active
categories with the same (parent_id, name, type) combination.

Using a partial index (WHERE is_current = TRUE) so that deleted/historical
records (is_current = FALSE) are excluded from the uniqueness check and
historical categories with the same name can coexist.

LOWER(name) ensures case-insensitive uniqueness (e.g. "Food" and "food"
are treated as duplicates).

COALESCE(parent_id, -1) treats NULL parent_id as a sentinel value so
PostgreSQL partial index can enforce uniqueness on NULL columns.
"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'c4e9f1a2b3d0'
down_revision = 'b3d9f5e7c2a1'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        CREATE UNIQUE INDEX IF NOT EXISTS idx_article_parent_name_type_current
        ON t_d_article (COALESCE(parent_id, -1), LOWER(name), type)
        WHERE is_current = TRUE
        """
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS idx_article_parent_name_type_current")
