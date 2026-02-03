"""add_position_to_shopping_list_items

Revision ID: akhmi26ypiar
Revises: 4c87e46b1cd8
Create Date: 2026-01-22 15:00:00.000000

This migration adds position field to t_f_shopping_list_item table
for explicit ordering control in shopping lists.

Changes:
1. Add position INTEGER NULL to t_f_shopping_list_item
2. Auto-assign positions to existing items (ROW_NUMBER by created_at)
3. Create composite index on (shopping_list_id, position)

Use Case:
- Task-014: Advanced Merge Conflict Logic for Shopping Lists
- Position field enables position-based ordering with smart merge
- Server is source of truth for position during conflict resolution
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'akhmi26ypiar'
down_revision: str | None = '4c87e46b1cd8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add position field to shopping list items."""

    # Step 1: Add position column
    print("[MIGRATION] Adding position column to t_f_shopping_list_item...")
    op.add_column(
        't_f_shopping_list_item',
        sa.Column(
            'position',
            sa.Integer(),
            nullable=True,
            comment='Position in list for ordering (auto-assigned on create)'
        )
    )

    # Step 2: Auto-assign positions to existing items
    # Use ROW_NUMBER() OVER (PARTITION BY shopping_list_id ORDER BY created_at)
    print("[MIGRATION] Auto-assigning positions to existing items...")
    op.execute("""
        UPDATE t_f_shopping_list_item
        SET position = subquery.row_num
        FROM (
            SELECT id,
                   ROW_NUMBER() OVER (PARTITION BY shopping_list_id ORDER BY created_at) as row_num
            FROM t_f_shopping_list_item
            WHERE position IS NULL
        ) AS subquery
        WHERE t_f_shopping_list_item.id = subquery.id;
    """)

    # Step 3: Create composite index for ordering queries
    print("[MIGRATION] Creating composite index for position ordering...")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_shopping_list_item_position
        ON t_f_shopping_list_item(shopping_list_id, position);
    """)

    # Update table statistics for query planner
    op.execute("ANALYZE t_f_shopping_list_item;")

    print("[MIGRATION] position field migration completed successfully")


def downgrade() -> None:
    """Remove position field from shopping list items."""

    print("[MIGRATION] Removing position index...")
    op.execute("DROP INDEX IF EXISTS idx_shopping_list_item_position;")

    print("[MIGRATION] Removing position column from t_f_shopping_list_item...")
    op.drop_column('t_f_shopping_list_item', 'position')

    print("[MIGRATION] position field rollback completed")
