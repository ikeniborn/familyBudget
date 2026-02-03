"""adaptive_period_all_leaf_categories

Revision ID: 870ace16c2f5
Revises: d1b4c09aa285
Create Date: 2025-11-12 19:22:21.154079

Implements adaptive period selection and all-leaf-categories processing:

CHANGES:
1. Remove LIMIT 10 → Process ALL leaf categories (maximum coverage)
2. Add leaf-only filter → Exclude parent nodes (more accurate recommendations)
3. Adaptive period per category → Try 90→180→270→360 days until min_sample_size met
4. Store used period → metadata.days_analyzed for transparency

ALGORITHM:
For each leaf category:
  For each record_type (fact, plan):
    Try period 90 days:
      IF sample_size >= 20 THEN compute K-means, CONTINUE
    Try period 180 days:
      IF sample_size >= 20 THEN compute K-means, CONTINUE
    Try period 270 days:
      IF sample_size >= 20 THEN compute K-means, CONTINUE
    Try period 360 days:
      IF sample_size >= 20 THEN compute K-means
      ELSE skip category (insufficient data)

BENEFITS:
- Maximum category coverage (rare categories use yearly data)
- Fresh recommendations for frequent categories (90 days)
- No premature filtering (check sample_size per category individually)
- Transparency (metadata.days_analyzed shows which period used)

TRADE-OFFS:
- Performance: ~5-10 minutes for 50+ categories (acceptable for nightly job)
- Mixed periods: Some categories use 90 days, others 360 days (documented in metadata)
- Seasonality: Yearly data may dilute seasonal patterns (trade-off for coverage)

DIAGNOSTIC QUERIES:
-- Distribution by period:
SELECT
    metadata->>'days_analyzed' as period_used,
    COUNT(*) as categories_count
FROM t_recommended_amounts
WHERE article_id IS NOT NULL
GROUP BY metadata->>'days_analyzed'
ORDER BY period_used;

-- Categories without recommendations (< 20 transactions in 360 days):
SELECT a.id, a.name, COUNT(bf.id) as trans_360d
FROM t_d_article a
LEFT JOIN t_f_budget_fact bf ON bf.article_id = a.id
    AND bf.fact_date >= CURRENT_DATE - INTERVAL '360 days'
WHERE a.is_current = TRUE
  AND NOT EXISTS (SELECT 1 FROM t_d_article c WHERE c.parent_id = a.id AND c.is_current = TRUE)
  AND NOT EXISTS (SELECT 1 FROM t_recommended_amounts WHERE article_id = a.id)
GROUP BY a.id, a.name;
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '870ace16c2f5'
down_revision: str | None = 'd1b4c09aa285'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Recreate recalculate_recommended_amounts() with adaptive period algorithm.

    Changes from previous version (d1b4c09aa285):
    1. Part 2 (Per-category):
       - REMOVED: LIMIT 10 (now processes ALL leaf categories)
       - ADDED: Leaf-only filter (NOT EXISTS child categories)
       - CHANGED: Adaptive period per category (90→180→270→360 days)
       - ADDED: metadata.days_analyzed field (stores which period used)

    2. Part 1 (Global):
       - UNCHANGED: Still uses fixed 90 days for global recommendations
    """

    # Drop old function
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE")

    # Recreate with adaptive period algorithm
    op.execute("""
        CREATE OR REPLACE FUNCTION recalculate_recommended_amounts()
        RETURNS VOID AS $$
        DECLARE
            article_rec RECORD;
            rec_type VARCHAR(10);
            sample_array DECIMAL(15,2)[];
            sample_size INT;
            used_days INT;
            centroids DECIMAL(15,2)[];
            rounded_amounts DECIMAL(15,2)[];
            k INT := 4;  -- Number of clusters
            min_sample_size INT := 20;

            -- For Part 1 (Global)
            global_rec RECORD;
        BEGIN
            -- Delete old computed recommendations (keep defaults)
            DELETE FROM t_recommended_amounts
            WHERE metadata->>'source' != 'default' OR article_id IS NOT NULL;

            -- ==============================================================
            -- Part 1: Global recommendations (UNCHANGED - fixed 90 days)
            -- ==============================================================
            FOR global_rec IN
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
                -- Apply K-means clustering
                centroids := kmeans_init_quantile(global_rec.amounts_array, k);
                centroids := kmeans_iterate(global_rec.amounts_array, centroids);

                -- Round to nice numbers and sort
                rounded_amounts := ARRAY(
                    SELECT round_to_nice(unnest(centroids))
                    ORDER BY 1
                );

                -- Insert global recommendation
                INSERT INTO t_recommended_amounts (
                    article_id,
                    type,
                    record_type,
                    period,
                    amounts,
                    metadata
                )
                VALUES (
                    NULL,  -- Global
                    global_rec.type,
                    global_rec.record_type,
                    'quarter',
                    rounded_amounts,
                    jsonb_build_object(
                        'source', 'kmeans',
                        'sample_size', global_rec.sample_size,
                        'days_analyzed', 90,
                        'updated_at', NOW()
                    )
                )
                ON CONFLICT (article_id, type, record_type, period)
                DO UPDATE SET
                    amounts = EXCLUDED.amounts,
                    metadata = EXCLUDED.metadata;
            END LOOP;

            -- ==============================================================
            -- Part 2: Per-category recommendations (ADAPTIVE PERIOD)
            -- ==============================================================
            -- Process ALL leaf categories (removed LIMIT 10)
            FOR article_rec IN
                SELECT DISTINCT a.id, a.type
                FROM t_d_article a
                WHERE a.is_current = TRUE
                  -- ✅ NEW: Filter only leaf categories (exclude parent nodes)
                  AND NOT EXISTS (
                      SELECT 1 FROM t_d_article c
                      WHERE c.parent_id = a.id AND c.is_current = TRUE
                  )
            LOOP
                -- Process both fact and plan separately
                FOR rec_type IN
                    SELECT UNNEST(ARRAY['fact', 'plan']::VARCHAR[])
                LOOP
                    sample_array := NULL;
                    sample_size := 0;
                    used_days := NULL;

                    -- ✅ ADAPTIVE PERIOD: Try 90 → 180 → 270 → 360 days

                    -- Attempt 1: 90 days
                    SELECT
                        ARRAY_AGG(bf.amount ORDER BY bf.amount),
                        COUNT(*)
                    INTO sample_array, sample_size
                    FROM t_f_budget_fact bf
                    WHERE bf.article_id = article_rec.id
                      AND bf.record_type = rec_type
                      AND bf.fact_date >= CURRENT_DATE - INTERVAL '90 days'
                      AND bf.amount > 0;

                    IF sample_size >= min_sample_size THEN
                        used_days := 90;
                    ELSE
                        -- Attempt 2: 180 days
                        SELECT
                            ARRAY_AGG(bf.amount ORDER BY bf.amount),
                            COUNT(*)
                        INTO sample_array, sample_size
                        FROM t_f_budget_fact bf
                        WHERE bf.article_id = article_rec.id
                          AND bf.record_type = rec_type
                          AND bf.fact_date >= CURRENT_DATE - INTERVAL '180 days'
                          AND bf.amount > 0;

                        IF sample_size >= min_sample_size THEN
                            used_days := 180;
                        ELSE
                            -- Attempt 3: 270 days
                            SELECT
                                ARRAY_AGG(bf.amount ORDER BY bf.amount),
                                COUNT(*)
                            INTO sample_array, sample_size
                            FROM t_f_budget_fact bf
                            WHERE bf.article_id = article_rec.id
                              AND bf.record_type = rec_type
                              AND bf.fact_date >= CURRENT_DATE - INTERVAL '270 days'
                              AND bf.amount > 0;

                            IF sample_size >= min_sample_size THEN
                                used_days := 270;
                            ELSE
                                -- Attempt 4: 360 days (last resort)
                                SELECT
                                    ARRAY_AGG(bf.amount ORDER BY bf.amount),
                                    COUNT(*)
                                INTO sample_array, sample_size
                                FROM t_f_budget_fact bf
                                WHERE bf.article_id = article_rec.id
                                  AND bf.record_type = rec_type
                                  AND bf.fact_date >= CURRENT_DATE - INTERVAL '360 days'
                                  AND bf.amount > 0;

                                IF sample_size >= min_sample_size THEN
                                    used_days := 360;
                                END IF;
                                -- ELSE: Skip category (insufficient data even for 360 days)
                            END IF;
                        END IF;
                    END IF;

                    -- If sufficient data found, compute K-means
                    IF used_days IS NOT NULL THEN
                        -- Apply K-means clustering
                        centroids := kmeans_init_quantile(sample_array, k);
                        centroids := kmeans_iterate(sample_array, centroids);

                        -- Round to nice numbers and sort
                        rounded_amounts := ARRAY(
                            SELECT round_to_nice(unnest(centroids))
                            ORDER BY 1
                        );

                        -- Insert category-specific recommendation
                        INSERT INTO t_recommended_amounts (
                            article_id,
                            type,
                            record_type,
                            period,
                            amounts,
                            metadata
                        )
                        VALUES (
                            article_rec.id,
                            article_rec.type,
                            rec_type,
                            'quarter',
                            rounded_amounts,
                            jsonb_build_object(
                                'source', 'kmeans',
                                'sample_size', sample_size,
                                'days_analyzed', used_days,  -- ✅ NEW: Store which period used
                                'updated_at', NOW()
                            )
                        )
                        ON CONFLICT (article_id, type, record_type, period)
                        DO UPDATE SET
                            amounts = EXCLUDED.amounts,
                            metadata = EXCLUDED.metadata,
                            last_updated = CURRENT_TIMESTAMP;
                    END IF;
                    -- ELSE: Category skipped (will not appear in t_recommended_amounts)
                END LOOP;
            END LOOP;

        END;
        $$ LANGUAGE plpgsql
    """)


def downgrade() -> None:
    """
    Downgrade: Restore previous version (TOP-10, fixed 90 days).

    Recreate d1b4c09aa285 version without adaptive period.
    """

    # Drop adaptive version
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE")

    # Restore previous version (d1b4c09aa285)
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

            -- Part 1: Global recommendations
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
                    article_id,
                    type,
                    record_type,
                    period,
                    amounts,
                    metadata
                )
                VALUES (
                    NULL,
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

            -- Part 2: TOP-10 popular (restored)
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
                LIMIT 10  -- Restored
            LOOP
                centroids := kmeans_init_quantile(rec.amounts_array, k);
                centroids := kmeans_iterate(rec.amounts_array, centroids);
                rounded_amounts := ARRAY(
                    SELECT round_to_nice(unnest(centroids))
                    ORDER BY 1
                );

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
