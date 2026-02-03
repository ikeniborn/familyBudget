"""fix_recalculate_recommended_amounts_scd1_migration

Revision ID: dfb4bd8a96ea
Revises: 272161ce0d9f
Create Date: 2025-11-27 06:53:19.669817

Fixes critical error after SCD Type 1 migration:
- ERROR: column a.is_current does not exist
- SQL: SELECT recalculate_recommended_amounts()
- Root cause: After SCD Type 1 migration, t_d_article no longer has is_current column
- Solution: Remove all references to a.is_current from function definition

Changes:
- Line 101 (Part 1 Global): Removed "AND a.is_current = TRUE"
- Line 159 (Part 2 Per-category): Removed "AND a.is_current = TRUE"


After SCD Type 1 migration:
- All records in t_d_article are current (no versioning)
- No need for is_current filter
- INNER JOIN by article_id is sufficient
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'dfb4bd8a96ea'
down_revision: str | None = '272161ce0d9f'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Update recalculate_recommended_amounts() to remove is_current filter.

    After SCD Type 1 migration, t_d_article no longer has is_current column.
    All records are current, so no filtering needed.
    """

    # Drop old function with is_current filter
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE")

    # Recreate without is_current filter (SCD Type 1 compatible)
    op.execute("""
        CREATE OR REPLACE FUNCTION recalculate_recommended_amounts()
        RETURNS VOID AS $$
        DECLARE
            rec RECORD;
            amounts DECIMAL(15,2)[];
            centroids DECIMAL(15,2)[];
            rounded_amounts DECIMAL(15,2)[];
            i INT;
            k INT := 4;  -- Number of clusters
            min_sample_size INT := 20;
            days_history INT := 90;
        BEGIN
            -- Delete old computed recommendations (keep defaults with article_id IS NULL and metadata->>'source' = 'default')
            DELETE FROM t_recommended_amounts
            WHERE metadata->>'source' != 'default' OR article_id IS NOT NULL;

            -- ==============================================================
            -- Part 1: Global recommendations (fact/plan × expense/income)
            -- ==============================================================
            FOR rec IN
                SELECT
                    a.type,
                    bf.record_type,
                    ARRAY_AGG(bf.amount ORDER BY bf.amount) AS amounts_array,
                    COUNT(*) AS sample_size
                FROM t_f_budget_fact bf
                INNER JOIN t_d_article a ON bf.article_id = a.id
                WHERE
                    bf.fact_date >= CURRENT_DATE - INTERVAL '90 days'
                    AND bf.amount > 0
                GROUP BY a.type, bf.record_type
                HAVING COUNT(*) >= min_sample_size
            LOOP
                -- Apply K-means clustering
                centroids := kmeans_init_quantile(rec.amounts_array, k);
                centroids := kmeans_iterate(rec.amounts_array, centroids);

                -- Round to nice numbers and sort
                rounded_amounts := ARRAY(
                    SELECT round_to_nice(unnest(centroids))
                    ORDER BY 1
                );

                -- Insert into recommendations table
                INSERT INTO t_recommended_amounts (
                    article_id,
                    type,
                    record_type,
                    period,
                    amounts,
                    metadata
                )
                VALUES (
                    NULL,  -- Global (all categories)
                    rec.type,
                    rec.record_type,
                    'quarter',
                    rounded_amounts,
                    jsonb_build_object(
                        'source', 'kmeans',
                        'sample_size', rec.sample_size,
                        'updated_at', NOW()
                    )
                )
                ON CONFLICT (article_id, type, record_type, period)
                DO UPDATE SET
                    amounts = EXCLUDED.amounts,
                    metadata = EXCLUDED.metadata;
            END LOOP;

            -- ==============================================================
            -- Part 2: Per-category recommendations (TOP-10 popular)
            -- ==============================================================
            FOR rec IN
                SELECT
                    bf.article_id,
                    a.type,
                    bf.record_type,
                    ARRAY_AGG(bf.amount ORDER BY bf.amount) AS amounts_array,
                    COUNT(*) AS sample_size,
                    aus.usage_count
                FROM t_f_budget_fact bf
                INNER JOIN t_d_article a ON bf.article_id = a.id
                INNER JOIN t_article_usage_stats aus ON bf.article_id = aus.article_id
                WHERE
                    bf.fact_date >= CURRENT_DATE - INTERVAL '90 days'
                    AND bf.amount > 0
                GROUP BY bf.article_id, a.type, bf.record_type, aus.usage_count
                HAVING COUNT(*) >= min_sample_size
                ORDER BY aus.usage_count DESC
                LIMIT 10
            LOOP
                -- Apply K-means clustering
                centroids := kmeans_init_quantile(rec.amounts_array, k);
                centroids := kmeans_iterate(rec.amounts_array, centroids);

                -- Round to nice numbers and sort
                rounded_amounts := ARRAY(
                    SELECT round_to_nice(unnest(centroids))
                    ORDER BY 1
                );

                -- Insert into recommendations table
                INSERT INTO t_recommended_amounts (
                    article_id,
                    type,
                    record_type,
                    period,
                    amounts,
                    metadata
                )
                VALUES (
                    rec.article_id,
                    rec.type,
                    rec.record_type,
                    'quarter',
                    rounded_amounts,
                    jsonb_build_object(
                        'source', 'kmeans',
                        'sample_size', rec.sample_size,
                        'usage_count', rec.usage_count,
                        'updated_at', NOW()
                    )
                )
                ON CONFLICT (article_id, type, record_type, period)
                DO UPDATE SET
                    amounts = EXCLUDED.amounts,
                    metadata = EXCLUDED.metadata;
            END LOOP;

        END;
        $$ LANGUAGE plpgsql
    """)


