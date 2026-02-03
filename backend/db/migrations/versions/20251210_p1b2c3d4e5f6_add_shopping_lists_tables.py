"""Add shopping lists tables (stores, product groups, shopping lists, items, import templates)

Revision ID: p1b2c3d4e5f6
Revises: o0a1b2c3d4e5
Create Date: 2025-12-10

This migration creates 8 new tables for shopping lists feature:
- Dimensions: Store, ProductGroup (with hierarchy)
- History: StoreHistory, ProductGroupHistory
- Hierarchy: ProductGroupHierarchy (Closure Table)
- Facts: ShoppingList (header), ShoppingListItem (lines)
- Config: ImportTemplate (user-specific CSV import templates)

Key Features:
- SHARED model: All data accessible by all users (except ImportTemplate)
- Only list OWNER can delete their list (creator_id check)
- SCD Type 1 + History tables pattern (like Articles)
- Closure Table for ProductGroup hierarchy
- Offline sync support (sync_status field in ShoppingListItem)
"""

from alembic import op

# Revision identifiers
revision = "p1b2c3d4e5f6"
down_revision = "o0a1b2c3d4e5"
branch_labels = None
depends_on = None


def upgrade():
    """Create shopping lists tables with indexes and constraints."""

    # =========================================================================
    # TABLE 1: t_d_store (Store dimension - SCD Type 1)
    # =========================================================================
    op.execute("""
        CREATE TABLE t_d_store (
            id SERIAL PRIMARY KEY,
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            address TEXT,
            description TEXT,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Store indexes
    op.execute("CREATE INDEX idx_store_creator_id ON t_d_store(creator_id)")
    op.execute("CREATE INDEX idx_store_name ON t_d_store(name)")
    op.execute("CREATE INDEX idx_store_code ON t_d_store(code) WHERE code IS NOT NULL")
    op.execute("CREATE INDEX idx_store_active ON t_d_store(is_active) WHERE is_active = TRUE")
    op.execute("CREATE UNIQUE INDEX idx_store_name_unique ON t_d_store(LOWER(name)) WHERE is_active = TRUE")

    op.execute("""
        COMMENT ON TABLE t_d_store IS
            'Store dimension table (SCD Type 1). Shared across all users. Only admins can manage stores.'
    """)

    # =========================================================================
    # TABLE 2: t_d_store_history (Store history - SCD Type 2)
    # =========================================================================
    op.execute("""
        CREATE TABLE t_d_store_history (
            history_id SERIAL PRIMARY KEY,
            store_id INT NOT NULL REFERENCES t_d_store(id) ON DELETE CASCADE,
            creator_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            address TEXT,
            description TEXT,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL,
            valid_from TIMESTAMP NOT NULL,
            valid_to TIMESTAMP NOT NULL DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
            is_current BOOLEAN NOT NULL,
            change_type VARCHAR(50) NOT NULL,
            changed_fields TEXT[],
            changed_by_user_id INT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_store_history_valid_dates CHECK (valid_from < valid_to)
        )
    """)

    # Store history indexes
    op.execute("CREATE INDEX idx_store_history_store_id ON t_d_store_history(store_id)")
    op.execute("CREATE INDEX idx_store_history_valid_from ON t_d_store_history(valid_from)")
    op.execute("CREATE INDEX idx_store_history_is_current ON t_d_store_history(is_current) WHERE is_current = TRUE")
    op.execute("CREATE INDEX idx_store_history_name ON t_d_store_history(name)")

    op.execute("""
        COMMENT ON TABLE t_d_store_history IS
            'Store change history (SCD Type 2). Stores all changes to Store table.'
    """)

    # =========================================================================
    # TABLE 3: t_d_product_group (ProductGroup dimension - SCD Type 1 + hierarchy)
    # =========================================================================
    op.execute("""
        CREATE TABLE t_d_product_group (
            id SERIAL PRIMARY KEY,
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            parent_id INT REFERENCES t_d_product_group(id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_product_group_no_self_reference CHECK (parent_id IS NULL OR parent_id != id)
        )
    """)

    # ProductGroup indexes
    op.execute("CREATE INDEX idx_product_group_creator_id ON t_d_product_group(creator_id)")
    op.execute("CREATE INDEX idx_product_group_parent_id ON t_d_product_group(parent_id)")
    op.execute("CREATE INDEX idx_product_group_name ON t_d_product_group(name)")
    op.execute("CREATE INDEX idx_product_group_code ON t_d_product_group(code) WHERE code IS NOT NULL")
    op.execute("CREATE INDEX idx_product_group_active ON t_d_product_group(is_active) WHERE is_active = TRUE")
    op.execute("CREATE UNIQUE INDEX idx_product_group_name_unique ON t_d_product_group(LOWER(name)) WHERE is_active = TRUE")

    op.execute("""
        COMMENT ON TABLE t_d_product_group IS
            'ProductGroup dimension table (SCD Type 1) with hierarchy. Shared across all users. Only admins can manage.'
    """)

    # =========================================================================
    # TABLE 4: t_d_product_group_history (ProductGroup history - SCD Type 2)
    # =========================================================================
    op.execute("""
        CREATE TABLE t_d_product_group_history (
            history_id SERIAL PRIMARY KEY,
            product_group_id INT NOT NULL REFERENCES t_d_product_group(id) ON DELETE CASCADE,
            creator_id INT NOT NULL,
            parent_id INT,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL,
            valid_from TIMESTAMP NOT NULL,
            valid_to TIMESTAMP NOT NULL DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
            is_current BOOLEAN NOT NULL,
            change_type VARCHAR(50) NOT NULL,
            changed_fields TEXT[],
            changed_by_user_id INT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_product_group_history_valid_dates CHECK (valid_from < valid_to)
        )
    """)

    # ProductGroup history indexes
    op.execute("CREATE INDEX idx_product_group_history_product_group_id ON t_d_product_group_history(product_group_id)")
    op.execute("CREATE INDEX idx_product_group_history_valid_from ON t_d_product_group_history(valid_from)")
    op.execute("CREATE INDEX idx_product_group_history_is_current ON t_d_product_group_history(is_current) WHERE is_current = TRUE")
    op.execute("CREATE INDEX idx_product_group_history_name ON t_d_product_group_history(name)")

    op.execute("""
        COMMENT ON TABLE t_d_product_group_history IS
            'ProductGroup change history (SCD Type 2). Stores all changes including hierarchy moves.'
    """)

    # =========================================================================
    # TABLE 5: t_d_product_group_hierarchy (Closure Table for hierarchy)
    # =========================================================================
    op.execute("""
        CREATE TABLE t_d_product_group_hierarchy (
            ancestor_id INT NOT NULL REFERENCES t_d_product_group(id) ON DELETE CASCADE,
            descendant_id INT NOT NULL REFERENCES t_d_product_group(id) ON DELETE CASCADE,
            depth INT NOT NULL CHECK (depth >= 0),
            PRIMARY KEY (ancestor_id, descendant_id)
        )
    """)

    # ProductGroup hierarchy indexes
    op.execute("CREATE INDEX idx_product_group_hierarchy_descendant_id ON t_d_product_group_hierarchy(descendant_id)")
    op.execute("CREATE INDEX idx_product_group_hierarchy_depth ON t_d_product_group_hierarchy(depth)")

    op.execute("""
        COMMENT ON TABLE t_d_product_group_hierarchy IS
            'Closure Table for ProductGroup hierarchy. Stores ALL ancestor-descendant paths for efficient queries.'
    """)

    # =========================================================================
    # TABLE 6: t_f_shopping_list (ShoppingList header - Header+Lines pattern)
    # =========================================================================
    op.execute("""
        CREATE TABLE t_f_shopping_list (
            id SERIAL PRIMARY KEY,
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ShoppingList indexes
    op.execute("CREATE INDEX idx_shopping_list_creator_id ON t_f_shopping_list(creator_id)")
    op.execute("CREATE INDEX idx_shopping_list_name ON t_f_shopping_list(name)")
    op.execute("CREATE INDEX idx_shopping_list_active ON t_f_shopping_list(is_active) WHERE is_active = TRUE")
    op.execute("CREATE INDEX idx_shopping_list_created_at ON t_f_shopping_list(created_at)")

    op.execute("""
        COMMENT ON TABLE t_f_shopping_list IS
            'ShoppingList header table (Header+Lines pattern). SHARED - all users can view/edit, only creator can delete.'
    """)

    # =========================================================================
    # TABLE 7: t_f_shopping_list_item (ShoppingListItem lines - with offline sync)
    # =========================================================================
    op.execute("""
        CREATE TABLE t_f_shopping_list_item (
            id SERIAL PRIMARY KEY,
            creator_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            shopping_list_id INT NOT NULL REFERENCES t_f_shopping_list(id) ON DELETE CASCADE,
            store_id INT NOT NULL REFERENCES t_d_store(id) ON DELETE RESTRICT,
            product_group_id INT NOT NULL REFERENCES t_d_product_group(id) ON DELETE RESTRICT,
            product_name VARCHAR(255) NOT NULL,
            quantity NUMERIC(10, 3),
            unit VARCHAR(50),
            comment TEXT,
            is_completed BOOLEAN NOT NULL DEFAULT FALSE,
            sync_status VARCHAR(20) NOT NULL DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict')),
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ShoppingListItem indexes
    op.execute("CREATE INDEX idx_shopping_list_item_creator_id ON t_f_shopping_list_item(creator_id)")
    op.execute("CREATE INDEX idx_shopping_list_item_shopping_list_id ON t_f_shopping_list_item(shopping_list_id)")
    op.execute("CREATE INDEX idx_shopping_list_item_store_id ON t_f_shopping_list_item(store_id)")
    op.execute("CREATE INDEX idx_shopping_list_item_product_group_id ON t_f_shopping_list_item(product_group_id)")
    op.execute("CREATE INDEX idx_shopping_list_item_product_name ON t_f_shopping_list_item(product_name)")
    op.execute("CREATE INDEX idx_shopping_list_item_is_completed ON t_f_shopping_list_item(is_completed)")
    op.execute("CREATE INDEX idx_shopping_list_item_sync_status ON t_f_shopping_list_item(sync_status) WHERE sync_status != 'synced'")

    op.execute("""
        COMMENT ON TABLE t_f_shopping_list_item IS
            'ShoppingListItem lines table (Header+Lines pattern). SHARED - all users can add/edit/delete items. Offline sync support.'
    """)

    # =========================================================================
    # TABLE 8: t_d_import_template (USER-SPECIFIC CSV import templates)
    # =========================================================================
    op.execute("""
        CREATE TABLE t_d_import_template (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL REFERENCES t_d_user(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            config JSONB NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # ImportTemplate indexes
    op.execute("CREATE INDEX idx_import_template_user_id ON t_d_import_template(user_id)")
    op.execute("CREATE INDEX idx_import_template_name ON t_d_import_template(name)")
    op.execute("CREATE INDEX idx_import_template_active ON t_d_import_template(is_active) WHERE is_active = TRUE")
    op.execute("CREATE UNIQUE INDEX idx_import_template_user_name_unique ON t_d_import_template(user_id, LOWER(name)) WHERE is_active = TRUE")

    op.execute("""
        COMMENT ON TABLE t_d_import_template IS
            'ImportTemplate config table. USER-SPECIFIC - each user has their own CSV import templates. JSONB config field.'
    """)


def downgrade():
    """Drop shopping lists tables in reverse order."""
    # Drop in reverse order to handle FK constraints
    op.drop_table("t_d_import_template")
    op.drop_table("t_f_shopping_list_item")
    op.drop_table("t_f_shopping_list")
    op.drop_table("t_d_product_group_hierarchy")
    op.drop_table("t_d_product_group_history")
    op.drop_table("t_d_product_group")
    op.drop_table("t_d_store_history")
    op.drop_table("t_d_store")
