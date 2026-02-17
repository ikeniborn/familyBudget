"""add_temp_id_to_shopping_list

Revision ID: b3d9f5e7c2a1
Revises: akhmi26ypiar
Create Date: 2026-02-16 15:30:00.000000

This migration adds temp_id field to t_f_shopping_list table
for client-side offline sync and Dexie consistency.

Changes:
1. Add temp_id UUID UNIQUE NULL to t_f_shopping_list
   (or convert existing BIGINT/VARCHAR to UUID if column already exists)
2. Generate UUID for existing records (backward compatibility)
3. Create index for temp_id queries
4. Add comment explaining field purpose

Use Case:
- Fix: Shopping Lists не сохраняются в Dexie
- Backend always generates UUID temp_id (eliminates frontend fallback)
- Enables Dexie FK queries by temp_id (not numeric ID)
- Guarantees consistency between server and client

Type choice: native PostgreSQL UUID
- 16 bytes vs 36 bytes (VARCHAR) — 2.25x storage reduction
- Built-in validation (DB rejects malformed UUIDs)
- Better index performance
- psycopg2 returns UUID as str when as_uuid=False — API/Dexie compatible

Note on type conversion:
  BIGINT  → ALTER COLUMN TYPE UUID USING NULL (existing values cleared)
  VARCHAR → ALTER COLUMN TYPE UUID USING temp_id::UUID
            (valid UUID strings preserved, invalid ones raise error)
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b3d9f5e7c2a1'
down_revision: str | None = 'akhmi26ypiar'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add temp_id UUID field (idempotent, handles BIGINT/VARCHAR → UUID conversion)."""

    # Step 1: Ensure column exists as native UUID type
    print("[MIGRATION] Ensuring temp_id column is UUID in t_f_shopping_list...")
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_f_shopping_list'
                  AND column_name = 'temp_id'
            ) THEN
                -- Column does not exist: create fresh as UUID
                ALTER TABLE t_f_shopping_list
                ADD COLUMN temp_id UUID;

            ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_f_shopping_list'
                  AND column_name = 'temp_id'
                  AND data_type = 'bigint'
            ) THEN
                -- Column exists as BIGINT (legacy int53): convert to UUID
                DROP INDEX IF EXISTS ix_t_f_shopping_list_temp_id;
                -- USING NULL: BIGINT values are not valid UUIDs
                ALTER TABLE t_f_shopping_list
                ALTER COLUMN temp_id TYPE UUID USING NULL;

            ELSIF EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_f_shopping_list'
                  AND column_name = 'temp_id'
                  AND data_type = 'character varying'
            ) THEN
                -- Column exists as VARCHAR: convert UUID strings to native UUID
                DROP INDEX IF EXISTS idx_shopping_list_temp_id;
                DROP INDEX IF EXISTS ix_t_f_shopping_list_temp_id;
                -- USING temp_id::UUID: valid UUID strings are preserved
                ALTER TABLE t_f_shopping_list
                ALTER COLUMN temp_id TYPE UUID USING temp_id::UUID;
            END IF;
            -- If already UUID: nothing to do
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

    # Step 3: Generate UUID for existing records without temp_id
    print("[MIGRATION] Generating UUIDs for existing records...")
    op.execute("""
        UPDATE t_f_shopping_list
        SET temp_id = gen_random_uuid()
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
            'Client-side UUID for offline sync (native UUID type, guaranteed unique, used for Dexie queries)';
    """)

    op.execute("ANALYZE t_f_shopping_list;")

    print("[MIGRATION] temp_id UUID field migration completed successfully")


def downgrade() -> None:
    """Remove temp_id field from shopping lists."""

    print("[MIGRATION] Removing temp_id index...")
    op.execute("DROP INDEX IF EXISTS idx_shopping_list_temp_id;")

    print("[MIGRATION] Removing temp_id column from t_f_shopping_list...")
    op.execute("ALTER TABLE t_f_shopping_list DROP COLUMN IF EXISTS temp_id;")

    print("[MIGRATION] temp_id field rollback completed")