def downgrade() -> None:
    """
    Downgrade: Restore function with is_current filter (SCD Type 2 version).

    Note: This will FAIL if t_d_article doesn't have is_current column.
    This downgrade is only for reference - do NOT use after SCD Type 1 migration.
    """

    # Drop SCD Type 1 compatible function
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE")

    # Recreate with is_current filter (SCD Type 2 version - will fail if column doesn't exist)
    op.execute("""
        CREATE OR REPLACE FUNCTION recalculate_recommended_amounts()
        RETURNS VOID AS $$
        DECLARE
            rec RECORD;
            amounts DECIMAL(15,2)[];
            centroids DECIMAL(15,2)[];
            rounded_amounts DECIMAL(15,2)[];
            i INT;
            k INT := 4;
            min_sample_size INT := 20;
            days_history INT := 90;
        BEGIN
            DELETE FROM t_recommended_amounts
            WHERE metadata->>'source' != 'default' OR article_id IS NOT NULL;

            FOR rec IN
                SELECT
                    a.type,
                    bf.record_type,
                    ARRAY_AGG(bf.amount ORDER BY bf.amount) AS amounts_array,
                    COUNT(*) AS sample_size
                FROM t_f_budget_fact bf
                INNER JOIN t_d_article a ON bf.article_id = a.id
                WHERE
                    bf.fact_date >= CURRENT_DATE - INTERVAL '90 days'
                    AND bf.amount > 0
                    AND a.is_current = TRUE
                GROUP BY a.type, bf.record_type
                HAVING COUNT(*) >= min_sample_size
            LOOP
                centroids := kmeans_init_quantile(rec.amounts_array, k);
                centroids := kmeans_iterate(rec.amounts_array, centroids);
                rounded_amounts := ARRAY(
                    SELECT round_to_nice(unnest(centroids))
                    ORDER BY 1
                );
                INSERT INTO t_recommended_amounts (
                    article_id, type, record_type, period, amounts, metadata
                )
                VALUES (
                    NULL, rec.type, rec.record_type, 'quarter', rounded_amounts,
                    jsonb_build_object(
                        'source', 'kmeans',
                        'sample_size', rec.sample_size,
                        'updated_at', NOW()
                    )
                )
                ON CONFLICT (article_id, type, record_type, period)
                DO UPDATE SET amounts = EXCLUDED.amounts, metadata = EXCLUDED.metadata;
            END LOOP;

            FOR rec IN
                SELECT
                    bf.article_id,
                    a.type,
                    bf.record_type,
                    ARRAY_AGG(bf.amount ORDER BY bf.amount) AS amounts_array,
                    COUNT(*) AS sample_size,
                    aus.usage_count
                FROM t_f_budget_fact bf
                INNER JOIN t_d_article a ON bf.article_id = a.id
                INNER JOIN t_article_usage_stats aus ON bf.article_id = aus.article_id
                WHERE
                    bf.fact_date >= CURRENT_DATE - INTERVAL '90 days'
                    AND bf.amount > 0
                    AND a.is_current = TRUE
                GROUP BY bf.article_id, a.type, bf.record_type, aus.usage_count
                HAVING COUNT(*) >= min_sample_size
                ORDER BY aus.usage_count DESC
                LIMIT 10
            LOOP
                centroids := kmeans_init_quantile(rec.amounts_array, k);
                centroids := kmeans_iterate(rec.amounts_array, centroids);
                rounded_amounts := ARRAY(
                    SELECT round_to_nice(unnest(centroids))
                    ORDER BY 1
                );
                INSERT INTO t_recommended_amounts (
                    article_id, type, record_type, period, amounts, metadata
                )
                VALUES (
                    rec.article_id, rec.type, rec.record_type, 'quarter', rounded_amounts,
                    jsonb_build_object(
                        'source', 'kmeans',
                        'sample_size', rec.sample_size,
                        'usage_count', rec.usage_count,
                        'updated_at', NOW()
                    )
                )
                ON CONFLICT (article_id, type, record_type, period)
                DO UPDATE SET amounts = EXCLUDED.amounts, metadata = EXCLUDED.metadata;
            END LOOP;

        END;
        $$ LANGUAGE plpgsql
    """)
