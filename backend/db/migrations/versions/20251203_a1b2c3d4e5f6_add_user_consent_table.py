"""add user consent table for GDPR compliance

Revision ID: a1b2c3d4e5f6
Revises: b3ae64eae53f
Create Date: 2025-12-03 14:00:00.000000

This migration creates the t_user_consent table for tracking user consent
for cookies, analytics, and other data processing activities.

GDPR Requirements:
- Record what consents were given/withdrawn
- When they were given
- Store proof of consent (IP, user agent)
- Keep historical records (append-only)
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: str | None = 'b3ae64eae53f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create user consent table
    op.create_table(
        't_user_consent',
        sa.Column('id', sa.Integer(), nullable=False, autoincrement=True),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('session_id', sa.String(length=255), nullable=True),
        sa.Column('consent_type', sa.String(length=50), nullable=False),
        sa.Column('consent_given', sa.Boolean(), nullable=False),
        sa.Column('privacy_policy_version', sa.String(length=20), nullable=False, server_default='1.0'),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['user_id'], ['t_d_user.id'], name='fk_user_consent_user_id'),
        sa.PrimaryKeyConstraint('id')
    )

    # Create indexes for efficient queries
    op.create_index('ix_user_consent_user_id', 't_user_consent', ['user_id'])
    op.create_index('ix_user_consent_session_id', 't_user_consent', ['session_id'])
    op.create_index('ix_user_consent_consent_type', 't_user_consent', ['consent_type'])
    op.create_index('ix_user_consent_created_at', 't_user_consent', ['created_at'])

    # Create composite index for getting latest consent per user/type
    op.create_index(
        'ix_user_consent_user_type_created',
        't_user_consent',
        ['user_id', 'consent_type', 'created_at'],
        postgresql_ops={'created_at': 'DESC'}
    )

    # Add comment to table
    op.execute("""
        COMMENT ON TABLE t_user_consent IS 'GDPR consent records - append-only audit log'
    """)


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_user_consent_user_type_created', table_name='t_user_consent')
    op.drop_index('ix_user_consent_created_at', table_name='t_user_consent')
    op.drop_index('ix_user_consent_consent_type', table_name='t_user_consent')
    op.drop_index('ix_user_consent_session_id', table_name='t_user_consent')
    op.drop_index('ix_user_consent_user_id', table_name='t_user_consent')

    # Drop table
    op.drop_table('t_user_consent')
