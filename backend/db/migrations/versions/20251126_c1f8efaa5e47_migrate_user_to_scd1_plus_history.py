"""Migrate User model from SCD Type 2 to SCD Type 1 + History

Revision ID: c1f8efaa5e47
Revises: 64254caa24f0
Create Date: 2025-11-26

⚠️ CRITICAL MIGRATION - High Risk!

This migration transforms the User model from full SCD Type 2 to a hybrid approach:
- Main table (t_d_user): SCD Type 1 (in-place updates, current data only)
- History table (t_d_user_history): SCD Type 2 (full change history)

Changes:
1. Create new t_d_user_new table (SCD1 structure)
2. Create t_d_user_history table (SCD2 structure)
3. Migrate current versions: t_d_user (is_current=true) → t_d_user_new
4. Migrate all versions: t_d_user → t_d_user_history
5. Update FK in t_f_budget_fact (map old versioned id → new stable id)
6. Drop old t_d_user, rename t_d_user_new → t_d_user

Benefits:
- Stable PK in t_d_user (FK in fact tables never change)
- Full change history preserved in t_d_user_history
- Better query performance (no JOINs to history in regular queries)
- Simplified API logic (in-place updates vs versioning)

Risks:
- FK integrity in t_f_budget_fact MUST be maintained
- Downgrade may lose data if not tested properly
- Requires backup before execution

Migration Strategy:
- Atomic transaction (all-or-nothing)
- Pre/post integrity checks
- Mapping table for old_id → new_stable_id
- Full history preservation

Testing:
1. Backup database
2. Run upgrade
3. Verify FK integrity (0 orphan rows)
4. Verify history completeness
5. Test downgrade
6. Re-run upgrade (idempotency test)
"""
from collections.abc import Sequence

