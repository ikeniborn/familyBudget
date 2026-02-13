"""Add pg_trgm extension and GIN index for description search

Revision ID: c9f2a8b4e1d6
Revises: e874781f91d3
Create Date: 2025-11-11 23:00:00
"""

from alembic import op

# revision identifiers
revision = 'c9f2a8b4e1d6'
down_revision = 'e874781f91d3'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add pg_trgm extension and create GIN index for trigram search.

    This enables fast substring search on the description field in t_f_budget_fact table.
    Trigram search is more flexible than ILIKE '%search%' and performs better
    on large tables thanks to GIN indexing.

    Performance benefits:
    - ILIKE '%search%': Sequential scan, O(n) complexity
    - pg_trgm with GIN: Index scan, O(log n) complexity
    - Supports fuzzy matching for typos
    """

    # Create pg_trgm extension if not exists
    # This extension provides trigram similarity operators and GIN index support
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")

    # Create GIN index on description column for trigram search
    # gin_trgm_ops: specialized operator class for trigram operations
    # This index speeds up similarity queries (% operator) and ILIKE with wildcards
    op.execute("""
        CREATE INDEX idx_budget_fact_description_trgm
        ON t_f_budget_fact
        USING gin (description gin_trgm_ops);
    """)


def downgrade() -> None:
    """
    Remove GIN trigram index from description column.

    ⚠️ WARNING: This will revert to slower sequential scans for description search.
    The pg_trgm extension is NOT dropped during downgrade as it may be used
    by other tables or features.
    """

    # Drop GIN trigram index
    op.execute("DROP INDEX IF EXISTS idx_budget_fact_description_trgm;")

    # Note: We do NOT drop pg_trgm extension here to avoid breaking other
    # potential uses of the extension in the database.
    # Extension can be manually dropped if needed: DROP EXTENSION IF EXISTS pg_trgm;
