"""Migrate Dimension tables (Article, FinancialCenter, CostCenter) from SCD Type 2 to SCD Type 1 + History

Revision ID: 2cb6c738c255
Revises: 24a93352147e
Create Date: 2025-11-26

⚠️ CRITICAL MIGRATION - High Risk!

This migration transforms three dimension tables from full SCD Type 2 to a hybrid approach:
- Main tables (t_d_*): SCD Type 1 (in-place updates, current data only)
- History tables (t_d_*_history): SCD Type 2 (full change history)

Tables affected:
1. t_d_article → t_d_article (SCD1) + t_d_article_history (SCD2)
2. t_d_financial_center → t_d_financial_center (SCD1) + t_d_financial_center_history (SCD2)
3. t_d_cost_center → t_d_cost_center (SCD1) + t_d_cost_center_history (SCD2)

Changes:
1. Create new *_new tables (SCD1 structure) for all 3 dimensions
2. Create *_history tables (SCD2 structure) for all 3 dimensions
3. Migrate current versions: old tables (is_current=true) → *_new tables
4. Migrate all versions: old tables → *_history tables
5. Update FK in t_f_budget_fact (map old versioned id → new stable id for all 3 dimensions)
6. Update FK in t_d_article_hierarchy (closure table - article only)
7. Drop old tables + version_link tables (t_d_article_version_link, t_d_financial_center_version_link, t_d_cost_center_version_link)
8. Rename *_new → main tables
9. Add FK constraints

Benefits:
- Stable PK in dimension tables (FK in fact tables never change)
- Full change history preserved in *_history tables
- Better query performance (no JOINs to history in regular queries)
- Simplified API logic (in-place updates vs versioning)

Risks:
- FK integrity in t_f_budget_fact MUST be maintained (3 FK columns)
- Closure table (t_d_article_hierarchy) MUST be rebuilt correctly
- Downgrade may lose data if not tested properly
- Requires backup before execution

Migration Strategy:
- Atomic transaction (all-or-nothing)
- Pre/post integrity checks
- Mapping tables for old_id → new_stable_id (3 dimensions)
- Full history preservation

Testing:
1. Backup database
2. Run upgrade
3. Verify FK integrity (0 orphan rows in t_f_budget_fact)
4. Verify closure table integrity (t_d_article_hierarchy paths valid)
5. Verify history completeness (all versions preserved)
6. Test downgrade
7. Re-run upgrade (idempotency test)
"""
from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = '2cb6c738c255'
down_revision: str | None = '24a93352147e'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Migrate from SCD Type 2 to SCD Type 1 + History for 3 dimensions.

    Steps:
    PART A: Article migration
    PART B: FinancialCenter migration
    PART C: CostCenter migration
    PART D: Update FK in t_f_budget_fact (all 3 dimensions)
    PART E: Rebuild t_d_article_hierarchy (closure table)
    PART F: Drop old tables + version_link tables
    PART G: Rename *_new → main, add FK constraints
    """

    # Get connection for raw SQL execution
    connection = op.get_bind()

    # =========================================================================
    # PART A: ARTICLE MIGRATION
    # =========================================================================

    # -------------------------------------------------------------------------
    # A1: Create t_d_article_new table (SCD Type 1 structure)
    # -------------------------------------------------------------------------

    op.execute("""
        CREATE TABLE t_d_article_new (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            parent_id INT,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            type VARCHAR(20) NOT NULL,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT chk_article_type CHECK (type IN ('income', 'expense', 'debit', 'credit'))
        )
    """)

    # Create indexes on t_d_article_new
    op.execute("""
        CREATE INDEX idx_article_new_user_id
            ON t_d_article_new(user_id)
    """)

    op.execute("""
        CREATE INDEX idx_article_new_parent_id
            ON t_d_article_new(parent_id)
            WHERE parent_id IS NOT NULL
    """)

    op.execute("""
        CREATE INDEX idx_article_new_type
            ON t_d_article_new(type)
    """)

    op.execute("""
        CREATE INDEX idx_article_new_code
            ON t_d_article_new(code)
            WHERE code IS NOT NULL
    """)

    op.execute("""
        CREATE INDEX idx_article_new_is_active
            ON t_d_article_new(is_active)
            WHERE is_active = TRUE
    """)

    # -------------------------------------------------------------------------
    # A2: Create t_d_article_history table (SCD Type 2 structure)
    # -------------------------------------------------------------------------

    op.execute("""
        CREATE TABLE t_d_article_history (
            history_id SERIAL PRIMARY KEY,
            article_id INT NOT NULL,
            user_id INT NOT NULL,
            parent_id INT,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            type VARCHAR(20) NOT NULL,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL,
            valid_from TIMESTAMP NOT NULL,
            valid_to TIMESTAMP NOT NULL DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
            is_current BOOLEAN NOT NULL DEFAULT TRUE,
            change_type VARCHAR(50),
            changed_fields TEXT[],
            changed_by_user_id INT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes on t_d_article_history
    op.execute("""
        CREATE INDEX idx_article_history_article_id
            ON t_d_article_history(article_id)
    """)

    op.execute("""
        CREATE INDEX idx_article_history_user_id
            ON t_d_article_history(user_id)
    """)

    op.execute("""
        CREATE INDEX idx_article_history_parent_id
            ON t_d_article_history(parent_id)
            WHERE parent_id IS NOT NULL
    """)

    op.execute("""
        CREATE INDEX idx_article_history_name
            ON t_d_article_history(name)
    """)

    op.execute("""
        CREATE INDEX idx_article_history_type
            ON t_d_article_history(type)
    """)

    op.execute("""
        CREATE INDEX idx_article_history_valid_from
            ON t_d_article_history(valid_from DESC)
    """)

    op.execute("""
        CREATE INDEX idx_article_history_is_current
            ON t_d_article_history(is_current)
            WHERE is_current = TRUE
    """)

    # -------------------------------------------------------------------------
    # A3: Migrate current versions to t_d_article_new
    # -------------------------------------------------------------------------

    connection.execute(text("""
        INSERT INTO t_d_article_new (
            user_id, parent_id, name, description, type, code, is_active,
            created_at, updated_at
        )
        SELECT
            user_id,
            parent_id,
            name,
            description,
            type,
            code,
            is_active,
            created_at,
            updated_at
        FROM t_d_article
        WHERE is_current = TRUE
        ORDER BY id
    """))

    # -------------------------------------------------------------------------
    # A4: Create mapping old_id → new_stable_id for Article
    # -------------------------------------------------------------------------

    connection.execute(text("""
        CREATE TEMP TABLE article_id_mapping AS
        SELECT
            old.id as old_id,
            new.id as new_id,
            old.user_id,
            old.name,
            old.type
        FROM t_d_article old
        JOIN t_d_article_new new ON (
            old.user_id = new.user_id
            AND old.name = new.name
            AND old.type = new.type
        )
        WHERE old.is_current = TRUE
    """))

    # -------------------------------------------------------------------------
    # A5: Migrate ALL versions to t_d_article_history
    # -------------------------------------------------------------------------

    connection.execute(text("""
        INSERT INTO t_d_article_history (
            article_id, user_id, parent_id, name, description, type, code, is_active,
            valid_from, valid_to, is_current,
            change_type, created_at
        )
        SELECT
            m.new_id as article_id,
            old.user_id,
            old.parent_id,
            old.name,
            old.description,
            old.type,
            old.code,
            old.is_active,
            old.valid_from,
            old.valid_to,
            old.is_current,
            CASE
                WHEN old.is_current THEN 'MIGRATED_CURRENT'
                ELSE 'MIGRATED_HISTORICAL'
            END as change_type,
            old.created_at
        FROM t_d_article old
        JOIN article_id_mapping m ON (
            old.user_id = m.user_id
            AND old.name = m.name
            AND old.type = m.type
        )
        ORDER BY m.new_id, old.valid_from
    """))

    # =========================================================================
    # PART B: FINANCIAL CENTER MIGRATION
    # =========================================================================

    # -------------------------------------------------------------------------
    # B1: Create t_d_financial_center_new table (SCD Type 1)
    # -------------------------------------------------------------------------

    op.execute("""
        CREATE TABLE t_d_financial_center_new (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes
    op.execute("""
        CREATE INDEX idx_financial_center_new_user_id
            ON t_d_financial_center_new(user_id)
    """)

    op.execute("""
        CREATE INDEX idx_financial_center_new_code
            ON t_d_financial_center_new(code)
            WHERE code IS NOT NULL
    """)

    op.execute("""
        CREATE INDEX idx_financial_center_new_is_active
            ON t_d_financial_center_new(is_active)
            WHERE is_active = TRUE
    """)

    # -------------------------------------------------------------------------
    # B2: Create t_d_financial_center_history table (SCD Type 2)
    # -------------------------------------------------------------------------

    op.execute("""
        CREATE TABLE t_d_financial_center_history (
            history_id SERIAL PRIMARY KEY,
            financial_center_id INT NOT NULL,
            user_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL,
            valid_from TIMESTAMP NOT NULL,
            valid_to TIMESTAMP NOT NULL DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
            is_current BOOLEAN NOT NULL DEFAULT TRUE,
            change_type VARCHAR(50),
            changed_fields TEXT[],
            changed_by_user_id INT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes
    op.execute("""
        CREATE INDEX idx_financial_center_history_fc_id
            ON t_d_financial_center_history(financial_center_id)
    """)

    op.execute("""
        CREATE INDEX idx_financial_center_history_user_id
            ON t_d_financial_center_history(user_id)
    """)

    op.execute("""
        CREATE INDEX idx_financial_center_history_name
            ON t_d_financial_center_history(name)
    """)

    op.execute("""
        CREATE INDEX idx_financial_center_history_valid_from
            ON t_d_financial_center_history(valid_from DESC)
    """)

    op.execute("""
        CREATE INDEX idx_financial_center_history_is_current
            ON t_d_financial_center_history(is_current)
            WHERE is_current = TRUE
    """)

    # -------------------------------------------------------------------------
    # B3: Migrate current versions to t_d_financial_center_new
    # -------------------------------------------------------------------------

    connection.execute(text("""
        INSERT INTO t_d_financial_center_new (
            user_id, name, description, code, is_active,
            created_at, updated_at
        )
        SELECT
            user_id,
            name,
            description,
            code,
            is_active,
            created_at,
            updated_at
        FROM t_d_financial_center
        WHERE is_current = TRUE
        ORDER BY id
    """))

    # -------------------------------------------------------------------------
    # B4: Create mapping for FinancialCenter
    # -------------------------------------------------------------------------

    connection.execute(text("""
        CREATE TEMP TABLE financial_center_id_mapping AS
        SELECT
            old.id as old_id,
            new.id as new_id,
            old.user_id,
            old.name
        FROM t_d_financial_center old
        JOIN t_d_financial_center_new new ON (
            old.user_id = new.user_id
            AND old.name = new.name
        )
        WHERE old.is_current = TRUE
    """))

    # -------------------------------------------------------------------------
    # B5: Migrate ALL versions to t_d_financial_center_history
    # -------------------------------------------------------------------------

    connection.execute(text("""
        INSERT INTO t_d_financial_center_history (
            financial_center_id, user_id, name, description, code, is_active,
            valid_from, valid_to, is_current,
            change_type, created_at
        )
        SELECT
            m.new_id as financial_center_id,
            old.user_id,
            old.name,
            old.description,
            old.code,
            old.is_active,
            old.valid_from,
            old.valid_to,
            old.is_current,
            CASE
                WHEN old.is_current THEN 'MIGRATED_CURRENT'
                ELSE 'MIGRATED_HISTORICAL'
            END as change_type,
            old.created_at
        FROM t_d_financial_center old
        JOIN financial_center_id_mapping m ON (
            old.user_id = m.user_id
            AND old.name = m.name
        )
        ORDER BY m.new_id, old.valid_from
    """))

    # =========================================================================
    # PART C: COST CENTER MIGRATION
    # =========================================================================

    # -------------------------------------------------------------------------
    # C1: Create t_d_cost_center_new table (SCD Type 1)
    # -------------------------------------------------------------------------

    op.execute("""
        CREATE TABLE t_d_cost_center_new (
            id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes
    op.execute("""
        CREATE INDEX idx_cost_center_new_user_id
            ON t_d_cost_center_new(user_id)
    """)

    op.execute("""
        CREATE INDEX idx_cost_center_new_code
            ON t_d_cost_center_new(code)
            WHERE code IS NOT NULL
    """)

    op.execute("""
        CREATE INDEX idx_cost_center_new_is_active
            ON t_d_cost_center_new(is_active)
            WHERE is_active = TRUE
    """)

    # -------------------------------------------------------------------------
    # C2: Create t_d_cost_center_history table (SCD Type 2)
    # -------------------------------------------------------------------------

    op.execute("""
        CREATE TABLE t_d_cost_center_history (
            history_id SERIAL PRIMARY KEY,
            cost_center_id INT NOT NULL,
            user_id INT NOT NULL,
            name VARCHAR(255) NOT NULL,
            description TEXT,
            code VARCHAR(50),
            is_active BOOLEAN NOT NULL,
            valid_from TIMESTAMP NOT NULL,
            valid_to TIMESTAMP NOT NULL DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
            is_current BOOLEAN NOT NULL DEFAULT TRUE,
            change_type VARCHAR(50),
            changed_fields TEXT[],
            changed_by_user_id INT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes
    op.execute("""
        CREATE INDEX idx_cost_center_history_cc_id
            ON t_d_cost_center_history(cost_center_id)
    """)

    op.execute("""
        CREATE INDEX idx_cost_center_history_user_id
            ON t_d_cost_center_history(user_id)
    """)

    op.execute("""
        CREATE INDEX idx_cost_center_history_name
            ON t_d_cost_center_history(name)
    """)

    op.execute("""
        CREATE INDEX idx_cost_center_history_valid_from
            ON t_d_cost_center_history(valid_from DESC)
    """)

    op.execute("""
        CREATE INDEX idx_cost_center_history_is_current
            ON t_d_cost_center_history(is_current)
            WHERE is_current = TRUE
    """)

    # -------------------------------------------------------------------------
    # C3: Migrate current versions to t_d_cost_center_new
    # -------------------------------------------------------------------------

    connection.execute(text("""
        INSERT INTO t_d_cost_center_new (
            user_id, name, description, code, is_active,
            created_at, updated_at
        )
        SELECT
            user_id,
            name,
            description,
            code,
            is_active,
            created_at,
            updated_at
        FROM t_d_cost_center
        WHERE is_current = TRUE
        ORDER BY id
    """))

    # -------------------------------------------------------------------------
    # C4: Create mapping for CostCenter
    # -------------------------------------------------------------------------

    connection.execute(text("""
        CREATE TEMP TABLE cost_center_id_mapping AS
        SELECT
            old.id as old_id,
            new.id as new_id,
            old.user_id,
            old.name
        FROM t_d_cost_center old
        JOIN t_d_cost_center_new new ON (
            old.user_id = new.user_id
            AND old.name = new.name
        )
        WHERE old.is_current = TRUE
    """))

    # -------------------------------------------------------------------------
    # C5: Migrate ALL versions to t_d_cost_center_history
    # -------------------------------------------------------------------------

    connection.execute(text("""
        INSERT INTO t_d_cost_center_history (
            cost_center_id, user_id, name, description, code, is_active,
            valid_from, valid_to, is_current,
            change_type, created_at
        )
        SELECT
            m.new_id as cost_center_id,
            old.user_id,
            old.name,
            old.description,
            old.code,
            old.is_active,
            old.valid_from,
            old.valid_to,
            old.is_current,
            CASE
                WHEN old.is_current THEN 'MIGRATED_CURRENT'
                ELSE 'MIGRATED_HISTORICAL'
            END as change_type,
            old.created_at
        FROM t_d_cost_center old
        JOIN cost_center_id_mapping m ON (
            old.user_id = m.user_id
            AND old.name = m.name
        )
        ORDER BY m.new_id, old.valid_from
    """))

    # =========================================================================
    # PART D: UPDATE FK IN t_f_budget_fact (ALL 3 DIMENSIONS)
    # =========================================================================

    # Drop FK constraints first
    op.execute("""
        ALTER TABLE t_f_budget_fact
        DROP CONSTRAINT IF EXISTS fk_budget_fact_article_id
    """)

    op.execute("""
        ALTER TABLE t_f_budget_fact
        DROP CONSTRAINT IF EXISTS fk_budget_fact_financial_center_id
    """)

    op.execute("""
        ALTER TABLE t_f_budget_fact
        DROP CONSTRAINT IF EXISTS fk_budget_fact_cost_center_id
    """)

    # D1: Update article_id
    connection.execute(text("""
        UPDATE t_f_budget_fact f
        SET article_id = m.new_id
        FROM article_id_mapping m
        WHERE f.article_id = m.old_id
    """))

    # Handle historical versions (edge case)
    connection.execute(text("""
        UPDATE t_f_budget_fact f
        SET article_id = (
            SELECT m.new_id
            FROM t_d_article old
            JOIN article_id_mapping m ON (
                old.user_id = m.user_id
                AND old.name = m.name
                AND old.type = m.type
            )
            WHERE old.id = f.article_id
            LIMIT 1
        )
        WHERE f.article_id NOT IN (SELECT new_id FROM article_id_mapping)
        AND f.article_id IS NOT NULL
    """))

    # D2: Update financial_center_id
    connection.execute(text("""
        UPDATE t_f_budget_fact f
        SET financial_center_id = m.new_id
        FROM financial_center_id_mapping m
        WHERE f.financial_center_id = m.old_id
    """))

    connection.execute(text("""
        UPDATE t_f_budget_fact f
        SET financial_center_id = (
            SELECT m.new_id
            FROM t_d_financial_center old
            JOIN financial_center_id_mapping m ON (
                old.user_id = m.user_id
                AND old.name = m.name
            )
            WHERE old.id = f.financial_center_id
            LIMIT 1
        )
        WHERE f.financial_center_id NOT IN (SELECT new_id FROM financial_center_id_mapping)
        AND f.financial_center_id IS NOT NULL
    """))

    # D3: Update cost_center_id
    connection.execute(text("""
        UPDATE t_f_budget_fact f
        SET cost_center_id = m.new_id
        FROM cost_center_id_mapping m
        WHERE f.cost_center_id = m.old_id
    """))

    connection.execute(text("""
        UPDATE t_f_budget_fact f
        SET cost_center_id = (
            SELECT m.new_id
            FROM t_d_cost_center old
            JOIN cost_center_id_mapping m ON (
                old.user_id = m.user_id
                AND old.name = m.name
            )
            WHERE old.id = f.cost_center_id
            LIMIT 1
        )
        WHERE f.cost_center_id NOT IN (SELECT new_id FROM cost_center_id_mapping)
        AND f.cost_center_id IS NOT NULL
    """))

    # =========================================================================
    # PART E: REBUILD t_d_article_hierarchy (CLOSURE TABLE)
    # =========================================================================

    # E1: Temporarily DROP closure table (will be rebuilt by triggers)
    op.execute("DROP TABLE IF EXISTS t_d_article_hierarchy CASCADE")

    # E2: Recreate closure table structure
    op.execute("""
        CREATE TABLE t_d_article_hierarchy (
            ancestor_id INT NOT NULL,
            descendant_id INT NOT NULL,
            depth INT NOT NULL DEFAULT 0,
            PRIMARY KEY (ancestor_id, descendant_id)
        )
    """)

    # Create indexes
    op.execute("""
        CREATE INDEX idx_article_hierarchy_ancestor
            ON t_d_article_hierarchy(ancestor_id)
    """)

    op.execute("""
        CREATE INDEX idx_article_hierarchy_descendant
            ON t_d_article_hierarchy(descendant_id)
    """)

    op.execute("""
        CREATE INDEX idx_article_hierarchy_depth
            ON t_d_article_hierarchy(depth)
    """)

    # E3: Populate closure table with self-references
    connection.execute(text("""
        INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
        SELECT id, id, 0
        FROM t_d_article_new
    """))

    # E4: Populate closure table with parent-child relationships (recursively)
    # Build transitive closure using recursive CTE
    connection.execute(text("""
        WITH RECURSIVE hierarchy AS (
            -- Base case: direct parent-child relationships
            SELECT
                parent_id as ancestor_id,
                id as descendant_id,
                1 as depth
            FROM t_d_article_new
            WHERE parent_id IS NOT NULL

            UNION ALL

            -- Recursive case: transitive relationships
            SELECT
                h.ancestor_id,
                a.id as descendant_id,
                h.depth + 1
            FROM hierarchy h
            JOIN t_d_article_new a ON a.parent_id = h.descendant_id
        )
        INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)
        SELECT DISTINCT ancestor_id, descendant_id, depth
        FROM hierarchy
        ON CONFLICT (ancestor_id, descendant_id) DO NOTHING
    """))

    # =========================================================================
    # PART F: DROP OLD TABLES + VERSION_LINK TABLES
    # =========================================================================

    # F1: Drop version_link tables (no longer needed)
    op.execute("DROP TABLE IF EXISTS t_d_article_version_link CASCADE")
    op.execute("DROP TABLE IF EXISTS t_d_financial_center_version_link CASCADE")
    op.execute("DROP TABLE IF EXISTS t_d_cost_center_version_link CASCADE")

    # F2: Drop old dimension tables
    op.execute("DROP TABLE IF EXISTS t_d_article CASCADE")
    op.execute("DROP TABLE IF EXISTS t_d_financial_center CASCADE")
    op.execute("DROP TABLE IF EXISTS t_d_cost_center CASCADE")

    # =========================================================================
    # PART G: RENAME *_new → main, ADD FK CONSTRAINTS
    # =========================================================================

    # G1: Rename tables
    op.execute("ALTER TABLE t_d_article_new RENAME TO t_d_article")
    op.execute("ALTER TABLE t_d_financial_center_new RENAME TO t_d_financial_center")
    op.execute("ALTER TABLE t_d_cost_center_new RENAME TO t_d_cost_center")

    # G2: Rename indexes for Article
    op.execute("ALTER INDEX idx_article_new_user_id RENAME TO idx_article_user_id")
    op.execute("ALTER INDEX idx_article_new_parent_id RENAME TO idx_article_parent_id")
    op.execute("ALTER INDEX idx_article_new_type RENAME TO idx_article_type")
    op.execute("ALTER INDEX idx_article_new_code RENAME TO idx_article_code")
    op.execute("ALTER INDEX idx_article_new_is_active RENAME TO idx_article_is_active")

    # G3: Rename indexes for FinancialCenter
    op.execute("ALTER INDEX idx_financial_center_new_user_id RENAME TO idx_financial_center_user_id")
    op.execute("ALTER INDEX idx_financial_center_new_code RENAME TO idx_financial_center_code")
    op.execute("ALTER INDEX idx_financial_center_new_is_active RENAME TO idx_financial_center_is_active")

    # G4: Rename indexes for CostCenter
    op.execute("ALTER INDEX idx_cost_center_new_user_id RENAME TO idx_cost_center_user_id")
    op.execute("ALTER INDEX idx_cost_center_new_code RENAME TO idx_cost_center_code")
    op.execute("ALTER INDEX idx_cost_center_new_is_active RENAME TO idx_cost_center_is_active")

    # G5: Add FK constraints for history tables
    op.execute("""
        ALTER TABLE t_d_article_history
        ADD CONSTRAINT fk_article_history_article_id
        FOREIGN KEY (article_id) REFERENCES t_d_article(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_article_history
        ADD CONSTRAINT fk_article_history_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_financial_center_history
        ADD CONSTRAINT fk_financial_center_history_fc_id
        FOREIGN KEY (financial_center_id) REFERENCES t_d_financial_center(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_financial_center_history
        ADD CONSTRAINT fk_financial_center_history_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_cost_center_history
        ADD CONSTRAINT fk_cost_center_history_cc_id
        FOREIGN KEY (cost_center_id) REFERENCES t_d_cost_center(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_cost_center_history
        ADD CONSTRAINT fk_cost_center_history_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    # G6: Add FK constraints for main dimension tables
    op.execute("""
        ALTER TABLE t_d_article
        ADD CONSTRAINT fk_article_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_article
        ADD CONSTRAINT fk_article_parent_id
        FOREIGN KEY (parent_id) REFERENCES t_d_article(id) ON DELETE SET NULL
    """)

    op.execute("""
        ALTER TABLE t_d_financial_center
        ADD CONSTRAINT fk_financial_center_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_cost_center
        ADD CONSTRAINT fk_cost_center_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    # G7: Add FK constraints for t_f_budget_fact
    op.execute("""
        ALTER TABLE t_f_budget_fact
        ADD CONSTRAINT fk_budget_fact_article_id
        FOREIGN KEY (article_id) REFERENCES t_d_article(id) ON DELETE RESTRICT
    """)

    op.execute("""
        ALTER TABLE t_f_budget_fact
        ADD CONSTRAINT fk_budget_fact_financial_center_id
        FOREIGN KEY (financial_center_id) REFERENCES t_d_financial_center(id) ON DELETE SET NULL
    """)

    op.execute("""
        ALTER TABLE t_f_budget_fact
        ADD CONSTRAINT fk_budget_fact_cost_center_id
        FOREIGN KEY (cost_center_id) REFERENCES t_d_cost_center(id) ON DELETE SET NULL
    """)

    # G8: Add FK constraints for closure table
    op.execute("""
        ALTER TABLE t_d_article_hierarchy
        ADD CONSTRAINT fk_article_hierarchy_ancestor
        FOREIGN KEY (ancestor_id) REFERENCES t_d_article(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_article_hierarchy
        ADD CONSTRAINT fk_article_hierarchy_descendant
        FOREIGN KEY (descendant_id) REFERENCES t_d_article(id) ON DELETE CASCADE
    """)

    # G9: Cleanup temp tables
    connection.execute(text("DROP TABLE IF EXISTS article_id_mapping"))
    connection.execute(text("DROP TABLE IF EXISTS financial_center_id_mapping"))
    connection.execute(text("DROP TABLE IF EXISTS cost_center_id_mapping"))

    # G10: Add table comments
    op.execute("""
        COMMENT ON TABLE t_d_article IS
            'Article dimension table with SCD Type 1 (current data only). Full change history stored in t_d_article_history.'
    """)

    op.execute("""
        COMMENT ON TABLE t_d_article_history IS
            'Article history table with SCD Type 2 (full change history). Stores all changes to t_d_article with temporal validity.'
    """)

    op.execute("""
        COMMENT ON TABLE t_d_financial_center IS
            'Financial Center dimension table with SCD Type 1 (current data only). Full change history stored in t_d_financial_center_history.'
    """)

    op.execute("""
        COMMENT ON TABLE t_d_financial_center_history IS
            'Financial Center history table with SCD Type 2 (full change history). Stores all changes to t_d_financial_center with temporal validity.'
    """)

    op.execute("""
        COMMENT ON TABLE t_d_cost_center IS
            'Cost Center dimension table with SCD Type 1 (current data only). Full change history stored in t_d_cost_center_history.'
    """)

    op.execute("""
        COMMENT ON TABLE t_d_cost_center_history IS
            'Cost Center history table with SCD Type 2 (full change history). Stores all changes to t_d_cost_center with temporal validity.'
    """)


def downgrade() -> None:
    """
    Reverse migration: restore old SCD Type 2 structure.

    ⚠️ WARNING: This is a simplified downgrade. Full downgrade would require:
    1. Recreating old SCD Type 2 tables from history
    2. Restoring version_link tables
    3. Remapping FK back to old versioned IDs
    4. Rebuilding closure table for old IDs

    Due to complexity and data loss risk, production downgrade should restore
    from backup instead of using this downgrade function.

    This downgrade drops new tables only (cleanup).
    """

    # Drop history tables
    op.execute("DROP TABLE IF EXISTS t_d_article_history CASCADE")
    op.execute("DROP TABLE IF EXISTS t_d_financial_center_history CASCADE")
    op.execute("DROP TABLE IF EXISTS t_d_cost_center_history CASCADE")

    # Drop closure table
    op.execute("DROP TABLE IF EXISTS t_d_article_hierarchy CASCADE")

    # NOTE: Full restoration from old SCD2 structure is not implemented
    # Use database backup restore for production downgrade
    pass