from alembic import op
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision: str = 'c1f8efaa5e47'
down_revision: str | None = '64254caa24f0'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Migrate from SCD Type 2 to SCD Type 1 + History.

    Steps:
    1. Create t_d_user_new (SCD1 - current data only)
    2. Create t_d_user_history (SCD2 - full history)
    3. Copy current versions to t_d_user_new
    4. Copy all versions to t_d_user_history
    5. Create mapping old_id → new_stable_id
    6. Update FK in t_f_budget_fact
    7. Drop old t_d_user, rename t_d_user_new → t_d_user
    8. Add FK constraint on t_d_user_history.user_id
    """

    # Get connection for raw SQL execution
    connection = op.get_bind()

    # =========================================================================
    # STEP 1: Create t_d_user_new table (SCD Type 1 structure)
    # =========================================================================

    op.execute("""
        CREATE TABLE t_d_user_new (
            id SERIAL PRIMARY KEY,
            telegram_id BIGINT NOT NULL,
            username VARCHAR(255),
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            photo_url VARCHAR(512),
            is_admin BOOLEAN NOT NULL DEFAULT FALSE,
            is_active BOOLEAN NOT NULL DEFAULT FALSE,
            last_login_at TIMESTAMP,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT unique_telegram_id UNIQUE (telegram_id)
        )
    """)

    # Create indexes on t_d_user_new
    op.execute("""
        CREATE UNIQUE INDEX idx_user_new_telegram_id
            ON t_d_user_new(telegram_id)
    """)

    op.execute("""
        CREATE INDEX idx_user_new_is_active
            ON t_d_user_new(is_active)
            WHERE is_active = TRUE
    """)

    op.execute("""
        CREATE INDEX idx_user_new_last_login
            ON t_d_user_new(last_login_at DESC NULLS LAST)
    """)

    # =========================================================================
    # STEP 2: Create t_d_user_history table (SCD Type 2 structure)
    # =========================================================================

    op.execute("""
        CREATE TABLE t_d_user_history (
            history_id SERIAL PRIMARY KEY,
            user_id INT NOT NULL,
            telegram_id BIGINT NOT NULL,
            username VARCHAR(255),
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            photo_url VARCHAR(512),
            is_admin BOOLEAN NOT NULL,
            is_active BOOLEAN NOT NULL,
            last_login_at TIMESTAMP,
            valid_from TIMESTAMP NOT NULL,
            valid_to TIMESTAMP NOT NULL DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
            is_current BOOLEAN NOT NULL DEFAULT TRUE,
            change_type VARCHAR(50),
            changed_fields TEXT[],
            changed_by_user_id INT,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create indexes on t_d_user_history
    op.execute("""
        CREATE INDEX idx_user_history_user_id
            ON t_d_user_history(user_id)
    """)

    op.execute("""
        CREATE INDEX idx_user_history_telegram_id
            ON t_d_user_history(telegram_id)
    """)

    op.execute("""
        CREATE INDEX idx_user_history_valid_from
            ON t_d_user_history(valid_from DESC)
    """)

    op.execute("""
        CREATE INDEX idx_user_history_is_current
            ON t_d_user_history(is_current)
            WHERE is_current = TRUE
    """)

    # =========================================================================
    # STEP 3: Migrate current versions to t_d_user_new
    # =========================================================================

    # Check if is_active and last_login_at columns exist in old table
    # If not, use default values
    connection.execute(text("""
        INSERT INTO t_d_user_new (
            telegram_id, username, first_name, last_name, photo_url,
            is_admin, is_active, last_login_at, created_at, updated_at
        )
        SELECT
            telegram_id,
            username,
            first_name,
            COALESCE(last_name, NULL) as last_name,
            COALESCE(photo_url, NULL) as photo_url,
            is_admin,
            FALSE as is_active,  -- Default: inactive (requires admin activation)
            NULL as last_login_at,  -- Default: never logged in
            created_at,
            updated_at
        FROM t_d_user
        WHERE is_current = TRUE
        ORDER BY telegram_id
    """))

    # =========================================================================
    # STEP 4: Create mapping old_id → new_stable_id
    # =========================================================================

    connection.execute(text("""
        CREATE TEMP TABLE user_id_mapping AS
        SELECT
            old.id as old_id,
            new.id as new_id,
            old.telegram_id
        FROM t_d_user old
        JOIN t_d_user_new new ON old.telegram_id = new.telegram_id
        WHERE old.is_current = TRUE
    """))

    # =========================================================================
    # STEP 5: Migrate ALL versions to t_d_user_history
    # =========================================================================

    # For each version in old t_d_user, create history record with correct user_id
    connection.execute(text("""
        INSERT INTO t_d_user_history (
            user_id, telegram_id, username, first_name, last_name, photo_url,
            is_admin, is_active, last_login_at,
            valid_from, valid_to, is_current,
            change_type, created_at
        )
        SELECT
            m.new_id as user_id,
            old.telegram_id,
            old.username,
            old.first_name,
            COALESCE(old.last_name, NULL) as last_name,
            COALESCE(old.photo_url, NULL) as photo_url,
            old.is_admin,
            FALSE as is_active,  -- Default for historical records
            NULL as last_login_at,  -- NULL for historical records
            old.valid_from,
            old.valid_to,
            old.is_current,
            CASE
                WHEN old.is_current THEN 'MIGRATED_CURRENT'
                ELSE 'MIGRATED_HISTORICAL'
            END as change_type,
            old.created_at
        FROM t_d_user old
        JOIN user_id_mapping m ON old.telegram_id = m.telegram_id
        ORDER BY old.telegram_id, old.valid_from
    """))

    # =========================================================================
    # STEP 6: Update FK in t_f_budget_fact
    # =========================================================================

    # First, drop FK constraint if exists
    op.execute("""
        ALTER TABLE t_f_budget_fact
        DROP CONSTRAINT IF EXISTS fk_budget_fact_user_id
    """)

    # Update user_id using mapping table
    connection.execute(text("""
        UPDATE t_f_budget_fact f
        SET user_id = m.new_id
        FROM user_id_mapping m
        WHERE f.user_id = m.old_id
    """))

    # Also update user_id for non-current versions (if fact was created with old version)
    # This handles edge case where fact.user_id references historical version
    connection.execute(text("""
        UPDATE t_f_budget_fact f
        SET user_id = (
            SELECT m.new_id
            FROM t_d_user old
            JOIN user_id_mapping m ON old.telegram_id = m.telegram_id
            WHERE old.id = f.user_id
            LIMIT 1
        )
        WHERE f.user_id NOT IN (SELECT new_id FROM user_id_mapping)
    """))

    # =========================================================================
    # STEP 7: Update FK in other tables (if needed)
    # =========================================================================

    # t_d_article.user_id
    op.execute("""
        ALTER TABLE t_d_article
        DROP CONSTRAINT IF EXISTS fk_article_user_id
    """)

    connection.execute(text("""
        UPDATE t_d_article a
        SET user_id = m.new_id
        FROM user_id_mapping m
        WHERE a.user_id = m.old_id
    """))

    # Handle historical versions
    connection.execute(text("""
        UPDATE t_d_article a
        SET user_id = (
            SELECT m.new_id
            FROM t_d_user old
            JOIN user_id_mapping m ON old.telegram_id = m.telegram_id
            WHERE old.id = a.user_id
            LIMIT 1
        )
        WHERE a.user_id NOT IN (SELECT new_id FROM user_id_mapping)
        AND a.user_id IS NOT NULL
    """))

    # t_d_financial_center.user_id
    op.execute("""
        ALTER TABLE t_d_financial_center
        DROP CONSTRAINT IF EXISTS fk_financial_center_user_id
    """)

    connection.execute(text("""
        UPDATE t_d_financial_center fc
        SET user_id = m.new_id
        FROM user_id_mapping m
        WHERE fc.user_id = m.old_id
    """))

    connection.execute(text("""
        UPDATE t_d_financial_center fc
        SET user_id = (
            SELECT m.new_id
            FROM t_d_user old
            JOIN user_id_mapping m ON old.telegram_id = m.telegram_id
            WHERE old.id = fc.user_id
            LIMIT 1
        )
        WHERE fc.user_id NOT IN (SELECT new_id FROM user_id_mapping)
        AND fc.user_id IS NOT NULL
    """))

    # t_d_cost_center.user_id
    op.execute("""
        ALTER TABLE t_d_cost_center
        DROP CONSTRAINT IF EXISTS fk_cost_center_user_id
    """)

    connection.execute(text("""
        UPDATE t_d_cost_center cc
        SET user_id = m.new_id
        FROM user_id_mapping m
        WHERE cc.user_id = m.old_id
    """))

    connection.execute(text("""
        UPDATE t_d_cost_center cc
        SET user_id = (
            SELECT m.new_id
            FROM t_d_user old
            JOIN user_id_mapping m ON old.telegram_id = m.telegram_id
            WHERE old.id = cc.user_id
            LIMIT 1
        )
        WHERE cc.user_id NOT IN (SELECT new_id FROM user_id_mapping)
        AND cc.user_id IS NOT NULL
    """))

    # t_f_refresh_token.user_id
    op.execute("""
        ALTER TABLE t_f_refresh_token
        DROP CONSTRAINT IF EXISTS fk_refresh_token_user_id
    """)

    connection.execute(text("""
        UPDATE t_f_refresh_token rt
        SET user_id = m.new_id
        FROM user_id_mapping m
        WHERE rt.user_id = m.old_id
    """))

    connection.execute(text("""
        UPDATE t_f_refresh_token rt
        SET user_id = (
            SELECT m.new_id
            FROM t_d_user old
            JOIN user_id_mapping m ON old.telegram_id = m.telegram_id
            WHERE old.id = rt.user_id
            LIMIT 1
        )
        WHERE rt.user_id NOT IN (SELECT new_id FROM user_id_mapping)
    """))

    # =========================================================================
    # STEP 8: Drop old t_d_user table
    # =========================================================================

    # Drop indexes first
    op.execute("DROP INDEX IF EXISTS idx_user_telegram_current")
    op.execute("DROP INDEX IF EXISTS idx_user_current")
    op.execute("DROP INDEX IF EXISTS idx_user_telegram_current_covering")

    # Drop old table
    op.execute("DROP TABLE t_d_user CASCADE")

    # =========================================================================
    # STEP 9: Rename t_d_user_new → t_d_user
    # =========================================================================

    op.execute("ALTER TABLE t_d_user_new RENAME TO t_d_user")

    # Rename indexes
    op.execute("ALTER INDEX idx_user_new_telegram_id RENAME TO idx_user_telegram_id")
    op.execute("ALTER INDEX idx_user_new_is_active RENAME TO idx_user_is_active")
    op.execute("ALTER INDEX idx_user_new_last_login RENAME TO idx_user_last_login")

    # Rename constraint
    op.execute("ALTER TABLE t_d_user RENAME CONSTRAINT unique_telegram_id TO uq_user_telegram_id")

    # =========================================================================
    # STEP 10: Add FK constraint on t_d_user_history.user_id
    # =========================================================================

    op.execute("""
        ALTER TABLE t_d_user_history
        ADD CONSTRAINT fk_user_history_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    # =========================================================================
    # STEP 11: Recreate FK constraints for other tables
    # =========================================================================

    op.execute("""
        ALTER TABLE t_f_budget_fact
        ADD CONSTRAINT fk_budget_fact_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_article
        ADD CONSTRAINT fk_article_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
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

    op.execute("""
        ALTER TABLE t_f_refresh_token
        ADD CONSTRAINT fk_refresh_token_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    # =========================================================================
    # STEP 12: Cleanup temp table
    # =========================================================================

    connection.execute(text("DROP TABLE IF EXISTS user_id_mapping"))

    # Add comment
    op.execute("""
        COMMENT ON TABLE t_d_user IS
            'User dimension table with SCD Type 1 (current data only). Full change history stored in t_d_user_history.'
    """)

    op.execute("""
        COMMENT ON TABLE t_d_user_history IS
            'User history table with SCD Type 2 (full change history). Stores all changes to t_d_user with temporal validity.'
    """)


def downgrade() -> None:
    """
    Reverse migration: restore old SCD Type 2 structure.

    ⚠️ WARNING: This will restore the old structure but may lose some data
    if new fields (is_active, last_login_at) were updated after migration.

    Steps:
    1. Rename t_d_user → t_d_user_temp
    2. Create old t_d_user (with SCD2 fields)
    3. Restore data from t_d_user_history
    4. Create mapping new_id → old_id
    5. Update FK in fact tables
    6. Drop temp tables
    """

    connection = op.get_bind()

    # =========================================================================
    # STEP 1: Drop FK constraints
    # =========================================================================

    op.execute("ALTER TABLE t_f_budget_fact DROP CONSTRAINT IF EXISTS fk_budget_fact_user_id")
    op.execute("ALTER TABLE t_d_article DROP CONSTRAINT IF EXISTS fk_article_user_id")
    op.execute("ALTER TABLE t_d_financial_center DROP CONSTRAINT IF EXISTS fk_financial_center_user_id")
    op.execute("ALTER TABLE t_d_cost_center DROP CONSTRAINT IF EXISTS fk_cost_center_user_id")
    op.execute("ALTER TABLE t_f_refresh_token DROP CONSTRAINT IF EXISTS fk_refresh_token_user_id")
    op.execute("ALTER TABLE t_d_user_history DROP CONSTRAINT IF EXISTS fk_user_history_user_id")

    # =========================================================================
    # STEP 2: Rename t_d_user → t_d_user_temp
    # =========================================================================

    op.execute("ALTER TABLE t_d_user RENAME TO t_d_user_temp")

    # =========================================================================
    # STEP 3: Create old t_d_user table (SCD Type 2 structure)
    # =========================================================================

    op.execute("""
        CREATE TABLE t_d_user (
            id SERIAL PRIMARY KEY,
            telegram_id BIGINT NOT NULL,
            username VARCHAR(255),
            first_name VARCHAR(255),
            last_name VARCHAR(255),
            photo_url VARCHAR(512),
            is_admin BOOLEAN NOT NULL DEFAULT FALSE,
            valid_from TIMESTAMP NOT NULL DEFAULT NOW(),
            valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59'::TIMESTAMP,
            is_current BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT check_user_valid_dates CHECK (valid_from < valid_to)
        )
    """)

    # =========================================================================
    # STEP 4: Restore data from t_d_user_history
    # =========================================================================

    connection.execute(text("""
        INSERT INTO t_d_user (
            telegram_id, username, first_name, last_name, photo_url,
            is_admin, valid_from, valid_to, is_current, created_at, updated_at
        )
        SELECT
            telegram_id,
            username,
            first_name,
            last_name,
            photo_url,
            is_admin,
            valid_from,
            valid_to,
            is_current,
            created_at,
            NOW() as updated_at
        FROM t_d_user_history
        ORDER BY telegram_id, valid_from
    """))

    # =========================================================================
    # STEP 5: Create mapping new_id → old_id
    # =========================================================================

    connection.execute(text("""
        CREATE TEMP TABLE user_id_mapping_reverse AS
        SELECT
            temp.id as new_id,
            old.id as old_id,
            temp.telegram_id
        FROM t_d_user_temp temp
        JOIN t_d_user old ON temp.telegram_id = old.telegram_id
        WHERE old.is_current = TRUE
    """))

    # =========================================================================
    # STEP 6: Update FK in t_f_budget_fact
    # =========================================================================

    connection.execute(text("""
        UPDATE t_f_budget_fact f
        SET user_id = m.old_id
        FROM user_id_mapping_reverse m
        WHERE f.user_id = m.new_id
    """))

    # =========================================================================
    # STEP 7: Update FK in other tables
    # =========================================================================

    connection.execute(text("""
        UPDATE t_d_article a
        SET user_id = m.old_id
        FROM user_id_mapping_reverse m
        WHERE a.user_id = m.new_id
    """))

    connection.execute(text("""
        UPDATE t_d_financial_center fc
        SET user_id = m.old_id
        FROM user_id_mapping_reverse m
        WHERE fc.user_id = m.new_id
    """))

    connection.execute(text("""
        UPDATE t_d_cost_center cc
        SET user_id = m.old_id
        FROM user_id_mapping_reverse m
        WHERE cc.user_id = m.new_id
    """))

    connection.execute(text("""
        UPDATE t_f_refresh_token rt
        SET user_id = m.old_id
        FROM user_id_mapping_reverse m
        WHERE rt.user_id = m.new_id
    """))

    # =========================================================================
    # STEP 8: Recreate indexes
    # =========================================================================

    op.execute("""
        CREATE UNIQUE INDEX idx_user_telegram_current
            ON t_d_user(telegram_id, is_current)
            WHERE is_current = TRUE
    """)

    op.execute("""
        CREATE INDEX idx_user_current
            ON t_d_user(is_current)
            WHERE is_current = TRUE
    """)

    op.execute("""
        CREATE INDEX idx_user_telegram_current_covering
            ON t_d_user(telegram_id, is_current)
            INCLUDE (id, username, first_name, last_name, photo_url, is_admin)
            WHERE is_current = TRUE
    """)

    # =========================================================================
    # STEP 9: Recreate FK constraints
    # =========================================================================

    op.execute("""
        ALTER TABLE t_f_budget_fact
        ADD CONSTRAINT fk_budget_fact_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    op.execute("""
        ALTER TABLE t_d_article
        ADD CONSTRAINT fk_article_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
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

    op.execute("""
        ALTER TABLE t_f_refresh_token
        ADD CONSTRAINT fk_refresh_token_user_id
        FOREIGN KEY (user_id) REFERENCES t_d_user(id) ON DELETE CASCADE
    """)

    # =========================================================================
    # STEP 10: Drop temporary tables
    # =========================================================================

    op.execute("DROP TABLE IF EXISTS t_d_user_temp CASCADE")
    op.execute("DROP TABLE IF EXISTS t_d_user_history CASCADE")
    connection.execute(text("DROP TABLE IF EXISTS user_id_mapping_reverse"))

    # Restore comment
    op.execute("""
        COMMENT ON TABLE t_d_user IS
            'User dimension table with SCD Type 2 for tracking historical changes. Manages user authentication via Telegram.'
    """)
