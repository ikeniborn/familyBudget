"""add_version_link_tables_for_dimension_tracking

Revision ID: ca32d1e1ab6e
Revises: 001_baseline
Create Date: 2025-11-09 12:33:43.448934

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca32d1e1ab6e'
down_revision: Union[str, None] = '001_baseline'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Create version link tables for tracking SCD Type 2 version relationships.

    Tables created:
    - t_d_article_version_link: Links old → new Article versions
    - t_d_financial_center_version_link: Links old → new FinancialCenter versions
    - t_d_cost_center_version_link: Links old → new CostCenter versions

    Each table tracks:
    - old_id → new_id relationship
    - When the new version was created (created_at)
    - Who made the change (changed_by_user_id)
    - What fields changed (changed_fields JSONB)
    """

    # 1. Create t_d_article_version_link
    op.execute("""
        CREATE TABLE t_d_article_version_link (
            id SERIAL PRIMARY KEY,
            old_article_id INT NOT NULL REFERENCES t_d_article(id) ON DELETE CASCADE,
            new_article_id INT NOT NULL REFERENCES t_d_article(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            changed_by_user_id INT REFERENCES t_d_user(id) ON DELETE SET NULL,
            changed_fields JSONB,
            CONSTRAINT uq_article_version_link UNIQUE (old_article_id, new_article_id)
        );

        -- Indexes for efficient lookups
        CREATE INDEX idx_article_version_link_old ON t_d_article_version_link(old_article_id);
        CREATE INDEX idx_article_version_link_new ON t_d_article_version_link(new_article_id);
        CREATE INDEX idx_article_version_link_created ON t_d_article_version_link(created_at DESC);

        -- Comment
        COMMENT ON TABLE t_d_article_version_link IS 'Tracks SCD Type 2 version relationships for Article dimension';
        COMMENT ON COLUMN t_d_article_version_link.old_article_id IS 'Previous version ID (is_current=false)';
        COMMENT ON COLUMN t_d_article_version_link.new_article_id IS 'New version ID (is_current=true)';
        COMMENT ON COLUMN t_d_article_version_link.changed_fields IS 'JSON array of field names that changed, e.g. ["name", "type"]';
    """)

    # 2. Create t_d_financial_center_version_link
    op.execute("""
        CREATE TABLE t_d_financial_center_version_link (
            id SERIAL PRIMARY KEY,
            old_fc_id INT NOT NULL REFERENCES t_d_financial_center(id) ON DELETE CASCADE,
            new_fc_id INT NOT NULL REFERENCES t_d_financial_center(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            changed_by_user_id INT REFERENCES t_d_user(id) ON DELETE SET NULL,
            changed_fields JSONB,
            CONSTRAINT uq_fc_version_link UNIQUE (old_fc_id, new_fc_id)
        );

        -- Indexes
        CREATE INDEX idx_fc_version_link_old ON t_d_financial_center_version_link(old_fc_id);
        CREATE INDEX idx_fc_version_link_new ON t_d_financial_center_version_link(new_fc_id);
        CREATE INDEX idx_fc_version_link_created ON t_d_financial_center_version_link(created_at DESC);

        -- Comment
        COMMENT ON TABLE t_d_financial_center_version_link IS 'Tracks SCD Type 2 version relationships for FinancialCenter dimension';
    """)

    # 3. Create t_d_cost_center_version_link
    op.execute("""
        CREATE TABLE t_d_cost_center_version_link (
            id SERIAL PRIMARY KEY,
            old_cc_id INT NOT NULL REFERENCES t_d_cost_center(id) ON DELETE CASCADE,
            new_cc_id INT NOT NULL REFERENCES t_d_cost_center(id) ON DELETE CASCADE,
            created_at TIMESTAMP NOT NULL DEFAULT NOW(),
            changed_by_user_id INT REFERENCES t_d_user(id) ON DELETE SET NULL,
            changed_fields JSONB,
            CONSTRAINT uq_cc_version_link UNIQUE (old_cc_id, new_cc_id)
        );

        -- Indexes
        CREATE INDEX idx_cc_version_link_old ON t_d_cost_center_version_link(old_cc_id);
        CREATE INDEX idx_cc_version_link_new ON t_d_cost_center_version_link(new_cc_id);
        CREATE INDEX idx_cc_version_link_created ON t_d_cost_center_version_link(created_at DESC);

        -- Comment
        COMMENT ON TABLE t_d_cost_center_version_link IS 'Tracks SCD Type 2 version relationships for CostCenter dimension';
    """)

    # 4. Update SCD2 triggers to include code field and version_link tracking
    # 4a. Update Article trigger - add code to versioning condition and add version_link insert
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_scd2_article()
        RETURNS TRIGGER AS $$
        DECLARE
            new_article_id INT;
            children_updated INT;
            changed_fields_arr TEXT[];
        BEGIN
            IF OLD.is_current = FALSE THEN
                RAISE EXCEPTION 'Cannot update non-current record (id=%). Update the current version instead.', OLD.id;
            END IF;

            -- ✅ NEW: Added code to versioning condition
            IF (OLD.name IS DISTINCT FROM NEW.name)
               OR (OLD.type IS DISTINCT FROM NEW.type)
               OR (OLD.code IS DISTINCT FROM NEW.code)
            THEN
                -- Track which fields changed (for version_link)
                changed_fields_arr := ARRAY[]::TEXT[];
                IF OLD.name IS DISTINCT FROM NEW.name THEN
                    changed_fields_arr := array_append(changed_fields_arr, 'name');
                END IF;
                IF OLD.type IS DISTINCT FROM NEW.type THEN
                    changed_fields_arr := array_append(changed_fields_arr, 'type');
                END IF;
                IF OLD.code IS DISTINCT FROM NEW.code THEN
                    changed_fields_arr := array_append(changed_fields_arr, 'code');
                END IF;

                -- Close old version
                UPDATE t_d_article
                SET is_current = FALSE,
                    valid_to = clock_timestamp(),
                    updated_at = clock_timestamp()
                WHERE id = OLD.id;

                -- ✅ NEW: Include code in INSERT
                INSERT INTO t_d_article (
                    user_id, parent_id, code, name, type, is_active,
                    valid_from, valid_to, is_current, created_at, updated_at
                ) VALUES (
                    NEW.user_id, NEW.parent_id, NEW.code, NEW.name, NEW.type, NEW.is_active,
                    clock_timestamp(), '9999-12-31 23:59:59'::TIMESTAMP, TRUE, OLD.created_at, clock_timestamp()
                )
                RETURNING id INTO new_article_id;

                -- ✅ NEW: Record version link
                INSERT INTO t_d_article_version_link (
                    old_article_id, new_article_id, created_at, changed_fields
                ) VALUES (
                    OLD.id, new_article_id, clock_timestamp(), to_jsonb(changed_fields_arr)
                );

                -- Redirect children to new parent version
                UPDATE t_d_article
                SET parent_id = new_article_id,
                    updated_at = clock_timestamp()
                WHERE parent_id = OLD.id
                  AND is_current = TRUE;

                GET DIAGNOSTICS children_updated = ROW_COUNT;

                RAISE NOTICE 'Created new article version: old_id=%, new_id=%, changed_fields=%, updated % children',
                    OLD.id, new_article_id, changed_fields_arr, children_updated;

                RETURN NULL;
            ELSE
                -- Non-versioned fields (e.g., is_active)
                NEW.updated_at := clock_timestamp();
                RETURN NEW;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 4b. Update FinancialCenter trigger - add version_link insert
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_scd2_financial_center()
        RETURNS TRIGGER AS $$
        DECLARE
            new_fc_id INT;
            changed_fields_arr TEXT[];
        BEGIN
            IF OLD.is_current = FALSE THEN
                RAISE EXCEPTION 'Cannot update non-current record (id=%). Update the current version instead.', OLD.id;
            END IF;

            IF (OLD.name IS DISTINCT FROM NEW.name)
               OR (OLD.description IS DISTINCT FROM NEW.description)
               OR (OLD.code IS DISTINCT FROM NEW.code)
            THEN
                -- Track which fields changed
                changed_fields_arr := ARRAY[]::TEXT[];
                IF OLD.name IS DISTINCT FROM NEW.name THEN
                    changed_fields_arr := array_append(changed_fields_arr, 'name');
                END IF;
                IF OLD.description IS DISTINCT FROM NEW.description THEN
                    changed_fields_arr := array_append(changed_fields_arr, 'description');
                END IF;
                IF OLD.code IS DISTINCT FROM NEW.code THEN
                    changed_fields_arr := array_append(changed_fields_arr, 'code');
                END IF;

                -- Close old version
                UPDATE t_d_financial_center
                SET is_current = FALSE,
                    valid_to = NOW(),
                    updated_at = NOW()
                WHERE id = OLD.id;

                -- Create new version
                INSERT INTO t_d_financial_center (
                    user_id, code, name, description,
                    valid_from, valid_to, is_current, created_at, updated_at
                ) VALUES (
                    NEW.user_id, NEW.code, NEW.name, NEW.description,
                    NOW(), '9999-12-31 23:59:59'::TIMESTAMP, TRUE, OLD.created_at, NOW()
                )
                RETURNING id INTO new_fc_id;

                -- ✅ NEW: Record version link
                INSERT INTO t_d_financial_center_version_link (
                    old_fc_id, new_fc_id, created_at, changed_fields
                ) VALUES (
                    OLD.id, new_fc_id, NOW(), to_jsonb(changed_fields_arr)
                );

                RAISE NOTICE 'Created new FC version: old_id=%, new_id=%, changed_fields=%',
                    OLD.id, new_fc_id, changed_fields_arr;

                RETURN NULL;
            ELSE
                NEW.updated_at := NOW();
                RETURN NEW;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 4c. Update CostCenter trigger - add version_link insert
    op.execute("""
        CREATE OR REPLACE FUNCTION trg_scd2_cost_center()
        RETURNS TRIGGER AS $$
        DECLARE
            new_cc_id INT;
            changed_fields_arr TEXT[];
        BEGIN
            IF OLD.is_current = FALSE THEN
                RAISE EXCEPTION 'Cannot update non-current record (id=%). Update the current version instead.', OLD.id;
            END IF;

            IF (OLD.name IS DISTINCT FROM NEW.name)
               OR (OLD.description IS DISTINCT FROM NEW.description)
               OR (OLD.code IS DISTINCT FROM NEW.code)
            THEN
                -- Track which fields changed
                changed_fields_arr := ARRAY[]::TEXT[];
                IF OLD.name IS DISTINCT FROM NEW.name THEN
                    changed_fields_arr := array_append(changed_fields_arr, 'name');
                END IF;
                IF OLD.description IS DISTINCT FROM NEW.description THEN
                    changed_fields_arr := array_append(changed_fields_arr, 'description');
                END IF;
                IF OLD.code IS DISTINCT FROM NEW.code THEN
                    changed_fields_arr := array_append(changed_fields_arr, 'code');
                END IF;

                -- Close old version
                UPDATE t_d_cost_center
                SET is_current = FALSE,
                    valid_to = NOW(),
                    updated_at = NOW()
                WHERE id = OLD.id;

                -- Create new version
                INSERT INTO t_d_cost_center (
                    user_id, code, name, description,
                    valid_from, valid_to, is_current, created_at, updated_at
                ) VALUES (
                    NEW.user_id, NEW.code, NEW.name, NEW.description,
                    NOW(), '9999-12-31 23:59:59'::TIMESTAMP, TRUE, OLD.created_at, NOW()
                )
                RETURNING id INTO new_cc_id;

                -- ✅ NEW: Record version link
                INSERT INTO t_d_cost_center_version_link (
                    old_cc_id, new_cc_id, created_at, changed_fields
                ) VALUES (
                    OLD.id, new_cc_id, NOW(), to_jsonb(changed_fields_arr)
                );

                RAISE NOTICE 'Created new CC version: old_id=%, new_id=%, changed_fields=%',
                    OLD.id, new_cc_id, changed_fields_arr;

                RETURN NULL;
            ELSE
                NEW.updated_at := NOW();
                RETURN NEW;
            END IF;
        END;
        $$ LANGUAGE plpgsql;
    """)


def downgrade() -> None:
    """
    Drop version link tables (reverse of upgrade).
    """
    op.execute("DROP TABLE IF EXISTS t_d_cost_center_version_link CASCADE;")
    op.execute("DROP TABLE IF EXISTS t_d_financial_center_version_link CASCADE;")
    op.execute("DROP TABLE IF EXISTS t_d_article_version_link CASCADE;")
