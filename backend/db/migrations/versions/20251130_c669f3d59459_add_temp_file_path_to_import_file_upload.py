"""add temp_file_path to import_file_upload

Revision ID: c669f3d59459
Revises: cebbd998203d
Create Date: 2025-11-30 19:54:43.312817

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c669f3d59459'
down_revision: str | None = 'cebbd998203d'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add temp_file_path column to t_import_file_upload table."""
    # Use raw SQL with IF NOT EXISTS for idempotency
    # Allows migration to be safely re-run without errors
    op.execute("""
        ALTER TABLE t_import_file_upload
        ADD COLUMN IF NOT EXISTS temp_file_path VARCHAR(500);
    """)


def downgrade() -> None:
    """Remove temp_file_path column from t_import_file_upload table."""
    # Use raw SQL with IF EXISTS for idempotency
    op.execute("""
        ALTER TABLE t_import_file_upload
        DROP COLUMN IF EXISTS temp_file_path;
    """)
