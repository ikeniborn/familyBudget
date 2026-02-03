"""add recurring plan reminder settings

Revision ID: d1e6f4a267d5
Revises: c22f4fa71f4b
Create Date: 2025-12-27 15:08:25.885536

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd1e6f4a267d5'
down_revision: str | None = 'c22f4fa71f4b'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add reminder settings columns to t_d_recurring_plan table."""
    # Add 3 columns for reminder configuration
    op.add_column(
        't_d_recurring_plan',
        sa.Column('enable_reminder', sa.Boolean(), nullable=False, server_default='false')
    )
    op.add_column(
        't_d_recurring_plan',
        sa.Column('reminder_hour', sa.Integer(), nullable=True)
    )
    op.add_column(
        't_d_recurring_plan',
        sa.Column('reminder_minute', sa.Integer(), nullable=True)
    )

    # Add CHECK constraints for valid hour/minute ranges
    op.create_check_constraint(
        'chk_reminder_hour_range',
        't_d_recurring_plan',
        'reminder_hour IS NULL OR (reminder_hour >= 0 AND reminder_hour <= 23)'
    )
    op.create_check_constraint(
        'chk_reminder_minute_range',
        't_d_recurring_plan',
        'reminder_minute IS NULL OR (reminder_minute >= 0 AND reminder_minute <= 59)'
    )

    # Add CHECK constraint to ensure time is complete when enabled
    op.create_check_constraint(
        'chk_reminder_time_complete',
        't_d_recurring_plan',
        '(enable_reminder = false) OR (enable_reminder = true AND reminder_hour IS NOT NULL AND reminder_minute IS NOT NULL)'
    )


def downgrade() -> None:
    """Remove reminder settings columns from t_d_recurring_plan table."""
    # Drop CHECK constraints first
    op.drop_constraint('chk_reminder_time_complete', 't_d_recurring_plan', type_='check')
    op.drop_constraint('chk_reminder_minute_range', 't_d_recurring_plan', type_='check')
    op.drop_constraint('chk_reminder_hour_range', 't_d_recurring_plan', type_='check')

    # Drop columns
    op.drop_column('t_d_recurring_plan', 'reminder_minute')
    op.drop_column('t_d_recurring_plan', 'reminder_hour')
    op.drop_column('t_d_recurring_plan', 'enable_reminder')
