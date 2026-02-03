"""Add user_comment field to import staging table

Revision ID: l7g8h9i0j1k2
Revises: k6f7g8h9i0j1
Create Date: 2025-12-06

This migration adds user_comment field to t_import_staging table.
Allows users to add comments during enrichment which will be
concatenated with description on import (via period separator).
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = "l7g8h9i0j1k2"
down_revision = "k6f7g8h9i0j1"
branch_labels = None
depends_on = None


def upgrade():
    """Add user_comment column to import staging table."""
    op.add_column(
        "t_import_staging",
        sa.Column(
            "user_comment",
            sa.Text(),
            nullable=True,
            comment="User comment added during enrichment (concatenated with description on import)",
        ),
    )


def downgrade():
    """Remove user_comment column from import staging table."""
    op.drop_column("t_import_staging", "user_comment")
