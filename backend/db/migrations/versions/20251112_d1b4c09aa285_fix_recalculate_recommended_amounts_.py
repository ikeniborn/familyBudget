"""fix_recalculate_recommended_amounts_join_error

Revision ID: d1b4c09aa285
Revises: b2232d851007
Create Date: 2025-11-12 14:23:47.393475

Fixes critical SQL errors in recalculate_recommended_amounts():
- ERROR #1: column "fact_type" does not exist in t_f_budget_fact
- ERROR #2: column "bf.is_current" does not exist in t_f_budget_fact
- Solution: Add INNER JOIN with t_d_article to get type + is_current from article
- Part 1 (Global): Replace fact_type with a.type + add JOIN + remove bf.is_current
- Part 2 (Per-category): Replace bf.fact_type with a.type + add JOIN + remove bf.is_current

Root cause:
- t_f_budget_fact does NOT have fact_type or is_current columns
- Article type (expense/income) stored in t_d_article.type
- SCD Type 2 flag (is_current) stored in t_d_article.is_current
- Required JOIN through article_id FK

Schema structure:
t_f_budget_fact:
  - article_id (FK -> t_d_article.id)
  - record_type (fact/plan)
  - NO fact_type column, NO is_current column



t_d_article (SCD Type 2):
  - id, name
  - type (expense/income) <- NEEDED
  - is_current, valid_from, valid_to <- NEEDED for SCD Type 2 filtering
"""
from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'd1b4c09aa285'
down_revision: str | None = 'b2232d851007'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """
    Recreate recalculate_recommended_amounts() with JOIN fix.

    Changes:
    1. Part 1 (Global recommendations):
       - Added: INNER JOIN t_d_article a ON bf.article_id = a.id
       - Changed: fact_type → a.type
       - Changed: GROUP BY fact_type, record_type → GROUP BY a.type, bf.record_type
       - Removed: bf.is_current = TRUE (column doesn't exist in t_f_budget_fact)
       - Added: a.is_current = TRUE (SCD Type 2 filter from t_d_article)

    2. Part 2 (Per-category recommendations):
       - Added: INNER JOIN t_d_article a ON bf.article_id = a.id
       - Changed: bf.fact_type → a.type
       - Changed: GROUP BY bf.article_id, bf.fact_type, ... → GROUP BY bf.article_id, a.type, ...
       - Removed: bf.is_current = TRUE (column doesn't exist in t_f_budget_fact)
       - Added: a.is_current = TRUE (SCD Type 2 filter from t_d_article)
    """

    # Drop old function with bug
    op.execute("DROP FUNCTION IF EXISTS recalculate_recommended_amounts() CASCADE")

    # Recreate with JOIN fix
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
    """
    Downgrade: Keep the fixed version.

    Note: We do NOT recreate the buggy version with fact_type,
    as it would cause SQL errors. The fix is permanent.

    If downgrade is truly needed (rollback to b2232d851007),
    the function will remain in its working state.
    """
    pass  # Keep fixed function - no downgrade to buggy version
