"""add_medicine_phase1_tables

Revision ID: m1a2b3c4d5e6
Revises: 524e09e9f39a
Create Date: 2026-06-15 00:00:00.000000

Phase 1 of medicine tracking: catalog (+SCD2 history), family members, stock.
"""
from collections.abc import Sequence

from alembic import op


revision: str = "m1a2b3c4d5e6"
down_revision: str | None = "524e09e9f39a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # ===== Catalog (SCD Type 1) =====
    op.execute("""
        CREATE TABLE t_d_medicine (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            inn VARCHAR(255),
            form VARCHAR(20) NOT NULL
                CHECK (form IN ('tablet','capsule','syrup','drops','ointment','spray','injection','other')),
            dosage VARCHAR(100),
            prescription_required BOOLEAN NOT NULL DEFAULT FALSE,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX idx_medicine_name ON t_d_medicine(name)")
    op.execute("CREATE INDEX idx_medicine_inn ON t_d_medicine(inn) WHERE inn IS NOT NULL")
    op.execute("CREATE INDEX idx_medicine_creator_id ON t_d_medicine(creator_id)")
    op.execute("CREATE INDEX idx_medicine_active ON t_d_medicine(is_active) WHERE is_active = TRUE")

    # ===== Catalog history (SCD Type 2) — valid_from/valid_to tz-aware (project convention) =====
    op.execute("""
        CREATE TABLE t_d_medicine_history (
            history_id SERIAL PRIMARY KEY,
            medicine_id INT NOT NULL REFERENCES t_d_medicine(id) ON DELETE CASCADE,
            creator_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            inn VARCHAR(255),
            form VARCHAR(20) NOT NULL,
            dosage VARCHAR(100),
            prescription_required BOOLEAN NOT NULL,
            notes TEXT,
            is_active BOOLEAN NOT NULL,
            valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
            valid_to TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT '9999-12-31 23:59:59+00'::TIMESTAMPTZ,
            is_current BOOLEAN NOT NULL,
            change_type VARCHAR(50) NOT NULL,
            changed_fields TEXT[],
            changed_by_user_id INT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_medicine_history_valid_dates CHECK (valid_from < valid_to)
        )
    """)
    op.execute("CREATE INDEX idx_medicine_history_medicine_id ON t_d_medicine_history(medicine_id)")
    op.execute("CREATE INDEX idx_medicine_history_valid_from ON t_d_medicine_history(valid_from)")
    op.execute("CREATE INDEX idx_medicine_history_is_current ON t_d_medicine_history(is_current) WHERE is_current = TRUE")

    # ===== Family members =====
    op.execute("""
        CREATE TABLE t_d_family_member (
            id SERIAL PRIMARY KEY,
            linked_user_id INT REFERENCES t_d_user(id) ON DELETE SET NULL,
            guardian_user_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            birth_date DATE,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)
    op.execute("CREATE INDEX idx_family_member_guardian ON t_d_family_member(guardian_user_id)")
    op.execute("CREATE INDEX idx_family_member_linked ON t_d_family_member(linked_user_id) WHERE linked_user_id IS NOT NULL")
    op.execute("CREATE INDEX idx_family_member_name ON t_d_family_member(name)")
    op.execute("CREATE INDEX idx_family_member_active ON t_d_family_member(is_active) WHERE is_active = TRUE")

    # ===== Stock (one package = one row) =====
    op.execute("""
        CREATE TABLE t_f_medicine_stock (
            id SERIAL PRIMARY KEY,
            medicine_id INT NOT NULL REFERENCES t_d_medicine(id) ON DELETE RESTRICT,
            quantity_remaining NUMERIC(10, 3) NOT NULL,
            quantity_initial NUMERIC(10, 3) NOT NULL,
            unit VARCHAR(50) NOT NULL,
            expiry_date DATE NOT NULL,
            purchase_date DATE,
            purchase_price NUMERIC(10, 2),
            location VARCHAR(100),
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            version INT NOT NULL DEFAULT 1,
            deleted_at TIMESTAMP,
            last_modified_by INT REFERENCES t_d_user(id) ON DELETE SET NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_stock_qty_nonneg CHECK (quantity_remaining >= 0)
        )
    """)
    op.execute("CREATE INDEX idx_medicine_stock_medicine_id ON t_f_medicine_stock(medicine_id)")
    op.execute("CREATE INDEX idx_medicine_stock_expiry ON t_f_medicine_stock(expiry_date)")
    op.execute("CREATE INDEX idx_medicine_stock_creator_id ON t_f_medicine_stock(creator_id)")
    op.execute("CREATE INDEX idx_medicine_stock_active ON t_f_medicine_stock(deleted_at) WHERE deleted_at IS NULL")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS t_f_medicine_stock")
    op.execute("DROP TABLE IF EXISTS t_d_family_member")
    op.execute("DROP TABLE IF EXISTS t_d_medicine_history")
    op.execute("DROP TABLE IF EXISTS t_d_medicine")
