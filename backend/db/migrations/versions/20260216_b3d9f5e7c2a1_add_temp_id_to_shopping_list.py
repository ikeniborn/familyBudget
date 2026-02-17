"""add_temp_id_to_shopping_list

Revision ID: b3d9f5e7c2a1
Revises: akhmi26ypiar
Create Date: 2026-02-16 15:30:00.000000

This migration adds temp_id field to t_f_shopping_list table
for client-side offline sync and Dexie consistency.

Changes:
1. Add temp_id VARCHAR(36) UNIQUE NULL to t_f_shopping_list
   (or convert existing BIGINT to VARCHAR if column already exists)
2. Generate UUID for existing records (backward compatibility)
3. Create index for temp_id queries
4. Add comment explaining field purpose

Use Case:
- Fix: Shopping Lists не сохраняются в Dexie
- Backend always generates UUID temp_id (eliminates frontend fallback)
- Enables Dexie FK queries by temp_id (not numeric ID)
- Guarantees consistency between server and client

Note on BIGINT → VARCHAR conversion:
  Column may exist as BIGINT from a previous SQLModel autogenerate.
  We detect this and convert it to VARCHAR(36) for UUID storage.
  Existing BIGINT values are cleared (set to NULL) and re-filled with UUIDs.
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b3d9f5e7c2a1'
down_revision: str | None = 'akhmi26ypiar'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add temp_id field to shopping lists (idempotent, handles BIGINT → VARCHAR conversion)."""

    # Step 1: Add column if missing, or convert BIGINT → VARCHAR(36) if already exists
    print("[MIGRATION] Ensuring temp_id column is VARCHAR(36) in t_f_shopping_list...")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_f_shopping_list'
                  AND column_name = 'temp_id'
            ) THEN
                -- Column does not exist: create fresh as VARCHAR(36)
                ALTER TABLE t_f_shopping_list
                ADD COLUMN temp_id VARCHAR(36);

            ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_f_shopping_list'
                  AND column_name = 'temp_id'
                  AND data_type = 'bigint'
            ) THEN
                -- Column exists as BIGINT (legacy int53): convert to VARCHAR(36)
                -- Drop old SQLModel auto-generated index before ALTER
                DROP INDEX IF EXISTS ix_t_f_shopping_list_temp_id;
                -- USING NULL: BIGINT values cannot be UUIDs, reset to NULL
                ALTER TABLE t_f_shopping_list
                ALTER COLUMN temp_id TYPE VARCHAR(36) USING NULL;
            END IF;
            -- If already VARCHAR(36): nothing to do
        END $$;
    """)

    # Step 2: Add UNIQUE constraint if not exists
    print("[MIGRATION] Adding UNIQUE constraint to temp_id...")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint
                WHERE conname = 't_f_shopping_list_temp_id_key'
                  AND conrelid = 't_f_shopping_list'::regclass
            ) THEN
                ALTER TABLE t_f_shopping_list
                ADD CONSTRAINT t_f_shopping_list_temp_id_key UNIQUE (temp_id);
            END IF;
        END $$;
    """)

    # Step 3: Generate UUID for existing records (backward compatibility)
    print("[MIGRATION] Generating UUIDs for existing records...")
    op.execute("""
        UPDATE t_f_shopping_list
        SET temp_id = gen_random_uuid()::TEXT
        WHERE temp_id IS NULL;
    """)

    # Step 4: Create index for queries
    print("[MIGRATION] Creating index for temp_id...")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_shopping_list_temp_id
        ON t_f_shopping_list(temp_id);
    """)

    # Step 5: Add comment
    print("[MIGRATION] Adding column comment...")
    op.execute("""
        COMMENT ON COLUMN t_f_shopping_list.temp_id IS
            'Client-side UUID for offline sync (guaranteed unique, used for Dexie queries)';
    """)

    # Update table statistics for query planner
    op.execute("ANALYZE t_f_shopping_list;")

    print("[MIGRATION] temp_id field migration completed successfully")


def downgrade() -> None:
    """Remove temp_id field from shopping lists."""

    print("[MIGRATION] Removing temp_id index...")
    op.execute("DROP INDEX IF EXISTS idx_shopping_list_temp_id;")

    print("[MIGRATION] Removing temp_id column from t_f_shopping_list...")
    op.execute("ALTER TABLE t_f_shopping_list DROP COLUMN IF EXISTS temp_id;")

    print("[MIGRATION] temp_id field rollback completed")
