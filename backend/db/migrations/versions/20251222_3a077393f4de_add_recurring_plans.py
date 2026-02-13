"""Add recurring plans table and recurring_plan_id to budget_fact

Creates t_d_recurring_plan table for storing recurring payment templates.
Adds recurring_plan_id column to t_f_budget_fact partitioned table.

Note: No FK constraint from budget_fact to recurring_plan due to partitioning.
Referential integrity is enforced at application level.

Revision ID: 3a077393f4de
Revises: z1b2c3d4e5f6
Create Date: 2025-12-22 12:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = '3a077393f4de'
down_revision = 'z1b2c3d4e5f6'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. Create t_d_recurring_plan table
    op.create_table(
        't_d_recurring_plan',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('article_id', sa.Integer(), nullable=False),
        sa.Column('financial_center_id', sa.Integer(), nullable=False),
        sa.Column('cost_center_id', sa.Integer(), nullable=True),
        sa.Column('frequency_type', sa.String(length=20), nullable=False),
        sa.Column('frequency_value', sa.Integer(), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('occurrences_count', sa.Integer(), nullable=True),
        sa.Column('occurrences_generated', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('amount', sa.Numeric(precision=15, scale=2), nullable=False),
        sa.Column('description', sa.String(length=1000), nullable=True),
        sa.Column('record_type', sa.String(length=10), nullable=False, server_default='plan'),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='true'),
        sa.Column('next_generation_date', sa.Date(), nullable=True),
        sa.Column('last_generated_date', sa.Date(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['t_d_user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['article_id'], ['t_d_article.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['financial_center_id'], ['t_d_financial_center.id'], ondelete='RESTRICT'),
        sa.ForeignKeyConstraint(['cost_center_id'], ['t_d_cost_center.id'], ondelete='SET NULL'),
    )

    # 2. Create indexes for t_d_recurring_plan
    op.create_index(
        'ix_t_d_recurring_plan_user_id',
        't_d_recurring_plan',
        ['user_id']
    )
    op.create_index(
        'ix_t_d_recurring_plan_article_id',
        't_d_recurring_plan',
        ['article_id']
    )
    op.create_index(
        'ix_t_d_recurring_plan_active_next_date',
        't_d_recurring_plan',
        ['is_active', 'next_generation_date'],
        postgresql_where=sa.text('is_active = true')
    )

    # 3. Add CHECK constraints
    op.execute("""
        ALTER TABLE t_d_recurring_plan
        ADD CONSTRAINT ck_recurring_plan_frequency_type
        CHECK (frequency_type IN ('daily', 'weekly', 'monthly', 'quarterly'))
    """)

    op.execute("""
        ALTER TABLE t_d_recurring_plan
        ADD CONSTRAINT ck_recurring_plan_record_type
        CHECK (record_type IN ('plan', 'fact'))
    """)

    op.execute("""
        ALTER TABLE t_d_recurring_plan
        ADD CONSTRAINT ck_recurring_plan_amount_positive
        CHECK (amount > 0)
    """)

    op.execute("""
        ALTER TABLE t_d_recurring_plan
        ADD CONSTRAINT ck_recurring_plan_frequency_value_range
        CHECK (
            (frequency_type = 'daily' AND frequency_value IS NULL) OR
            (frequency_type = 'weekly' AND frequency_value >= 0 AND frequency_value <= 6) OR
            (frequency_type IN ('monthly', 'quarterly') AND frequency_value >= 1 AND frequency_value <= 28)
        )
    """)

    op.execute("""
        ALTER TABLE t_d_recurring_plan
        ADD CONSTRAINT ck_recurring_plan_dates
        CHECK (end_date IS NULL OR end_date >= start_date)
    """)

    # 4. Add recurring_plan_id column to all budget_fact partitions
    # Using dynamic SQL to handle partitioned table
    op.execute("""
        ALTER TABLE t_f_budget_fact
        ADD COLUMN IF NOT EXISTS recurring_plan_id INTEGER NULL
    """)

    # 5. Create partial index for recurring_plan_id (only non-null values)
    # Using CONCURRENTLY to avoid locking - but this requires being outside transaction
    # Since Alembic runs in transaction, we use regular CREATE INDEX
    op.execute("""
        CREATE INDEX IF NOT EXISTS ix_t_f_budget_fact_recurring_plan_id
        ON t_f_budget_fact (recurring_plan_id)
        WHERE recurring_plan_id IS NOT NULL
    """)

    # 6. Add comment for documentation
    op.execute("""
        COMMENT ON TABLE t_d_recurring_plan IS
        'Recurring payment templates for automatic BudgetFact generation.
        Stores frequency settings (daily/weekly/monthly/quarterly) and duration options.
        Scheduler job generates facts based on these templates.'
    """)

    op.execute("""
        COMMENT ON COLUMN t_f_budget_fact.recurring_plan_id IS
        'Reference to recurring plan template that generated this fact.
        No FK constraint due to partitioning - integrity enforced at application level.'
    """)


def downgrade() -> None:
    # 1. Drop index on recurring_plan_id
    op.execute("""
        DROP INDEX IF EXISTS ix_t_f_budget_fact_recurring_plan_id
    """)

    # 2. Drop recurring_plan_id column from budget_fact
    op.execute("""
        ALTER TABLE t_f_budget_fact
        DROP COLUMN IF EXISTS recurring_plan_id
    """)

    # 3. Drop indexes on recurring_plan
    op.drop_index('ix_t_d_recurring_plan_active_next_date', table_name='t_d_recurring_plan')
    op.drop_index('ix_t_d_recurring_plan_article_id', table_name='t_d_recurring_plan')
    op.drop_index('ix_t_d_recurring_plan_user_id', table_name='t_d_recurring_plan')

    # 4. Drop t_d_recurring_plan table (constraints dropped automatically)
    op.drop_table('t_d_recurring_plan')
