"""merge heads

Revision ID: b3ae64eae53f
Revises: c669f3d59460, f8e9a7b6c4d2
Create Date: 2025-12-02 02:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b3ae64eae53f'
down_revision: Union[str, Sequence[str], None] = ('c669f3d59460', 'f8e9a7b6c4d2')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
