"""Add cost-center-to-financial-center linking table

Revision ID: s4e5f6g7h8i9
Revises: r3d4e5f6g7h8
Create Date: 2025-12-12

This migration creates a linking table between cost centers and financial centers.
Implements "whitelist" pattern:
- No entries for a cost center = available for ALL financial centers
- Has entries = cost center available ONLY for linked financial centers

Business Rules:
- Filtering applied only when CREATING new transactions
- Existing transactions are not affected by this filtering
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = "s4e5f6g7h8i9"
down_revision = "r3d4e5f6g7h8"
branch_labels = None
depends_on = None


def upgrade():
    """Create cost-center-financial-center linking table with indexes and constraints."""
    # 1. Create linking table
    op.create_table(
        "t_cost_center_financial_center",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "cost_center_id",
            sa.BigInteger(),
            sa.ForeignKey("t_d_cost_center.id", ondelete="CASCADE"),
            nullable=False,
            comment="FK to cost center",
        ),
        sa.Column(
            "financial_center_id",
            sa.BigInteger(),
            sa.ForeignKey("t_d_financial_center.id", ondelete="CASCADE"),
            nullable=False,
            comment="FK to financial center",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now(),
            comment="Link creation timestamp",
        ),
        comment="Links cost centers to specific financial centers. Empty = available for all FCs.",
    )

    # 2. Create unique constraint (cost_center_id, financial_center_id)
    op.create_unique_constraint(
        "uq_cost_center_financial_center",
        "t_cost_center_financial_center",
        ["cost_center_id", "financial_center_id"],
    )

    # 3. Create indexes for efficient lookups
    op.create_index(
        "ix_cc_fc_cost_center_id",
        "t_cost_center_financial_center",
        ["cost_center_id"],
    )

    op.create_index(
        "ix_cc_fc_financial_center_id",
        "t_cost_center_financial_center",
        ["financial_center_id"],
    )


def downgrade():
    """Drop cost-center-financial-center linking table."""
    op.drop_table("t_cost_center_financial_center")
