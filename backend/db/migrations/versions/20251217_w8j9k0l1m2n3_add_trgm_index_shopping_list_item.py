"""Add pg_trgm GIN index for shopping list item product_name search

Revision ID: w8j9k0l1m2n3
Revises: v7h8i9j0k1l2
Create Date: 2025-12-17

This migration adds a GIN trigram index on the product_name column
of t_f_shopping_list_item for fuzzy, case-insensitive search.

Background:
- Product autocomplete needs to find products regardless of case
- Russian text with ILIKE can have collation issues
- Trigram search provides fuzzy matching (finds "молоко" with query "мол")

Index details:
- Uses pg_trgm extension (already installed in migration 20251111)
- GIN index on LOWER(product_name) for case-insensitive search
- gin_trgm_ops operator class for trigram similarity queries

Query pattern:
```sql
SELECT product_name, similarity(LOWER(product_name), 'мол')
FROM t_f_shopping_list_item
WHERE similarity(LOWER(product_name), 'мол') > 0.3
ORDER BY similarity(LOWER(product_name), 'мол') DESC;
```
"""

from alembic import op

# revision identifiers
revision = 'w8j9k0l1m2n3'
down_revision = 'v7h8i9j0k1l2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Add GIN trigram index on LOWER(product_name) for case-insensitive fuzzy search.

    pg_trgm extension is already installed (migration 20251111_c9f2a8b4e1d6).
    """
    # Create GIN index on LOWER(product_name) for case-insensitive trigram search
    # gin_trgm_ops: specialized operator class for trigram operations
    # This index speeds up similarity() queries with LOWER() function
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_shopping_list_item_product_name_trgm
        ON t_f_shopping_list_item
        USING gin (LOWER(product_name) gin_trgm_ops);
    """)


def downgrade() -> None:
    """
    Remove GIN trigram index from product_name column.

    Note: pg_trgm extension is NOT dropped (used by other features).
    """
    op.execute("DROP INDEX IF EXISTS idx_shopping_list_item_product_name_trgm;")
