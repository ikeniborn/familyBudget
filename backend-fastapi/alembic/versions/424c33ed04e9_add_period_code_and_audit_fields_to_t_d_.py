"""Add period_code and audit fields to t_d_period table

Revision ID: 424c33ed04e9
Revises: 5ef4678b70a0
Create Date: 2025-09-14 18:25:27.049939

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '424c33ed04e9'
down_revision: Union[str, None] = '5ef4678b70a0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add period_code column
    op.add_column('t_d_period', sa.Column('period_code', sa.String(20), nullable=True))

    # Add audit columns
    op.add_column('t_d_period', sa.Column('created_by', sa.Integer(), nullable=True))
    op.add_column('t_d_period', sa.Column('managed_by', sa.Integer(), nullable=True))

    # Populate period_code with auto-generated values based on period_ru_name
    op.execute("""
        UPDATE t_d_period
        SET period_code = UPPER(LEFT(period_ru_name, 3)) ||
            LPAD(row_num::text, 3, '0')
        FROM (
            SELECT period_id,
                   ROW_NUMBER() OVER (ORDER BY period_id) as row_num
            FROM t_d_period
            WHERE period_code IS NULL
        ) seq
        WHERE t_d_period.period_id = seq.period_id
        AND period_code IS NULL;
    """)

    # Set audit fields - use user_id as creator and manager
    op.execute("""
        UPDATE t_d_period
        SET created_by = user_id, managed_by = user_id
        WHERE created_by IS NULL;
    """)

    # Make period_code not nullable
    op.alter_column('t_d_period', 'period_code', nullable=False)

    # Create unique constraint on period_code
    op.create_unique_constraint('_period_code_uc', 't_d_period', ['period_code'])

    # Add foreign key constraints for audit fields
    op.create_foreign_key('fk_period_created_by', 't_d_period', 't_d_user', ['created_by'], ['user_id'])
    op.create_foreign_key('fk_period_managed_by', 't_d_period', 't_d_user', ['managed_by'], ['user_id'])


def downgrade() -> None:
    # Drop foreign key constraints
    op.drop_constraint('fk_period_created_by', 't_d_period', type_='foreignkey')
    op.drop_constraint('fk_period_managed_by', 't_d_period', type_='foreignkey')

    # Drop unique constraint
    op.drop_constraint('_period_code_uc', 't_d_period', type_='unique')

    # Drop added columns
    op.drop_column('t_d_period', 'managed_by')
    op.drop_column('t_d_period', 'created_by')
    op.drop_column('t_d_period', 'period_code')
