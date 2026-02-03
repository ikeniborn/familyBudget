"""Add is_offline_sync column to budget_fact tables

Revision ID: u6g7h8i9j0k1
Revises: t5f6g7h8i9j0
Create Date: 2025-12-13

This migration adds is_offline_sync boolean column to track records
created via offline synchronization.

Affected tables:
- t_f_budget_fact - main fact table
- t_f_budget_fact_history - SCD Type 2 history table

Column details:
- is_offline_sync: BOOLEAN NOT NULL DEFAULT FALSE
- True if record was created via offline synchronization
- False for records created online (default)
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = 'u6g7h8i9j0k1'
down_revision = 't5f6g7h8i9j0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add is_offline_sync column to fact tables."""
    # Add to main fact table
    op.add_column(
        't_f_budget_fact',
        sa.Column(
            'is_offline_sync',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment='True if record was created via offline synchronization'
        )
    )

    # Add to history table
    op.add_column(
        't_f_budget_fact_history',
        sa.Column(
            'is_offline_sync',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment='Offline sync flag snapshot'
        )
    )


def downgrade() -> None:
    """Remove is_offline_sync column from fact tables."""
    op.drop_column('t_f_budget_fact_history', 'is_offline_sync')
    op.drop_column('t_f_budget_fact', 'is_offline_sync')
