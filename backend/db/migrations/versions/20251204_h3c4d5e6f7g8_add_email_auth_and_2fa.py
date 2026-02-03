"""Add email authentication and 2FA support

Revision ID: h3c4d5e6f7g8
Revises: g2b3c4d5e6f7
Create Date: 2025-12-04

This migration adds support for email/password + 2FA authentication:

1. t_d_user changes:
   - Make telegram_id nullable (for email-only users)
   - Add email, password_hash fields
   - Add 2FA fields: two_factor_secret, two_factor_enabled, backup_codes
   - Add CHECK constraint (at least one auth method)
   - Add partial unique index on email

2. t_d_user_history changes:
   - Make telegram_id nullable
   - Add email field
   - Add two_factor_enabled field

3. New table t_2fa_session:
   - Temporary 2FA sessions (5-min TTL, single-use)
   - SHA-256 hashed tokens

BREAKING CHANGE: telegram_id becomes nullable.
All existing users have telegram_id, so this is backwards compatible.
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'h3c4d5e6f7g8'
down_revision: str | None = 'g2b3c4d5e6f7'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Add email/password + 2FA authentication support.
    """

    # =========================================================================
    # 1. Modify t_d_user table
    # =========================================================================

    # 1.1 Make telegram_id nullable (for email-only users)
    op.alter_column(
        't_d_user',
        'telegram_id',
        existing_type=sa.BigInteger(),
        nullable=True
    )

    # 1.2 Add email field
    op.add_column(
        't_d_user',
        sa.Column('email', sa.String(320), nullable=True)
    )

    # 1.3 Add password_hash field (Argon2)
    op.add_column(
        't_d_user',
        sa.Column('password_hash', sa.String(255), nullable=True)
    )

    # 1.4 Add 2FA fields
    op.add_column(
        't_d_user',
        sa.Column('two_factor_secret', sa.String(64), nullable=True)
    )
    op.add_column(
        't_d_user',
        sa.Column('two_factor_enabled', sa.Boolean(), nullable=False, server_default='false')
    )
    op.add_column(
        't_d_user',
        sa.Column('backup_codes', sa.String(2000), nullable=True)
    )

    # 1.5 Add CHECK constraint: at least one auth method must be set
    op.create_check_constraint(
        'chk_user_has_auth_method',
        't_d_user',
        'telegram_id IS NOT NULL OR email IS NOT NULL'
    )

    # 1.6 Add partial unique index on email (only non-null values)
    op.execute("""
        CREATE UNIQUE INDEX ix_t_d_user_email_unique
        ON t_d_user(email)
        WHERE email IS NOT NULL
    """)

    # =========================================================================
    # 2. Modify t_d_user_history table
    # =========================================================================

    # 2.1 Make telegram_id nullable
    op.alter_column(
        't_d_user_history',
        'telegram_id',
        existing_type=sa.BigInteger(),
        nullable=True
    )

    # 2.2 Add email field
    op.add_column(
        't_d_user_history',
        sa.Column('email', sa.String(320), nullable=True)
    )

    # 2.3 Add two_factor_enabled field (for security audit)
    op.add_column(
        't_d_user_history',
        sa.Column('two_factor_enabled', sa.Boolean(), nullable=False, server_default='false')
    )

    # =========================================================================
    # 3. Create t_2fa_session table
    # =========================================================================

    op.create_table(
        't_2fa_session',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('t_d_user.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('token_hash', sa.String(64), nullable=False, unique=True, index=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('used', sa.Boolean(), nullable=False, server_default='false'),
    )

    # Add index for cleanup job (expired sessions)
    op.create_index(
        'ix_t_2fa_session_expires_at',
        't_2fa_session',
        ['expires_at']
    )


def downgrade() -> None:
    """
    Revert email/password + 2FA authentication support.

    WARNING: This will lose all email-only users and 2FA data!
    """

    # =========================================================================
    # 1. Drop t_2fa_session table
    # =========================================================================

    op.drop_index('ix_t_2fa_session_expires_at', table_name='t_2fa_session')
    op.drop_table('t_2fa_session')

    # =========================================================================
    # 2. Revert t_d_user_history changes
    # =========================================================================

    op.drop_column('t_d_user_history', 'two_factor_enabled')
    op.drop_column('t_d_user_history', 'email')

    op.alter_column(
        't_d_user_history',
        'telegram_id',
        existing_type=sa.BigInteger(),
        nullable=False
    )

    # =========================================================================
    # 3. Revert t_d_user changes
    # =========================================================================

    # Drop partial unique index on email
    op.execute("DROP INDEX IF EXISTS ix_t_d_user_email_unique")

    # Drop CHECK constraint
    op.drop_constraint('chk_user_has_auth_method', 't_d_user', type_='check')

    # Drop 2FA fields
    op.drop_column('t_d_user', 'backup_codes')
    op.drop_column('t_d_user', 'two_factor_enabled')
    op.drop_column('t_d_user', 'two_factor_secret')

    # Drop password_hash field
    op.drop_column('t_d_user', 'password_hash')

    # Drop email field
    op.drop_column('t_d_user', 'email')

    # Make telegram_id NOT NULL again
    # WARNING: This will fail if there are email-only users!
    op.alter_column(
        't_d_user',
        'telegram_id',
        existing_type=sa.BigInteger(),
        nullable=False
    )
