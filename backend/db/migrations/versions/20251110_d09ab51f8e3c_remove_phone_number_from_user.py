"""remove_phone_number_from_user

Revision ID: d09ab51f8e3c
Revises: 926d27ceb781
Create Date: 2025-11-10 20:52:52.483230

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd09ab51f8e3c'
down_revision: Union[str, None] = '926d27ceb781'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove phone_number column from t_d_user table."""
    op.drop_column('t_d_user', 'phone_number')


def downgrade() -> None:
    """Restore phone_number column to t_d_user table."""
    op.add_column(
        't_d_user',
        sa.Column('phone_number', sa.VARCHAR(length=20), nullable=True)
    )
