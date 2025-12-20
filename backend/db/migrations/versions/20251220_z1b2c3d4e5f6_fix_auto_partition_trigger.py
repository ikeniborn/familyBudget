"""Fix auto-partition - create partitions for extended date range

The BEFORE INSERT trigger approach doesn't work for partitioned tables because
PostgreSQL determines the target partition BEFORE calling the trigger.

Simple solution: Pre-create partitions for a wide date range (2010-2040).
This covers historical imports and future planning.

Also removes the ineffective triggers created by previous migration.

Revision ID: z1b2c3d4e5f6
Revises: y0a1b2c3d4e5
Create Date: 2025-12-20 23:00:00.000000

"""
from alembic import op

# revision identifiers, used by Alembic.
revision = 'z1b2c3d4e5f6'
down_revision = 'y0a1b2c3d4e5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Drop the ineffective BEFORE INSERT triggers from all tables
    op.execute("""
        DO $$
        DECLARE
            r RECORD;
        BEGIN
            FOR r IN
                SELECT tgrelid::regclass::text as tbl
                FROM pg_trigger
                WHERE tgname = 'trg_budget_fact_ensure_partition'
            LOOP
                EXECUTE 'DROP TRIGGER IF EXISTS trg_budget_fact_ensure_partition ON ' || r.tbl;
            END LOOP;
        END$$;
    """)

    # 2. Drop the ineffective trigger function
    op.execute("DROP FUNCTION IF EXISTS budget_fact_partition_trigger()")

    # 3. Create partitions for extended range: 2010-2040
    # Using the existing ensure_budget_fact_partition function
    # This creates ~360 partitions (30 years * 12 months)
    op.execute("""
        DO $$
        DECLARE
            y INT;
            m INT;
            target_date DATE;
        BEGIN
            -- Create partitions for years 2010-2022 (before existing 2023-2030)
            FOR y IN 2010..2022 LOOP
                FOR m IN 1..12 LOOP
                    target_date := make_date(y, m, 1);
                    PERFORM ensure_budget_fact_partition(target_date);
                END LOOP;
            END LOOP;

            -- Create partitions for years 2031-2040 (after existing 2023-2030)
            FOR y IN 2031..2040 LOOP
                FOR m IN 1..12 LOOP
                    target_date := make_date(y, m, 1);
                    PERFORM ensure_budget_fact_partition(target_date);
                END LOOP;
            END LOOP;

            RAISE NOTICE 'Created partitions for 2010-2022 and 2031-2040';
        END$$;
    """)


def downgrade() -> None:
    # Note: We don't drop the created partitions as they may contain data.
    # The ensure_budget_fact_partition function remains for future use.
    pass
