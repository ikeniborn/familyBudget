"""Add temp_id columns for offline sync

Revision ID: y0k1l2m3n4o5
Revises: x9k0l1m2n3o4
Create Date: 2026-02-12

This migration adds temp_id BIGINT columns to track client-side temporary IDs
for offline synchronization (int53 from JavaScript).

Affected tables:
- t_f_shopping_list - shopping list header table
- t_f_shopping_list_item - shopping list items table
- t_f_budget_fact - budget fact transactions table

Column details:
- temp_id: BIGINT NULL (nullable, indexed)
- Stores client-generated int53 temporary ID (0 to 9,007,199,254,740,991)
- Used for offline sync to track records before server ID assignment
- Allows client and server to maintain the same ID for correlation
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = 'y0k1l2m3n4o5'
down_revision = 'x9k0l1m2n3o4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add temp_id columns to shopping and budget fact tables."""
    # Add temp_id to t_f_shopping_list
    op.add_column(
        't_f_shopping_list',
        sa.Column(
            'temp_id',
            sa.BigInteger(),
            nullable=True,
            comment='Client-side temporary ID for offline sync (int53 from JavaScript)'
        )
    )

    # Add temp_id to t_f_shopping_list_item
    op.add_column(
        't_f_shopping_list_item',
        sa.Column(
            'temp_id',
            sa.BigInteger(),
            nullable=True,
            comment='Client-side temporary ID for offline sync (int53 from JavaScript)'
        )
    )

    # Add temp_id to t_f_budget_fact
    op.add_column(
        't_f_budget_fact',
        sa.Column(
            'temp_id',
            sa.BigInteger(),
            nullable=True,
            comment='Client-side temporary ID for offline sync (int53 from JavaScript)'
        )
    )

    # Create indexes on temp_id columns for fast lookup
    op.create_index(
        'ix_t_f_shopping_list_temp_id',
        't_f_shopping_list',
        ['temp_id'],
        unique=False
    )

    op.create_index(
        'ix_t_f_shopping_list_item_temp_id',
        't_f_shopping_list_item',
        ['temp_id'],
        unique=False
    )

    op.create_index(
        'ix_t_f_budget_fact_temp_id',
        't_f_budget_fact',
        ['temp_id'],
        unique=False
    )


def downgrade() -> None:
    """Remove temp_id columns and indexes."""
    # Drop indexes first
    op.drop_index('ix_t_f_budget_fact_temp_id', table_name='t_f_budget_fact')
    op.drop_index('ix_t_f_shopping_list_item_temp_id', table_name='t_f_shopping_list_item')
    op.drop_index('ix_t_f_shopping_list_temp_id', table_name='t_f_shopping_list')

    # Drop columns
    op.drop_column('t_f_budget_fact', 'temp_id')
    op.drop_column('t_f_shopping_list_item', 'temp_id')
    op.drop_column('t_f_shopping_list', 'temp_id')
