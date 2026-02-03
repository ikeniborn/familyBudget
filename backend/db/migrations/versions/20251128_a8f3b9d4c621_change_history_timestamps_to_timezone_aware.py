"""change history timestamps to timezone-aware


Revision ID: a8f3b9d4c621
Revises: dc2fdb49a746
Create Date: 2025-11-28 21:22:00.000000

Change all History table timestamp columns from 'timestamp without time zone'
to 'timestamp with time zone' to match Python datetime.now(timezone.utc).

Root cause of DataError:
- Python code sends timezone-aware datetime objects
- PostgreSQL columns were 'timestamp without time zone'
- asyncpg error: "can't subtract offset-naive and offset-aware datetimes"

This migration changes ALL timestamp columns in ALL History tables:
- t_d_article_history: valid_from, valid_to, created_at
- t_d_user_history: valid_from, valid_to, created_at
- t_f_budget_fact_history: fact_date, valid_from, valid_to, created_at
- t_d_financial_center_history: valid_from, valid_to, created_at
- t_d_cost_center_history: valid_from, valid_to, created_at

Migration is safe:
- PostgreSQL automatically converts existing naive timestamps to UTC
- Existing data preserved with timezone = UTC (TIMESTAMP WITHOUT TIME ZONE interpreted as UTC)
- No data loss
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a8f3b9d4c621'
down_revision: str | None = 'dc2fdb49a746'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Change all History table timestamps to timezone-aware."""

    # ArticleHistory
    op.execute("""
        ALTER TABLE t_d_article_history
            ALTER COLUMN valid_from TYPE timestamp with time zone,
            ALTER COLUMN valid_to TYPE timestamp with time zone,
            ALTER COLUMN created_at TYPE timestamp with time zone;
    """)

    # UserHistory
    op.execute("""
        ALTER TABLE t_d_user_history
            ALTER COLUMN valid_from TYPE timestamp with time zone,
            ALTER COLUMN valid_to TYPE timestamp with time zone,
            ALTER COLUMN created_at TYPE timestamp with time zone;
    """)

    # BudgetFactHistory
    op.execute("""
        ALTER TABLE t_f_budget_fact_history
            ALTER COLUMN fact_date TYPE timestamp with time zone,
            ALTER COLUMN valid_from TYPE timestamp with time zone,
            ALTER COLUMN valid_to TYPE timestamp with time zone,
            ALTER COLUMN created_at TYPE timestamp with time zone;
    """)

    # FinancialCenterHistory
    op.execute("""
        ALTER TABLE t_d_financial_center_history
            ALTER COLUMN valid_from TYPE timestamp with time zone,
            ALTER COLUMN valid_to TYPE timestamp with time zone,
            ALTER COLUMN created_at TYPE timestamp with time zone;
    """)

    # CostCenterHistory
    op.execute("""
        ALTER TABLE t_d_cost_center_history
            ALTER COLUMN valid_from TYPE timestamp with time zone,
            ALTER COLUMN valid_to TYPE timestamp with time zone,
            ALTER COLUMN created_at TYPE timestamp with time zone;
    """)


def downgrade() -> None:
    """Revert History table timestamps to timezone-naive."""

    # ArticleHistory
    op.execute("""
        ALTER TABLE t_d_article_history
            ALTER COLUMN valid_from TYPE timestamp without time zone,
            ALTER COLUMN valid_to TYPE timestamp without time zone,
            ALTER COLUMN created_at TYPE timestamp without time zone;
    """)

    # UserHistory
    op.execute("""
        ALTER TABLE t_d_user_history
            ALTER COLUMN valid_from TYPE timestamp without time zone,
            ALTER COLUMN valid_to TYPE timestamp without time zone,
            ALTER COLUMN created_at TYPE timestamp without time zone;
    """)

    # BudgetFactHistory
    op.execute("""
        ALTER TABLE t_f_budget_fact_history
            ALTER COLUMN fact_date TYPE timestamp without time zone,
            ALTER COLUMN valid_from TYPE timestamp without time zone,
            ALTER COLUMN valid_to TYPE timestamp without time zone,
            ALTER COLUMN created_at TYPE timestamp without time zone;
    """)

    # FinancialCenterHistory
    op.execute("""
        ALTER TABLE t_d_financial_center_history
            ALTER COLUMN valid_from TYPE timestamp without time zone,
            ALTER COLUMN valid_to TYPE timestamp without time zone,
            ALTER COLUMN created_at TYPE timestamp without time zone;
    """)

    # CostCenterHistory
    op.execute("""
        ALTER TABLE t_d_cost_center_history
            ALTER COLUMN valid_from TYPE timestamp without time zone,
            ALTER COLUMN valid_to TYPE timestamp without time zone,
            ALTER COLUMN created_at TYPE timestamp without time zone;
    """)
