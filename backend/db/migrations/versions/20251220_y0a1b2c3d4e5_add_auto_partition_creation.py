"""Add auto-partition creation for t_f_budget_fact

Creates SQL function and trigger to automatically create partitions
for dates outside the pre-defined range (2023-2030).

Problem: Inserting records with dates outside 2023-2030 range fails with
"no partition of relation found for row" error (converted to 409 Conflict).

Solution: BEFORE INSERT trigger that checks if partition exists and creates it if not.

Revision ID: y0a1b2c3d4e5
Revises: x9k0l1m2n3o4
Create Date: 2025-12-20 16:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'y0a1b2c3d4e5'
down_revision = 'x9k0l1m2n3o4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create function to ensure partition exists for a given date
    op.execute("""
        CREATE OR REPLACE FUNCTION ensure_budget_fact_partition(target_date DATE)
        RETURNS VOID AS $$
        DECLARE
            partition_name TEXT;
            start_date DATE;
            end_date DATE;
        BEGIN
            -- Generate partition name: t_f_budget_fact_YYYY_MM
            partition_name := 't_f_budget_fact_' || to_char(target_date, 'YYYY_MM');

            -- Check if partition already exists
            IF NOT EXISTS (
                SELECT 1 FROM pg_tables
                WHERE schemaname = 'public' AND tablename = partition_name
            ) THEN
                -- Calculate partition boundaries (first day of month to first day of next month)
                start_date := date_trunc('month', target_date)::DATE;
                end_date := (date_trunc('month', target_date) + INTERVAL '1 month')::DATE;

                -- Create the partition
                EXECUTE format(
                    'CREATE TABLE %I PARTITION OF t_f_budget_fact FOR VALUES FROM (%L) TO (%L)',
                    partition_name, start_date, end_date
                );

                -- Create GIN index for description search (same as existing partitions)
                -- This requires pg_trgm extension which should already exist
                EXECUTE format(
                    'CREATE INDEX IF NOT EXISTS idx_%I_description_trgm ON %I USING gin (description gin_trgm_ops)',
                    partition_name, partition_name
                );

                RAISE NOTICE 'Auto-created partition: % for range [%, %)', partition_name, start_date, end_date;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 2. Create trigger function that calls ensure_budget_fact_partition
    op.execute("""
        CREATE OR REPLACE FUNCTION budget_fact_partition_trigger()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Ensure partition exists before insert
            PERFORM ensure_budget_fact_partition(NEW.fact_date);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 3. Create BEFORE INSERT trigger on parent table
    # This fires for every INSERT and ensures the target partition exists
    op.execute("""
        CREATE TRIGGER trg_budget_fact_ensure_partition
        BEFORE INSERT ON t_f_budget_fact
        FOR EACH ROW
        EXECUTE FUNCTION budget_fact_partition_trigger();
    """)


def downgrade() -> None:
    # Remove trigger first (depends on function)
    op.execute("DROP TRIGGER IF EXISTS trg_budget_fact_ensure_partition ON t_f_budget_fact")

    # Remove trigger function
    op.execute("DROP FUNCTION IF EXISTS budget_fact_partition_trigger()")

    # Remove partition creation function
    op.execute("DROP FUNCTION IF EXISTS ensure_budget_fact_partition(DATE)")

    # Note: This does NOT drop any partitions that were auto-created.
    # They will remain in the database with their data intact.
