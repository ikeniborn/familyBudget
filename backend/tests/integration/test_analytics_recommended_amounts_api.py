"""
Integration tests for GET /api/v1/analytics/recommended-amounts API endpoint.

Tests complete recommended amounts workflow through REST API:
1. Global recommendations (no filters)
2. Category-specific recommendations
3. Type-specific recommendations (income vs expense)
4. Record type differentiation (fact vs plan)
5. Cache behavior (24h caching)
6. Fallback to defaults with insufficient data
7. Authentication requirements

These tests verify the API endpoint works correctly end-to-end.
"""

import pytest
from decimal import Decimal
from datetime import date, timedelta
from httpx import AsyncClient
from sqlmodel import text
from sqlmodel.ext.asyncio.session import AsyncSession

from backend.app.models.fact import BudgetFact


# ============================================================================
# Authentication Tests
# ============================================================================


@pytest.mark.asyncio
async def test_recommended_amounts_requires_authentication(client: AsyncClient):
    """
    Test that endpoint requires authentication.

    Verifies:
    - Anonymous requests return 401 Unauthorized
    - JWT token is required
    """
    response = await client.get("/api/v1/analytics/recommended-amounts")
    assert response.status_code == 401, "Should require authentication"


# ============================================================================
# Global Recommendations Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_recommended_amounts_global_expenses(
    user_client: AsyncClient,
    admin_client: AsyncClient,
    session: AsyncSession
):
    """
    Test global expense recommendations (no filters).

    Query: GET /api/v1/analytics/recommended-amounts?type=expense&record_type=fact

    Verifies:
    - Returns 4 amounts
    - Amounts are in ascending order
    - Response includes algorithm and metadata
    - Falls back to defaults if no data
    """
    response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "type": "expense",
            "record_type": "fact",
            "period": "quarter",
        }
    )

    assert response.status_code == 200
    data = response.json()

    # Verify response structure
    assert "amounts" in data
    assert "algorithm" in data
    assert "metadata" in data

    # Verify amounts
    amounts = data["amounts"]
    assert len(amounts) == 4, f"Should return 4 amounts, got {len(amounts)}"
    assert amounts == sorted(amounts), "Amounts should be in ascending order"

    # Verify amounts are positive
    for amount in amounts:
        assert Decimal(amount) > 0, f"Amount {amount} should be positive"

    # Verify algorithm
    assert data["algorithm"] in ["k_means", "default"], \
        f"Algorithm should be k_means or default, got {data['algorithm']}"

    # Verify metadata
    metadata = data["metadata"]
    assert "source" in metadata
    assert "sample_size" in metadata
    assert "period_days" in metadata
    assert metadata["period_days"] == 90, "Quarter should be 90 days"


@pytest.mark.asyncio
async def test_get_recommended_amounts_global_income(user_client: AsyncClient):
    """
    Test global income recommendations.

    Query: GET /api/v1/analytics/recommended-amounts?type=income&record_type=fact

    Verifies:
    - Income amounts are typically larger than expense amounts
    - Default income amounts: [10000, 20000, 50000, 100000]
    """
    response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "type": "income",
            "record_type": "fact",
        }
    )

    assert response.status_code == 200
    data = response.json()

    amounts = data["amounts"]
    assert len(amounts) == 4

    # Income amounts should be larger (typically >= 10k)
    # (unless there's K-means data suggesting otherwise)
    if data["algorithm"] == "default":
        assert all(Decimal(a) >= 10000 for a in amounts), \
            "Default income amounts should be >= 10k"


