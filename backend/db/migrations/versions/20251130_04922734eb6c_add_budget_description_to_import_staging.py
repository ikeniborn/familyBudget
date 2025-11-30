"""add_budget_description_to_import_staging

Revision ID: 04922734eb6c
Revises: e60f86fd6465
Create Date: 2025-11-30 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '04922734eb6c'
down_revision: Union[str, None] = 'e60f86fd6465'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        't_import_staging',
        sa.Column('budget_description', sa.Text(), nullable=True)
    )


def downgrade() -> None:
    op.drop_column('t_import_staging', 'budget_description')
