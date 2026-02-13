"""install_pg_stat_statements_extension

Revision ID: 3d858bda8766
Revises: dfb4bd8a96ea
Create Date: 2025-11-27 12:25:40.809227

Enables pg_stat_statements extension for query performance monitoring.

pg_stat_statements provides:
- Track execution statistics of all SQL statements
- Identify slow queries (mean_exec_time, max_exec_time)
- Monitor query frequency (calls)
- Detect N+1 queries
- Total execution time tracking

Prerequisites:
- PostgreSQL must be started with: shared_preload_libraries='pg_stat_statements'
- See docker-compose.yml for configuration

After migration:
- Use: SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
- Reset stats: SELECT pg_stat_statements_reset();

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3d858bda8766'
down_revision: str | None = 'dfb4bd8a96ea'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Install pg_stat_statements extension.

    This extension must be loaded via shared_preload_libraries.
    If not loaded, migration will fail with error:
    "could not open extension control file ... pg_stat_statements.control"

    Solution: Add to docker-compose.yml:
      command:
        - postgres
        - -c
        - shared_preload_libraries=pg_stat_statements
    """

    # Install extension (idempotent)
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements;")

    # Verify installation
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
            ) THEN
                RAISE EXCEPTION 'pg_stat_statements extension failed to install. Check shared_preload_libraries.';
            END IF;
        END $$;
    """)


def downgrade() -> None:
    """
    Remove pg_stat_statements extension.

    Note: This will drop all collected statistics.
    Statistics can be reset without dropping extension:
    SELECT pg_stat_statements_reset();
    """

    # Drop extension (idempotent)
    op.execute("DROP EXTENSION IF EXISTS pg_stat_statements;")
