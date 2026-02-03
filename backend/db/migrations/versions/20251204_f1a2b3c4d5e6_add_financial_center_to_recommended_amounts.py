"""add_financial_center_to_recommended_amounts

Revision ID: f1a2b3c4d5e6
Revises: a1b2c3d4e5f6
Create Date: 2025-12-04

Adds financial_center_id column to t_recommended_amounts table.
This allows recommended amounts to be calculated per ЦФО (financial center).

Changes:
1. Add financial_center_id column (nullable FK to t_d_financial_center)
2. Update unique constraint to include financial_center_id
3. Add index for financial_center_id lookups
4. Update recalculate_recommended_amounts() function to calculate per ЦФО
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: str | None = 'a1b2c3d4e5f6'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Add financial_center_id support to recommended amounts.
    """
    # Step 1: Add financial_center_id column
    op.execute("""
        ALTER TABLE t_recommended_amounts
        ADD COLUMN financial_center_id INTEGER
        REFERENCES t_d_financial_center(id) ON DELETE CASCADE
    """)

    # Step 2: Drop old unique constraint
    op.execute("""
        ALTER TABLE t_recommended_amounts
        DROP CONSTRAINT IF EXISTS unique_recommendation_key
    """)

    # Step 3: Create new unique constraint including financial_center_id
    op.execute("""
        ALTER TABLE t_recommended_amounts
        ADD CONSTRAINT unique_recommendation_key
        UNIQUE NULLS NOT DISTINCT (article_id, financial_center_id, type, record_type, period)
    """)

    # Step 4: Add index for financial_center_id lookups
    op.execute("""
        CREATE INDEX idx_recommended_amounts_financial_center
        ON t_recommended_amounts(financial_center_id)
        WHERE financial_center_id IS NOT NULL
    """)

    # Step 5: Update lookup index to include financial_center_id
    op.execute("DROP INDEX IF EXISTS idx_recommended_amounts_lookup")
    op.execute("""
        CREATE INDEX idx_recommended_amounts_lookup
        ON t_recommended_amounts(article_id, financial_center_id, type, record_type, period)
    """)

    # Step 6: Update recalculate_recommended_amounts() function
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE")
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
            -- Delete old computed recommendations (keep defaults with source = 'default')
            DELETE FROM t_recommended_amounts
            WHERE metadata->>'source' != 'default' OR article_id IS NOT NULL OR financial_center_id IS NOT NULL;

            -- ==============================================================
            -- Part 1: Global recommendations (fact/plan × expense/income)
            -- Without ЦФО filter (financial_center_id = NULL)
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

                -- Insert global recommendation (financial_center_id = NULL)
                INSERT INTO t_recommended_amounts (
                    article_id,
                    financial_center_id,
                    type,
                    record_type,
                    period,
                    amounts,
                    metadata
                )
                VALUES (
                    NULL,  -- Global (all categories)
                    NULL,  -- Global (all financial centers)
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
                ON CONFLICT (article_id, financial_center_id, type, record_type, period)
                DO UPDATE SET
                    amounts = EXCLUDED.amounts,
                    metadata = EXCLUDED.metadata;
            END LOOP;

            -- ==============================================================
            -- Part 2: Per ЦФО recommendations (fact/plan × expense/income)
            -- ==============================================================
            FOR rec IN
                SELECT
                    bf.financial_center_id,
                    a.type,
                    bf.record_type,
                    ARRAY_AGG(bf.amount ORDER BY bf.amount) AS amounts_array,
                    COUNT(*) AS sample_size
                FROM t_f_budget_fact bf
                INNER JOIN t_d_article a ON bf.article_id = a.id
                WHERE
                    bf.fact_date >= CURRENT_DATE - INTERVAL '90 days'
                    AND bf.amount > 0
                    AND bf.financial_center_id IS NOT NULL
                GROUP BY bf.financial_center_id, a.type, bf.record_type
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

                -- Insert per-ЦФО recommendation
                INSERT INTO t_recommended_amounts (
                    article_id,
                    financial_center_id,
                    type,
                    record_type,
                    period,
                    amounts,
                    metadata
                )
                VALUES (
                    NULL,  -- All categories
                    rec.financial_center_id,
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
                ON CONFLICT (article_id, financial_center_id, type, record_type, period)
                DO UPDATE SET
                    amounts = EXCLUDED.amounts,
                    metadata = EXCLUDED.metadata;
            END LOOP;

            -- ==============================================================
            -- Part 3: Per-category + Per-ЦФО recommendations (TOP combinations)
            -- ==============================================================
            FOR rec IN
                SELECT
                    bf.article_id,
                    bf.financial_center_id,
                    a.type,
                    bf.record_type,
                    ARRAY_AGG(bf.amount ORDER BY bf.amount) AS amounts_array,
                    COUNT(*) AS sample_size
                FROM t_f_budget_fact bf
                INNER JOIN t_d_article a ON bf.article_id = a.id
                WHERE
                    bf.fact_date >= CURRENT_DATE - INTERVAL '90 days'
                    AND bf.amount > 0
                    AND bf.financial_center_id IS NOT NULL
                GROUP BY bf.article_id, bf.financial_center_id, a.type, bf.record_type
                HAVING COUNT(*) >= min_sample_size
                ORDER BY COUNT(*) DESC
                LIMIT 50  -- Top 50 category+ЦФО combinations
            LOOP
                -- Apply K-means clustering
                centroids := kmeans_init_quantile(rec.amounts_array, k);
                centroids := kmeans_iterate(rec.amounts_array, centroids);

                -- Round to nice numbers and sort
                rounded_amounts := ARRAY(
                    SELECT round_to_nice(unnest(centroids))
                    ORDER BY 1
                );

                -- Insert per-category + per-ЦФО recommendation
                INSERT INTO t_recommended_amounts (
                    article_id,
                    financial_center_id,
                    type,
                    record_type,
                    period,
                    amounts,
                    metadata
                )
                VALUES (
                    rec.article_id,
                    rec.financial_center_id,
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
                ON CONFLICT (article_id, financial_center_id, type, record_type, period)
                DO UPDATE SET
                    amounts = EXCLUDED.amounts,
                    metadata = EXCLUDED.metadata;
            END LOOP;

            -- ==============================================================
            -- Part 4: Per-category recommendations (without ЦФО filter)
            -- TOP-10 popular categories
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

                -- Insert per-category recommendation (financial_center_id = NULL)
                INSERT INTO t_recommended_amounts (
                    article_id,
                    financial_center_id,
                    type,
                    record_type,
                    period,
                    amounts,
                    metadata
                )
                VALUES (
                    rec.article_id,
                    NULL,  -- All financial centers
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
                ON CONFLICT (article_id, financial_center_id, type, record_type, period)
                DO UPDATE SET
                    amounts = EXCLUDED.amounts,
                    metadata = EXCLUDED.metadata;
            END LOOP;

        END;
        $$ LANGUAGE plpgsql
    """)


def downgrade() -> None:
    """
    Remove financial_center_id from recommended amounts.
    """
    # Restore old function without financial_center_id
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE")
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

    # Drop new index
    op.execute("DROP INDEX IF EXISTS idx_recommended_amounts_financial_center")

    # Restore old lookup index
    op.execute("DROP INDEX IF EXISTS idx_recommended_amounts_lookup")
    op.execute("""
        CREATE INDEX idx_recommended_amounts_lookup
        ON t_recommended_amounts(article_id, type, record_type, period)
    """)

    # Restore old unique constraint
    op.execute("""
        ALTER TABLE t_recommended_amounts
        DROP CONSTRAINT IF EXISTS unique_recommendation_key
    """)
    op.execute("""
        ALTER TABLE t_recommended_amounts
        ADD CONSTRAINT unique_recommendation_key
        UNIQUE NULLS NOT DISTINCT (article_id, type, record_type, period)
    """)

    # Drop financial_center_id column
    op.execute("""
        ALTER TABLE t_recommended_amounts
        DROP COLUMN IF EXISTS financial_center_id
    """)
