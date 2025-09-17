"""remove_shared_functionality

Revision ID: 7001f0ea49df
Revises: db5be6413a0c
Create Date: 2025-09-17 14:44:27.695613

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7001f0ea49df'
down_revision: Union[str, None] = 'db5be6413a0c'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Remove shared functionality from reference tables:
    1. Migrate NULL user_id records to first admin user
    2. Make user_id NOT NULL in all reference tables
    3. Remove created_by and managed_by columns
    4. Update unique constraints to be user-specific
    """

    # Step 1: Migrate NULL user_id records to first admin user (ID: 1)
    print("Migrating NULL user_id records to first admin user...")

    # Get the first admin user ID
    connection = op.get_bind()
    result = connection.execute(sa.text(
        "SELECT user_id FROM t_d_user WHERE user_role = 'admin' ORDER BY user_id LIMIT 1"
    ))
    admin_user_id = result.scalar()

    if admin_user_id is None:
        raise Exception("No admin user found to migrate shared records to")

    print(f"Using admin user_id: {admin_user_id}")

    # Update NULL user_id records in all reference tables
    connection.execute(sa.text(
        f"UPDATE t_d_period SET user_id = {admin_user_id} WHERE user_id IS NULL"
    ))
    connection.execute(sa.text(
        f"UPDATE t_d_financial_center SET user_id = {admin_user_id} WHERE user_id IS NULL"
    ))
    connection.execute(sa.text(
        f"UPDATE t_d_cost_center SET user_id = {admin_user_id} WHERE user_id IS NULL"
    ))
    connection.execute(sa.text(
        f"UPDATE t_d_nomenclature SET user_id = {admin_user_id} WHERE user_id IS NULL"
    ))
    connection.execute(sa.text(
        f"UPDATE t_d_article SET user_id = {admin_user_id} WHERE user_id IS NULL"
    ))

    # Verify no NULL user_id records remain
    null_counts = {}
    for table in ['t_d_period', 't_d_financial_center', 't_d_cost_center', 't_d_nomenclature', 't_d_article']:
        result = connection.execute(sa.text(f"SELECT COUNT(*) FROM {table} WHERE user_id IS NULL"))
        count = result.scalar()
        null_counts[table] = count
        if count > 0:
            raise Exception(f"Migration failed: {count} NULL user_id records remain in {table}")

    print("All NULL user_id records successfully migrated")

    # Step 2: Make user_id NOT NULL in all reference tables
    print("Making user_id NOT NULL in all reference tables...")
    op.alter_column('t_d_period', 'user_id', nullable=False)
    op.alter_column('t_d_financial_center', 'user_id', nullable=False)
    op.alter_column('t_d_cost_center', 'user_id', nullable=False)
    op.alter_column('t_d_nomenclature', 'user_id', nullable=False)
    op.alter_column('t_d_article', 'user_id', nullable=False)

    # Step 3: Remove created_by and managed_by columns
    print("Removing created_by and managed_by columns...")

    # Remove foreign key constraints first
    op.drop_constraint('fk_period_created_by', 't_d_period', type_='foreignkey')
    op.drop_constraint('fk_period_managed_by', 't_d_period', type_='foreignkey')
    op.drop_constraint('fk_financial_center_created_by', 't_d_financial_center', type_='foreignkey')
    op.drop_constraint('fk_financial_center_managed_by', 't_d_financial_center', type_='foreignkey')
    op.drop_constraint('fk_cost_center_created_by', 't_d_cost_center', type_='foreignkey')
    op.drop_constraint('fk_cost_center_managed_by', 't_d_cost_center', type_='foreignkey')
    op.drop_constraint('fk_nomenclature_created_by', 't_d_nomenclature', type_='foreignkey')
    op.drop_constraint('fk_nomenclature_managed_by', 't_d_nomenclature', type_='foreignkey')
    op.drop_constraint('fk_t_d_article_created_by_t_d_user', 't_d_article', type_='foreignkey')
    op.drop_constraint('fk_t_d_article_managed_by_t_d_user', 't_d_article', type_='foreignkey')

    # Drop columns
    op.drop_column('t_d_period', 'created_by')
    op.drop_column('t_d_period', 'managed_by')
    op.drop_column('t_d_financial_center', 'created_by')
    op.drop_column('t_d_financial_center', 'managed_by')
    op.drop_column('t_d_cost_center', 'created_by')
    op.drop_column('t_d_cost_center', 'managed_by')
    op.drop_column('t_d_nomenclature', 'created_by')
    op.drop_column('t_d_nomenclature', 'managed_by')
    op.drop_column('t_d_article', 'created_by')
    op.drop_column('t_d_article', 'managed_by')

    # Step 4: Update unique constraints to be user-specific
    print("Updating unique constraints to be user-specific...")

    # Drop global unique constraints
    op.drop_constraint('_period_code_uc', 't_d_period', type_='unique')
    op.drop_constraint('_financial_center_code_uc', 't_d_financial_center', type_='unique')
    op.drop_constraint('_cost_center_code_uc', 't_d_cost_center', type_='unique')
    op.drop_constraint('_nomenclature_code_uc', 't_d_nomenclature', type_='unique')
    op.drop_constraint('uq_t_d_article_article_code', 't_d_article', type_='unique')

    # Create user-specific unique constraints
    op.create_unique_constraint('_period_code_user_uc', 't_d_period', ['period_code', 'user_id'])
    op.create_unique_constraint('_financial_center_code_user_uc', 't_d_financial_center', ['financial_center_code', 'user_id'])
    op.create_unique_constraint('_cost_center_code_user_uc', 't_d_cost_center', ['cost_center_code', 'user_id'])
    op.create_unique_constraint('_nomenclature_code_user_uc', 't_d_nomenclature', ['nomenclature_code', 'user_id'])
    op.create_unique_constraint('_article_code_user_uc', 't_d_article', ['article_code', 'user_id'])

    print("Migration completed successfully!")


