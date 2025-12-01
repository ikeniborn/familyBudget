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
down_revision: Union[str, None] = 'a8f3b9d4c621'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS for idempotency
    # Allows migration to be safely re-run without errors
    op.execute("""
        ALTER TABLE t_import_staging
        ADD COLUMN IF NOT EXISTS budget_description TEXT;
    """)


def downgrade() -> None:
    # Use raw SQL with IF EXISTS for idempotency
    op.execute("""
        ALTER TABLE t_import_staging
        DROP COLUMN IF EXISTS budget_description;
    """)