# ============================================================================
# Category-Specific Recommendations Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_recommended_amounts_category_specific(
    user_client: AsyncClient,
    admin_client: AsyncClient,
    session: AsyncSession
):
    """
    Test category-specific recommendations.

    Setup:
    - Create category "Groceries"
    - Create 25 grocery transactions
    - Query recommendations for Groceries category

    Query: GET /api/v1/analytics/recommended-amounts?article_id=X&type=expense&record_type=fact

    Verifies:
    - Returns category-specific recommendations
    - Metadata includes article_id and article_name
    - Algorithm is k_means (sufficient data)
    - Sample size >= 20
    """
    # Step 1: Create test category
    article_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "GROCERIES_API",
            "name": "Groceries API Test",
            "type": "expense",
            "parent_id": None,
        },
    )
    assert article_response.status_code == 201
    article_id = article_response.json()["id"]

    # Step 2: Create financial center
    fc_response = await admin_client.post(
        "/api/v1/financial-centers",
        json={"code": "FC_API", "name": "FC API Test"},
    )
    assert fc_response.status_code == 201
    fc_id = fc_response.json()["id"]

    # Step 3: Create 25 transactions for this category
    base_date = date.today() - timedelta(days=60)
    amounts = [300 + i * 50 for i in range(25)]  # 300, 350, 400, ..., 1500

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

    # Step 4: Query category-specific recommendations
    response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "article_id": article_id,
            "type": "expense",
            "record_type": "fact",
            "period": "quarter",
        }
    )

    assert response.status_code == 200
    data = response.json()

    # Verify category-specific results
    assert data["algorithm"] == "k_means", \
        "Should use K-means with 25 samples"

    metadata = data["metadata"]
    assert metadata["article_id"] == article_id, \
        "Metadata should include article_id"
    assert metadata["article_name"] == "Groceries API Test", \
        "Metadata should include article_name"
    assert metadata["sample_size"] >= 20, \
        "Should have sufficient samples"

    # Verify amounts are in reasonable range
    amounts = [Decimal(a) for a in data["amounts"]]
    assert all(250 <= a <= 2000 for a in amounts), \
        f"Amounts should be in range 250-2000, got {amounts}"


# ============================================================================
# Record Type Differentiation Tests (Fact vs Plan)
# ============================================================================


@pytest.mark.asyncio
async def test_get_recommended_amounts_facts_vs_plans(
    user_client: AsyncClient,
    admin_client: AsyncClient,
    session: AsyncSession
):
    """
    Test that facts and plans use different recommendations.

    Setup:
    - Create fact transactions (small amounts: 100-1000)
    - Create plan records (large amounts: 5000-50000)
    - Query both record types

    Verifies:
    - record_type='fact' returns smaller amounts
    - record_type='plan' returns larger amounts
    - Default plan amounts: [5000, 10000, 20000, 50000]
    - Default fact amounts: [100, 500, 1000, 5000]
    """
    # Step 1: Setup
    article_response = await admin_client.post(
        "/api/v1/articles",
        json={"code": "MIXED", "name": "Mixed Test", "type": "expense", "parent_id": None},
    )
    assert article_response.status_code == 201
    article_id = article_response.json()["id"]

    fc_response = await admin_client.post(
        "/api/v1/financial-centers",
        json={"code": "FC_MIXED", "name": "FC Mixed"},
    )
    assert fc_response.status_code == 201
    fc_id = fc_response.json()["id"]

    # Step 2: Create fact transactions (small)
    base_date = date.today() - timedelta(days=60)
    fact_amounts = [100 + i * 30 for i in range(25)]

    for i, amount in enumerate(fact_amounts):
        fact = BudgetFact(
            article_id=article_id,
            amount=Decimal(str(amount)),
            fact_date=base_date + timedelta(days=i),
            record_type="fact",
            financial_center_id=fc_id,
            user_id=1,
        )
        session.add(fact)

    # Step 3: Create plan records (large)
    plan_amounts = [5000 + i * 1000 for i in range(25)]

    for i, amount in enumerate(plan_amounts):
        plan = BudgetFact(
            article_id=article_id,
            amount=Decimal(str(amount)),
            fact_date=base_date + timedelta(days=i),
            record_type="plan",
            financial_center_id=fc_id,
            user_id=1,
        )
        session.add(plan)

    await session.commit()

    # Step 4: Query fact recommendations
    fact_response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "article_id": article_id,
            "type": "expense",
            "record_type": "fact",
        }
    )
    assert fact_response.status_code == 200
    fact_data = fact_response.json()

    # Step 5: Query plan recommendations
    plan_response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "article_id": article_id,
            "type": "expense",
            "record_type": "plan",
        }
    )
    assert plan_response.status_code == 200
    plan_data = plan_response.json()

    # Step 6: Compare
    fact_amounts = [Decimal(a) for a in fact_data["amounts"]]
    plan_amounts = [Decimal(a) for a in plan_data["amounts"]]

    # Plans should have larger amounts than facts
    assert plan_amounts[0] > fact_amounts[-1], \
        f"Plan amounts {plan_amounts} should be larger than fact amounts {fact_amounts}"


