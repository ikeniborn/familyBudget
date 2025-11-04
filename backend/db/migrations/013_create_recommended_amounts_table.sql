-- ============================================================================
-- Migration: 013_create_recommended_amounts_table.sql
-- Description: Create recommended amounts table for smart quick amount suggestions
-- Author: ClaudeCode Implementation System
-- Date: 2025-11-04
-- Task: Smart Amount Suggestions with K-means Clustering
-- ============================================================================

-- ============================================================================
-- TABLE: t_recommended_amounts
-- Purpose: Store pre-calculated recommended amounts for quick selection buttons
-- Algorithm: K-means clustering (4 clusters) on historical transaction data
-- Pattern: Cache table (recalculated nightly at 02:00 UTC)
-- ============================================================================

CREATE TABLE IF NOT EXISTS t_recommended_amounts (
    -- Primary key
    id SERIAL PRIMARY KEY,

    -- Optional category filter (NULL = global recommendations)
    article_id INTEGER,

    -- Transaction type filter ('income' | 'expense' | NULL for all)
    type VARCHAR(20),

    -- Record type ('fact' | 'plan')
    record_type VARCHAR(10) NOT NULL DEFAULT 'fact',

    -- Analysis period ('week' | 'month' | 'quarter' | 'year')
    -- Default: 'quarter' (90 days) as per user selection
    period VARCHAR(20) NOT NULL DEFAULT 'quarter',

    -- Recommended amounts (4 values from K-means clustering)
    -- Array of DECIMAL values, e.g., [100, 500, 1000, 5000]
    amounts DECIMAL(15,2)[] NOT NULL,

    -- Metadata about calculation (JSONB for flexibility)
    -- Example: {"sample_size": 50, "min_amount": 100, "max_amount": 10000, "avg_amount": 1500, "period_days": 90}
    metadata JSONB,

    -- Last calculation timestamp
    last_updated TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Foreign key constraint (cascade delete when article is deleted)
    CONSTRAINT fk_recommended_amounts_article
        FOREIGN KEY (article_id)
        REFERENCES t_d_article(id)
        ON DELETE CASCADE,

    -- Business rules
    -- Exactly 4 recommended amounts (for 4 quick buttons)
    CONSTRAINT check_amounts_count
        CHECK (array_length(amounts, 1) = 4),

    -- All amounts must be positive
    CONSTRAINT check_amounts_positive
        CHECK (
            amounts[1] > 0 AND
            amounts[2] > 0 AND
            amounts[3] > 0 AND
            amounts[4] > 0
        ),

    -- Amounts must be in ascending order
    CONSTRAINT check_amounts_ordered
        CHECK (
            amounts[1] <= amounts[2] AND
            amounts[2] <= amounts[3] AND
            amounts[3] <= amounts[4]
        ),

    -- Valid transaction type values
    CONSTRAINT check_type_values
        CHECK (type IS NULL OR type IN ('income', 'expense')),

    -- Valid record type values
    CONSTRAINT check_record_type_values
        CHECK (record_type IN ('fact', 'plan')),

    -- Valid period values
    CONSTRAINT check_period_values
        CHECK (period IN ('week', 'month', 'quarter', 'year')),

    -- Unique constraint: one recommendation per (article, type, record_type, period) combination
    CONSTRAINT unique_recommendation_key
        UNIQUE NULLS NOT DISTINCT (article_id, type, record_type, period)
);

-- ============================================================================
-- INDEXES: Performance optimization for lookup queries
-- ============================================================================

-- Index for lookup by article_id (most common query)
CREATE INDEX idx_recommended_amounts_article
    ON t_recommended_amounts(article_id)
    WHERE article_id IS NOT NULL;

-- Index for global recommendations (article_id IS NULL)
CREATE INDEX idx_recommended_amounts_global
    ON t_recommended_amounts(type, record_type, period)
    WHERE article_id IS NULL;

-- Index for type filtering
CREATE INDEX idx_recommended_amounts_type
    ON t_recommended_amounts(type)
    WHERE type IS NOT NULL;

-- Index for record_type filtering
CREATE INDEX idx_recommended_amounts_record_type
    ON t_recommended_amounts(record_type);

