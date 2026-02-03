"""Add article-to-financial-center linking table

Revision ID: o0a1b2c3d4e5
Revises: n9i0j1k2l3m4
Create Date: 2025-12-08

This migration creates a linking table between articles (categories) and financial centers.
Implements "whitelist" pattern:
- No entries for an article = available for ALL financial centers
- Has entries = article available ONLY for linked financial centers

Business Rules:
- Only LEAF articles should have links (enforced at application level)
- Filtering applied only when CREATING new transactions
- Existing transactions are not affected by this filtering
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = "o0a1b2c3d4e5"
down_revision = "n9i0j1k2l3m4"
branch_labels = None
depends_on = None


def upgrade():
    """Create article-financial-center linking table with indexes and constraints."""
    # 1. Create linking table
    op.create_table(
        "t_article_financial_center",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column(
            "article_id",
            sa.BigInteger(),
            sa.ForeignKey("t_d_article.id", ondelete="CASCADE"),
            nullable=False,
            comment="FK to article (should be LEAF article)",
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
        comment="Links leaf articles to specific financial centers. Empty = available for all FCs.",
    )

    # 2. Create unique constraint (article_id, financial_center_id)
    op.create_unique_constraint(
        "uq_article_financial_center",
        "t_article_financial_center",
        ["article_id", "financial_center_id"],
    )

    # 3. Create indexes for efficient lookups
    op.create_index(
        "ix_article_financial_center_article_id",
        "t_article_financial_center",
        ["article_id"],
    )

    op.create_index(
        "ix_article_financial_center_financial_center_id",
        "t_article_financial_center",
        ["financial_center_id"],
    )


def downgrade():
    """Drop article-financial-center linking table."""
    op.drop_table("t_article_financial_center")
