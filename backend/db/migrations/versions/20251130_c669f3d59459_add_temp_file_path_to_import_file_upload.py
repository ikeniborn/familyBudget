"""add temp_file_path to import_file_upload

Revision ID: c669f3d59459
Revises: cebbd998203d
Create Date: 2025-11-30 19:54:43.312817

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c669f3d59459'
down_revision: Union[str, None] = 'cebbd998203d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add temp_file_path column to t_import_file_upload table."""
    op.add_column(
        't_import_file_upload',
        sa.Column('temp_file_path', sa.String(500), nullable=True)
    )


def downgrade() -> None:
    """Remove temp_file_path column from t_import_file_upload table."""
    op.drop_column('t_import_file_upload', 'temp_file_path')
