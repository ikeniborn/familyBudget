"""Remove product tables

Revision ID: 746e34a709b8
Revises: 7001f0ea49df
Create Date: 2025-09-19 19:15:18.309161

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '746e34a709b8'
down_revision: Union[str, None] = '7001f0ea49df'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Drop product-related tables in proper order to handle foreign key constraints

    # 1. Drop t_f_product_price first (has FK to t_d_product)
    op.drop_table('t_f_product_price')

    # 2. Drop t_l_product_nomenclature (has FK to t_d_product and t_d_nomenclature)
    op.drop_table('t_l_product_nomenclature')

    # 3. Drop t_d_product last (main table)
    op.drop_table('t_d_product')


def downgrade() -> None:
    # Recreate product-related tables in reverse order

    # 1. Recreate t_d_product first (main table)
    op.create_table('t_d_product',
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('product_name', sa.String(length=255), nullable=False),
        sa.Column('category_name', sa.String(length=100), nullable=True),
        sa.Column('unit_measure', sa.String(length=50), nullable=True),
        sa.Column('barcode', sa.String(length=50), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('created_dttm', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_dttm', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.PrimaryKeyConstraint('product_id', name='pk_t_d_product')
    )

    # Create indexes for t_d_product
    op.create_index('idx_product_active', 't_d_product', ['is_active'])
    op.create_index('idx_product_barcode', 't_d_product', ['barcode'])
    op.create_index('idx_product_category', 't_d_product', ['category_name'])
    op.create_index('idx_product_name', 't_d_product', ['product_name'])
    op.create_index('ix_t_d_product_product_id', 't_d_product', ['product_id'])

    # 2. Recreate t_f_product_price (depends on t_d_product)
    op.create_table('t_f_product_price',
        sa.Column('price_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('supplier_name', sa.String(length=255), nullable=True),
        sa.Column('price_value', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('price_date', sa.Date(), server_default=sa.text('CURRENT_DATE'), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('created_dttm', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['t_d_product.product_id'], name='fk_t_f_product_price_product_id_t_d_product', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['t_d_user.user_id'], name='fk_t_f_product_price_user_id_t_d_user'),
        sa.PrimaryKeyConstraint('price_id', name='pk_t_f_product_price')
    )

    # Create indexes for t_f_product_price
    op.create_index('idx_product_price_date', 't_f_product_price', ['price_date'])
    op.create_index('idx_product_price_product', 't_f_product_price', ['product_id'])
    op.create_index('idx_product_price_supplier', 't_f_product_price', ['supplier_name'])
    op.create_index('idx_product_price_user', 't_f_product_price', ['user_id'])
    op.create_index('ix_t_f_product_price_price_id', 't_f_product_price', ['price_id'])

    # 3. Recreate t_l_product_nomenclature (depends on both t_d_product and t_d_nomenclature)
    op.create_table('t_l_product_nomenclature',
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('nomenclature_id', sa.Integer(), nullable=False),
        sa.Column('created_dttm', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['nomenclature_id'], ['t_d_nomenclature.nomenclature_id'], name='fk_t_l_product_nomenclature_nomenclature_id_t_d_nomenclature', ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['t_d_product.product_id'], name='fk_t_l_product_nomenclature_product_id_t_d_product', ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('product_id', 'nomenclature_id', name='pk_t_l_product_nomenclature')
    )

    # Create indexes for t_l_product_nomenclature
    op.create_index('idx_product_nomenclature_nom', 't_l_product_nomenclature', ['nomenclature_id'])
    op.create_index('idx_product_nomenclature_product', 't_l_product_nomenclature', ['product_id'])
