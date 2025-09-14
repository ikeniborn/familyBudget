"""Add missing timestamp columns to t_d_period

Revision ID: 12b7c55f437a
Revises: 424c33ed04e9
Create Date: 2025-09-14 18:38:14.070219

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "12b7c55f437a"
down_revision: Union[str, None] = "424c33ed04e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add missing timestamp audit columns to t_d_period
    op.add_column("t_d_period", sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=True))
    op.add_column("t_d_period", sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove the timestamp columns
    op.drop_column("t_d_period", "updated_at")
    op.drop_column("t_d_period", "created_at")
