"""remove_dexie_sync_columns

Revision ID: 524e09e9f39a
Revises: 1972ca908ff9
Create Date: 2026-06-05 00:00:00.000000

Drops 5 columns + 7 indexes used only by removed Dexie offline sync layer.
"""
from collections.abc import Sequence

from alembic import op


revision: str = "524e09e9f39a"
down_revision: str | None = "1972ca908ff9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Indexes first
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_content_hash;")
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_history_content_hash;")
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_sync_hash;")
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_sync_dedup;")
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_history_sync_hash;")
    op.execute("DROP INDEX IF EXISTS idx_shopping_list_item_sync_status;")

    # Drop UNIQUE constraint on shopping list temp_id, then the column.
    # Postgres auto-named the constraint `t_f_shopping_list_temp_id_key` in
    # migration 20260216; the alternate `uq_shopping_list_temp_id` form is
    # tried too for forward-compat. Drop the temp_id index as well.
    op.execute("ALTER TABLE t_f_shopping_list DROP CONSTRAINT IF EXISTS t_f_shopping_list_temp_id_key;")
    op.execute("ALTER TABLE t_f_shopping_list DROP CONSTRAINT IF EXISTS uq_shopping_list_temp_id;")
    op.execute("DROP INDEX IF EXISTS uq_shopping_list_temp_id;")
    op.execute("DROP INDEX IF EXISTS idx_shopping_list_temp_id;")
    op.execute("ALTER TABLE t_f_shopping_list DROP COLUMN IF EXISTS temp_id;")

    # shopping_list_item.sync_status
    op.execute("ALTER TABLE t_f_shopping_list_item DROP COLUMN IF EXISTS sync_status;")

    # Fact current + history tables
    for table in ("t_f_budget_fact", "t_f_budget_fact_history"):
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS is_offline_sync;")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS content_hash;")
        op.execute(f"ALTER TABLE {table} DROP COLUMN IF EXISTS sync_hash;")


def downgrade() -> None:
    # Non-reversible by design — Dexie infrastructure is gone.
    raise NotImplementedError("remove_dexie_sync_columns is not reversible")
