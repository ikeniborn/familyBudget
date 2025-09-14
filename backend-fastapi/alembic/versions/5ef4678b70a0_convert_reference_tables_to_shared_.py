"""Convert reference tables to shared admin-managed structure

Revision ID: 5ef4678b70a0
Revises: 86027abaa82e
Create Date: 2025-09-14 14:20:01.368160

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5ef4678b70a0'
down_revision: Union[str, None] = '86027abaa82e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Add code columns to reference tables
    # Financial Centers
    op.add_column('t_d_financial_center', sa.Column('financial_center_code', sa.String(20), nullable=True))

    # Cost Centers
    op.add_column('t_d_cost_center', sa.Column('cost_center_code', sa.String(20), nullable=True))

    # Nomenclatures
    op.add_column('t_d_nomenclature', sa.Column('nomenclature_code', sa.String(50), nullable=True))

    # Step 2: Add audit columns
    # Financial Centers
    op.add_column('t_d_financial_center', sa.Column('created_by', sa.Integer(), nullable=True))
    op.add_column('t_d_financial_center', sa.Column('managed_by', sa.Integer(), nullable=True))
    op.add_column('t_d_financial_center', sa.Column('description', sa.String(500), nullable=True))

    # Cost Centers
    op.add_column('t_d_cost_center', sa.Column('created_by', sa.Integer(), nullable=True))
    op.add_column('t_d_cost_center', sa.Column('managed_by', sa.Integer(), nullable=True))
    op.add_column('t_d_cost_center', sa.Column('description', sa.String(500), nullable=True))

    # Nomenclatures
    op.add_column('t_d_nomenclature', sa.Column('created_by', sa.Integer(), nullable=True))
    op.add_column('t_d_nomenclature', sa.Column('managed_by', sa.Integer(), nullable=True))
    op.add_column('t_d_nomenclature', sa.Column('description', sa.String(500), nullable=True))

    # Step 3: Populate code columns with auto-generated values
    # Financial Centers - use first 3 chars of name + sequential number
    op.execute("""
        UPDATE t_d_financial_center
        SET financial_center_code = UPPER(LEFT(financial_center_name, 3)) ||
            LPAD(row_num::text, 3, '0')
        FROM (
            SELECT financial_center_id,
                   ROW_NUMBER() OVER (ORDER BY financial_center_id) as row_num
            FROM t_d_financial_center
            WHERE financial_center_code IS NULL
        ) seq
        WHERE t_d_financial_center.financial_center_id = seq.financial_center_id
        AND financial_center_code IS NULL;
    """)

    # Cost Centers - use first 3 chars of name + sequential number
    op.execute("""
        UPDATE t_d_cost_center
        SET cost_center_code = UPPER(LEFT(cost_center_name, 3)) ||
            LPAD(row_num::text, 3, '0')
        FROM (
            SELECT cost_center_id,
                   ROW_NUMBER() OVER (ORDER BY cost_center_id) as row_num
            FROM t_d_cost_center
            WHERE cost_center_code IS NULL
        ) seq
        WHERE t_d_cost_center.cost_center_id = seq.cost_center_id
        AND cost_center_code IS NULL;
    """)

    # Nomenclatures - use first 5 chars of name + sequential number
    op.execute("""
        UPDATE t_d_nomenclature
        SET nomenclature_code = UPPER(LEFT(nomenclature_name, 5)) ||
            LPAD(row_num::text, 3, '0')
        FROM (
            SELECT nomenclature_id,
                   ROW_NUMBER() OVER (ORDER BY nomenclature_id) as row_num
            FROM t_d_nomenclature
            WHERE nomenclature_code IS NULL
        ) seq
        WHERE t_d_nomenclature.nomenclature_id = seq.nomenclature_id
        AND nomenclature_code IS NULL;
    """)

    # Step 4: Set audit fields - first user becomes creator and manager
    op.execute("""
        UPDATE t_d_financial_center
        SET created_by = user_id, managed_by = user_id
        WHERE created_by IS NULL;
    """)

    op.execute("""
        UPDATE t_d_cost_center
        SET created_by = user_id, managed_by = user_id
        WHERE created_by IS NULL;
    """)

    op.execute("""
        UPDATE t_d_nomenclature
        SET created_by = user_id, managed_by = user_id
        WHERE created_by IS NULL;
    """)

    # Step 5: Make code columns not nullable
    op.alter_column('t_d_financial_center', 'financial_center_code', nullable=False)
    op.alter_column('t_d_cost_center', 'cost_center_code', nullable=False)
    op.alter_column('t_d_nomenclature', 'nomenclature_code', nullable=False)

    # Step 6: Create global unique constraints on code
    op.create_unique_constraint('_financial_center_code_uc', 't_d_financial_center', ['financial_center_code'])
    op.create_unique_constraint('_cost_center_code_uc', 't_d_cost_center', ['cost_center_code'])
    op.create_unique_constraint('_nomenclature_code_uc', 't_d_nomenclature', ['nomenclature_code'])

    # Step 7: Add foreign key constraints for audit fields
    op.create_foreign_key('fk_financial_center_created_by', 't_d_financial_center', 't_d_user', ['created_by'], ['user_id'])
    op.create_foreign_key('fk_financial_center_managed_by', 't_d_financial_center', 't_d_user', ['managed_by'], ['user_id'])

    op.create_foreign_key('fk_cost_center_created_by', 't_d_cost_center', 't_d_user', ['created_by'], ['user_id'])
    op.create_foreign_key('fk_cost_center_managed_by', 't_d_cost_center', 't_d_user', ['managed_by'], ['user_id'])

    op.create_foreign_key('fk_nomenclature_created_by', 't_d_nomenclature', 't_d_user', ['created_by'], ['user_id'])
    op.create_foreign_key('fk_nomenclature_managed_by', 't_d_nomenclature', 't_d_user', ['managed_by'], ['user_id'])


def downgrade() -> None:
    # Drop foreign key constraints
    op.drop_constraint('fk_financial_center_created_by', 't_d_financial_center', type_='foreignkey')
    op.drop_constraint('fk_financial_center_managed_by', 't_d_financial_center', type_='foreignkey')
    op.drop_constraint('fk_cost_center_created_by', 't_d_cost_center', type_='foreignkey')
    op.drop_constraint('fk_cost_center_managed_by', 't_d_cost_center', type_='foreignkey')
    op.drop_constraint('fk_nomenclature_created_by', 't_d_nomenclature', type_='foreignkey')
    op.drop_constraint('fk_nomenclature_managed_by', 't_d_nomenclature', type_='foreignkey')

    # Drop global unique constraints
    op.drop_constraint('_financial_center_code_uc', 't_d_financial_center', type_='unique')
    op.drop_constraint('_cost_center_code_uc', 't_d_cost_center', type_='unique')
    op.drop_constraint('_nomenclature_code_uc', 't_d_nomenclature', type_='unique')

    # Drop added columns
    op.drop_column('t_d_financial_center', 'managed_by')
    op.drop_column('t_d_financial_center', 'created_by')
    op.drop_column('t_d_financial_center', 'description')
    op.drop_column('t_d_financial_center', 'financial_center_code')

    op.drop_column('t_d_cost_center', 'managed_by')
    op.drop_column('t_d_cost_center', 'created_by')
    op.drop_column('t_d_cost_center', 'description')
    op.drop_column('t_d_cost_center', 'cost_center_code')

    op.drop_column('t_d_nomenclature', 'managed_by')
    op.drop_column('t_d_nomenclature', 'created_by')
    op.drop_column('t_d_nomenclature', 'description')
    op.drop_column('t_d_nomenclature', 'nomenclature_code')
