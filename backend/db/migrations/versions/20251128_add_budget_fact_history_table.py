"""add_budget_fact_history_table

Revision ID: 7f9e8c6d5b4a
Revises: 3d858bda8766
Create Date: 2025-11-28 07:25:00.000000

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7f9e8c6d5b4a'
down_revision: str | None = '3d858bda8766'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create t_f_budget_fact_history table for tracking all budget fact changes."""

    # Create t_f_budget_fact_history table
    # Note: No foreign key constraint on fact_id because:
    # 1. t_f_budget_fact is partitioned with composite PK (id, fact_date)
    # 2. History should persist even after fact deletion (audit trail)
    # 3. Referential integrity is enforced at application level
    op.create_table(
        't_f_budget_fact_history',
        sa.Column('history_id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('fact_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('financial_center_id', sa.Integer(), nullable=True),
        sa.Column('cost_center_id', sa.Integer(), nullable=True),
        sa.Column('fact_date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('record_type', sa.String(length=10), nullable=False),
        sa.Column('transfer_id', sa.Integer(), nullable=True),
        sa.Column('valid_from', sa.DateTime(), nullable=False),
        sa.Column('valid_to', sa.DateTime(), nullable=False, server_default=sa.text("'9999-12-31'::timestamp")),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('change_type', sa.String(length=20), nullable=False),
        sa.Column('changed_fields', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('changed_by_user_id', sa.Integer(), nullable=True),
        sa.Column('cascade_delete_source', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.PrimaryKeyConstraint('history_id')
    )

    # Create indexes for efficient queries (explicitly named for consistency)
    op.create_index('ix_t_f_budget_fact_history_fact_id', 't_f_budget_fact_history', ['fact_id'])
    op.create_index('ix_t_f_budget_fact_history_user_id', 't_f_budget_fact_history', ['user_id'])
    op.create_index('ix_t_f_budget_fact_history_article_id', 't_f_budget_fact_history', ['article_id'])
    op.create_index('ix_t_f_budget_fact_history_fact_date', 't_f_budget_fact_history', ['fact_date'])
    op.create_index('ix_t_f_budget_fact_history_valid_from', 't_f_budget_fact_history', ['valid_from'])
    op.create_index('ix_t_f_budget_fact_history_is_current', 't_f_budget_fact_history', ['is_current'])


def downgrade() -> None:
    """Drop t_f_budget_fact_history table."""

    # Drop indexes
    op.drop_index('ix_t_f_budget_fact_history_is_current', 't_f_budget_fact_history')
    op.drop_index('ix_t_f_budget_fact_history_valid_from', 't_f_budget_fact_history')
    op.drop_index('ix_t_f_budget_fact_history_fact_date', 't_f_budget_fact_history')
    op.drop_index('ix_t_f_budget_fact_history_article_id', 't_f_budget_fact_history')
    op.drop_index('ix_t_f_budget_fact_history_user_id', 't_f_budget_fact_history')
    op.drop_index('ix_t_f_budget_fact_history_fact_id', 't_f_budget_fact_history')

    # Drop table
    op.drop_table('t_f_budget_fact_history')