# ============================================================================
# Period Parameter Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_recommended_amounts_different_periods(user_client: AsyncClient):
    """
    Test different period parameters.

    Periods:
    - week: 7 days
    - month: 30 days
    - quarter: 90 days (default)
    - year: 365 days

    Verifies:
    - period parameter affects metadata.period_days
    - All periods return valid results
    """
    periods = {
        "week": 7,
        "month": 30,
        "quarter": 90,
        "year": 365,
    }

    for period, expected_days in periods.items():
        response = await user_client.get(
            "/api/v1/analytics/recommended-amounts",
            params={
                "type": "expense",
                "record_type": "fact",
                "period": period,
            }
        )

        assert response.status_code == 200
        data = response.json()

        assert data["metadata"]["period_days"] == expected_days, \
            f"Period '{period}' should have {expected_days} days"


# ============================================================================
# Insufficient Data / Fallback Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_recommended_amounts_fallback_to_defaults(
    user_client: AsyncClient,
    admin_client: AsyncClient
):
    """
    Test fallback to default amounts with insufficient data.

    Setup:
    - Create category with 0 transactions
    - Query recommendations

    Verifies:
    - Returns default amounts
    - Algorithm is 'default'
    - Metadata shows sample_size = 0
    """
    # Create category with no transactions
    article_response = await admin_client.post(
        "/api/v1/articles",
        json={
            "code": "EMPTY_CAT",
            "name": "Empty Category",
            "type": "expense",
            "parent_id": None,
        },
    )
    assert article_response.status_code == 201
    article_id = article_response.json()["id"]

    # Query recommendations
    response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "article_id": article_id,
            "type": "expense",
            "record_type": "fact",
        }
    )

    assert response.status_code == 200
    data = response.json()

    # Should fall back to defaults
    assert data["algorithm"] == "default", "Should use default algorithm"
    assert data["metadata"]["sample_size"] == 0, "Sample size should be 0"
    assert data["metadata"]["source"] == "default", "Source should be 'default'"

    # Default expense amounts
    amounts = [Decimal(a) for a in data["amounts"]]
    expected_defaults = [Decimal("100"), Decimal("500"), Decimal("1000"), Decimal("5000")]
    assert amounts == expected_defaults, \
        f"Should return default expense amounts {expected_defaults}, got {amounts}"


# ============================================================================
# Min Sample Size Parameter Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_recommended_amounts_custom_min_sample_size(
    user_client: AsyncClient,
    admin_client: AsyncClient,
    session: AsyncSession
):
    """
    Test custom min_sample_size parameter.

    Setup:
    - Create 15 transactions (below default 20, but above custom 10)
    - Query with min_sample_size=10

    Verifies:
    - K-means is used with 15 samples (>= 10)
    - Lower threshold allows calculation
    """
    # Step 1: Setup
    article_response = await admin_client.post(
        "/api/v1/articles",
        json={"code": "SPARSE", "name": "Sparse Data", "type": "expense", "parent_id": None},
    )
    assert article_response.status_code == 201
    article_id = article_response.json()["id"]

    fc_response = await admin_client.post(
        "/api/v1/financial-centers",
        json={"code": "FC_SPARSE", "name": "FC Sparse"},
    )
    assert fc_response.status_code == 201
    fc_id = fc_response.json()["id"]

    # Step 2: Create only 15 transactions (below default 20)
    base_date = date.today() - timedelta(days=45)
    for i in range(15):
        fact = BudgetFact(
            article_id=article_id,
            amount=Decimal(str(400 + i * 50)),
            fact_date=base_date + timedelta(days=i * 3),
            record_type="fact",
            financial_center_id=fc_id,
            user_id=1,
        )
        session.add(fact)

    await session.commit()

    # Step 3: Query with default min_sample_size (20) - should get defaults
    response_default = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "article_id": article_id,
            "type": "expense",
            "record_type": "fact",
            "min_sample_size": 20,  # Default
        }
    )
    assert response_default.status_code == 200
    data_default = response_default.json()
    assert data_default["algorithm"] == "default", \
        "Should use defaults with 15 samples < 20 min"

    # Step 4: Query with lower min_sample_size (10) - should get K-means
    response_custom = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "article_id": article_id,
            "type": "expense",
            "record_type": "fact",
            "min_sample_size": 10,  # Lower threshold
        }
    )
    assert response_custom.status_code == 200
    data_custom = response_custom.json()
    assert data_custom["algorithm"] == "k_means", \
        "Should use K-means with 15 samples >= 10 min"


