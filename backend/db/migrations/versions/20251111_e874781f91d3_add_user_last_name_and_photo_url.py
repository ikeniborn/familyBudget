"""Add last_name and photo_url fields to t_d_user table

Revision ID: e874781f91d3
Revises: e2558a31af07
Create Date: 2025-11-11 08:18:24
"""

import sqlalchemy as sa
from alembic import op

# revision identifiers
revision = 'e874781f91d3'
down_revision = 'e2558a31af07'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add last_name and photo_url columns to t_d_user table.

    These fields support Telegram OAuth data:
    - last_name: User's last name from Telegram profile (optional)
    - photo_url: Local path to cached avatar image (optional)

    Both fields are nullable since Telegram may not provide them.
    photo_url stores local path like '/static/avatars/123.jpg' after
    downloading avatar from Telegram.
    """

    # Add last_name column
    op.add_column(
        't_d_user',
        sa.Column(
            'last_name',
            sa.VARCHAR(length=255),
            nullable=True,
            comment='User last name from Telegram'
        )
    )

    # Add photo_url column
    # Uses VARCHAR(512) for longer URLs/paths
    op.add_column(
        't_d_user',
        sa.Column(
            'photo_url',
            sa.VARCHAR(length=512),
            nullable=True,
            comment='Local path to cached profile photo'
        )
    )

    # Drop old covering index
    op.drop_index(
        'idx_user_telegram_current_covering',
        table_name='t_d_user'
    )

    # Recreate covering index with new columns included
    # This improves query performance for auth lookups
    op.execute("""
        CREATE INDEX idx_user_telegram_current_covering
            ON t_d_user(telegram_id, is_current)
            INCLUDE (id, username, first_name, last_name, photo_url, is_admin)
            WHERE is_current = TRUE
    """)


def downgrade() -> None:
    """
    Remove last_name and photo_url columns from t_d_user table.

    ⚠️ WARNING: This will permanently delete user's last names and photo URLs!
    Local avatar files in /static/avatars/ will not be automatically deleted.
    """

    # Drop covering index
    op.drop_index(
        'idx_user_telegram_current_covering',
        table_name='t_d_user'
    )

    # Recreate old covering index without new columns
    op.execute("""
        CREATE INDEX idx_user_telegram_current_covering
            ON t_d_user(telegram_id, is_current)
            INCLUDE (id, username, first_name, is_admin)
            WHERE is_current = TRUE
    """)

    # Drop columns
    op.drop_column('t_d_user', 'photo_url')
    op.drop_column('t_d_user', 'last_name')
