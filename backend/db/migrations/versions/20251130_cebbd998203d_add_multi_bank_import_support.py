"""add multi-bank import support

Revision ID: cebbd998203d
Revises: 04922734eb6c
Create Date: 2025-11-30 19:10:17.959182

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSON


# revision identifiers, used by Alembic.
revision: str = 'cebbd998203d'
down_revision: Union[str, None] = '04922734eb6c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create t_d_bank_provider table
    op.create_table(
        't_d_bank_provider',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(50), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code', name='uq_bank_provider_code')
    )

    # 2. Create t_import_file_upload table
    op.create_table(
        't_import_file_upload',
        sa.Column('id', sa.BigInteger(), autoincrement=True, nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('bank_provider_id', sa.Integer(), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('csv_headers', JSON, nullable=True),
        sa.Column('csv_sample_rows', JSON, nullable=True),
        sa.Column('total_rows', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(20), server_default='uploaded', nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('mapping_id', sa.Integer(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('analyzed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('parsed_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['user_id'], ['t_d_user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['bank_provider_id'], ['t_d_bank_provider.id'], ondelete='CASCADE'),
    )
    op.create_index('ix_import_file_upload_user_id', 't_import_file_upload', ['user_id'])
    op.create_index('ix_import_file_upload_status', 't_import_file_upload', ['status'])

    # 3. Create t_import_column_mapping table
    op.create_table(
        't_import_column_mapping',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('bank_provider_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('mapping', JSON, nullable=False),
        sa.Column('transformations', JSON, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('NOW()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['bank_provider_id'], ['t_d_bank_provider.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['t_d_user.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('bank_provider_id', 'user_id', name='uq_bank_user_mapping')
    )

    # Add foreign key from t_import_file_upload.mapping_id to t_import_column_mapping.id
    op.create_foreign_key(
        'fk_import_file_upload_mapping_id',
        't_import_file_upload',
        't_import_column_mapping',
        ['mapping_id'],
        ['id'],
        ondelete='SET NULL'
    )

    # 4. Modify t_import_staging - clear data first
    op.execute("DELETE FROM t_import_staging")

    # Drop tinkoff-specific columns
    op.drop_column('t_import_staging', 'tinkoff_date')
    op.drop_column('t_import_staging', 'tinkoff_amount')
    op.drop_column('t_import_staging', 'tinkoff_category')
    op.drop_column('t_import_staging', 'tinkoff_mcc')
    op.drop_column('t_import_staging', 'tinkoff_description')
    op.drop_column('t_import_staging', 'tinkoff_card')

    # Add generic columns
    op.add_column('t_import_staging', sa.Column('file_upload_id', sa.BigInteger(), nullable=True))
    op.add_column('t_import_staging', sa.Column('fact_date', sa.Date(), nullable=False))
    op.add_column('t_import_staging', sa.Column('amount_string', sa.String(20), nullable=False))
    op.add_column('t_import_staging', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('t_import_staging', sa.Column('csv_metadata', JSON, nullable=True))

    # Add foreign key
    op.create_foreign_key(
        'fk_import_staging_file_upload_id',
        't_import_staging',
        't_import_file_upload',
        ['file_upload_id'],
        ['id'],
        ondelete='CASCADE'
    )

    # 5. Seed default banks
    op.execute("""
        INSERT INTO t_d_bank_provider (code, name, active) VALUES
        ('tinkoff', 'Тинькофф Банк', true),
        ('alfabank', 'Альфа-Банк', true),
        ('sberbank', 'Сбербанк', true),
        ('vtb', 'ВТБ', true),
        ('raiffeisen', 'Райффайзен Банк', true)
    """)


def downgrade() -> None:
    # Restore t_import_staging
    op.drop_constraint('fk_import_staging_file_upload_id', 't_import_staging', type_='foreignkey')
    op.drop_column('t_import_staging', 'csv_metadata')
    op.drop_column('t_import_staging', 'description')
    op.drop_column('t_import_staging', 'amount_string')
    op.drop_column('t_import_staging', 'fact_date')
    op.drop_column('t_import_staging', 'file_upload_id')

    op.add_column('t_import_staging', sa.Column('tinkoff_card', sa.String(20), nullable=True))
    op.add_column('t_import_staging', sa.Column('tinkoff_description', sa.Text(), nullable=True))
    op.add_column('t_import_staging', sa.Column('tinkoff_mcc', sa.String(10), nullable=True))
    op.add_column('t_import_staging', sa.Column('tinkoff_category', sa.String(255), nullable=True))
    op.add_column('t_import_staging', sa.Column('tinkoff_amount', sa.String(20), nullable=False))
    op.add_column('t_import_staging', sa.Column('tinkoff_date', sa.Date(), nullable=False))

    # Drop new tables (in reverse order)
    op.drop_constraint('fk_import_file_upload_mapping_id', 't_import_file_upload', type_='foreignkey')
    op.drop_table('t_import_column_mapping')
    op.drop_index('ix_import_file_upload_status', 't_import_file_upload')
    op.drop_index('ix_import_file_upload_user_id', 't_import_file_upload')
    op.drop_table('t_import_file_upload')
    op.drop_table('t_d_bank_provider')
