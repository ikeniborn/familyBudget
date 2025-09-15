"""Make account_name, bill_name, and operation fields optional in nomenclature

Revision ID: ba29b9c1f48d
Revises: 424c33ed04e9
Create Date: 2025-09-15 17:08:47.360257

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = "ba29b9c1f48d"
down_revision: Union[str, None] = "12b7c55f437a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Make account_name, bill_name, and operation_name nullable in t_d_nomenclature table."""
    # Make the three fields optional (nullable=True)
    op.alter_column("t_d_nomenclature", "account_name",
                   existing_type=sa.VARCHAR(),
                   nullable=True)
    op.alter_column("t_d_nomenclature", "bill_name",
                   existing_type=sa.VARCHAR(),
                   nullable=True)
    op.alter_column("t_d_nomenclature", "operation_name",
                   existing_type=sa.VARCHAR(),
                   nullable=True)


def downgrade() -> None:
    """Revert account_name, bill_name, and operation_name to be non-nullable."""
    # Note: This downgrade requires that all existing records have non-null values
    # for these fields, otherwise it will fail
    op.alter_column("t_d_nomenclature", "operation_name",
                   existing_type=sa.VARCHAR(),
                   nullable=False)
    op.alter_column("t_d_nomenclature", "bill_name",
                   existing_type=sa.VARCHAR(),
                   nullable=False)
    op.alter_column("t_d_nomenclature", "account_name",
                   existing_type=sa.VARCHAR(),
                   nullable=False)
