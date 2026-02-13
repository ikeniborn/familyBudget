"""Add content_hash and sync_hash for offline sync deduplication

Revision ID: v7h8i9j0k1l2
Revises: u6g7h8i9j0k1
Create Date: 2025-12-14

This migration adds content_hash and sync_hash columns to support
deduplication of records during offline synchronization.

Background:
- When user clicks "Sync" button multiple times, repeated POST requests
  create duplicate records on server
- Frontend generates MD5 hash of transaction content in IndexedDB
- Backend needs to check for duplicates before creating new records

Hash Generation:
1. content_hash = MD5(article_id|amount|fact_date|description|record_type)
   - Identifies same transaction content
   - Used for duplicate detection across all users (Shared Family Budget)

2. sync_hash = MD5(content_hash|user_id|created_date)
   - Uniquely identifies offline sync operation within a day
   - Prevents duplicate creation from repeated sync attempts
   - Same transaction next day = different sync_hash (legitimate duplicate)

Affected tables:
- t_f_budget_fact - main fact table (adds content_hash, sync_hash)
- t_f_budget_fact_history - SCD Type 2 history (adds content_hash, sync_hash)

Column details:
- content_hash: VARCHAR(32) NULL - MD5 hash of transaction content
- sync_hash: VARCHAR(32) NULL - MD5 hash for sync deduplication
- Both columns nullable (existing records don't have hashes)
- Only offline sync records (is_offline_sync=true) will have hashes

Indexes:
- idx_budget_fact_content_hash - speeds up duplicate lookups
- idx_budget_fact_sync_hash - speeds up sync deduplication
- idx_budget_fact_sync_dedup - composite index for dedup queries

API Changes:
- create_fact endpoint checks sync_hash when is_offline_sync=true
- If duplicate found within 24 hours, returns existing record (idempotent)
- Frontend sends content_hash and sync_hash during offline sync
"""

import sqlalchemy as sa
from alembic import op

# Revision identifiers
revision = 'v7h8i9j0k1l2'
down_revision = 'u6g7h8i9j0k1'
branch_labels = None
depends_on = None


def upgrade():
    """Add content_hash and sync_hash columns with indexes."""

    # Add columns to main fact table
    op.add_column(
        't_f_budget_fact',
        sa.Column('content_hash', sa.String(32), nullable=True,
                  comment='MD5 hash of content (article_id|amount|fact_date|description|record_type)')
    )

    op.add_column(
        't_f_budget_fact',
        sa.Column('sync_hash', sa.String(32), nullable=True,
                  comment='MD5 hash for offline sync deduplication (content_hash|user_id|created_date)')
    )

    # Add columns to history table
    op.add_column(
        't_f_budget_fact_history',
        sa.Column('content_hash', sa.String(32), nullable=True,
                  comment='MD5 hash of content')
    )

    op.add_column(
        't_f_budget_fact_history',
        sa.Column('sync_hash', sa.String(32), nullable=True,
                  comment='MD5 hash for sync deduplication')
    )

    # Create indexes on main fact table
    op.create_index(
        'idx_budget_fact_content_hash',
        't_f_budget_fact',
        ['content_hash'],
        unique=False
    )

    op.create_index(
        'idx_budget_fact_sync_hash',
        't_f_budget_fact',
        ['sync_hash'],
        unique=False  # NOT unique - same transaction can be created next day
    )

    # Composite index for efficient deduplication queries
    # Backend query: WHERE sync_hash=X AND is_offline_sync=true AND created_at > NOW() - INTERVAL '24 hours'
    op.create_index(
        'idx_budget_fact_sync_dedup',
        't_f_budget_fact',
        ['sync_hash', 'created_at', 'is_offline_sync'],
        unique=False
    )

    # Create indexes on history table (for completeness)
    op.create_index(
        'idx_budget_fact_history_content_hash',
        't_f_budget_fact_history',
        ['content_hash'],
        unique=False
    )

    op.create_index(
        'idx_budget_fact_history_sync_hash',
        't_f_budget_fact_history',
        ['sync_hash'],
        unique=False
    )


def downgrade():
    """Remove content_hash and sync_hash columns and indexes."""

    # Drop indexes from history table
    op.drop_index('idx_budget_fact_history_sync_hash', table_name='t_f_budget_fact_history')
    op.drop_index('idx_budget_fact_history_content_hash', table_name='t_f_budget_fact_history')

    # Drop indexes from main table
    op.drop_index('idx_budget_fact_sync_dedup', table_name='t_f_budget_fact')
    op.drop_index('idx_budget_fact_sync_hash', table_name='t_f_budget_fact')
    op.drop_index('idx_budget_fact_content_hash', table_name='t_f_budget_fact')

    # Drop columns from history table
    op.drop_column('t_f_budget_fact_history', 'sync_hash')
    op.drop_column('t_f_budget_fact_history', 'content_hash')

    # Drop columns from main table
    op.drop_column('t_f_budget_fact', 'sync_hash')
    op.drop_column('t_f_budget_fact', 'content_hash')