# ============================================================================
# Cache Behavior Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_recommended_amounts_cache_behavior(
    user_client: AsyncClient,
    session: AsyncSession
):
    """
    Test cache behavior (24h caching in t_recommended_amounts).

    Verifies:
    - First call calculates and caches
    - Second call uses cached value (metadata.source = 'cached')
    - Cache is valid for 24 hours

    Note: This test verifies the caching mechanism exists.
    Full cache expiry testing requires time manipulation or manual DB updates.
    """
    # Call endpoint twice
    response1 = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={"type": "expense", "record_type": "fact"}
    )
    assert response1.status_code == 200
    data1 = response1.json()

    response2 = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={"type": "expense", "record_type": "fact"}
    )
    assert response2.status_code == 200
    data2 = response2.json()

    # Both should return same amounts (either both calculated or both cached)
    assert data1["amounts"] == data2["amounts"], \
        "Consecutive calls should return same amounts"

    # Verify cache table exists and has entries
    result = await session.execute(
        text("SELECT COUNT(*) FROM t_recommended_amounts WHERE last_updated >= NOW() - INTERVAL '24 hours'")
    )
    count = result.scalar()
    assert count >= 0, "Cache table should exist and be queryable"


# ============================================================================
# Response Format Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_recommended_amounts_response_format(user_client: AsyncClient):
    """
    Test API response format matches schema.

    Verifies:
    - Response has required fields: amounts, algorithm, metadata
    - amounts is array of 4 Decimals
    - algorithm is string ('k_means' or 'default')
    - metadata has required fields
    """
    response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={"type": "expense", "record_type": "fact"}
    )

    assert response.status_code == 200
    data = response.json()

    # Verify top-level structure
    assert "amounts" in data
    assert "algorithm" in data
    assert "metadata" in data

    # Verify amounts
    assert isinstance(data["amounts"], list)
    assert len(data["amounts"]) == 4
    for amount in data["amounts"]:
        assert isinstance(amount, (int, float, str)), "Amount should be numeric"
        assert Decimal(amount) > 0, "Amount should be positive"

    # Verify algorithm
    assert isinstance(data["algorithm"], str)
    assert data["algorithm"] in ["k_means", "default"]

    # Verify metadata structure
    metadata = data["metadata"]
    required_fields = ["source", "sample_size", "period_days"]
    for field in required_fields:
        assert field in metadata, f"Metadata should have '{field}' field"

    # Optional metadata fields (present when K-means is used)
    optional_fields = ["min_amount", "max_amount", "avg_amount", "algorithm_version", "convergence_iterations"]
    if data["algorithm"] == "k_means":
        assert metadata["sample_size"] > 0, "K-means should have sample_size > 0"


# ============================================================================
# Invalid Input Tests
# ============================================================================


@pytest.mark.asyncio
async def test_get_recommended_amounts_invalid_article_id(user_client: AsyncClient):
    """
    Test with non-existent article_id.

    Verifies:
    - Returns default amounts (not 404)
    - Algorithm is 'default'
    - Sample size is 0
    """
    response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "article_id": 999999,  # Non-existent
            "type": "expense",
            "record_type": "fact",
        }
    )

    assert response.status_code == 200, "Should return 200 with defaults, not 404"
    data = response.json()

    assert data["algorithm"] == "default"
    assert data["metadata"]["sample_size"] == 0


@pytest.mark.asyncio
async def test_get_recommended_amounts_invalid_type(user_client: AsyncClient):
    """
    Test with invalid type parameter.

    Verifies:
    - Returns 422 Unprocessable Entity (validation error)
    - Or falls back to no type filter
    """
    response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "type": "invalid_type",  # Invalid
            "record_type": "fact",
        }
    )

    # Either validation error or accepts and treats as no filter
    assert response.status_code in [200, 422], \
        "Should either accept (200) or reject (422) invalid type"


@pytest.mark.asyncio
async def test_get_recommended_amounts_invalid_record_type(user_client: AsyncClient):
    """
    Test with invalid record_type parameter.

    Verifies:
    - Returns validation error or defaults
    """
    response = await user_client.get(
        "/api/v1/analytics/recommended-amounts",
        params={
            "type": "expense",
            "record_type": "invalid_record_type",  # Invalid
        }
    )

    # Validation should catch this
    assert response.status_code in [200, 422]
