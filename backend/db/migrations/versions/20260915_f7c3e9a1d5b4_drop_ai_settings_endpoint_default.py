"""Drop the hardcoded endpoint_url server_default from t_d_ai_settings

The default pointed at a personal endpoint and is dead weight anyway: the
service layer creates the single settings row from Python-side model
defaults, never via raw SQL. Existing rows keep their stored value.

Revision ID: f7c3e9a1d5b4
Revises: b8d2f4a6c7e1
Create Date: 2026-09-15 21:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f7c3e9a1d5b4"
down_revision: str | None = "b8d2f4a6c7e1"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column("t_d_ai_settings", "endpoint_url", server_default=None)


def downgrade() -> None:
    op.alter_column(
        "t_d_ai_settings",
        "endpoint_url",
        server_default="https://homelab.ikeniborn.ru/v1",
    )
