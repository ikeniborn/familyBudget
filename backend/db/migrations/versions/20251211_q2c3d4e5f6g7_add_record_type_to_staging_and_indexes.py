"""Add record_type to import staging and indexes for budget_fact

Revision ID: q2c3d4e5f6g7
Revises: p1b2c3d4e5f6
Create Date: 2025-12-11

This migration:
1. Adds record_type column to t_import_staging table
2. Creates indexes on t_f_budget_fact.record_type for efficient filtering

The record_type field allows users to import transactions as either 'fact' (actual)
or 'plan' (budget plan) during the enrichment step.
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = "q2c3d4e5f6g7"
down_revision = "p1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade():
    """Add record_type to staging and create indexes."""

    # 1. Add record_type column to import staging table
    op.add_column(
        "t_import_staging",
        sa.Column(
            "record_type",
            sa.String(10),
            nullable=False,
            server_default="fact",
            comment="Record type: 'fact' for actual transactions, 'plan' for budget plans",
        ),
    )

    # 2. Add CHECK constraint for valid record_type values
    op.execute("""
        ALTER TABLE t_import_staging
        ADD CONSTRAINT check_staging_record_type
        CHECK (record_type IN ('fact', 'plan'))
    """)

    # 3. Create index on record_type for efficient filtering
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_budget_fact_record_type
        ON t_f_budget_fact(record_type)
    """)

    # 4. Create composite index for common query: user + record_type + date
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_budget_fact_user_record_type_date
        ON t_f_budget_fact(user_id, record_type, fact_date DESC)
    """)


def downgrade():
    """Remove record_type from staging and drop indexes."""

    # Drop indexes from budget_fact
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_user_record_type_date")
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_record_type")

    # Drop constraint and column from staging
    op.execute("ALTER TABLE t_import_staging DROP CONSTRAINT IF EXISTS check_staging_record_type")
    op.drop_column("t_import_staging", "record_type")
