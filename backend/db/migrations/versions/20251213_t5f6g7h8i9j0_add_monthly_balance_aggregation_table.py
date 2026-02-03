"""Add monthly balance aggregation table


Revision ID: t5f6g7h8i9j0
Revises: s4e5f6g7h8i9
Create Date: 2025-12-13

This migration creates an aggregation table for storing monthly balance snapshots
to optimize balance calculation queries.

Purpose:
- Store closing balance for each financial center at end of each month
- Avoid scanning all historical transactions when calculating opening balances
- Significant performance improvement for large datasets

Logic:
- Opening Balance for Month N = Closing Balance from Month N-1 (from this table)
- Current Balance = Opening Balance + Month Movements (from t_f_budget_fact)

Update Strategy:
- Calculated monthly or on-demand
- Can be refreshed via admin API or scheduled job
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = "t5f6g7h8i9j0"
down_revision = "s4e5f6g7h8i9"
branch_labels = None
depends_on = None


def upgrade():
    """Create monthly balance aggregation table with indexes and constraints."""
    # 1. Create aggregation table
    op.create_table(
        "t_agg_financial_center_balance_monthly",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "financial_center_id",
            sa.BigInteger(),
            sa.ForeignKey("t_d_financial_center.id", ondelete="CASCADE"),
            nullable=False,
            comment="FK to financial center",
        ),
        sa.Column(
            "year",
            sa.Integer(),
            nullable=False,
            comment="Year (YYYY, e.g., 2025)",
        ),
        sa.Column(
            "month",
            sa.Integer(),
            nullable=False,
            comment="Month (1-12)",
        ),
        sa.Column(
            "closing_balance",
            sa.Numeric(precision=15, scale=2),
            nullable=False,
            server_default="0.00",
            comment="Cumulative balance at end of month",
        ),
        sa.Column(
            "transaction_count",
            sa.Integer(),
            nullable=False,
            server_default="0",
            comment="Number of transactions in this month",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
            comment="When this aggregate was calculated",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
            comment="Last update timestamp",
        ),
        comment="Monthly balance aggregates for financial centers (optimization table)",
    )

    # 2. Create unique constraint (financial_center_id, year, month)
    op.create_unique_constraint(
        "uq_fcb_monthly_unique",
        "t_agg_financial_center_balance_monthly",
        ["financial_center_id", "year", "month"],
    )

    # 3. Create indexes for efficient lookups
    op.create_index(
        "ix_fcb_monthly_fc_id",
        "t_agg_financial_center_balance_monthly",
        ["financial_center_id"],
    )

    op.create_index(
        "ix_fcb_monthly_period",
        "t_agg_financial_center_balance_monthly",
        ["year", "month"],
    )

    # 4. Create composite index for fast queries
    op.create_index(
        "ix_fcb_monthly_fc_period",
        "t_agg_financial_center_balance_monthly",
        ["financial_center_id", "year", "month"],
    )


def downgrade():
    """Drop monthly balance aggregation table."""
    op.drop_table("t_agg_financial_center_balance_monthly")
