"""add_google_sheets_url_to_shopping_list

Revision ID: 1972ca908ff9
Revises: ebf328b51e19
Create Date: 2026-06-03 12:00:00.000000
"""
from collections.abc import Sequence

from alembic import op

revision: str = '1972ca908ff9'
down_revision: str | None = 'ebf328b51e19'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_name = 't_f_shopping_list'
                  AND column_name = 'google_sheets_url'
            ) THEN
                ALTER TABLE t_f_shopping_list
                ADD COLUMN google_sheets_url VARCHAR(2048) NULL;

                COMMENT ON COLUMN t_f_shopping_list.google_sheets_url IS
                    'Saved Google Sheets URL for this specific shopping list (per-list, not per-user)';
            END IF;
        END $$;
    """)
    print("[MIGRATION] google_sheets_url column added to t_f_shopping_list")


def downgrade() -> None:
    op.execute(
        "ALTER TABLE t_f_shopping_list DROP COLUMN IF EXISTS google_sheets_url;"
    )
    print("[MIGRATION] google_sheets_url column removed from t_f_shopping_list")
