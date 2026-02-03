"""add bank_provider_id to staging

Revision ID: c669f3d59460
Revises: c669f3d59459
Create Date: 2025-12-01 18:30:00.000000

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c669f3d59460'
down_revision: str | None = 'c669f3d59459'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Add bank_provider_id column to t_import_staging
    op.execute("""
        ALTER TABLE t_import_staging
        ADD COLUMN IF NOT EXISTS bank_provider_id INTEGER;
    """)

    # Add foreign key constraint
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 't_import_staging_bank_provider_id_fkey'
            ) THEN
                ALTER TABLE t_import_staging
                ADD CONSTRAINT t_import_staging_bank_provider_id_fkey
                    FOREIGN KEY (bank_provider_id)
                    REFERENCES t_d_bank_provider(id)
                    ON DELETE SET NULL;
            END IF;
        END $$;
    """)

    # Create index for bank_provider_id
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_import_staging_bank_provider_id
        ON t_import_staging(bank_provider_id);
    """)

    # Update existing records to set bank_provider_id from file_upload (if possible)
    op.execute("""
        UPDATE t_import_staging
        SET bank_provider_id = (
            SELECT bank_provider_id
            FROM t_import_file_upload
            WHERE id = t_import_staging.file_upload_id
        )
        WHERE file_upload_id IS NOT NULL
        AND bank_provider_id IS NULL;
    """)


def downgrade() -> None:
    # Drop index
    op.execute("""
        DROP INDEX IF EXISTS ix_import_staging_bank_provider_id;
    """)

    # Drop foreign key constraint
    op.execute("""
        ALTER TABLE t_import_staging
        DROP CONSTRAINT IF EXISTS t_import_staging_bank_provider_id_fkey;
    """)

    # Drop column
    op.execute("""
        ALTER TABLE t_import_staging
        DROP COLUMN IF EXISTS bank_provider_id;
    """)
