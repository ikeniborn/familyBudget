"""Add sync fields to shopping list item for offline sync

Revision ID: r3d4e5f6g7h8
Revises: q2c3d4e5f6g7
Create Date: 2025-12-11

This migration adds fields required for offline sync with conflict resolution:
1. version - Optimistic locking version (incremented on each update)
2. deleted_at - Soft delete timestamp (NULL = active, NOT NULL = deleted)
3. completed_at - When item was marked as completed (for conflict resolution)
4. last_modified_by - User ID who last modified this item

Also creates partial index for active items and sets completed_at for existing
completed items.
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = "r3d4e5f6g7h8"
down_revision = "q2c3d4e5f6g7"
branch_labels = None
depends_on = None


def upgrade():
    """Add sync fields to shopping list item."""

    # 1. Add version column with default value 1
    op.add_column(
        "t_f_shopping_list_item",
        sa.Column(
            "version",
            sa.Integer(),
            nullable=False,
            server_default="1",
            comment="Optimistic locking version (incremented on each update)",
        ),
    )

    # 2. Add deleted_at column for soft delete
    op.add_column(
        "t_f_shopping_list_item",
        sa.Column(
            "deleted_at",
            sa.DateTime(),
            nullable=True,
            comment="Soft delete timestamp (NULL = active, NOT NULL = deleted)",
        ),
    )

    # 3. Add completed_at column for conflict resolution
    op.add_column(
        "t_f_shopping_list_item",
        sa.Column(
            "completed_at",
            sa.DateTime(),
            nullable=True,
            comment="When item was marked as completed (for conflict resolution)",
        ),
    )

    # 4. Add last_modified_by column (FK to user)
    op.add_column(
        "t_f_shopping_list_item",
        sa.Column(
            "last_modified_by",
            sa.Integer(),
            sa.ForeignKey("t_d_user.id", ondelete="SET NULL"),
            nullable=True,
            comment="User ID who last modified this item",
        ),
    )

    # 5. Create index on deleted_at for soft delete queries
    op.create_index(
        "ix_shopping_list_item_deleted_at",
        "t_f_shopping_list_item",
        ["deleted_at"],
        unique=False,
    )

    # 6. Create partial index for active items (deleted_at IS NULL)
    op.execute("""
        CREATE INDEX ix_shopping_list_item_active
        ON t_f_shopping_list_item (shopping_list_id)
        WHERE deleted_at IS NULL
    """)

    # 7. Create index on last_modified_by
    op.create_index(
        "ix_shopping_list_item_last_modified_by",
        "t_f_shopping_list_item",
        ["last_modified_by"],
        unique=False,
    )

    # 8. Data migration: set completed_at for existing completed items
    op.execute("""
        UPDATE t_f_shopping_list_item
        SET completed_at = updated_at
        WHERE is_completed = TRUE AND completed_at IS NULL
    """)


def downgrade():
    """Remove sync fields from shopping list item."""

    # Drop indexes
    op.execute("DROP INDEX IF EXISTS ix_shopping_list_item_active")
    op.drop_index("ix_shopping_list_item_last_modified_by", table_name="t_f_shopping_list_item")
    op.drop_index("ix_shopping_list_item_deleted_at", table_name="t_f_shopping_list_item")

    # Drop columns
    op.drop_column("t_f_shopping_list_item", "last_modified_by")
    op.drop_column("t_f_shopping_list_item", "completed_at")
    op.drop_column("t_f_shopping_list_item", "deleted_at")
    op.drop_column("t_f_shopping_list_item", "version")
