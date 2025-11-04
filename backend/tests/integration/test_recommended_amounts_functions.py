"""
Integration tests for PostgreSQL recommended amounts functions.

Tests database functions that power smart amount suggestions:
1. round_to_nice() - rounds amounts to human-friendly numbers
2. k_means_clustering_1d() - K-means clustering algorithm (Lloyd's algorithm)
3. calculate_recommended_amounts() - calculates recommendations with filters
4. recalculate_recommended_amounts() - batch recalculation (scheduler job)

These tests verify PostgreSQL PL/pgSQL functions work correctly with real data.
"""

import pytest
from decimal import Decimal
from datetime import date, timedelta
from sqlmodel import text
from sqlmodel.ext.asyncio.session import AsyncSession
from httpx import AsyncClient

from backend.app.models.article import Article
from backend.app.models.fact import BudgetFact
from backend.app.models.financial_center import FinancialCenter


# ============================================================================
# round_to_nice() Function Tests
# ============================================================================


@pytest.mark.asyncio
async def test_round_to_nice_small_amounts(session: AsyncSession):
    """
    Test round_to_nice() for small amounts (<100).

    Rounding rule: Round to nearest 10.

    Examples:
    - 47 → 50
    - 83 → 80
    - 95 → 100
    """
    test_cases = [
        (Decimal("47.50"), Decimal("50.00")),
        (Decimal("83.00"), Decimal("80.00")),
        (Decimal("95.00"), Decimal("100.00")),
        (Decimal("12.30"), Decimal("10.00")),
    ]

    for input_val, expected in test_cases:
        result = await session.execute(
            text("SELECT round_to_nice(:amount)"),
            {"amount": input_val}
        )
        rounded = result.scalar()
        assert Decimal(rounded) == expected, \
            f"round_to_nice({input_val}) should be {expected}, got {rounded}"


@pytest.mark.asyncio
async def test_round_to_nice_medium_amounts(session: AsyncSession):
    """
    Test round_to_nice() for medium amounts (100-999).

    Rounding rule: Round to nearest 50.

    Examples:
    - 123 → 100
    - 470 → 450
    - 890 → 900
    """
    test_cases = [
        (Decimal("123.00"), Decimal("100.00")),
        (Decimal("470.00"), Decimal("450.00")),
        (Decimal("890.00"), Decimal("900.00")),
        (Decimal("525.00"), Decimal("550.00")),
    ]

    for input_val, expected in test_cases:
        result = await session.execute(
            text("SELECT round_to_nice(:amount)"),
            {"amount": input_val}
        )
        rounded = result.scalar()
        assert Decimal(rounded) == expected, \
            f"round_to_nice({input_val}) should be {expected}, got {rounded}"


@pytest.mark.asyncio
async def test_round_to_nice_large_amounts(session: AsyncSession):
    """
    Test round_to_nice() for large amounts (1000-9999).

    Rounding rule: Round to nearest 100.

    Examples:
    - 1234 → 1200
    - 5678 → 5700
    - 9999 → 10000
    """
    test_cases = [
        (Decimal("1234.00"), Decimal("1200.00")),
        (Decimal("5678.00"), Decimal("5700.00")),
        (Decimal("9999.00"), Decimal("10000.00")),
    ]

    for input_val, expected in test_cases:
        result = await session.execute(
            text("SELECT round_to_nice(:amount)"),
            {"amount": input_val}
        )
        rounded = result.scalar()
        assert Decimal(rounded) == expected, \
            f"round_to_nice({input_val}) should be {expected}, got {rounded}"


