"""Drop per-user timezone support

Revision ID: k6f7g8h9i0j1
Revises: j5e6f7g8h9i0
Create Date: 2025-12-06

This migration removes per-user timezone support.
Timezone is now managed only at system level (SYSTEM_TIMEZONE env var).

Rationale:
- Simplified architecture: all users share the same timezone
- Timezone is set by admin at system level
- Individual users do not need their own timezone setting
"""

from alembic import op

# Revision identifiers
revision = "k6f7g8h9i0j1"
down_revision = "j5e6f7g8h9i0"
branch_labels = None
depends_on = None


def upgrade():
    """Remove timezone columns from user tables."""
    # Drop timezone from history table first (no FK dependency)
    op.drop_column("t_d_user_history", "timezone")

    # Drop timezone from main user table
    op.drop_column("t_d_user", "timezone")


def downgrade():
    """Restore timezone columns (optional - for rollback)."""
    import sqlalchemy as sa

    # Add back to main user table
    op.add_column(
        "t_d_user",
        sa.Column(
            "timezone",
            sa.String(50),
            nullable=True,
            comment="User timezone in IANA format (e.g., Europe/Moscow). NULL uses SYSTEM_TIMEZONE.",
        ),
    )

    # Add back to history table
    op.add_column(
        "t_d_user_history",
        sa.Column(
            "timezone",
            sa.String(50),
            nullable=True,
            comment="User timezone at time of change (snapshot)",
        ),
    )
