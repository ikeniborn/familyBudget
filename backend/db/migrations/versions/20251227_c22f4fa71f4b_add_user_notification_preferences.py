"""add_user_notification_preferences

Revision ID: c22f4fa71f4b
Revises: e8e69b30e4db
Create Date: 2025-12-27 14:28:23.231657

This migration adds notification preference fields to t_d_user table.

Changes:
1. Add enable_push_notifications BOOLEAN NOT NULL DEFAULT TRUE
2. Add enable_telegram_notifications BOOLEAN NOT NULL DEFAULT TRUE
3. Update t_d_user_history table to include new fields
4. Create performance index for notification filtering

Default Values:
- Both fields default to TRUE for backward compatibility
- Existing users will have all notifications enabled by default
- New users will have all notifications enabled unless explicitly disabled
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'c22f4fa71f4b'
down_revision: str | None = 'e8e69b30e4db'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add user notification preference fields."""

    # Step 1: Add columns to main User table (t_d_user)
    print("[MIGRATION] Adding enable_push_notifications to t_d_user...")
    op.add_column(
        't_d_user',
        sa.Column(
            'enable_push_notifications',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('TRUE'),
            comment='Enable Web Push notifications for this user (default: TRUE for backward compatibility)'
        )
    )

    print("[MIGRATION] Adding enable_telegram_notifications to t_d_user...")
    op.add_column(
        't_d_user',
        sa.Column(
            'enable_telegram_notifications',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('TRUE'),
            comment='Enable Telegram notifications for this user (default: TRUE for backward compatibility)'
        )
    )

    # Step 2: Add columns to User History table (t_d_user_history)
    print("[MIGRATION] Adding enable_push_notifications to t_d_user_history...")
    op.add_column(
        't_d_user_history',
        sa.Column(
            'enable_push_notifications',
            sa.Boolean(),
            nullable=True,
            comment='Historical snapshot of push notification preference'
        )
    )

    print("[MIGRATION] Adding enable_telegram_notifications to t_d_user_history...")
    op.add_column(
        't_d_user_history',
        sa.Column(
            'enable_telegram_notifications',
            sa.Boolean(),
            nullable=True,
            comment='Historical snapshot of Telegram notification preference'
        )
    )

    # Step 3: Create partial index for performance optimization
    print("[MIGRATION] Creating performance index idx_user_notifications_enabled...")
    op.execute("""
        CREATE INDEX idx_user_notifications_enabled
        ON t_d_user(id)
        WHERE enable_push_notifications = TRUE OR enable_telegram_notifications = TRUE
    """)

    # Add index comment
    op.execute("""
        COMMENT ON INDEX idx_user_notifications_enabled IS
        'Index for efficiently finding users with at least one notification channel enabled (for scheduler jobs)'
    """)

    print("[MIGRATION] User notification preferences migration completed successfully")


def downgrade() -> None:
    """Remove user notification preference fields."""

    print("[MIGRATION] Removing index idx_user_notifications_enabled...")
    op.drop_index('idx_user_notifications_enabled', table_name='t_d_user')

    print("[MIGRATION] Removing columns from t_d_user_history...")
    op.drop_column('t_d_user_history', 'enable_telegram_notifications')
    op.drop_column('t_d_user_history', 'enable_push_notifications')

    print("[MIGRATION] Removing columns from t_d_user...")
    op.drop_column('t_d_user', 'enable_telegram_notifications')
    op.drop_column('t_d_user', 'enable_push_notifications')

    print("[MIGRATION] User notification preferences rollback completed")