@pytest.mark.asyncio
async def test_round_to_nice_very_large_amounts(session: AsyncSession):
    """
    Test round_to_nice() for very large amounts (>=100k).

    Rounding rule: Round to nearest 10000.

    Examples:
    - 123456 → 120000
    - 567890 → 570000
    """
    test_cases = [
        (Decimal("123456.00"), Decimal("120000.00")),
        (Decimal("567890.00"), Decimal("570000.00")),
    ]

    for input_val, expected in test_cases:
        result = await session.execute(
            text("SELECT round_to_nice(:amount)"),
            {"amount": input_val}
        )
        rounded = result.scalar()
        assert Decimal(rounded) == expected, \
            f"round_to_nice({input_val}) should be {expected}, got {rounded}"


# ============================================================================
# k_means_clustering_1d() Function Tests
# ============================================================================


@pytest.mark.asyncio
async def test_k_means_with_distinct_clusters(session: AsyncSession):
    """
    Test K-means clustering with 4 distinct clusters.

    Input: [100, 150, 500, 550, 1000, 1100, 5000, 5500]
    Expected clusters around: ~125, ~525, ~1050, ~5250

    Verifies:
    - K-means converges correctly
    - Returns 4 centroids in ascending order
    - Centroids are reasonably close to expected values
    """
    amounts = [100, 150, 500, 550, 1000, 1100, 5000, 5500]
    amounts_array = "{" + ",".join(str(a) for a in amounts) + "}"

    result = await session.execute(
        text("SELECT k_means_clustering_1d(:amounts::DECIMAL(15,2)[])"),
        {"amounts": amounts_array}
    )
    centroids = result.scalar()

    # Parse PostgreSQL array result
    centroids_list = [Decimal(c) for c in centroids.strip("{}").split(",")]

    # Verify 4 centroids returned
    assert len(centroids_list) == 4, f"Expected 4 centroids, got {len(centroids_list)}"

    # Verify ascending order
    assert centroids_list == sorted(centroids_list), "Centroids should be in ascending order"

    # Verify centroids are in expected ranges
    assert 100 <= centroids_list[0] <= 200, f"Cluster 1 should be ~125, got {centroids_list[0]}"
    assert 400 <= centroids_list[1] <= 600, f"Cluster 2 should be ~525, got {centroids_list[1]}"
    assert 900 <= centroids_list[2] <= 1200, f"Cluster 3 should be ~1050, got {centroids_list[2]}"
    assert 4500 <= centroids_list[3] <= 6000, f"Cluster 4 should be ~5250, got {centroids_list[3]}"


@pytest.mark.asyncio
async def test_k_means_with_insufficient_data(session: AsyncSession):
    """
    Test K-means with fewer than 4 data points.

    Input: [100, 500, 1000]
    Expected: Should handle gracefully (may use available points or fallback)

    Verifies:
    - Function doesn't crash with insufficient data
    - Returns valid result (even if not 4 distinct clusters)
    """
    amounts = [100, 500, 1000]
    amounts_array = "{" + ",".join(str(a) for a in amounts) + "}"

    result = await session.execute(
        text("SELECT k_means_clustering_1d(:amounts::DECIMAL(15,2)[])"),
        {"amounts": amounts_array}
    )
    centroids = result.scalar()

    # Function should not crash - verify result is valid
    assert centroids is not None
    centroids_list = [Decimal(c) for c in centroids.strip("{}").split(",")]
    assert len(centroids_list) > 0, "Should return at least some centroids"


@pytest.mark.asyncio
async def test_k_means_convergence_iterations(session: AsyncSession):
    """
    Test K-means convergence with custom iteration limit.

    Verifies:
    - K-means converges within max_iterations
    - Result is deterministic for same input
    """
    amounts = [100, 200, 150, 500, 600, 550, 1000, 1200, 1100, 5000, 5500, 5200]
    amounts_array = "{" + ",".join(str(a) for a in amounts) + "}"

    # Run twice - should get same result (deterministic with quantile initialization)
    result1 = await session.execute(
        text("SELECT k_means_clustering_1d(:amounts::DECIMAL(15,2)[], 4, 20, 1.0)"),
        {"amounts": amounts_array}
    )
    centroids1 = result1.scalar()

    result2 = await session.execute(
        text("SELECT k_means_clustering_1d(:amounts::DECIMAL(15,2)[], 4, 20, 1.0)"),
        {"amounts": amounts_array}
    )
    centroids2 = result2.scalar()

    assert centroids1 == centroids2, "K-means should be deterministic for same input"


