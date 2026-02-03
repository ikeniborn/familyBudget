"""add_recalculate_recommended_amounts_function

Revision ID: b2232d851007
Revises: 713fcefee450
Create Date: 2025-11-12 13:36:16.937714

"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'b2232d851007'
down_revision: str | None = '713fcefee450'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Creates PostgreSQL function recalculate_recommended_amounts() which:
    - Uses K-means clustering (k=4) on transaction history (last 90 days)
    - Calculates recommended amounts for quick selection buttons
    - Updates t_recommended_amounts table

    Algorithm:
    - Global recommendations: 4 variations (fact/plan × expense/income)
    - Per-category recommendations: TOP-10 popular categories
    - K-means with quantile-based initialization (Lloyd's algorithm)
    - Minimum sample size: 20 transactions (fallback to defaults)
    - Results rounded to "nice" numbers via round_to_nice()
    """

    # Step 1: Create K-means helper function - initialize centroids using quantiles
    op.execute("""
        CREATE OR REPLACE FUNCTION kmeans_init_quantile(amounts DECIMAL(15,2)[], k INT)
        RETURNS DECIMAL(15,2)[] AS $$
        DECLARE
            sorted_amounts DECIMAL(15,2)[];
            centroids DECIMAL(15,2)[];
            i INT;
            quantile_idx INT;
        BEGIN
            -- Sort amounts ascending
            sorted_amounts := ARRAY(SELECT unnest(amounts) ORDER BY 1);

            -- Initialize centroids at quantile positions
            FOR i IN 1..k LOOP
                quantile_idx := GREATEST(1, LEAST(
                    array_length(sorted_amounts, 1),
                    FLOOR((i::DECIMAL / (k + 1)) * array_length(sorted_amounts, 1))::INT
                ));
                centroids[i] := sorted_amounts[quantile_idx];
            END LOOP;

            RETURN centroids;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE
    """)

    # Step 2: Create K-means iteration function (Lloyd's algorithm)
    op.execute("""
        CREATE OR REPLACE FUNCTION kmeans_iterate(
            amounts DECIMAL(15,2)[],
            centroids DECIMAL(15,2)[],
            max_iterations INT DEFAULT 50,
            tolerance DECIMAL DEFAULT 0.01
        )
        RETURNS DECIMAL(15,2)[] AS $$
        DECLARE
            k INT := array_length(centroids, 1);
            iteration INT := 0;
            converged BOOLEAN := FALSE;
            new_centroids DECIMAL(15,2)[];
            cluster_sums DECIMAL(15,2)[];
            cluster_counts INT[];
            amount DECIMAL(15,2);
            closest_centroid_idx INT;
            min_distance DECIMAL;
            distance DECIMAL;
            i INT;
            max_change DECIMAL;
        BEGIN
            WHILE iteration < max_iterations AND NOT converged LOOP
                -- Initialize cluster sums and counts
                cluster_sums := ARRAY_FILL(0::DECIMAL(15,2), ARRAY[k]);
                cluster_counts := ARRAY_FILL(0, ARRAY[k]);

                -- Assign each amount to nearest centroid
                FOREACH amount IN ARRAY amounts LOOP
                    min_distance := NULL;
                    closest_centroid_idx := 1;

                    FOR i IN 1..k LOOP
                        distance := ABS(amount - centroids[i]);
                        IF min_distance IS NULL OR distance < min_distance THEN
                            min_distance := distance;
                            closest_centroid_idx := i;
                        END IF;
                    END LOOP;

                    -- Add to cluster sum
                    cluster_sums[closest_centroid_idx] := cluster_sums[closest_centroid_idx] + amount;
                    cluster_counts[closest_centroid_idx] := cluster_counts[closest_centroid_idx] + 1;
                END LOOP;

                -- Calculate new centroids
                max_change := 0;
                FOR i IN 1..k LOOP
                    IF cluster_counts[i] > 0 THEN
                        new_centroids[i] := cluster_sums[i] / cluster_counts[i];
                    ELSE
                        -- Keep old centroid if cluster is empty
                        new_centroids[i] := centroids[i];
                    END IF;

                    -- Track maximum change for convergence detection
                    max_change := GREATEST(max_change, ABS(new_centroids[i] - centroids[i]));
                END LOOP;

                -- Check convergence
                IF max_change < tolerance THEN
                    converged := TRUE;
                END IF;

                centroids := new_centroids;
                iteration := iteration + 1;
            END LOOP;

            RETURN centroids;
        END;
        $$ LANGUAGE plpgsql IMMUTABLE
    """)

    # Step 3: Create main recalculate_recommended_amounts function
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
                    AND bf.is_current = TRUE
                    AND a.is_current = TRUE
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
                    AND bf.is_current = TRUE
                    AND a.is_current = TRUE
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
    """Drop K-means functions and recalculate_recommended_amounts."""

    # Drop main function
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts()")

    # Drop K-means helpers
    op.execute("DROP FUNCTION IF EXISTS kmeans_iterate(DECIMAL(15,2)[], DECIMAL(15,2)[], INT, DECIMAL)")
    op.execute("DROP FUNCTION IF EXISTS kmeans_init_quantile(DECIMAL(15,2)[], INT)")
