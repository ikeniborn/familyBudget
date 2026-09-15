"""Bound t_f_budget_fact partition auto-creation and drop empty partitions

Root cause (prod RAM incident 2026-07-02): migration z1b2c3d4e5f6 pre-created
372 monthly partitions (2010-2040), each carrying ~19 indexes => ~8900
relations in pg_class. Every long-lived pooled connection gradually cached
metadata for all of them (~90MB relcache/catcache per idle backend), pushing
the PostgreSQL container to ~866MB on a 1.8GB host.

This migration:
1. Replaces ensure_budget_fact_partition() with a guarded version that only
   creates partitions inside [2020-01-01 .. current month + 6 months] and
   relies on the partitioned parent for index inheritance (no manual
   per-partition index creation).
2. Drops partitions that contain no rows (verified with count(*), not
   statistics). They are recreated on demand by the function.
3. Pre-creates the partition runway: current month + 6 months ahead.

Application side: partition_service.ensure_partitions_for_dates() is called
before every BudgetFact insert (and fact_date update), and a daily scheduler
job keeps the runway ahead of time.

Revision ID: b7f4a2c9d1e3
Revises: m3c4d5e6f7a8
Create Date: 2026-07-02 18:30:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b7f4a2c9d1e3'
down_revision = 'm3c4d5e6f7a8'
branch_labels = None
depends_on = None


GUARDED_FUNCTION = """
    CREATE OR REPLACE FUNCTION ensure_budget_fact_partition(target_date DATE)
    RETURNS VOID AS $$
    DECLARE
        partition_name TEXT;
        start_date DATE;
        end_date DATE;
        min_allowed CONSTANT DATE := DATE '2020-01-01';
        max_allowed DATE;
    BEGIN
        partition_name := 't_f_budget_fact_' || to_char(target_date, 'YYYY_MM');

        -- Existing partition: nothing to do (guard applies to creation only)
        IF EXISTS (
            SELECT 1 FROM pg_tables
            WHERE schemaname = 'public' AND tablename = partition_name
        ) THEN
            RETURN;
        END IF;

        -- Auto-creation window: history floor .. 6 months ahead
        max_allowed := (date_trunc('month', now()) + INTERVAL '7 months')::DATE - 1;
        IF target_date < min_allowed OR target_date > max_allowed THEN
            RAISE EXCEPTION 'fact_date % is outside partition auto-creation window [% .. %]',
                target_date, min_allowed, max_allowed
                USING ERRCODE = 'check_violation',
                      HINT = 'Partitions are auto-created only within this window.';
        END IF;

        start_date := date_trunc('month', target_date)::DATE;
        end_date := (date_trunc('month', target_date) + INTERVAL '1 month')::DATE;

        -- IF NOT EXISTS defuses concurrent-creation races.
        -- Indexes are inherited automatically from the partitioned parent.
        EXECUTE format(
            'CREATE TABLE IF NOT EXISTS %I PARTITION OF t_f_budget_fact FOR VALUES FROM (%L) TO (%L)',
            partition_name, start_date, end_date
        );
        RAISE NOTICE 'Auto-created partition: % for range [%, %)', partition_name, start_date, end_date;
    END;
    $$ LANGUAGE plpgsql;
"""


def upgrade() -> None:
    # 1. Guarded partition-creation function
    op.execute(GUARDED_FUNCTION)

    # 2. Drop empty partitions (row count verified, not statistics)
    op.execute("""
        DO $$
        DECLARE
            r RECORD;
            cnt BIGINT;
            dropped INT := 0;
        BEGIN
            FOR r IN
                SELECT c.relname
                FROM pg_class c
                JOIN pg_inherits i ON i.inhrelid = c.oid
                WHERE i.inhparent = 't_f_budget_fact'::regclass
                ORDER BY c.relname
            LOOP
                EXECUTE format('SELECT count(*) FROM %I', r.relname) INTO cnt;
                IF cnt = 0 THEN
                    EXECUTE format('DROP TABLE %I', r.relname);
                    dropped := dropped + 1;
                END IF;
            END LOOP;
            RAISE NOTICE 'Dropped % empty t_f_budget_fact partitions', dropped;
        END$$;
    """)

    # 3. Pre-create the runway: current month + 6 months ahead
    op.execute("""
        DO $$
        DECLARE
            offs INT;
        BEGIN
            FOR offs IN 0..6 LOOP
                PERFORM ensure_budget_fact_partition(
                    (date_trunc('month', now()) + make_interval(months => offs))::DATE
                );
            END LOOP;
        END$$;
    """)


def downgrade() -> None:
    # Restore the unguarded function from y0a1b2c3d4e5 (manual trgm index
    # creation included, as new partitions no longer inherit it there).
    # Dropped empty partitions are NOT recreated.
    op.execute("""
        CREATE OR REPLACE FUNCTION ensure_budget_fact_partition(target_date DATE)
        RETURNS VOID AS $$
        DECLARE
            partition_name TEXT;
            start_date DATE;
            end_date DATE;
        BEGIN
            partition_name := 't_f_budget_fact_' || to_char(target_date, 'YYYY_MM');

            IF NOT EXISTS (
                SELECT 1 FROM pg_tables
                WHERE schemaname = 'public' AND tablename = partition_name
            ) THEN
                start_date := date_trunc('month', target_date)::DATE;
                end_date := (date_trunc('month', target_date) + INTERVAL '1 month')::DATE;

                EXECUTE format(
                    'CREATE TABLE %I PARTITION OF t_f_budget_fact FOR VALUES FROM (%L) TO (%L)',
                    partition_name, start_date, end_date
                );

                EXECUTE format(
                    'CREATE INDEX IF NOT EXISTS idx_%I_description_trgm ON %I USING gin (description gin_trgm_ops)',
                    partition_name, partition_name
                );

                RAISE NOTICE 'Auto-created partition: % for range [%, %)', partition_name, start_date, end_date;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)
