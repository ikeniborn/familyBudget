"""
Unit tests for baseline Alembic migration (001_baseline).

Tests verify that the baseline migration creates all required:
- Tables (dimensions, facts, hierarchy, auth, notifications, recommendations)
- Indexes (performance optimization)
- Constraints (data integrity)
- Triggers (hierarchy maintenance, SCD Type 2)
- Functions (PostgreSQL functions for business logic)

These tests are SYNTACTIC ONLY - they don't run the migration,
just verify the migration file structure and SQL syntax.
"""
import pytest
from pathlib import Path


# Путь к миграции
MIGRATION_PATH = Path(__file__).parents[4] / "backend" / "db" / "migrations" / "versions" / "20251110_e2558a31af07_baseline_v5_1_0_consolidated.py"


class TestBaselineMigrationStructure:
    """Test baseline migration file structure."""

    def test_migration_file_exists(self):
        """Verify baseline migration file exists."""
        assert MIGRATION_PATH.exists(), f"Migration file not found: {MIGRATION_PATH}"

    def test_migration_file_has_docstring(self):
        """Verify migration has proper docstring."""
        content = MIGRATION_PATH.read_text()
        assert '"""Baseline schema v5.1.0' in content
        assert "Revision ID: e2558a31af07" in content
        assert "Revises: None" in content

    def test_migration_has_upgrade_function(self):
        """Verify migration has upgrade() function."""
        content = MIGRATION_PATH.read_text()
        assert "def upgrade() -> None:" in content

    def test_migration_has_downgrade_function(self):
        """Verify migration has downgrade() function."""
        content = MIGRATION_PATH.read_text()
        assert "def downgrade() -> None:" in content

    def test_migration_has_revision_identifiers(self):
        """Verify migration has proper revision identifiers."""
        content = MIGRATION_PATH.read_text()
        assert "revision: str = 'e2558a31af07'" in content
        assert "down_revision: str | None = None" in content

    def test_migration_imports_alembic_op(self):
        """Verify migration imports alembic op."""
        content = MIGRATION_PATH.read_text()
        assert "from alembic import op" in content
        assert "import sqlalchemy as sa" in content


