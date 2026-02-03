"""add multi-bank import support

Revision ID: cebbd998203d
Revises: 04922734eb6c
Create Date: 2025-11-30 19:10:17.959182

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'cebbd998203d'
down_revision: str | None = '04922734eb6c'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Use raw SQL with IF NOT EXISTS for all operations to ensure idempotency
    # This allows the migration to be safely re-run without errors

    # 1. Create t_d_bank_provider table
    op.execute("""
        CREATE TABLE IF NOT EXISTS t_d_bank_provider (
            id SERIAL PRIMARY KEY,
            code VARCHAR(50) NOT NULL,
            name VARCHAR(255) NOT NULL,
            active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT uq_bank_provider_code UNIQUE (code)
        );
    """)

    # 2. Create t_import_file_upload table
    op.execute("""
        CREATE TABLE IF NOT EXISTS t_import_file_upload (
            id BIGSERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            bank_provider_id INTEGER NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            file_size INTEGER,
            mime_type VARCHAR(100),
            csv_headers JSON,
            csv_sample_rows JSON,
            total_rows INTEGER,
            status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
            error_message TEXT,
            mapping_id INTEGER,
            uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            analyzed_at TIMESTAMP WITH TIME ZONE,
            parsed_at TIMESTAMP WITH TIME ZONE,
            CONSTRAINT t_import_file_upload_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE,
            CONSTRAINT t_import_file_upload_bank_provider_id_fkey
                FOREIGN KEY (bank_provider_id) REFERENCES t_d_bank_provider(id) ON DELETE CASCADE
        );
    """)

    # Create indexes for t_import_file_upload
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_import_file_upload_user_id
        ON t_import_file_upload(user_id);
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_import_file_upload_status
        ON t_import_file_upload(status);
    """)

    # 3. Create t_import_column_mapping table
    op.execute("""
        CREATE TABLE IF NOT EXISTS t_import_column_mapping (
            id SERIAL PRIMARY KEY,
            bank_provider_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            mapping JSON NOT NULL,
            transformations JSON,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
            CONSTRAINT t_import_column_mapping_bank_provider_id_fkey
                FOREIGN KEY (bank_provider_id) REFERENCES t_d_bank_provider(id) ON DELETE CASCADE,
            CONSTRAINT t_import_column_mapping_user_id_fkey
                FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE,
            CONSTRAINT uq_bank_user_mapping UNIQUE (bank_provider_id, user_id)
        );
    """)

    # Add foreign key from t_import_file_upload.mapping_id to t_import_column_mapping.id
    # Check if constraint already exists before creating
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_import_file_upload_mapping_id'
            ) THEN
                ALTER TABLE t_import_file_upload
                ADD CONSTRAINT fk_import_file_upload_mapping_id
                FOREIGN KEY (mapping_id) REFERENCES t_import_column_mapping(id) ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # 4. Modify t_import_staging - clear data first
    op.execute("DELETE FROM t_import_staging")

    # Drop tinkoff-specific columns (use IF EXISTS)
    op.execute("""
        ALTER TABLE t_import_staging
        DROP COLUMN IF EXISTS tinkoff_date,
        DROP COLUMN IF EXISTS tinkoff_amount,
        DROP COLUMN IF EXISTS tinkoff_category,
        DROP COLUMN IF EXISTS tinkoff_mcc,
        DROP COLUMN IF EXISTS tinkoff_description,
        DROP COLUMN IF EXISTS tinkoff_card;
    """)

    # Add generic columns (use IF NOT EXISTS)
    op.execute("""
        ALTER TABLE t_import_staging
        ADD COLUMN IF NOT EXISTS file_upload_id BIGINT,
        ADD COLUMN IF NOT EXISTS fact_date DATE,
        ADD COLUMN IF NOT EXISTS amount_string VARCHAR(20),
        ADD COLUMN IF NOT EXISTS description TEXT,
        ADD COLUMN IF NOT EXISTS csv_metadata JSON;
    """)

    # Set NOT NULL constraints after adding columns
    # Only if columns exist and are all NULL currently
    op.execute("""
        DO $$
        BEGIN
            -- Set NOT NULL only if column exists and has no NULL values
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_import_staging' AND column_name = 'fact_date'
            ) THEN
                UPDATE t_import_staging SET fact_date = CURRENT_DATE WHERE fact_date IS NULL;
                ALTER TABLE t_import_staging ALTER COLUMN fact_date SET NOT NULL;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_import_staging' AND column_name = 'amount_string'
            ) THEN
                UPDATE t_import_staging SET amount_string = '0' WHERE amount_string IS NULL;
                ALTER TABLE t_import_staging ALTER COLUMN amount_string SET NOT NULL;
            END IF;
        END $$;
    """)

    # Add foreign key for file_upload_id
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_import_staging_file_upload_id'
            ) THEN
                ALTER TABLE t_import_staging
                ADD CONSTRAINT fk_import_staging_file_upload_id
                FOREIGN KEY (file_upload_id) REFERENCES t_import_file_upload(id) ON DELETE CASCADE;
            END IF;
        END $$;
    """)

    # 5. Seed default banks (use ON CONFLICT DO NOTHING for idempotency)
    op.execute("""
        INSERT INTO t_d_bank_provider (code, name, active) VALUES
        ('tinkoff', 'Тинькофф Банк', true),
        ('alfabank', 'Альфа-Банк', true),
        ('sberbank', 'Сбербанк', true),
        ('vtb', 'ВТБ', true),
        ('raiffeisen', 'Райффайзен Банк', true)
        ON CONFLICT (code) DO NOTHING;
    """)


def downgrade() -> None:
    # Use raw SQL with IF EXISTS for all operations to ensure idempotency

    # Restore t_import_staging - clear data first
    op.execute("DELETE FROM t_import_staging")

    # Drop foreign key if exists
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_import_staging_file_upload_id'
            ) THEN
                ALTER TABLE t_import_staging
                DROP CONSTRAINT fk_import_staging_file_upload_id;
            END IF;
        END $$;
    """)

    # Drop generic columns
    op.execute("""
        ALTER TABLE t_import_staging
        DROP COLUMN IF EXISTS csv_metadata,
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS amount_string,
        DROP COLUMN IF EXISTS fact_date,
        DROP COLUMN IF EXISTS file_upload_id;
    """)

    # Restore tinkoff-specific columns
    op.execute("""
        ALTER TABLE t_import_staging
        ADD COLUMN IF NOT EXISTS tinkoff_card VARCHAR(20),
        ADD COLUMN IF NOT EXISTS tinkoff_description TEXT,
        ADD COLUMN IF NOT EXISTS tinkoff_mcc VARCHAR(10),
        ADD COLUMN IF NOT EXISTS tinkoff_category VARCHAR(255),
        ADD COLUMN IF NOT EXISTS tinkoff_amount VARCHAR(20),
        ADD COLUMN IF NOT EXISTS tinkoff_date DATE;
    """)

    # Set NOT NULL constraints for required tinkoff columns
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_import_staging' AND column_name = 'tinkoff_date'
            ) THEN
                UPDATE t_import_staging SET tinkoff_date = CURRENT_DATE WHERE tinkoff_date IS NULL;
                ALTER TABLE t_import_staging ALTER COLUMN tinkoff_date SET NOT NULL;
            END IF;

            IF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_import_staging' AND column_name = 'tinkoff_amount'
            ) THEN
                UPDATE t_import_staging SET tinkoff_amount = '0' WHERE tinkoff_amount IS NULL;
                ALTER TABLE t_import_staging ALTER COLUMN tinkoff_amount SET NOT NULL;
            END IF;
        END $$;
    """)

    # Drop new tables (in reverse order)
    op.execute("""
        DO $$
        BEGIN
            IF EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 'fk_import_file_upload_mapping_id'
            ) THEN
                ALTER TABLE t_import_file_upload
                DROP CONSTRAINT fk_import_file_upload_mapping_id;
            END IF;
        END $$;
    """)

    op.execute("DROP TABLE IF EXISTS t_import_column_mapping CASCADE;")
    op.execute("DROP INDEX IF EXISTS ix_import_file_upload_status;")
    op.execute("DROP INDEX IF EXISTS ix_import_file_upload_user_id;")
    op.execute("DROP TABLE IF EXISTS t_import_file_upload CASCADE;")
    op.execute("DROP TABLE IF EXISTS t_d_bank_provider CASCADE;")
