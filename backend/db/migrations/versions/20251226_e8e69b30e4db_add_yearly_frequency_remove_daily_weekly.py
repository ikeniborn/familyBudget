"""add yearly frequency remove daily weekly

Revision ID: e8e69b30e4db
Revises: 9baacd464951
Create Date: 2025-12-26 07:49:35.434119

Changes:
- Remove 'daily' and 'weekly' from frequency_type CHECK constraint
- Add 'yearly' to frequency_type CHECK constraint
- Update frequency_value CHECK constraint for yearly MMDD format (101-1231)
- Add column comment explaining yearly encoding

MMDD Encoding for yearly:
  frequency_value = (month * 100) + day
  Examples: 115 = Jan 15, 315 = Mar 15, 1231 = Dec 31
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e8e69b30e4db'
down_revision: str | None = '9baacd464951'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema to support yearly frequency."""

    # Drop old CHECK constraints (using actual constraint names from DB)
    op.drop_constraint('ck_recurring_plan_frequency_type', 't_d_recurring_plan', type_='check')
    op.drop_constraint('ck_recurring_plan_frequency_value_range', 't_d_recurring_plan', type_='check')

    # Data migration: Delete existing daily/weekly plans (no longer supported)
    # Note: These frequency types are being removed from the system
    op.execute("""
        DELETE FROM t_d_recurring_plan
        WHERE frequency_type IN ('daily', 'weekly')
    """)

    # Create new CHECK constraint (remove daily/weekly, add yearly)
    op.execute("""
        ALTER TABLE t_d_recurring_plan
        ADD CONSTRAINT ck_recurring_plan_frequency_type
        CHECK (frequency_type IN ('monthly', 'quarterly', 'yearly'))
    """)

    # Update frequency_value constraint for yearly MMDD format
    op.execute("""
        ALTER TABLE t_d_recurring_plan
        ADD CONSTRAINT ck_recurring_plan_frequency_value_range
        CHECK (
            (frequency_type = 'monthly' AND frequency_value BETWEEN 1 AND 28) OR
            (frequency_type = 'quarterly' AND frequency_value BETWEEN 1 AND 28) OR
            (frequency_type = 'yearly' AND frequency_value BETWEEN 101 AND 1231)
        )
    """)

    # Add column comment
    op.execute("""
        COMMENT ON COLUMN t_d_recurring_plan.frequency_value IS
        'Day of month (1-28) for monthly/quarterly, MMDD format (101-1231) for yearly'
    """)


def downgrade() -> None:
    """Downgrade schema to previous version (restore daily/weekly)."""

    # Drop new CHECK constraints (using actual constraint names from DB)
    op.drop_constraint('ck_recurring_plan_frequency_type', 't_d_recurring_plan', type_='check')
    op.drop_constraint('ck_recurring_plan_frequency_value_range', 't_d_recurring_plan', type_='check')

    # Restore old CHECK constraints (with daily/weekly)
    op.execute("""
        ALTER TABLE t_d_recurring_plan
        ADD CONSTRAINT ck_recurring_plan_frequency_type
        CHECK (frequency_type IN ('daily', 'weekly', 'monthly', 'quarterly'))
    """)

    op.execute("""
        ALTER TABLE t_d_recurring_plan
        ADD CONSTRAINT ck_recurring_plan_frequency_value_range
        CHECK (frequency_value >= 1 AND frequency_value <= 31)
    """)

    # Remove column comment
    op.execute("COMMENT ON COLUMN t_d_recurring_plan.frequency_value IS NULL")