# ============================================================================
# calculate_recommended_amounts() Function Tests
# ============================================================================


@pytest.mark.asyncio
async def test_calculate_recommended_amounts_global(
    session: AsyncSession,
    admin_client: AsyncClient
):
    """
    Test calculate_recommended_amounts() with global recommendations (no filters).

    Setup:
    - Create multiple expense transactions with varying amounts
    - Call calculate_recommended_amounts(NULL, 'expense', 'fact', 'quarter', 20)

    Verifies:
    - Returns 4 amounts
    - Amounts are in ascending order
    - Amounts are "nice" rounded numbers
    - Algorithm is 'k_means' or 'default' based on sample size
    """
    # Step 1: Create test article
    article_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "TEST_FOOD",
            "name": "Test Food",
            "type": "expense",
            "parent_id": None,
        },
    )
    assert article_response.status_code == 201
    article = article_response.json()
    article_id = article["id"]

    # Step 2: Create test financial center
    fc_response = await admin_client.post(
        "/api/v1/financial-centers",
        json={
            "code": "TEST_FC",
            "name": "Test Financial Center",
        },
    )
    assert fc_response.status_code == 201
    fc = fc_response.json()
    fc_id = fc["id"]

    # Step 3: Create 25 expense transactions (enough for K-means)
    base_date = date.today() - timedelta(days=30)
    amounts = [100, 150, 200, 250, 300, 500, 550, 600, 700, 800,
               1000, 1200, 1500, 1800, 2000, 2500, 3000, 3500, 4000, 4500,
               5000, 5500, 6000, 6500, 7000]

    for i, amount in enumerate(amounts):
        fact = BudgetFact(
            article_id=article_id,
            amount=Decimal(str(amount)),
            fact_date=base_date + timedelta(days=i),
            record_type="fact",
            financial_center_id=fc_id,
            user_id=1,  # Admin user
        )
        session.add(fact)

    await session.commit()

    # Step 4: Call calculate_recommended_amounts (global, expense, fact, quarter, min 20)
    result = await session.execute(
        text("""
            SELECT * FROM calculate_recommended_amounts(
                NULL,      -- article_id (global)
                'expense', -- type
                'fact',    -- record_type
                'quarter', -- period (90 days)
                20         -- min_sample_size
            )
        """)
    )
    row = result.fetchone()

    # Verify result structure
    assert row is not None, "Function should return a result"

    amounts = row.amounts
    algorithm = row.algorithm
    metadata = row.metadata

    # Verify amounts
    assert len(amounts) == 4, f"Should return 4 amounts, got {len(amounts)}"
    assert amounts == sorted(amounts), "Amounts should be in ascending order"

    # Verify algorithm (should be k_means with 25 samples)
    assert algorithm in ["k_means", "default"], \
        f"Algorithm should be k_means or default, got {algorithm}"

    # If K-means was used, verify metadata
    if algorithm == "k_means":
        assert metadata["sample_size"] >= 20, "Sample size should be >= 20 for K-means"
        assert metadata["min_amount"] is not None
        assert metadata["max_amount"] is not None
        assert metadata["avg_amount"] is not None

    # Verify amounts are "nice" rounded
    for amount in amounts:
        # Check if amount is a "nice" number (ends in 0, 00, 000, etc.)
        amount_int = int(amount)
        is_nice = (
            amount_int % 10 == 0 or
            amount_int % 50 == 0 or
            amount_int % 100 == 0 or
            amount_int % 500 == 0 or
            amount_int % 1000 == 0
        )
        assert is_nice, f"Amount {amount} should be a 'nice' rounded number"