-- Composite index for fast lookups (article + type + record_type + period)
CREATE INDEX idx_recommended_amounts_lookup
    ON t_recommended_amounts(article_id, type, record_type, period);

-- Index for finding stale records (for cleanup jobs)
CREATE INDEX idx_recommended_amounts_last_updated
    ON t_recommended_amounts(last_updated);

-- ============================================================================
-- COMMENTS: PostgreSQL system catalog documentation
-- ============================================================================

COMMENT ON TABLE t_recommended_amounts IS
'Pre-calculated recommended amounts for quick selection buttons in transaction forms.
Calculated nightly at 02:00 UTC using K-means clustering on last 90 days of transaction history.';

COMMENT ON COLUMN t_recommended_amounts.article_id IS
'Optional category filter. NULL means global recommendations (all categories).';

COMMENT ON COLUMN t_recommended_amounts.type IS
'Transaction type filter: income, expense, or NULL (all types).';

COMMENT ON COLUMN t_recommended_amounts.record_type IS
'Record type: fact (actual transactions) or plan (planned transactions).
Plans typically have larger amounts (5k-50k) compared to facts (100-5k).';

COMMENT ON COLUMN t_recommended_amounts.period IS
'Historical analysis period: week (7d), month (30d), quarter (90d), year (365d).
Default: quarter (90 days) as per user selection.';

COMMENT ON COLUMN t_recommended_amounts.amounts IS
'Array of 4 recommended amounts calculated via K-means clustering.
Values are sorted in ascending order and rounded to "nice" numbers (50, 100, 500, 1000, etc.).';

COMMENT ON COLUMN t_recommended_amounts.metadata IS
'JSONB metadata about calculation: sample_size, min_amount, max_amount, avg_amount, period_days, algorithm_version, convergence_iterations.';

COMMENT ON COLUMN t_recommended_amounts.last_updated IS
'Timestamp of last calculation. Used for cache invalidation and stale record detection.';

-- ============================================================================
-- INITIAL DATA: Default recommendations for new users
-- ============================================================================

-- Global recommendations for expenses (facts)
INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata)
VALUES (
    NULL,
    'expense',
    'fact',
    'quarter',
    ARRAY[100, 500, 1000, 5000]::DECIMAL(15,2)[],
    '{"source": "default", "note": "Initial default values for new installations"}'::JSONB
)
ON CONFLICT (article_id, type, record_type, period) DO NOTHING;

-- Global recommendations for income (facts)
INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata)
VALUES (
    NULL,
    'income',
    'fact',
    'quarter',
    ARRAY[10000, 20000, 50000, 100000]::DECIMAL(15,2)[],
    '{"source": "default", "note": "Initial default values for new installations"}'::JSONB
)
ON CONFLICT (article_id, type, record_type, period) DO NOTHING;

-- Global recommendations for expenses (plans)
INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata)
VALUES (
    NULL,
    'expense',
    'plan',
    'quarter',
    ARRAY[5000, 10000, 20000, 50000]::DECIMAL(15,2)[],
    '{"source": "default", "note": "Initial default values for new installations. Plans typically have larger amounts than facts."}'::JSONB
)
ON CONFLICT (article_id, type, record_type, period) DO NOTHING;

-- Global recommendations for income (plans)
INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata)
VALUES (
    NULL,
    'income',
    'plan',
    'quarter',
    ARRAY[20000, 50000, 100000, 200000]::DECIMAL(15,2)[],
    '{"source": "default", "note": "Initial default values for new installations. Plans typically have larger amounts than facts."}'::JSONB
)
ON CONFLICT (article_id, type, record_type, period) DO NOTHING;

-- ============================================================================
-- POSTGRESQL FUNCTIONS: K-means Clustering and Calculation
-- ============================================================================

