"""Convert amount Decimal(15,2) to BigInteger rubles end-to-end

Affects:
- t_f_budget_fact.amount (partitioned parent; ALTER propagates to all partitions in PG10+)
- t_d_recurring_plan.amount
- t_f_budget_fact_history.amount
- t_notification.plan_amount, t_notification.actual_amount

ROUND(amount)::BIGINT chosen because production amounts are de-facto whole rubles
(no fractional kopecks expected). Downgrade restores Numeric(15,2) preserving the
integer values (no kopeck information was created).

Revision ID: ebf328b51e19
Revises: c4e9f1a2b3d0
Create Date: 2026-04-26
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ebf328b51e19'
down_revision = 'c4e9f1a2b3d0'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Partitioned parent: ALTER on parent propagates to all partitions in PG10+.
    op.alter_column(
        't_f_budget_fact', 'amount',
        type_=sa.BigInteger(),
        existing_type=sa.Numeric(15, 2),
        existing_nullable=False,
        postgresql_using='ROUND(amount)::BIGINT',
    )
    op.alter_column(
        't_d_recurring_plan', 'amount',
        type_=sa.BigInteger(),
        existing_type=sa.Numeric(15, 2),
        existing_nullable=False,
        postgresql_using='ROUND(amount)::BIGINT',
    )
    op.alter_column(
        't_f_budget_fact_history', 'amount',
        type_=sa.BigInteger(),
        existing_type=sa.Numeric(15, 2),
        existing_nullable=False,
        postgresql_using='ROUND(amount)::BIGINT',
    )
    op.alter_column(
        't_notification', 'plan_amount',
        type_=sa.BigInteger(),
        existing_type=sa.Numeric(15, 2),
        existing_nullable=False,
        postgresql_using='ROUND(plan_amount)::BIGINT',
    )
    op.alter_column(
        't_notification', 'actual_amount',
        type_=sa.BigInteger(),
        existing_type=sa.Numeric(15, 2),
        existing_nullable=False,
        postgresql_using='ROUND(actual_amount)::BIGINT',
    )


def downgrade() -> None:
    for table, col, nullable in [
        ('t_notification', 'actual_amount', False),
        ('t_notification', 'plan_amount', False),
        ('t_f_budget_fact_history', 'amount', False),
        ('t_d_recurring_plan', 'amount', False),
        ('t_f_budget_fact', 'amount', False),
    ]:
        op.alter_column(
            table, col,
            type_=sa.Numeric(15, 2),
            existing_type=sa.BigInteger(),
            existing_nullable=nullable,
            postgresql_using=f'{col}::NUMERIC(15,2)',
        )
