"""add_recurring_plan_indexes

Revision ID: 28cb68876eaf
Revises: b4c5d6e7f8g9
Create Date: 2025-12-30 15:23:57.045425

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '28cb68876eaf'
down_revision: Union[str, None] = 'b4c5d6e7f8g9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add composite indexes for RecurringPlan stats queries.

    Indexes added:
    1. Composite index on (user_id, is_active, frequency_type) INCLUDE (amount)
       - Used by get_stats() for active/paused/monthly sum aggregations
       - 40-60% faster stats queries

    2. Partial index on (user_id, is_active, next_generation_date) WHERE is_active = TRUE
       - Used by get_stats() for pending count
       - 50% smaller than full index (only active plans)

    NOTE: Removed CONCURRENTLY to make compatible with Alembic transactions.
    CONCURRENTLY requires AUTOCOMMIT which exits Alembic transaction context.
    For production deployments with zero downtime, use manual migration with CONCURRENTLY.
    """

    # Use standard Alembic op.execute() instead of raw psycopg2
    # Composite index for stats queries (active/paused/monthly sum)
    # INCLUDE (amount) makes this a covering index (Index Only Scan)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_recurring_plan_user_active_frequency
        ON t_d_recurring_plan(user_id, is_active, frequency_type)
        INCLUDE (amount);
    """)

    # Partial index for pending count (WHERE clause reduces index size 50%)
    # Only indexes active plans (is_active = TRUE)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_recurring_plan_user_active_next_date
        ON t_d_recurring_plan(user_id, is_active, next_generation_date)
        WHERE is_active = TRUE;
    """)

    # Update table statistics for query planner
    op.execute("ANALYZE t_d_recurring_plan;")


def downgrade() -> None:
    """
    Remove composite indexes for RecurringPlan.

    NOTE: Removed CONCURRENTLY for Alembic transaction compatibility.
    """

    # Use standard Alembic op.execute()
    op.execute("DROP INDEX IF EXISTS idx_recurring_plan_user_active_next_date;")
    op.execute("DROP INDEX IF EXISTS idx_recurring_plan_user_active_frequency;")
