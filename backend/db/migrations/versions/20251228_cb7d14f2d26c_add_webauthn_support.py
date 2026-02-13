"""add webauthn support

Revision ID: cb7d14f2d26c
Revises: d1e6f4a267d5
Create Date: 2025-12-28

"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'cb7d14f2d26c'
down_revision: str | None = 'd1e6f4a267d5'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Add WebAuthn biometric authentication support.

    Creates 3 new tables:
    - t_d_webauthn_credential: Stores WebAuthn public keys and metadata
    - t_f_webauthn_challenge: Temporary challenges (10-min TTL)
    - t_f_webauthn_audit_log: Comprehensive audit trail

    Features:
    - Platform authenticator support (TouchID, FaceID, Windows Hello)
    - Sign count validation (cloned credential detection)
    - Comprehensive audit logging
    - Soft delete (is_revoked flag)
    """

    # Create t_d_webauthn_credential table
    op.create_table(
        't_d_webauthn_credential',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('credential_id', sa.String(length=1024), nullable=False),
        sa.Column('public_key', sa.LargeBinary(), nullable=False),
        sa.Column('sign_count', sa.BigInteger(), nullable=False, server_default='0'),
        sa.Column('transports', postgresql.ARRAY(sa.String()), nullable=True),
        sa.Column('aaguid', sa.String(length=36), nullable=True),
        sa.Column('device_name', sa.String(length=255), nullable=True),
        sa.Column('backup_eligible', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('backup_state', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('is_revoked', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['t_d_user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Indexes for t_d_webauthn_credential
    op.create_index(
        'ix_webauthn_credential_user_id',
        't_d_webauthn_credential',
        ['user_id'],
        unique=False
    )
    op.create_index(
        'ix_webauthn_credential_credential_id',
        't_d_webauthn_credential',
        ['credential_id'],
        unique=True
    )
    # Partial index for active credentials (WHERE is_revoked = FALSE)
    op.create_index(
        'ix_webauthn_credential_active',
        't_d_webauthn_credential',
        ['user_id'],
        unique=False,
        postgresql_where=sa.text('is_revoked = FALSE')
    )

    # Create t_f_webauthn_challenge table
    op.create_table(
        't_f_webauthn_challenge',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('challenge', sa.String(length=255), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('challenge_type', sa.String(length=20), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('consumed_at', sa.DateTime(), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.CheckConstraint(
            "challenge_type IN ('registration', 'authentication')",
            name='chk_webauthn_challenge_type'
        ),
        sa.ForeignKeyConstraint(['user_id'], ['t_d_user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # Indexes for t_f_webauthn_challenge
    op.create_index(
        'ix_webauthn_challenge_challenge',
        't_f_webauthn_challenge',
        ['challenge'],
        unique=True
    )
    op.create_index(
        'ix_webauthn_challenge_expires_at',
        't_f_webauthn_challenge',
        ['expires_at'],
        unique=False
    )

    # Create t_f_webauthn_audit_log table
    op.create_table(
        't_f_webauthn_audit_log',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=True),
        sa.Column('credential_id', sa.String(length=1024), nullable=True),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.text('NOW()')),
        sa.ForeignKeyConstraint(['user_id'], ['t_d_user.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id')
    )

    # Indexes for t_f_webauthn_audit_log
    op.create_index(
        'ix_webauthn_audit_created_at',
        't_f_webauthn_audit_log',
        ['created_at'],
        unique=False,
        postgresql_ops={'created_at': 'DESC'}
    )
    op.create_index(
        'ix_webauthn_audit_event_type',
        't_f_webauthn_audit_log',
        ['event_type'],
        unique=False
    )


def downgrade() -> None:
    """
    Remove WebAuthn support.

    Drops all WebAuthn tables in reverse order.
    """
    # Drop indexes first (good practice)
    op.drop_index('ix_webauthn_audit_event_type', table_name='t_f_webauthn_audit_log')
    op.drop_index('ix_webauthn_audit_created_at', table_name='t_f_webauthn_audit_log')
    op.drop_index('ix_webauthn_challenge_expires_at', table_name='t_f_webauthn_challenge')
    op.drop_index('ix_webauthn_challenge_challenge', table_name='t_f_webauthn_challenge')
    op.drop_index('ix_webauthn_credential_active', table_name='t_d_webauthn_credential')
    op.drop_index('ix_webauthn_credential_credential_id', table_name='t_d_webauthn_credential')
    op.drop_index('ix_webauthn_credential_user_id', table_name='t_d_webauthn_credential')

    # Drop tables in reverse order
    op.drop_table('t_f_webauthn_audit_log')
    op.drop_table('t_f_webauthn_challenge')
    op.drop_table('t_d_webauthn_credential')
