"""Add push subscriptions and scheduled reminders tables

Revision ID: i4d5e6f7g8h9
Revises: h3c4d5e6f7g8
Create Date: 2025-12-05

This migration adds support for plan reminders:

1. t_push_subscription:
   - Web Push subscription storage for each user/browser
   - Multiple subscriptions per user (different devices)
   - CASCADE delete when user is deleted

2. t_scheduled_reminder:
   - Scheduled reminders for budget plans (record_type='plan')
   - One-to-one relationship with BudgetFact (unique fact_id)
   - CASCADE delete when plan is deleted
   - Status tracking: pending, sent, failed, cancelled
   - Retry logic with max 3 attempts

Usage:
- User creates plan and sets reminder datetime
- Scheduler job runs every 5 minutes
- When reminder is due, sends Telegram + Web Push notifications
- Reminder marked as 'sent' after successful delivery
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'i4d5e6f7g8h9'
down_revision: str | None = 'h3c4d5e6f7g8'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Create push subscriptions and scheduled reminders tables.
    """

    # =========================================================================
    # 1. Create t_push_subscription table
    # =========================================================================

    op.create_table(
        't_push_subscription',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column(
            'user_id',
            sa.Integer(),
            sa.ForeignKey('t_d_user.id', ondelete='CASCADE'),
            nullable=False,
            index=True
        ),
        sa.Column('endpoint', sa.String(2000), nullable=False),
        sa.Column('p256dh_key', sa.String(500), nullable=False),
        sa.Column('auth_key', sa.String(100), nullable=False),
        sa.Column('user_agent', sa.String(500), nullable=True),
        sa.Column(
            'created_at',
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
    )

    # Unique constraint on endpoint (each subscription is unique)
    op.create_index(
        'ix_t_push_subscription_endpoint_unique',
        't_push_subscription',
        ['endpoint'],
        unique=True
    )

    # Add comment
    op.execute("""
        COMMENT ON TABLE t_push_subscription IS
        'Web Push subscriptions for browser notifications. Multiple per user (different devices/browsers).'
    """)

    # =========================================================================
    # 2. Create t_scheduled_reminder table
    # =========================================================================

    op.create_table(
        't_scheduled_reminder',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        # NOTE: No FK constraint on fact_id because t_f_budget_fact is partitioned
        # (PK is (id, fact_date), not just id). Referential integrity is enforced
        # at application level in ReminderService.
        sa.Column(
            'fact_id',
            sa.Integer(),
            nullable=False,
            unique=True,  # One reminder per plan
            index=True
        ),
        sa.Column(
            'reminder_datetime',
            sa.DateTime(),
            nullable=False,
            index=True
        ),
        sa.Column(
            'status',
            sa.String(20),
            nullable=False,
            server_default='pending'
        ),
        sa.Column('sent_at', sa.DateTime(), nullable=True),
        sa.Column(
            'telegram_sent',
            sa.Boolean(),
            nullable=False,
            server_default='false'
        ),
        sa.Column(
            'web_push_sent',
            sa.Boolean(),
            nullable=False,
            server_default='false'
        ),
        sa.Column('error_message', sa.String(1000), nullable=True),
        sa.Column(
            'retry_count',
            sa.Integer(),
            nullable=False,
            server_default='0'
        ),
        sa.Column(
            'created_at',
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now()
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(),
            nullable=False,
            server_default=sa.func.now()
        ),
    )

    # Index for scheduler job to find due reminders efficiently
    op.create_index(
        'ix_t_scheduled_reminder_due',
        't_scheduled_reminder',
        ['status', 'reminder_datetime'],
        postgresql_where=sa.text("status = 'pending'")
    )

    # CHECK constraint for valid status values
    op.create_check_constraint(
        'chk_reminder_status_valid',
        't_scheduled_reminder',
        "status IN ('pending', 'sent', 'failed', 'cancelled')"
    )

    # Add comment
    op.execute("""
        COMMENT ON TABLE t_scheduled_reminder IS
        'Scheduled reminders for budget plans. One-to-one with BudgetFact (record_type=plan). '
        'Scheduler job runs every 5 min to send due reminders via Telegram + Web Push.'
    """)


def downgrade() -> None:
    """
    Drop push subscriptions and scheduled reminders tables.
    """

    # =========================================================================
    # 1. Drop t_scheduled_reminder
    # =========================================================================

    op.drop_constraint('chk_reminder_status_valid', 't_scheduled_reminder', type_='check')
    op.drop_index('ix_t_scheduled_reminder_due', table_name='t_scheduled_reminder')
    op.drop_table('t_scheduled_reminder')

    # =========================================================================
    # 2. Drop t_push_subscription
    # =========================================================================

    op.drop_index('ix_t_push_subscription_endpoint_unique', table_name='t_push_subscription')
    op.drop_table('t_push_subscription')
