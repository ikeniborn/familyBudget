"""
Alembic Migration Template - Production-Safe Pattern
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'YYYYMMDD_hash'
down_revision = 'previous_hash'

def upgrade() -> None:
    # Step 1: Add column as nullable (safe)
    op.add_column('table_name', sa.Column('new_column', sa.String(255), nullable=True))
    
    # Step 2: Backfill data (if needed)
    op.execute("UPDATE table_name SET new_column = 'default' WHERE new_column IS NULL")
    
    # Step 3: Add NOT NULL constraint (after backfill)
    op.alter_column('table_name', 'new_column', nullable=False)
    
    # Step 4: Create index (concurrent on PostgreSQL)
    op.create_index('ix_table_new_column', 'table_name', ['new_column'], unique=False)

def downgrade() -> None:
    op.drop_index('ix_table_new_column')
    op.drop_column('table_name', 'new_column')
