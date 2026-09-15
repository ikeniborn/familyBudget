"""Add t_f_ai_chat_log table (analytics-chat server-side history)

One row per analytics-chat exchange: question, resolved scope (JSON),
grounded answer, outcome status, latency. Additive only — no existing
table is touched. Read by GET /api/v1/ai/analytics-chat/history.

Revision ID: b8d2f4a6c7e1
Revises: e5a1c7f3b9d2
Create Date: 2026-09-15 10:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b8d2f4a6c7e1"
down_revision: str | None = "e5a1c7f3b9d2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "t_f_ai_chat_log",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column(
            "user_id",
            sa.Integer(),
            sa.ForeignKey("t_d_user.id"),
            nullable=False,
        ),
        sa.Column("question", sa.String(500), nullable=False),
        sa.Column("scope", sa.JSON(), nullable=True),
        sa.Column("answer", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("latency_ms", sa.Integer(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_t_f_ai_chat_log_user_id", "t_f_ai_chat_log", ["user_id"]
    )
    op.create_index(
        "ix_t_f_ai_chat_log_created_at", "t_f_ai_chat_log", ["created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_t_f_ai_chat_log_created_at", table_name="t_f_ai_chat_log")
    op.drop_index("ix_t_f_ai_chat_log_user_id", table_name="t_f_ai_chat_log")
    op.drop_table("t_f_ai_chat_log")
