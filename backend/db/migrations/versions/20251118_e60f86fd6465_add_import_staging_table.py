"""add_import_staging_table

Revision ID: e60f86fd6465
Revises: 966a21081716
Create Date: 2025-11-18 22:04:47.358021

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e60f86fd6465'
down_revision: str | None = '966a21081716'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        't_import_staging',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('tinkoff_date', sa.Date(), nullable=False),
        sa.Column('tinkoff_amount', sa.String(20), nullable=False),
        sa.Column('tinkoff_category', sa.String(255), nullable=True),
        sa.Column('tinkoff_mcc', sa.String(10), nullable=True),
        sa.Column('tinkoff_description', sa.Text(), nullable=True),
        sa.Column('tinkoff_card', sa.String(20), nullable=True),
        sa.Column('article_id', sa.Integer(), nullable=True),
        sa.Column('financial_center_id', sa.Integer(), nullable=True),
        sa.Column('cost_center_id', sa.Integer(), nullable=True),
        sa.Column('is_selected', sa.Boolean(), server_default='false', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['t_d_user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['article_id'], ['t_d_article.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['financial_center_id'], ['t_d_financial_center.id'], ondelete='SET NULL'),
        sa.ForeignKeyConstraint(['cost_center_id'], ['t_d_cost_center.id'], ondelete='SET NULL'),
    )

    op.create_index('ix_import_staging_user_id', 't_import_staging', ['user_id'])
    op.create_index('ix_import_staging_is_selected', 't_import_staging', ['is_selected'])
    op.create_index('ix_import_staging_created_at', 't_import_staging', ['created_at'])


def downgrade() -> None:
    op.drop_index('ix_import_staging_created_at', 't_import_staging')
    op.drop_index('ix_import_staging_is_selected', 't_import_staging')
    op.drop_index('ix_import_staging_user_id', 't_import_staging')
    op.drop_table('t_import_staging')
