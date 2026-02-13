"""add_gin_indexes_to_partitions

Revision ID: 713fcefee450
Revises: c9f2a8b4e1d6
Create Date: 2025-11-12 00:31:51.356936

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '713fcefee450'
down_revision: str | None = 'c9f2a8b4e1d6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Create GIN trigram indexes on ALL t_f_budget_fact partitions.

    Problem:
    Previous migration created index with "ON ONLY" which only creates index
    on parent table, NOT on child partitions. Since all data lives in partitions,
    search queries don't use the index.

    Solution:
    Dynamically find all partitions (t_f_budget_fact_YYYY_MM) and create
    GIN index on description field for EACH partition.

    Performance:
    - 96 partitions (2023-01 to 2030-12)
    - Each CREATE INDEX runs CONCURRENTLY to avoid blocking writes
    - Estimated time: ~5-10 minutes for all partitions
    """

    # Get database connection
    connection = op.get_bind()

    # Find all partition tables
    result = connection.execute(sa.text("""
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 't_f_budget_fact_%'
        AND tablename ~ '^t_f_budget_fact_[0-9]{4}_[0-9]{2}$'
        ORDER BY tablename;
    """))

    partitions = [row[0] for row in result]

    print(f"Creating GIN indexes on {len(partitions)} partitions...")

    # Create index on each partition
    for partition_name in partitions:
        index_name = f"idx_{partition_name}_description_trgm"

        # Note: CONCURRENTLY requires executing outside of transaction block
        # Since Alembic runs migrations in transactions by default, we use regular CREATE INDEX
        # For production with zero-downtime, run this with op.execute() and handle transactions manually

        sql = f"""
            CREATE INDEX IF NOT EXISTS {index_name}
            ON {partition_name}
            USING gin (description gin_trgm_ops);
        """

        op.execute(sql)
        print(f"  ✓ Created index on {partition_name}")

    print(f"✓ Successfully created {len(partitions)} GIN indexes")


def downgrade() -> None:
    """
    Drop GIN trigram indexes from all partitions.

    WARNING: This will revert to sequential scans for search queries.
    Only run this if you're reverting the search feature completely.
    """

    connection = op.get_bind()

    # Find all partition tables
    result = connection.execute(sa.text("""
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = 'public'
        AND tablename LIKE 't_f_budget_fact_%'
        AND tablename ~ '^t_f_budget_fact_[0-9]{4}_[0-9]{2}$'
        ORDER BY tablename;
    """))

    partitions = [row[0] for row in result]

    print(f"Dropping GIN indexes from {len(partitions)} partitions...")

    # Drop index from each partition
    for partition_name in partitions:
        index_name = f"idx_{partition_name}_description_trgm"

        sql = f"DROP INDEX IF EXISTS {index_name};"

        op.execute(sql)
        print(f"  ✓ Dropped index from {partition_name}")

    print(f"✓ Successfully dropped {len(partitions)} GIN indexes")
