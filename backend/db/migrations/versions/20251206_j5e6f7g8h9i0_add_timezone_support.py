"""Add timezone support to users

Revision ID: j5e6f7g8h9i0
Revises: i4d5e6f7g8h9
Create Date: 2025-12-06

This migration:
1. Adds 'timezone' column to t_d_user (user preference, IANA format)
2. Adds 'timezone' column to t_d_user_history (for audit)
3. Sets default timezone for existing users based on SYSTEM_TIMEZONE env var

Architecture Notes:
- timezone is stored as VARCHAR(50) with IANA timezone names (e.g., "Europe/Moscow")
- NULL means use SYSTEM_TIMEZONE from config (server default)
- Column is nullable to support gradual migration and new user creation
"""

import os

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = "j5e6f7g8h9i0"
down_revision = "i4d5e6f7g8h9"
branch_labels = None
depends_on = None


def upgrade():
    """Add timezone column to user tables."""
    # Get system timezone from environment (default to UTC if not set)
    system_tz = os.environ.get("SYSTEM_TIMEZONE", "UTC")

    # 1. Add timezone column to t_d_user (main table)
    op.add_column(
        "t_d_user",
        sa.Column(
            "timezone",
            sa.String(50),
            nullable=True,
            comment="User timezone in IANA format (e.g., Europe/Moscow). NULL uses SYSTEM_TIMEZONE.",
        ),
    )

    # 2. Add timezone column to t_d_user_history (history table)
    op.add_column(
        "t_d_user_history",
        sa.Column(
            "timezone",
            sa.String(50),
            nullable=True,
            comment="User timezone at time of change (snapshot)",
        ),
    )

    # 3. Set default timezone for existing users
    # Using parameterized query to prevent SQL injection
    op.execute(
        sa.text("UPDATE t_d_user SET timezone = :tz WHERE timezone IS NULL").bindparams(
            tz=system_tz
        )
    )

    # 4. Update existing history records to have same timezone as current user
    op.execute(
        sa.text("""
            UPDATE t_d_user_history h
            SET timezone = u.timezone
            FROM t_d_user u
            WHERE h.user_id = u.id AND h.timezone IS NULL
        """)
    )


def downgrade():
    """Remove timezone columns."""
    op.drop_column("t_d_user_history", "timezone")
    op.drop_column("t_d_user", "timezone")
