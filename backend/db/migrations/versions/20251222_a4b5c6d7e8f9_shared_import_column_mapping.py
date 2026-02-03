"""Change import column mapping to shared per bank

Changes t_import_column_mapping unique constraint from (bank_provider_id, user_id)
to (bank_provider_id) only. This allows mapping to be shared across all users
instead of per-user mappings.

user_id column is kept for tracking who last updated the mapping (informational only).

Revision ID: a4b5c6d7e8f9
Revises: 3a077393f4de
Create Date: 2025-12-22 18:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'a4b5c6d7e8f9'
down_revision = '3a077393f4de'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Change unique constraint from (bank_provider_id, user_id) to (bank_provider_id).

    Steps:
    1. Delete duplicate mappings, keeping the latest one per bank_provider_id
    2. Drop old unique constraint
    3. Create new unique constraint on bank_provider_id only
    """
    # 1. Delete duplicate mappings, keeping the latest one per bank_provider_id
    # Uses a CTE to identify duplicates and delete all but the most recently updated
    op.execute("""
        DELETE FROM t_import_column_mapping
        WHERE id NOT IN (
            SELECT DISTINCT ON (bank_provider_id) id
            FROM t_import_column_mapping
            ORDER BY bank_provider_id, updated_at DESC
        );
    """)

    # 2. Drop old unique constraint (bank_provider_id, user_id)
    op.execute("""
        ALTER TABLE t_import_column_mapping
        DROP CONSTRAINT IF EXISTS uq_bank_user_mapping;
    """)

    # 3. Create new unique constraint (bank_provider_id only)
    op.execute("""
        ALTER TABLE t_import_column_mapping
        ADD CONSTRAINT uq_bank_mapping UNIQUE (bank_provider_id);
    """)


def downgrade() -> None:
    """
    Revert to per-user mapping constraint.

    Note: This may fail if there are multiple mappings for the same bank
    after the upgrade (which shouldn't happen with the new constraint).
    """
    # 1. Drop new unique constraint
    op.execute("""
        ALTER TABLE t_import_column_mapping
        DROP CONSTRAINT IF EXISTS uq_bank_mapping;
    """)

    # 2. Recreate old unique constraint (bank_provider_id, user_id)
    op.execute("""
        ALTER TABLE t_import_column_mapping
        ADD CONSTRAINT uq_bank_user_mapping UNIQUE (bank_provider_id, user_id);
    """)
