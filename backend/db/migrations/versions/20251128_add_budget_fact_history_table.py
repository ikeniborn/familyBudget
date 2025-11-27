"""add_budget_fact_history_table

Revision ID: 7f9e8c6d5b4a
Revises: 3d858bda8766
Create Date: 2025-11-28 07:25:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7f9e8c6d5b4a'
down_revision: Union[str, None] = '3d858bda8766'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create t_f_budget_fact_history table for tracking all budget fact changes."""

    # Create t_f_budget_fact_history table
    op.create_table(
        't_f_budget_fact_history',
        sa.Column('history_id', sa.Integer(), nullable=False, primary_key=True, autoincrement=True),
        sa.Column('fact_id', sa.Integer(), nullable=False, index=True),
        sa.Column('user_id', sa.Integer(), nullable=False, index=True),
        sa.Column('article_id', sa.Integer(), nullable=False, index=True),
        sa.Column('financial_center_id', sa.Integer(), nullable=True),
        sa.Column('cost_center_id', sa.Integer(), nullable=True),
        sa.Column('fact_date', sa.Date(), nullable=False, index=True),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('record_type', sa.String(length=10), nullable=False),
        sa.Column('transfer_id', sa.Integer(), nullable=True),
        sa.Column('valid_from', sa.DateTime(), nullable=False, index=True),
        sa.Column('valid_to', sa.DateTime(), nullable=False, server_default=sa.text("'9999-12-31'::timestamp")),
        sa.Column('is_current', sa.Boolean(), nullable=False, server_default=sa.text('true'), index=True),
        sa.Column('change_type', sa.String(length=20), nullable=False),
        sa.Column('changed_fields', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('changed_by_user_id', sa.Integer(), nullable=True),
        sa.Column('cascade_delete_source', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('CURRENT_TIMESTAMP')),
        sa.ForeignKeyConstraint(['fact_id'], ['t_f_budget_fact.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('history_id')
    )

    # Create indexes for efficient queries
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
