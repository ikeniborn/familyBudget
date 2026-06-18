"""add_medicine_reminder

Revision ID: m3c4d5e6f7a8
Revises: m2b3c4d5e6f7
Create Date: 2026-06-15 00:00:02.000000

Phase 3: t_medicine_reminder (one push per recipient per intake).
"""
from collections.abc import Sequence

from alembic import op


revision: str = "m3c4d5e6f7a8"
down_revision: str | None = "m2b3c4d5e6f7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE t_medicine_reminder (
            id SERIAL PRIMARY KEY,
            intake_log_id INT NOT NULL REFERENCES t_f_medicine_intake_log(id) ON DELETE CASCADE,
            recipient_user_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            reminder_datetime TIMESTAMP NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','sent','failed','cancelled')),
            sent_at TIMESTAMP,
            telegram_sent BOOLEAN NOT NULL DEFAULT FALSE,
            web_push_sent BOOLEAN NOT NULL DEFAULT FALSE,
            error_message VARCHAR(1000),
            retry_count INT NOT NULL DEFAULT 0,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_medicine_reminder_recipient UNIQUE (intake_log_id, recipient_user_id)
        )
    """)
    op.execute("CREATE INDEX idx_medicine_reminder_intake ON t_medicine_reminder(intake_log_id)")
    op.execute("CREATE INDEX idx_medicine_reminder_datetime ON t_medicine_reminder(reminder_datetime)")
    op.execute("CREATE INDEX idx_medicine_reminder_pending ON t_medicine_reminder(status) WHERE status = 'pending'")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS t_medicine_reminder")
