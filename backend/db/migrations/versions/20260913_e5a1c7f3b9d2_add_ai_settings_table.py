"""Add t_d_ai_settings single-row configuration table (AI module, phase 1)

Runtime configuration for the AI module (OpenAI-compatible provider):
endpoint URL, bearer token, per-slot model aliases (text / image / voice),
confidence threshold, and a global enable switch. Managed from the admin
web UI; the service layer reads/creates the row with id=1 lazily, so no
seed data is inserted here.

Revision ID: e5a1c7f3b9d2
Revises: d4e8f1a6c2b9
Create Date: 2026-09-13 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e5a1c7f3b9d2"
down_revision: str | None = "d4e8f1a6c2b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "t_d_ai_settings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "enabled", sa.Boolean(), nullable=False, server_default=sa.false()
        ),
        sa.Column(
            "endpoint_url",
            sa.String(500),
            nullable=False,
            server_default="https://homelab.ikeniborn.ru/v1",
        ),
        sa.Column("api_token", sa.String(1000), nullable=True),
        sa.Column("model_text", sa.String(255), nullable=True),
        sa.Column("model_image", sa.String(255), nullable=True),
        sa.Column("model_voice", sa.String(255), nullable=True),
        sa.Column(
            "confidence_threshold",
            sa.Float(),
            nullable=False,
            server_default="0.7",
        ),
        sa.Column(
            "updated_by",
            sa.Integer(),
            sa.ForeignKey("t_d_user.id"),
            nullable=True,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("t_d_ai_settings")