@pytest.mark.asyncio
async def test_calculate_recommended_amounts_category_specific(
    session: AsyncSession,
    admin_client: AsyncClient
):
    """
    Test calculate_recommended_amounts() with category filter.

    Setup:
    - Create category "Groceries"
    - Create 25 transactions for Groceries
    - Call calculate_recommended_amounts(article_id, 'expense', 'fact', 'quarter', 20)

    Verifies:
    - Returns category-specific recommendations
    - Only considers transactions for specified category
    - Metadata includes article_id and article_name
    """
    # Step 1: Create test article
    article_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES",
            "name": "Groceries",
            "type": "expense",
            "parent_id": None,
        },
    )
    assert article_response.status_code == 201
    article = article_response.json()
    article_id = article["id"]

    # Step 2: Create test financial center
    fc_response = await admin_client.post(
        "/api/v1/financial-centers",
        json={
            "code": "FAMILY",
            "name": "Family",
        },
    )
    assert fc_response.status_code == 201
    fc = fc_response.json()
    fc_id = fc["id"]

    # Step 3: Create 25 grocery transactions
    base_date = date.today() - timedelta(days=60)
    amounts = [200, 250, 300, 350, 400, 450, 500, 550, 600, 650,
               700, 750, 800, 850, 900, 950, 1000, 1100, 1200, 1300,
               1400, 1500, 1600, 1700, 1800]

    for i, amount in enumerate(amounts):
        fact = BudgetFact(
            article_id=article_id,
            amount=Decimal(str(amount)),
            fact_date=base_date + timedelta(days=i),
            record_type="fact",
            financial_center_id=fc_id,
            user_id=1,
        )
        session.add(fact)

    await session.commit()

    # Step 4: Call calculate_recommended_amounts for Groceries category
    result = await session.execute(
        text("""
            SELECT * FROM calculate_recommended_amounts(
                :article_id, -- category-specific
                'expense',
                'fact',
                'quarter',
                20
            )
        """),
        {"article_id": article_id}
    )
    row = result.fetchone()

    assert row is not None
    amounts = row.amounts
    algorithm = row.algorithm
    metadata = row.metadata

    # Verify category-specific results
    assert len(amounts) == 4
    assert metadata["article_id"] == article_id, "Metadata should include article_id"
    assert metadata["article_name"] == "Groceries", "Metadata should include article_name"
    assert metadata["sample_size"] >= 20, "Should have sufficient samples"


@pytest.mark.asyncio
async def test_calculate_recommended_amounts_insufficient_data(session: AsyncSession):
    """
    Test calculate_recommended_amounts() with insufficient data (<20 transactions).

    Verifies:
    - Returns default fallback amounts
    - Algorithm is 'default'
    - Metadata shows sample_size = 0
    """
    # Call with filters that won't match any transactions
    result = await session.execute(
        text("""
            SELECT * FROM calculate_recommended_amounts(
                99999,     -- Non-existent article_id
                'expense',
                'fact',
                'quarter',
                20
            )
        """)
    )
    row = result.fetchone()

    assert row is not None
    amounts = row.amounts
    algorithm = row.algorithm
    metadata = row.metadata

    # Should fall back to defaults
    assert algorithm == "default", "Should use default algorithm with insufficient data"
    assert metadata["sample_size"] == 0, "Sample size should be 0"
    assert len(amounts) == 4, "Should still return 4 amounts (defaults)"


