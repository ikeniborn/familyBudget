"""Add user_id to period table

Revision ID: 86027abaa82e
Revises: 
Create Date: 2025-09-08 15:51:10.846710

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '86027abaa82e'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add user_id column to t_d_period table
    op.add_column('t_d_period', sa.Column('user_id', sa.Integer(), nullable=True))
    
    # Create index for user_id
    op.create_index(op.f('ix_t_d_period_user_id'), 't_d_period', ['user_id'], unique=False)
    
    # Create foreign key constraint
    op.create_foreign_key(
        op.f('fk_t_d_period_user_id_t_d_user'), 
        't_d_period', 
        't_d_user', 
        ['user_id'], 
        ['user_id']
    )
    
    # Set user_id = 1 (Administrator) for all existing periods to preserve data
    op.execute("""
        UPDATE t_d_period 
        SET user_id = 1 
        WHERE user_id IS NULL
    """)


def downgrade() -> None:
    # Drop foreign key constraint
    op.drop_constraint(op.f('fk_t_d_period_user_id_t_d_user'), 't_d_period', type_='foreignkey')
    
    # Drop index
    op.drop_index(op.f('ix_t_d_period_user_id'), table_name='t_d_period')
    
    # Drop user_id column
    op.drop_column('t_d_period', 'user_id')
