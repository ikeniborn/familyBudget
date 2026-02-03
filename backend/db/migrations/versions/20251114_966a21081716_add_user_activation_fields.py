"""add_user_activation_fields

Revision ID: 966a21081716
Revises: 870ace16c2f5
Create Date: 2025-11-14 06:54:43.506177

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '966a21081716'
down_revision: str | None = '870ace16c2f5'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Add is_active and last_login_at fields to t_d_user table."""
    # Add is_active column (default FALSE - new users inactive by default)
    op.add_column(
        't_d_user',
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.false())
    )

    # Add last_login_at column (nullable - NULL until first login)
    op.add_column(
        't_d_user',
        sa.Column('last_login_at', sa.DateTime(), nullable=True)
    )

    # Create indexes for efficient filtering
    op.create_index(
        'idx_user_is_active',
        't_d_user',
        ['is_active']
    )
    op.create_index(
        'idx_user_last_login_at',
        't_d_user',
        ['last_login_at']
    )

    # IMPORTANT: Set existing users as active (backward compatibility)
    # All users who already exist should remain active
    op.execute("UPDATE t_d_user SET is_active = TRUE WHERE is_current = TRUE")


def downgrade() -> None:
    """Remove is_active and last_login_at fields from t_d_user table."""
    # Drop indexes first
    op.drop_index('idx_user_last_login_at', table_name='t_d_user')
    op.drop_index('idx_user_is_active', table_name='t_d_user')

    # Drop columns
    op.drop_column('t_d_user', 'last_login_at')
    op.drop_column('t_d_user', 'is_active')