class TestBaselineMigrationTables:
    """Test that baseline migration creates all required tables."""

    @pytest.fixture
    def migration_content(self):
        """Read migration file content."""
        return MIGRATION_PATH.read_text()

    def test_creates_user_dimension_table(self, migration_content):
        """Verify t_d_user table creation."""
        assert "CREATE TABLE t_d_user" in migration_content
        assert "telegram_id BIGINT NOT NULL" in migration_content
        assert "is_admin BOOLEAN NOT NULL DEFAULT FALSE" in migration_content
        assert "valid_from TIMESTAMP" in migration_content
        assert "valid_to TIMESTAMP" in migration_content
        assert "is_current BOOLEAN NOT NULL DEFAULT TRUE" in migration_content

    def test_creates_article_dimension_table(self, migration_content):
        """Verify t_d_article table creation."""
        assert "CREATE TABLE t_d_article" in migration_content
        assert "parent_id INT REFERENCES t_d_article(id)" in migration_content
        assert "type VARCHAR(20) NOT NULL CHECK (type IN ('income', 'expense'))" in migration_content
        assert "is_active BOOLEAN NOT NULL DEFAULT TRUE" in migration_content

    def test_creates_financial_center_table(self, migration_content):
        """Verify t_d_financial_center table creation."""
        assert "CREATE TABLE t_d_financial_center" in migration_content
        assert "code VARCHAR(50)" in migration_content
        assert "name VARCHAR(255) NOT NULL" in migration_content

    def test_creates_cost_center_table(self, migration_content):
        """Verify t_d_cost_center table creation."""
        assert "CREATE TABLE t_d_cost_center" in migration_content
        assert "code VARCHAR(50)" in migration_content

    def test_creates_budget_fact_table(self, migration_content):
        """Verify t_f_budget_fact table creation."""
        assert "CREATE TABLE t_f_budget_fact" in migration_content
        assert "user_id INT NOT NULL REFERENCES t_d_user(id)" in migration_content
        assert "article_id INT NOT NULL REFERENCES t_d_article(id)" in migration_content
        assert "amount DECIMAL(15, 2) NOT NULL" in migration_content
        assert "fact_date DATE NOT NULL" in migration_content
        assert "CONSTRAINT check_fact_amount_not_zero CHECK (amount != 0)" in migration_content

    def test_creates_article_hierarchy_table(self, migration_content):
        """Verify t_d_article_hierarchy table creation (Closure Table)."""
        assert "CREATE TABLE t_d_article_hierarchy" in migration_content
        assert "ancestor_id INT NOT NULL REFERENCES t_d_article(id)" in migration_content
        assert "descendant_id INT NOT NULL REFERENCES t_d_article(id)" in migration_content
        assert "depth INT NOT NULL CHECK (depth >= 0)" in migration_content
        assert "CONSTRAINT uq_article_hierarchy_path UNIQUE (ancestor_id, descendant_id)" in migration_content

    def test_creates_refresh_token_table(self, migration_content):
        """Verify t_f_refresh_token table creation."""
        assert "CREATE TABLE t_f_refresh_token" in migration_content
        assert "token_hash VARCHAR(255) NOT NULL UNIQUE" in migration_content
        assert "expires_at TIMESTAMP NOT NULL" in migration_content
        assert "is_revoked BOOLEAN NOT NULL DEFAULT FALSE" in migration_content

    def test_creates_article_usage_stats_table(self, migration_content):
        """Verify t_article_usage_stats table creation."""
        assert "CREATE TABLE t_article_usage_stats" in migration_content
        assert "article_id INTEGER NOT NULL" in migration_content
        assert "usage_count INTEGER NOT NULL DEFAULT 0" in migration_content

    def test_creates_notification_table(self, migration_content):
        """Verify t_notification table creation."""
        assert "CREATE TABLE t_notification" in migration_content
        assert "user_id INTEGER" in migration_content  # Nullable for broadcast
        assert "article_id INTEGER NOT NULL" in migration_content
        assert "notification_type VARCHAR(50) NOT NULL" in migration_content

    def test_creates_recommended_amounts_table(self, migration_content):
        """Verify t_recommended_amounts table creation."""
        assert "CREATE TABLE t_recommended_amounts" in migration_content
        assert "amounts DECIMAL(15,2)[] NOT NULL" in migration_content
        assert "CONSTRAINT check_amounts_count CHECK (array_length(amounts, 1) = 4)" in migration_content


class TestBaselineMigrationIndexes:
    """Test that baseline migration creates all required indexes."""

    @pytest.fixture
    def migration_content(self):
        """Read migration file content."""
        return MIGRATION_PATH.read_text()

    def test_creates_user_indexes(self, migration_content):
        """Verify user table indexes."""
        assert "CREATE UNIQUE INDEX idx_user_telegram_current" in migration_content
        assert "CREATE INDEX idx_user_telegram_current_covering" in migration_content

    def test_creates_article_indexes(self, migration_content):
        """Verify article table indexes."""
        assert "CREATE INDEX idx_article_parent_id" in migration_content
        assert "CREATE INDEX idx_article_type" in migration_content
        assert "CREATE INDEX idx_article_active" in migration_content
        assert "CREATE INDEX idx_article_active_current" in migration_content

    def test_creates_budget_fact_indexes(self, migration_content):
        """Verify budget fact table performance indexes."""
        assert "CREATE INDEX idx_budget_fact_user_date" in migration_content
        assert "CREATE INDEX idx_budget_fact_user_date_amount_covering" in migration_content
        assert "CREATE INDEX idx_budget_fact_article_date_amount_covering" in migration_content

    def test_creates_hierarchy_indexes(self, migration_content):
        """Verify article hierarchy indexes."""
        assert "CREATE INDEX idx_article_hierarchy_ancestor" in migration_content
        assert "CREATE INDEX idx_article_hierarchy_descendant" in migration_content
        assert "CREATE INDEX idx_hierarchy_ancestor_depth_covering" in migration_content


