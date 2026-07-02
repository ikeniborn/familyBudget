"""Revise t_f_budget_fact indexes: drop unused and leading-column duplicates

Based on prod pg_stat_user_indexes history (accumulated since cluster init,
snapshot 2026-07-02, aggregated across all partitions):

Dropped — zero scans over the whole stats history:
- idx_budget_fact_cc_date                        (0 scans)
- idx_budget_fact_user_date                      (0 scans; exact prefix of
  idx_budget_fact_user_date_amount_covering)
- idx_budget_fact_amount_date                    (0 scans)
- idx_budget_fact_user_article_date_covering     (0 scans)
- standalone idx_t_f_budget_fact_*_description_trgm duplicates (0 scans;
  created manually by the pre-b7f4a2c9d1e3 ensure_budget_fact_partition on
  auto-created partitions, duplicating the GIN index those partitions
  already inherit from the partitioned parent idx_budget_fact_description_trgm)

Dropped — redundant leading column, queries fall back to the kept index:
- idx_budget_fact_fc_id      (928K scans -> idx_budget_fact_fc_date)
- idx_budget_fact_user_id    (1.4K scans -> user_id-leading composites)
- idx_budget_fact_article_date_amount_covering
                             (540 scans  -> idx_budget_fact_article_id)

Kept (11 per partition): pkey, idx_budget_fact_date, idx_budget_fact_fc_date,
idx_budget_fact_record_type, idx_budget_fact_user_date_amount_covering,
idx_budget_fact_user_record_type_date, idx_budget_fact_article_id,
idx_budget_fact_cc_id, ix_budget_fact_transfer_id,
ix_t_f_budget_fact_recurring_plan_id, idx_budget_fact_description_trgm.

Motivation: every index exists on each monthly partition, so each unused
index multiplies pg_class relations and per-backend relcache memory
(see revision b7f4a2c9d1e3 for the RAM incident background).

Revision ID: d4e8f1a6c2b9
Revises: b7f4a2c9d1e3
Create Date: 2026-07-02 19:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'd4e8f1a6c2b9'
down_revision = 'b7f4a2c9d1e3'
branch_labels = None
depends_on = None

# Partitioned parent indexes to drop (cascades to all partitions)
PARENT_INDEXES_TO_DROP = [
    "idx_budget_fact_fc_id",
    "idx_budget_fact_user_id",
    "idx_budget_fact_user_date",
    "idx_budget_fact_cc_date",
    "idx_budget_fact_amount_date",
    "idx_budget_fact_user_article_date_covering",
    "idx_budget_fact_article_date_amount_covering",
]


def upgrade() -> None:
    for index_name in PARENT_INDEXES_TO_DROP:
        op.execute(f"DROP INDEX IF EXISTS {index_name}")

    # Standalone per-partition trgm duplicates created manually by the old
    # ensure_budget_fact_partition. Only unattached indexes qualify — the
    # inherited children of idx_budget_fact_description_trgm stay.
    op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT c.relname
                FROM pg_class c
                WHERE c.relkind = 'i'
                  AND c.relname ~ '^idx_t_f_budget_fact_[0-9]{4}_[0-9]{2}_description_trgm$'
                  AND NOT EXISTS (
                      SELECT 1 FROM pg_inherits i WHERE i.inhrelid = c.oid
                  )
            LOOP
                EXECUTE format('DROP INDEX IF EXISTS %I', r.relname);
            END LOOP;
        END$$;
    """)


def downgrade() -> None:
    # Recreate parent indexes with their original definitions
    # (per-partition description btree orphans are intentionally not restored)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_budget_fact_fc_id
        ON t_f_budget_fact (financial_center_id)
        WHERE financial_center_id IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_budget_fact_user_id
        ON t_f_budget_fact (user_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_budget_fact_user_date
        ON t_f_budget_fact (user_id, fact_date DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_budget_fact_cc_date
        ON t_f_budget_fact (cost_center_id, fact_date DESC)
        WHERE cost_center_id IS NOT NULL
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_budget_fact_amount_date
        ON t_f_budget_fact (amount, fact_date DESC)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_budget_fact_user_article_date_covering
        ON t_f_budget_fact (user_id, article_id, fact_date DESC)
        INCLUDE (amount, description, financial_center_id)
    """)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_budget_fact_article_date_amount_covering
        ON t_f_budget_fact (article_id, fact_date DESC)
        INCLUDE (amount, user_id)
    """)
