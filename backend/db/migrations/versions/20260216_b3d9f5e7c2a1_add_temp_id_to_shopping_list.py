"""add_temp_id_to_shopping_list

Revision ID: b3d9f5e7c2a1
Revises: akhmi26ypiar
Create Date: 2026-02-16 15:30:00.000000

This migration adds temp_id field to t_f_shopping_list table
for client-side offline sync and Dexie consistency.

Changes:
1. Add temp_id VARCHAR(36) UNIQUE NULL to t_f_shopping_list
2. Generate UUID for existing records (backward compatibility)
3. Create index for temp_id queries
4. Add comment explaining field purpose

Use Case:
- Fix: Shopping Lists не сохраняются в Dexie
- Backend always generates UUID temp_id (eliminates frontend fallback)
- Enables Dexie FK queries by temp_id (not numeric ID)
- Guarantees consistency between server and client
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b3d9f5e7c2a1'
down_revision: str | None = 'akhmi26ypiar'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add temp_id field to shopping lists."""

    # Step 1: Add temp_id column
    print("[MIGRATION] Adding temp_id column to t_f_shopping_list...")
    op.execute("""
        ALTER TABLE t_f_shopping_list
        ADD COLUMN temp_id VARCHAR(36) UNIQUE;
    """)

    # Step 2: Generate UUID for existing records (backward compatibility)
    print("[MIGRATION] Generating UUIDs for existing records...")
    op.execute("""
        UPDATE t_f_shopping_list
        SET temp_id = gen_random_uuid()::TEXT
        WHERE temp_id IS NULL;
    """)

    # Step 3: Create index for queries
    print("[MIGRATION] Creating index for temp_id...")
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_shopping_list_temp_id
        ON t_f_shopping_list(temp_id);
    """)

    # Step 4: Add comment
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
    op.execute("ALTER TABLE t_f_shopping_list DROP COLUMN temp_id;")

    print("[MIGRATION] temp_id field rollback completed")