class TestBaselineMigrationFunctions:
    """Test that baseline migration creates all required PostgreSQL functions."""

    @pytest.fixture
    def migration_content(self):
        """Read migration file content."""
        return MIGRATION_PATH.read_text()

    def test_creates_get_article_depth_function(self, migration_content):
        """Verify get_article_depth() function creation."""
        assert "CREATE OR REPLACE FUNCTION get_article_depth(p_article_id INT)" in migration_content
        assert "RETURNS INT" in migration_content
        assert "$$ LANGUAGE plpgsql" in migration_content

    def test_creates_circular_reference_check_function(self, migration_content):
        """Verify would_create_circular_reference() function creation."""
        assert "CREATE OR REPLACE FUNCTION would_create_circular_reference" in migration_content
        assert "RETURNS BOOLEAN" in migration_content

    def test_creates_hierarchy_insert_trigger_function(self, migration_content):
        """Verify hierarchy insert trigger function."""
        assert "CREATE OR REPLACE FUNCTION trg_article_hierarchy_insert()" in migration_content
        assert "RETURNS TRIGGER" in migration_content
        assert "INSERT INTO t_d_article_hierarchy (ancestor_id, descendant_id, depth)" in migration_content

    def test_creates_hierarchy_update_trigger_function(self, migration_content):
        """Verify hierarchy update trigger function."""
        assert "CREATE OR REPLACE FUNCTION trg_article_hierarchy_update()" in migration_content
        assert "DELETE FROM t_d_article_hierarchy" in migration_content

    def test_creates_scd2_user_trigger_function(self, migration_content):
        """Verify SCD Type 2 trigger for users."""
        assert "CREATE OR REPLACE FUNCTION trg_scd2_user()" in migration_content
        assert "IF OLD.is_current = FALSE THEN" in migration_content
        assert "UPDATE t_d_user SET is_current = FALSE" in migration_content

    def test_creates_scd2_article_trigger_function(self, migration_content):
        """Verify SCD Type 2 trigger for articles."""
        assert "CREATE OR REPLACE FUNCTION trg_scd2_article()" in migration_content
        assert "UPDATE t_d_article SET parent_id = new_article_id" in migration_content

    def test_creates_round_to_nice_function(self, migration_content):
        """Verify round_to_nice() function for recommendations."""
        assert "CREATE OR REPLACE FUNCTION round_to_nice(amount DECIMAL(15,2))" in migration_content
        assert "IMMUTABLE" in migration_content

    def test_creates_recalculate_usage_stats_function(self, migration_content):
        """Verify recalculate_article_usage_stats() function."""
        assert "CREATE OR REPLACE FUNCTION recalculate_article_usage_stats()" in migration_content
        assert "TRUNCATE TABLE t_article_usage_stats" in migration_content


class TestBaselineMigrationTriggers:
    """Test that baseline migration creates all required triggers."""

    @pytest.fixture
    def migration_content(self):
        """Read migration file content."""
        return MIGRATION_PATH.read_text()

    def test_creates_hierarchy_insert_trigger(self, migration_content):
        """Verify hierarchy insert trigger."""
        assert "CREATE TRIGGER trg_article_hierarchy_insert_after" in migration_content
        assert "AFTER INSERT ON t_d_article" in migration_content

    def test_creates_hierarchy_update_trigger(self, migration_content):
        """Verify hierarchy update trigger."""
        assert "CREATE TRIGGER trg_article_hierarchy_update_after" in migration_content
        assert "AFTER UPDATE ON t_d_article" in migration_content
        assert "WHEN (OLD.parent_id IS DISTINCT FROM NEW.parent_id)" in migration_content

    def test_creates_scd2_triggers(self, migration_content):
        """Verify SCD Type 2 triggers for all dimension tables."""
        assert "CREATE TRIGGER trg_scd2_user_before_update" in migration_content
        assert "CREATE TRIGGER trg_scd2_article_before_update" in migration_content
        assert "CREATE TRIGGER trg_scd2_financial_center_before_update" in migration_content
        assert "CREATE TRIGGER trg_scd2_cost_center_before_update" in migration_content


