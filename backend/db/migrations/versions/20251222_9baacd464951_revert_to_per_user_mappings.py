"""revert to per user mappings

This migration reverts the shared mapping model (migration a4b5c6d7e8f9)
back to per-user mappings. Each user should have their own mapping per bank.

Background:
- Migration a4b5c6d7e8f9 changed constraint from (bank_provider_id, user_id)
  to (bank_provider_id) only, creating shared mappings
- This caused issue where users overwrite each other's mappings
- This migration restores per-user isolation

Revision ID: 9baacd464951
Revises: a4b5c6d7e8f9
Create Date: 2025-12-22 23:15:05.087075

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '9baacd464951'
down_revision: str | None = 'a4b5c6d7e8f9'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Revert to per-user mapping constraint.

    Steps:
    1. Drop current unique constraint (bank_provider_id only)
    2. Create new unique constraint (bank_provider_id, user_id)
    3. Add index on user_id for performance

    Note: Existing mappings are preserved. If there are multiple users
    using the same bank, they will start with the same mapping (the one
    that survived the previous migration) but can now customize independently.
    """
    # 1. Drop shared constraint
    op.execute("""
        ALTER TABLE t_import_column_mapping
        DROP CONSTRAINT IF EXISTS uq_bank_mapping;
    """)

    # 2. Create per-user constraint
    op.execute("""
        ALTER TABLE t_import_column_mapping
        ADD CONSTRAINT uq_bank_user_mapping UNIQUE (bank_provider_id, user_id);
    """)

    # 3. Add index on user_id (if not exists)
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_import_column_mapping_user_id
        ON t_import_column_mapping (user_id);
    """)


def downgrade() -> None:
    """
    Revert to shared mapping model (not recommended).

    WARNING: This will delete all but the most recent mapping per bank.
    Data loss will occur if multiple users have customized mappings.

    This is essentially the upgrade() from migration a4b5c6d7e8f9.
    """
    # 1. Delete all mappings except the latest per bank (data loss!)
    op.execute("""
        DELETE FROM t_import_column_mapping
        WHERE id NOT IN (
            SELECT DISTINCT ON (bank_provider_id) id
            FROM t_import_column_mapping
            ORDER BY bank_provider_id, updated_at DESC
        );
    """)

    # 2. Drop per-user constraint
    op.execute("""
        ALTER TABLE t_import_column_mapping
        DROP CONSTRAINT IF EXISTS uq_bank_user_mapping;
    """)

    # 3. Add back shared constraint
    op.execute("""
        ALTER TABLE t_import_column_mapping
        ADD CONSTRAINT uq_bank_mapping UNIQUE (bank_provider_id);
    """)
