"""remove_last_name_from_user

Revision ID: 926d27ceb781
Revises: 001_baseline
Create Date: 2025-11-10 19:59:33.412404

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '926d27ceb781'
down_revision: Union[str, None] = '001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Remove last_name column from t_d_user table."""
    op.drop_column('t_d_user', 'last_name')


def downgrade() -> None:
    """Restore last_name column to t_d_user table."""
    op.add_column(
        't_d_user',
        sa.Column('last_name', sa.VARCHAR(length=255), nullable=True)
    )
