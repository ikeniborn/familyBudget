"""add_medicine_phase2_tables

Revision ID: m2b3c4d5e6f7
Revises: m1a2b3c4d5e6
Create Date: 2026-06-15 00:00:01.000000

Phase 2: medicine courses + intake_log (generated schedule).
"""
from collections.abc import Sequence

from alembic import op


revision: str = "m2b3c4d5e6f7"
down_revision: str | None = "m1a2b3c4d5e6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE t_f_medicine_course (
            id SERIAL PRIMARY KEY,
            medicine_id INT NOT NULL REFERENCES t_d_medicine(id) ON DELETE RESTRICT,
            patient_id INT NOT NULL REFERENCES t_d_family_member(id) ON DELETE RESTRICT,
            prescribed_by VARCHAR(255),
            dose_amount NUMERIC(10, 3) NOT NULL,
            dose_unit VARCHAR(50) NOT NULL,
            intake_times JSONB NOT NULL,
            with_food VARCHAR(10) CHECK (with_food IS NULL OR with_food IN ('before','with','after','any')),
            start_date DATE NOT NULL,
            end_date DATE,
            schedule_type VARCHAR(20) NOT NULL DEFAULT 'daily'
                CHECK (schedule_type IN ('daily','every_n_days','weekdays')),
            schedule_config JSONB,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            reminders_enabled BOOLEAN NOT NULL DEFAULT TRUE,
            notification_channels JSONB NOT NULL DEFAULT '["telegram","web_push"]'::jsonb,
            snooze_minutes INT NOT NULL DEFAULT 30,
            comment TEXT,
            deleted_at TIMESTAMP,
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX idx_medicine_course_medicine_id ON t_f_medicine_course(medicine_id)")
    op.execute("CREATE INDEX idx_medicine_course_patient_id ON t_f_medicine_course(patient_id)")
    op.execute("CREATE INDEX idx_medicine_course_active ON t_f_medicine_course(is_active) WHERE is_active = TRUE")
    op.execute("CREATE INDEX idx_medicine_course_alive ON t_f_medicine_course(deleted_at) WHERE deleted_at IS NULL")

    op.execute("""
        CREATE TABLE t_f_medicine_intake_log (
            id SERIAL PRIMARY KEY,
            course_id INT NOT NULL REFERENCES t_f_medicine_course(id) ON DELETE CASCADE,
            patient_id INT NOT NULL REFERENCES t_d_family_member(id) ON DELETE RESTRICT,
            scheduled_at TIMESTAMP NOT NULL,
            taken_at TIMESTAMP,
            status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
                CHECK (status IN ('scheduled','taken','skipped','late')),
            dose_taken NUMERIC(10, 3),
            stock_id INT REFERENCES t_f_medicine_stock(id) ON DELETE SET NULL,
            comment TEXT,
            marked_by INT REFERENCES t_d_user(id) ON DELETE SET NULL,
            version INT NOT NULL DEFAULT 1,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT uq_intake_course_scheduled UNIQUE (course_id, scheduled_at)
        )
    """)
    op.execute("CREATE INDEX idx_intake_patient_scheduled ON t_f_medicine_intake_log(patient_id, scheduled_at)")
    op.execute("CREATE INDEX idx_intake_course_scheduled ON t_f_medicine_intake_log(course_id, scheduled_at)")
    op.execute("CREATE INDEX idx_intake_status ON t_f_medicine_intake_log(status)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS t_f_medicine_intake_log")
    op.execute("DROP TABLE IF EXISTS t_f_medicine_course")