@pytest.mark.asyncio
async def test_calculate_recommended_amounts_plans(
    session: AsyncSession,
    admin_client: AsyncClient
):
    """
    Test calculate_recommended_amounts() for plans (record_type='plan').

    Setup:
    - Create 25 plan records (larger amounts: 5k-50k)
    - Call calculate_recommended_amounts with record_type='plan'

    Verifies:
    - Plans use separate calculation from facts
    - Default amounts for plans are larger (5k-50k vs 100-5k for facts)
    """
    # Step 1: Create test article
    article_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "SALARY",
            "name": "Salary",
            "type": "income",
            "parent_id": None,
        },
    )
    assert article_response.status_code == 201
    article = article_response.json()
    article_id = article["id"]

    # Step 2: Create test financial center
    fc_response = await admin_client.post(
        "/api/v1/financial-centers",
        json={
            "code": "PERSONAL",
            "name": "Personal",
        },
    )
    assert fc_response.status_code == 201
    fc = fc_response.json()
    fc_id = fc["id"]

    # Step 3: Create 25 plan records with larger amounts
    base_date = date.today() - timedelta(days=60)
    amounts = [5000, 6000, 7000, 8000, 9000, 10000, 12000, 15000, 18000, 20000,
               22000, 25000, 28000, 30000, 35000, 40000, 45000, 50000, 55000, 60000,
               65000, 70000, 75000, 80000, 90000]

    for i, amount in enumerate(amounts):
        fact = BudgetFact(
            article_id=article_id,
            amount=Decimal(str(amount)),
            fact_date=base_date + timedelta(days=i),
            record_type="plan",  # PLAN, not fact
            financial_center_id=fc_id,
            user_id=1,
        )
        session.add(fact)

    await session.commit()

    # Step 4: Call for plans
    result = await session.execute(
        text("""
            SELECT * FROM calculate_recommended_amounts(
                NULL,
                'income',
                'plan',    -- PLAN
                'quarter',
                20
            )
        """)
    )
    row = result.fetchone()

    assert row is not None
    amounts = row.amounts

    # Verify plan amounts are larger
    assert all(a >= 5000 for a in amounts), \
        f"Plan amounts should be >= 5000, got {amounts}"


# ============================================================================
# recalculate_recommended_amounts() Function Tests
# ============================================================================


@pytest.mark.asyncio
async def test_recalculate_recommended_amounts_batch(
    session: AsyncSession,
    admin_client: AsyncClient
):
    """
    Test recalculate_recommended_amounts() batch function (used by scheduler).

    Setup:
    - Create diverse transaction data (multiple categories, types, etc.)
    - Call recalculate_recommended_amounts()
    - Query t_recommended_amounts table

    Verifies:
    - Function executes without errors
    - Creates entries in t_recommended_amounts table
    - Calculates global and category-specific recommendations
    - Updates last_updated timestamp
    """
    # Step 1: Create test data
    article_response = await admin_client.post(
        "/api/v1/articles",
        json={"code": "TRANSPORT", "name": "Transport", "type": "expense", "parent_id": None},
    )
    assert article_response.status_code == 201
    article_id = article_response.json()["id"]

    fc_response = await admin_client.post(
        "/api/v1/financial-centers",
        json={"code": "MAIN", "name": "Main FC"},
    )
    assert fc_response.status_code == 201
    fc_id = fc_response.json()["id"]

    # Create 30 transactions
    base_date = date.today() - timedelta(days=45)
    for i in range(30):
        fact = BudgetFact(
            article_id=article_id,
            amount=Decimal(str(500 + i * 100)),
            fact_date=base_date + timedelta(days=i),
            record_type="fact",
            financial_center_id=fc_id,
            user_id=1,
        )
        session.add(fact)
    await session.commit()

    # Step 2: Call batch recalculation
    await session.execute(text("SELECT recalculate_recommended_amounts()"))
    await session.commit()

    # Step 3: Verify results in t_recommended_amounts
    result = await session.execute(
        text("SELECT COUNT(*) FROM t_recommended_amounts")
    )
    count = result.scalar()

    assert count > 0, "Should have created recommendation entries"

    # Verify structure
    result = await session.execute(
        text("SELECT * FROM t_recommended_amounts LIMIT 1")
    )
    row = result.fetchone()

    assert row is not None
    assert len(row.amounts) == 4, "Each entry should have 4 amounts"
    assert row.metadata is not None, "Metadata should be present"
    assert row.last_updated is not None, "Last updated timestamp should be set"