-- ----------------------------------------------------------------------------
-- FUNCTION: round_to_nice
-- Purpose: Round amount to "nice" numbers (10, 50, 100, 500, 1000, etc.)
-- Used for: Making recommended amounts human-friendly
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION round_to_nice(amount DECIMAL(15,2))
RETURNS DECIMAL(15,2) AS $$
BEGIN
    -- Handle edge cases
    IF amount IS NULL OR amount <= 0 THEN
        RETURN 100;  -- Default minimum
    END IF;

    -- Round to nice numbers based on magnitude
    IF amount < 100 THEN
        -- Round to nearest 10: 10, 20, 30, 40, 50, 60, 70, 80, 90
        RETURN GREATEST(10, ROUND(amount / 10) * 10);
    ELSIF amount < 1000 THEN
        -- Round to nearest 50: 100, 150, 200, 250, 300, ..., 950
        RETURN ROUND(amount / 50) * 50;
    ELSIF amount < 10000 THEN
        -- Round to nearest 100: 1000, 1100, 1200, ..., 9900
        RETURN ROUND(amount / 100) * 100;
    ELSIF amount < 100000 THEN
        -- Round to nearest 1000: 10000, 11000, 12000, ..., 99000
        RETURN ROUND(amount / 1000) * 1000;
    ELSE
        -- Round to nearest 10000: 100000, 110000, 120000, ...
        RETURN ROUND(amount / 10000) * 10000;
    END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION round_to_nice(DECIMAL) IS
'Round amount to human-friendly "nice" numbers (10, 50, 100, 500, 1000, etc.).
Rounding granularity increases with magnitude for better UX.';

-- ----------------------------------------------------------------------------
-- FUNCTION: k_means_clustering_1d
-- Purpose: K-means clustering algorithm for 1-dimensional data (amounts)
-- Algorithm: Lloyd's algorithm with smart initialization
-- Returns: Array of 4 cluster centroids (sorted)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION k_means_clustering_1d(
    amounts DECIMAL(15,2)[],
    k INTEGER DEFAULT 4,
    max_iterations INTEGER DEFAULT 20,
    epsilon DECIMAL(15,2) DEFAULT 1.0
)
RETURNS DECIMAL(15,2)[] AS $$
DECLARE
    n INTEGER;
    centroids DECIMAL(15,2)[];
    old_centroids DECIMAL(15,2)[];
    assignments INTEGER[];
    iteration INTEGER := 0;
    converged BOOLEAN := FALSE;
    i INTEGER;
    j INTEGER;
    min_dist DECIMAL(15,2);
    dist DECIMAL(15,2);
    cluster_id INTEGER;
    cluster_sum DECIMAL(15,2);
    cluster_count INTEGER;
    max_change DECIMAL(15,2);