def downgrade() -> None:
    """
    Rollback shared functionality removal:
    1. Restore global unique constraints
    2. Add back created_by and managed_by columns
    3. Make user_id nullable again
    4. Note: Cannot restore original NULL user_id records (data migration is irreversible)
    """

    print("Rolling back shared functionality removal...")

    # Step 1: Restore global unique constraints
    print("Restoring global unique constraints...")

    # Drop user-specific unique constraints
    op.drop_constraint('_article_code_user_uc', 't_d_article', type_='unique')
    op.drop_constraint('_nomenclature_code_user_uc', 't_d_nomenclature', type_='unique')
    op.drop_constraint('_cost_center_code_user_uc', 't_d_cost_center', type_='unique')
    op.drop_constraint('_financial_center_code_user_uc', 't_d_financial_center', type_='unique')
    op.drop_constraint('_period_code_user_uc', 't_d_period', type_='unique')

    # Create global unique constraints
    op.create_unique_constraint('_period_code_uc', 't_d_period', ['period_code'])
    op.create_unique_constraint('_financial_center_code_uc', 't_d_financial_center', ['financial_center_code'])
    op.create_unique_constraint('_cost_center_code_uc', 't_d_cost_center', ['cost_center_code'])
    op.create_unique_constraint('_nomenclature_code_uc', 't_d_nomenclature', ['nomenclature_code'])
    op.create_unique_constraint('uq_t_d_article_article_code', 't_d_article', ['article_code'])

    # Step 2: Add back created_by and managed_by columns
    print("Adding back created_by and managed_by columns...")

    # Add columns back
    op.add_column('t_d_period', sa.Column('created_by', sa.Integer(), nullable=True))
    op.add_column('t_d_period', sa.Column('managed_by', sa.Integer(), nullable=True))
    op.add_column('t_d_financial_center', sa.Column('created_by', sa.Integer(), nullable=True))
    op.add_column('t_d_financial_center', sa.Column('managed_by', sa.Integer(), nullable=True))
    op.add_column('t_d_cost_center', sa.Column('created_by', sa.Integer(), nullable=True))
    op.add_column('t_d_cost_center', sa.Column('managed_by', sa.Integer(), nullable=True))
    op.add_column('t_d_nomenclature', sa.Column('created_by', sa.Integer(), nullable=True))
    op.add_column('t_d_nomenclature', sa.Column('managed_by', sa.Integer(), nullable=True))
    op.add_column('t_d_article', sa.Column('created_by', sa.Integer(), nullable=True))
    op.add_column('t_d_article', sa.Column('managed_by', sa.Integer(), nullable=True))

    # Add foreign key constraints back
    op.create_foreign_key('fk_period_created_by', 't_d_period', 't_d_user', ['created_by'], ['user_id'])
    op.create_foreign_key('fk_period_managed_by', 't_d_period', 't_d_user', ['managed_by'], ['user_id'])
    op.create_foreign_key('fk_financial_center_created_by', 't_d_financial_center', 't_d_user', ['created_by'], ['user_id'])
    op.create_foreign_key('fk_financial_center_managed_by', 't_d_financial_center', 't_d_user', ['managed_by'], ['user_id'])
    op.create_foreign_key('fk_cost_center_created_by', 't_d_cost_center', 't_d_user', ['created_by'], ['user_id'])
    op.create_foreign_key('fk_cost_center_managed_by', 't_d_cost_center', 't_d_user', ['managed_by'], ['user_id'])
    op.create_foreign_key('fk_nomenclature_created_by', 't_d_nomenclature', 't_d_user', ['created_by'], ['user_id'])
    op.create_foreign_key('fk_nomenclature_managed_by', 't_d_nomenclature', 't_d_user', ['managed_by'], ['user_id'])
    op.create_foreign_key('fk_t_d_article_created_by_t_d_user', 't_d_article', 't_d_user', ['created_by'], ['user_id'])
    op.create_foreign_key('fk_t_d_article_managed_by_t_d_user', 't_d_article', 't_d_user', ['managed_by'], ['user_id'])

    # Step 3: Make user_id nullable again
    print("Making user_id nullable again...")
    op.alter_column('t_d_period', 'user_id', nullable=True)
    op.alter_column('t_d_financial_center', 'user_id', nullable=True)
    op.alter_column('t_d_cost_center', 'user_id', nullable=True)
    op.alter_column('t_d_nomenclature', 'user_id', nullable=True)
    op.alter_column('t_d_article', 'user_id', nullable=True)

    print("WARNING: Original NULL user_id records cannot be restored.")
    print("All previously shared records now belong to the admin user.")
    print("Rollback completed!")
