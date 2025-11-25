"""add_is_active_to_financial_and_cost_centers

Revision ID: f385331ab243
Revises: add_debit_credit
Create Date: 2025-11-25 14:12:28.489411

Add is_active field to FinancialCenter and CostCenter tables for archiving functionality.
Archived entities are hidden from UI dropdowns but remain available in analytics.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'f385331ab243'
down_revision: Union[str, None] = 'add_debit_credit'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add is_active column to financial_center and cost_center tables."""

    # Add is_active column to t_d_financial_center
    op.add_column(
        't_d_financial_center',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true')
    )

    # Create index on is_active for t_d_financial_center
    op.create_index(
        'ix_t_d_financial_center_is_active',
        't_d_financial_center',
        ['is_active'],
        unique=False
    )

    # Add is_active column to t_d_cost_center
    op.add_column(
        't_d_cost_center',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true')
    )

    # Create index on is_active for t_d_cost_center
    op.create_index(
        'ix_t_d_cost_center_is_active',
        't_d_cost_center',
        ['is_active'],
        unique=False
    )

    # Add comments for documentation
    op.execute("""
        COMMENT ON COLUMN t_d_financial_center.is_active IS
        'Active status flag: True = visible in UI dropdowns, False = archived (hidden but available in analytics)';
    """)

    op.execute("""
        COMMENT ON COLUMN t_d_cost_center.is_active IS
        'Active status flag: True = visible in UI dropdowns, False = archived (hidden but available in analytics)';
    """)


def downgrade() -> None:
    """Remove is_active column from financial_center and cost_center tables."""

    # Drop indexes
    op.drop_index('ix_t_d_cost_center_is_active', table_name='t_d_cost_center')
    op.drop_index('ix_t_d_financial_center_is_active', table_name='t_d_financial_center')

    # Drop columns
    op.drop_column('t_d_cost_center', 'is_active')
    op.drop_column('t_d_financial_center', 'is_active')
