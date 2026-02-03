"""Add merged_into_user_id field to users table

Revision ID: m8h9i0j1k2l3
Revises: l7g8h9i0j1k2
Create Date: 2025-12-06

This migration adds merged_into_user_id field to t_d_user table.
When a user account is merged into another, this field stores the target user ID.
The source account is deactivated and all facts are transferred to target.
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = "m8h9i0j1k2l3"
down_revision = "l7g8h9i0j1k2"
branch_labels = None
depends_on = None


def upgrade():
    """Add merged_into_user_id column to users table."""
    op.add_column(
        "t_d_user",
        sa.Column(
            "merged_into_user_id",
            sa.Integer(),
            nullable=True,
            comment="Reference to target user when this account was merged into another",
        ),
    )
    # Add index for faster lookups
    op.create_index(
        "ix_t_d_user_merged_into_user_id",
        "t_d_user",
        ["merged_into_user_id"],
        unique=False,
    )


def downgrade():
    """Remove merged_into_user_id column from users table."""
    op.drop_index("ix_t_d_user_merged_into_user_id", table_name="t_d_user")
    op.drop_column("t_d_user", "merged_into_user_id")