BEGIN
    -- Validate inputs
    n := array_length(amounts, 1);
    IF n IS NULL OR n < k THEN
        -- Not enough data points, return evenly spaced values
        RETURN ARRAY[
            round_to_nice(100),
            round_to_nice(500),
            round_to_nice(1000),
            round_to_nice(5000)
        ];
    END IF;

    -- Initialize centroids using quantile-based method (better than random)
    -- This ensures initial centroids are spread across the data range
    centroids := ARRAY[
        (SELECT percentile_cont(0.10) WITHIN GROUP (ORDER BY v) FROM unnest(amounts) v),
        (SELECT percentile_cont(0.35) WITHIN GROUP (ORDER BY v) FROM unnest(amounts) v),
        (SELECT percentile_cont(0.65) WITHIN GROUP (ORDER BY v) FROM unnest(amounts) v),
        (SELECT percentile_cont(0.90) WITHIN GROUP (ORDER BY v) FROM unnest(amounts) v)
    ];

    -- K-means iteration loop (Lloyd's algorithm)
    WHILE iteration < max_iterations AND NOT converged LOOP
        iteration := iteration + 1;
        old_centroids := centroids;

        -- Assignment step: assign each point to nearest centroid
        assignments := ARRAY[]::INTEGER[];
        FOR i IN 1..n LOOP
            min_dist := NULL;
            cluster_id := 1;

            -- Find nearest centroid
            FOR j IN 1..k LOOP
                dist := ABS(amounts[i] - centroids[j]);
                IF min_dist IS NULL OR dist < min_dist THEN
                    min_dist := dist;
                    cluster_id := j;
                END IF;
            END LOOP;

            assignments := array_append(assignments, cluster_id);
        END LOOP;

        -- Update step: recalculate centroids
        FOR j IN 1..k LOOP
            cluster_sum := 0;
            cluster_count := 0;

            -- Calculate mean of points in cluster j
            FOR i IN 1..n LOOP
                IF assignments[i] = j THEN
                    cluster_sum := cluster_sum + amounts[i];
                    cluster_count := cluster_count + 1;
                END IF;
            END LOOP;

            -- Update centroid (keep old if cluster is empty)
            IF cluster_count > 0 THEN
                centroids[j] := cluster_sum / cluster_count;
            END IF;
        END LOOP;

        -- Check convergence: max change in centroids < epsilon
        max_change := 0;
        FOR j IN 1..k LOOP
            max_change := GREATEST(max_change, ABS(centroids[j] - old_centroids[j]));
        END LOOP;

        IF max_change < epsilon THEN
            converged := TRUE;
        END IF;
    END LOOP;

    -- Sort centroids in ascending order
    SELECT ARRAY_AGG(v ORDER BY v)
    INTO centroids
    FROM unnest(centroids) v;

    -- Round centroids to nice numbers
    FOR i IN 1..k LOOP
        centroids[i] := round_to_nice(centroids[i]);
    END LOOP;

    -- Ensure uniqueness by adding small increments if needed
    FOR i IN 2..k LOOP
        IF centroids[i] = centroids[i-1] THEN
            -- Duplicate detected, increment slightly
            IF centroids[i] < 1000 THEN
                centroids[i] := centroids[i] + 50;
            ELSE
                centroids[i] := centroids[i] + 500;
            END IF;
            centroids[i] := round_to_nice(centroids[i]);
        END IF;
    END LOOP;

    RETURN centroids;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION k_means_clustering_1d(DECIMAL[], INTEGER, INTEGER, DECIMAL) IS
'K-means clustering for 1D data (amounts). Returns 4 cluster centroids sorted and rounded to nice numbers.
Uses Lloyd''s algorithm with quantile-based initialization for better convergence.';

-- ----------------------------------------------------------------------------
-- FUNCTION: calculate_recommended_amounts
-- Purpose: Calculate recommended amounts for specific filters
-- Returns: Array of 4 amounts or NULL if insufficient data
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION calculate_recommended_amounts(
    p_article_id INTEGER DEFAULT NULL,
    p_type VARCHAR(20) DEFAULT NULL,
    p_record_type VARCHAR(10) DEFAULT 'fact',
    p_period VARCHAR(20) DEFAULT 'quarter',
    p_min_sample_size INTEGER DEFAULT 20
)
RETURNS TABLE(
    amounts DECIMAL(15,2)[],
    sample_size INTEGER,
    min_amount DECIMAL(15,2),
    max_amount DECIMAL(15,2),
    avg_amount DECIMAL(15,2),
    period_days INTEGER
) AS $$
DECLARE
    start_date DATE;
    amount_array DECIMAL(15,2)[];
    result_amounts DECIMAL(15,2)[];
    v_sample_size INTEGER;
    v_min_amount DECIMAL(15,2);
    v_max_amount DECIMAL(15,2);
    v_avg_amount DECIMAL(15,2);
    v_period_days INTEGER;
BEGIN
    -- Calculate start date based on period
    v_period_days := CASE
        WHEN p_period = 'week' THEN 7
        WHEN p_period = 'month' THEN 30
        WHEN p_period = 'quarter' THEN 90
        WHEN p_period = 'year' THEN 365
        ELSE 90
    END;

    start_date := CURRENT_DATE - INTERVAL '1 day' * v_period_days;

    -- Collect transaction amounts
    SELECT
        ARRAY_AGG(f.amount ORDER BY f.amount),
        COUNT(*),
        MIN(f.amount),
        MAX(f.amount),
        AVG(f.amount)
    INTO
        amount_array,
        v_sample_size,
        v_min_amount,
        v_max_amount,
        v_avg_amount
    FROM t_f_budget_fact f
    JOIN t_d_article a ON f.article_id = a.id
    WHERE f.fact_date >= start_date
      AND f.record_type = p_record_type
      AND (p_article_id IS NULL OR f.article_id = p_article_id)
      AND (p_type IS NULL OR a.type = p_type)
      AND a.is_current = TRUE;

    -- Check if we have enough data
    IF v_sample_size IS NULL OR v_sample_size < p_min_sample_size THEN
        -- Insufficient data, return NULL (will use defaults)
        RETURN QUERY SELECT NULL::DECIMAL(15,2)[], 0, 0::DECIMAL(15,2), 0::DECIMAL(15,2), 0::DECIMAL(15,2), v_period_days;
        RETURN;
    END IF;

    -- Apply K-means clustering
    result_amounts := k_means_clustering_1d(amount_array, 4, 20, 1.0);

    -- Return results
    RETURN QUERY SELECT result_amounts, v_sample_size, v_min_amount, v_max_amount, v_avg_amount, v_period_days;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION calculate_recommended_amounts(INTEGER, VARCHAR, VARCHAR, VARCHAR, INTEGER) IS
'Calculate recommended amounts using K-means clustering on historical transaction data.
Returns NULL amounts if sample size is below minimum threshold (default: 20 transactions).';

-- ----------------------------------------------------------------------------
-- FUNCTION: recalculate_recommended_amounts
-- Purpose: Main function to recalculate all recommendations (called by scheduler)
-- Strategy: Recalculate TOP-10 popular categories + global recommendations
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION recalculate_recommended_amounts()
RETURNS VOID AS $$
DECLARE
    v_article RECORD;
    v_result RECORD;
    v_metadata JSONB;
BEGIN
    -- ========================================================================
    -- STEP 1: Recalculate GLOBAL recommendations (article_id = NULL)
    -- ========================================================================

    -- Global facts: expense
    SELECT * INTO v_result FROM calculate_recommended_amounts(NULL, 'expense', 'fact', 'quarter', 20);
    IF v_result.amounts IS NOT NULL THEN
        v_metadata := jsonb_build_object(
            'source', 'k_means',
            'sample_size', v_result.sample_size,
            'min_amount', v_result.min_amount,
            'max_amount', v_result.max_amount,
            'avg_amount', v_result.avg_amount,
            'period_days', v_result.period_days,
            'algorithm_version', '1.0'
        );

        INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata, last_updated)
        VALUES (NULL, 'expense', 'fact', 'quarter', v_result.amounts, v_metadata, CURRENT_TIMESTAMP)
        ON CONFLICT (article_id, type, record_type, period)
        DO UPDATE SET amounts = v_result.amounts, metadata = v_metadata, last_updated = CURRENT_TIMESTAMP;
    END IF;

    -- Global facts: income
    SELECT * INTO v_result FROM calculate_recommended_amounts(NULL, 'income', 'fact', 'quarter', 20);
    IF v_result.amounts IS NOT NULL THEN
        v_metadata := jsonb_build_object(
            'source', 'k_means',
            'sample_size', v_result.sample_size,
            'min_amount', v_result.min_amount,
            'max_amount', v_result.max_amount,
            'avg_amount', v_result.avg_amount,
            'period_days', v_result.period_days,
            'algorithm_version', '1.0'
        );

        INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata, last_updated)
        VALUES (NULL, 'income', 'fact', 'quarter', v_result.amounts, v_metadata, CURRENT_TIMESTAMP)
        ON CONFLICT (article_id, type, record_type, period)
        DO UPDATE SET amounts = v_result.amounts, metadata = v_metadata, last_updated = CURRENT_TIMESTAMP;
    END IF;

    -- Global plans: expense
    SELECT * INTO v_result FROM calculate_recommended_amounts(NULL, 'expense', 'plan', 'quarter', 20);
    IF v_result.amounts IS NOT NULL THEN
        v_metadata := jsonb_build_object(
            'source', 'k_means',
            'sample_size', v_result.sample_size,
            'min_amount', v_result.min_amount,
            'max_amount', v_result.max_amount,
            'avg_amount', v_result.avg_amount,
            'period_days', v_result.period_days,
            'algorithm_version', '1.0'
        );

        INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata, last_updated)
        VALUES (NULL, 'expense', 'plan', 'quarter', v_result.amounts, v_metadata, CURRENT_TIMESTAMP)
        ON CONFLICT (article_id, type, record_type, period)
        DO UPDATE SET amounts = v_result.amounts, metadata = v_metadata, last_updated = CURRENT_TIMESTAMP;
    END IF;

    -- Global plans: income
    SELECT * INTO v_result FROM calculate_recommended_amounts(NULL, 'income', 'plan', 'quarter', 20);
    IF v_result.amounts IS NOT NULL THEN
        v_metadata := jsonb_build_object(
            'source', 'k_means',
            'sample_size', v_result.sample_size,
            'min_amount', v_result.min_amount,
            'max_amount', v_result.max_amount,
            'avg_amount', v_result.avg_amount,
            'period_days', v_result.period_days,
            'algorithm_version', '1.0'
        );

        INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata, last_updated)
        VALUES (NULL, 'income', 'plan', 'quarter', v_result.amounts, v_metadata, CURRENT_TIMESTAMP)
        ON CONFLICT (article_id, type, record_type, period)
        DO UPDATE SET amounts = v_result.amounts, metadata = v_metadata, last_updated = CURRENT_TIMESTAMP;
    END IF;

    -- ========================================================================
    -- STEP 2: Recalculate TOP-10 popular categories (from t_article_usage_stats)
    -- ========================================================================

    FOR v_article IN
        SELECT a.id, a.type
        FROM t_article_usage_stats s
        JOIN t_d_article a ON s.article_id = a.id
        WHERE a.is_current = TRUE
        ORDER BY s.usage_count DESC
        LIMIT 10
    LOOP
        -- Calculate for facts
        SELECT * INTO v_result FROM calculate_recommended_amounts(v_article.id, v_article.type, 'fact', 'quarter', 20);
        IF v_result.amounts IS NOT NULL THEN
            v_metadata := jsonb_build_object(
                'source', 'k_means',
                'article_id', v_article.id,
                'sample_size', v_result.sample_size,
                'min_amount', v_result.min_amount,
                'max_amount', v_result.max_amount,
                'avg_amount', v_result.avg_amount,
                'period_days', v_result.period_days,
                'algorithm_version', '1.0'
            );

            INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata, last_updated)
            VALUES (v_article.id, v_article.type, 'fact', 'quarter', v_result.amounts, v_metadata, CURRENT_TIMESTAMP)
            ON CONFLICT (article_id, type, record_type, period)
            DO UPDATE SET amounts = v_result.amounts, metadata = v_metadata, last_updated = CURRENT_TIMESTAMP;
        END IF;

        -- Calculate for plans
        SELECT * INTO v_result FROM calculate_recommended_amounts(v_article.id, v_article.type, 'plan', 'quarter', 20);
        IF v_result.amounts IS NOT NULL THEN
            v_metadata := jsonb_build_object(
                'source', 'k_means',
                'article_id', v_article.id,
                'sample_size', v_result.sample_size,
                'min_amount', v_result.min_amount,
                'max_amount', v_result.max_amount,
                'avg_amount', v_result.avg_amount,
                'period_days', v_result.period_days,
                'algorithm_version', '1.0'
            );

            INSERT INTO t_recommended_amounts (article_id, type, record_type, period, amounts, metadata, last_updated)
            VALUES (v_article.id, v_article.type, 'plan', 'quarter', v_result.amounts, v_metadata, CURRENT_TIMESTAMP)
            ON CONFLICT (article_id, type, record_type, period)
            DO UPDATE SET amounts = v_result.amounts, metadata = v_metadata, last_updated = CURRENT_TIMESTAMP;
        END IF;
    END LOOP;

    RAISE NOTICE 'Recommended amounts recalculation completed successfully';
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_recommended_amounts() IS
'Main function to recalculate all recommended amounts (called by scheduler nightly at 02:00 UTC).
Recalculates: (1) Global recommendations (4 variations), (2) TOP-10 popular categories (facts + plans).';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