class TestBaselineMigrationDowngrade:
    """Test that downgrade() properly removes all objects."""

    @pytest.fixture
    def migration_content(self):
        """Read migration file content."""
        return MIGRATION_PATH.read_text()

    def test_downgrade_drops_tables(self, migration_content):
        """Verify downgrade drops all tables."""
        # Extract downgrade function content
        downgrade_section = migration_content.split("def downgrade() -> None:")[1]

        assert "DROP TABLE IF EXISTS t_recommended_amounts CASCADE" in downgrade_section
        assert "DROP TABLE IF EXISTS t_notification CASCADE" in downgrade_section
        assert "DROP TABLE IF EXISTS t_article_usage_stats CASCADE" in downgrade_section
        assert "DROP TABLE IF EXISTS t_f_refresh_token CASCADE" in downgrade_section
        assert "DROP TABLE IF EXISTS t_f_budget_fact CASCADE" in downgrade_section
        assert "DROP TABLE IF EXISTS t_d_article_hierarchy CASCADE" in downgrade_section
        assert "DROP TABLE IF EXISTS t_d_cost_center CASCADE" in downgrade_section
        assert "DROP TABLE IF EXISTS t_d_financial_center CASCADE" in downgrade_section
        assert "DROP TABLE IF EXISTS t_d_article CASCADE" in downgrade_section
        assert "DROP TABLE IF EXISTS t_d_user CASCADE" in downgrade_section

    def test_downgrade_drops_functions(self, migration_content):
        """Verify downgrade drops all functions."""
        downgrade_section = migration_content.split("def downgrade() -> None:")[1]

        assert "DROP FUNCTION IF EXISTS round_to_nice" in downgrade_section
        assert "DROP FUNCTION IF EXISTS recalculate_article_usage_stats" in downgrade_section
        assert "DROP FUNCTION IF EXISTS trg_scd2_cost_center" in downgrade_section
        assert "DROP FUNCTION IF EXISTS trg_scd2_financial_center" in downgrade_section
        assert "DROP FUNCTION IF EXISTS trg_scd2_article" in downgrade_section
        assert "DROP FUNCTION IF EXISTS trg_scd2_user" in downgrade_section
        assert "DROP FUNCTION IF EXISTS get_article_depth" in downgrade_section
        assert "DROP FUNCTION IF EXISTS would_create_circular_reference" in downgrade_section


class TestBaselineMigrationDataIntegrity:
    """Test that migration includes data integrity constraints."""

    @pytest.fixture
    def migration_content(self):
        """Read migration file content."""
        return MIGRATION_PATH.read_text()

    def test_scd2_constraints(self, migration_content):
        """Verify SCD Type 2 constraints."""
        assert "CHECK (valid_from < valid_to)" in migration_content
        assert "is_current BOOLEAN NOT NULL DEFAULT TRUE" in migration_content

    def test_foreign_key_constraints(self, migration_content):
        """Verify foreign key constraints with proper cascade rules."""
        assert "REFERENCES t_d_user(id) ON DELETE CASCADE" in migration_content
        assert "REFERENCES t_d_article(id) ON DELETE RESTRICT" in migration_content  # Fact table
        assert "REFERENCES t_d_article(id) ON DELETE SET NULL" in migration_content  # Parent FK

    def test_check_constraints(self, migration_content):
        """Verify CHECK constraints for business rules."""
        assert "CHECK (type IN ('income', 'expense'))" in migration_content
        assert "CHECK (amount != 0)" in migration_content
        assert "CHECK (depth >= 0)" in migration_content
        assert "CHECK (array_length(amounts, 1) = 4)" in migration_content

    def test_unique_constraints(self, migration_content):
        """Verify unique constraints."""
        assert "UNIQUE (ancestor_id, descendant_id)" in migration_content
        assert "token_hash VARCHAR(255) NOT NULL UNIQUE" in migration_content


class TestBaselineMigrationInitialData:
    """Test that migration inserts initial/default data."""

    @pytest.fixture
    def migration_content(self):
        """Read migration file content."""
        return MIGRATION_PATH.read_text()

    def test_inserts_default_recommendations(self, migration_content):
        """Verify default recommended amounts are inserted."""
        assert "INSERT INTO t_recommended_amounts" in migration_content
        assert "ARRAY[100, 500, 1000, 5000]" in migration_content  # Default expenses (facts)
        assert "ARRAY[10000, 20000, 50000, 100000]" in migration_content  # Default income (facts)

    def test_calls_recalculate_usage_stats(self, migration_content):
        """Verify usage stats are calculated on migration."""
        assert "SELECT recalculate_article_usage_stats()" in migration_content
