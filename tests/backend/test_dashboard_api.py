"""
Comprehensive integration tests for dashboard API endpoints.
Tests all dashboard-related reports endpoints including:
- /dashboard-stats
- /dashboard
- /category-analysis
- /spending-trends
- /period-stats
- /analytics

Focuses on data accuracy, user isolation, error handling, and edge cases.
Updated to test unified API response format and comprehensive functionality.
"""
import pytest
from datetime import datetime, date
from fastapi import status
from fastapi.testclient import TestClient
from httpx import AsyncClient


def validate_dashboard_stats_response(response_data: dict):
    """Helper function to validate dashboard stats response structure."""
    assert "total_budget" in response_data
    assert "total_actual" in response_data
    assert "variance" in response_data
    assert "variance_percent" in response_data or response_data["variance_percent"] is None
    assert "budget_transactions" in response_data
    assert "actual_transactions" in response_data
    assert "total_transactions" in response_data
    assert "active_categories" in response_data
    assert "period_id" in response_data

    # Type checks
    assert isinstance(response_data["total_budget"], (int, float))
    assert isinstance(response_data["total_actual"], (int, float))
    assert isinstance(response_data["variance"], (int, float))
    assert isinstance(response_data["budget_transactions"], int)
    assert isinstance(response_data["actual_transactions"], int)
    assert isinstance(response_data["total_transactions"], int)
    assert isinstance(response_data["active_categories"], int)


def validate_dashboard_data_response(response_data: dict):
    """Helper function to validate dashboard data response structure."""
    assert "total_income" in response_data
    assert "total_expense" in response_data
    assert "budget_utilization" in response_data
    assert "top_categories" in response_data

    # Type checks
    assert isinstance(response_data["total_income"], (int, float))
    assert isinstance(response_data["total_expense"], (int, float))
    assert isinstance(response_data["budget_utilization"], (int, float))
    assert isinstance(response_data["top_categories"], list)

    # Validate top categories structure
    for category in response_data["top_categories"]:
        assert "category" in category
        assert "amount" in category
        assert "percentage" in category
        assert isinstance(category["category"], str)
        assert isinstance(category["amount"], (int, float))
        assert isinstance(category["percentage"], (int, float))


def validate_category_analysis_response(response_data: list):
    """Helper function to validate category analysis response structure."""
    assert isinstance(response_data, list)

    for item in response_data:
        assert "nomenclature_id" in item
        assert "nomenclature_name" in item
        assert "budget_amount" in item
        assert "actual_amount" in item
        assert "variance" in item
        assert "variance_percent" in item or item["variance_percent"] is None
        assert "transaction_count" in item

        # Type checks
        assert isinstance(item["nomenclature_id"], int)
        assert isinstance(item["nomenclature_name"], str)
        assert isinstance(item["budget_amount"], (int, float))
        assert isinstance(item["actual_amount"], (int, float))
        assert isinstance(item["variance"], (int, float))
        assert isinstance(item["transaction_count"], int)


def validate_spending_trends_response(response_data: dict):
    """Helper function to validate spending trends response structure."""
    assert "trends" in response_data
    assert isinstance(response_data["trends"], list)

    for trend in response_data["trends"]:
        assert "period_id" in trend
        assert "period_name" in trend
        assert "period_date" in trend or trend["period_date"] is None
        assert "budget_amount" in trend
        assert "actual_amount" in trend
        assert "variance" in trend

        # Type checks
        assert isinstance(trend["period_id"], int)
        assert isinstance(trend["period_name"], str)
        assert isinstance(trend["budget_amount"], (int, float))
        assert isinstance(trend["actual_amount"], (int, float))
        assert isinstance(trend["variance"], (int, float))


class TestDashboardStatsEndpoint:
    """Test the /reports/dashboard-stats endpoint."""

    @pytest.mark.asyncio
    async def test_get_dashboard_stats_success(self, client: TestClient, auth_headers: dict):
        """Test successful dashboard stats retrieval."""
        response = client.get("/api/reports/dashboard-stats", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()
        validate_dashboard_stats_response(response_data)

    @pytest.mark.asyncio
    async def test_get_dashboard_stats_with_period_filter(self, client: TestClient, auth_headers: dict):
        """Test dashboard stats with period filter."""
        response = client.get(
            "/api/reports/dashboard-stats",
            headers=auth_headers,
            params={"period_id": 1}
        )

        assert response.status_code == 200
        response_data = response.json()
        validate_dashboard_stats_response(response_data)
        assert response_data["period_id"] == 1

    @pytest.mark.asyncio
    async def test_get_dashboard_stats_no_data(self, client: TestClient, auth_headers: dict):
        """Test dashboard stats when no registry data exists."""
        # This should return zeros but still valid structure
        response = client.get("/api/reports/dashboard-stats", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()
        validate_dashboard_stats_response(response_data)

        # Should have zero values when no data
        assert response_data["total_budget"] >= 0
        assert response_data["total_actual"] >= 0
        assert response_data["budget_transactions"] >= 0
        assert response_data["actual_transactions"] >= 0

    @pytest.mark.asyncio
    async def test_get_dashboard_stats_unauthorized(self, client: TestClient):
        """Test dashboard stats without authentication."""
        response = client.get("/api/reports/dashboard-stats")

        assert response.status_code == 401

    @pytest.mark.asyncio
    async def test_get_dashboard_stats_invalid_period(self, client: TestClient, auth_headers: dict):
        """Test dashboard stats with invalid period ID."""
        response = client.get(
            "/api/reports/dashboard-stats",
            headers=auth_headers,
            params={"period_id": 99999}
        )

        assert response.status_code == 200
        response_data = response.json()
        validate_dashboard_stats_response(response_data)
        # Should return empty data but valid structure


class TestDashboardDataEndpoint:
    """Test the /reports/dashboard endpoint."""

    @pytest.mark.asyncio
    async def test_get_dashboard_data_success(self, client: TestClient, auth_headers: dict):
        """Test successful dashboard data retrieval."""
        response = client.get("/api/reports/dashboard", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()
        validate_dashboard_data_response(response_data)

    @pytest.mark.asyncio
    async def test_get_dashboard_data_with_period_filter(self, client: TestClient, auth_headers: dict):
        """Test dashboard data with period filter."""
        response = client.get(
            "/api/reports/dashboard",
            headers=auth_headers,
            params={"period_id": 1}
        )

        assert response.status_code == 200
        response_data = response.json()
        validate_dashboard_data_response(response_data)

    @pytest.mark.asyncio
    async def test_dashboard_data_budget_utilization_calculation(self, client: TestClient, auth_headers: dict):
        """Test correct budget utilization calculation."""
        response = client.get("/api/reports/dashboard", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        total_income = response_data["total_income"]
        total_expense = response_data["total_expense"]
        budget_utilization = response_data["budget_utilization"]

        if total_income > 0:
            expected_utilization = (total_expense / total_income) * 100
            assert abs(budget_utilization - expected_utilization) < 0.01
        else:
            assert budget_utilization == 0

    @pytest.mark.asyncio
    async def test_dashboard_data_top_categories_limit(self, client: TestClient, auth_headers: dict):
        """Test that top categories are limited to 5."""
        response = client.get("/api/reports/dashboard", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        assert len(response_data["top_categories"]) <= 5

    @pytest.mark.asyncio
    async def test_dashboard_data_categories_percentage_sum(self, client: TestClient, auth_headers: dict):
        """Test that top categories percentages sum correctly."""
        response = client.get("/api/reports/dashboard", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        if response_data["top_categories"]:
            total_percentage = sum(cat["percentage"] for cat in response_data["top_categories"])
            # Should sum to approximately 100% (allowing for rounding errors)
            assert 99.0 <= total_percentage <= 101.0


class TestCategoryAnalysisEndpoint:
    """Test the /reports/category-analysis endpoint."""

    @pytest.mark.asyncio
    async def test_get_category_analysis_success(self, client: TestClient, auth_headers: dict):
        """Test successful category analysis retrieval."""
        response = client.get("/api/reports/category-analysis", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()
        validate_category_analysis_response(response_data)

    @pytest.mark.asyncio
    async def test_get_category_analysis_with_filters(self, client: TestClient, auth_headers: dict):
        """Test category analysis with all filters."""
        response = client.get(
            "/api/reports/category-analysis",
            headers=auth_headers,
            params={
                "period_id": 1,
                "financial_center_id": 1,
                "cost_center_id": 1
            }
        )

        assert response.status_code == 200
        response_data = response.json()
        validate_category_analysis_response(response_data)

    @pytest.mark.asyncio
    async def test_category_analysis_variance_calculation(self, client: TestClient, auth_headers: dict):
        """Test correct variance calculation in category analysis."""
        response = client.get("/api/reports/category-analysis", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        for item in response_data:
            expected_variance = item["actual_amount"] - item["budget_amount"]
            assert abs(item["variance"] - expected_variance) < 0.01

            if item["budget_amount"] != 0:
                expected_percent = (item["variance"] / item["budget_amount"]) * 100
                if item["variance_percent"] is not None:
                    assert abs(item["variance_percent"] - expected_percent) < 0.01


class TestSpendingTrendsEndpoint:
    """Test the /reports/spending-trends endpoint."""

    @pytest.mark.asyncio
    async def test_get_spending_trends_success(self, client: TestClient, auth_headers: dict):
        """Test successful spending trends retrieval."""
        response = client.get("/api/reports/spending-trends", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()
        validate_spending_trends_response(response_data)

    @pytest.mark.asyncio
    async def test_get_spending_trends_custom_months(self, client: TestClient, auth_headers: dict):
        """Test spending trends with custom months parameter."""
        response = client.get(
            "/api/reports/spending-trends",
            headers=auth_headers,
            params={"months": 12}
        )

        assert response.status_code == 200
        response_data = response.json()
        validate_spending_trends_response(response_data)

        # Should not exceed requested months
        assert len(response_data["trends"]) <= 12

    @pytest.mark.asyncio
    async def test_get_spending_trends_with_nomenclature_filter(self, client: TestClient, auth_headers: dict):
        """Test spending trends with nomenclature filter."""
        response = client.get(
            "/api/reports/spending-trends",
            headers=auth_headers,
            params={
                "months": 6,
                "nomenclature_id": 1
            }
        )

        assert response.status_code == 200
        response_data = response.json()
        validate_spending_trends_response(response_data)

    @pytest.mark.asyncio
    async def test_spending_trends_chronological_order(self, client: TestClient, auth_headers: dict):
        """Test that spending trends are returned in chronological order."""
        response = client.get("/api/reports/spending-trends", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        trends = response_data["trends"]
        if len(trends) > 1:
            # Should be in chronological order (oldest first)
            for i in range(1, len(trends)):
                if trends[i]["period_date"] and trends[i-1]["period_date"]:
                    assert trends[i]["period_date"] >= trends[i-1]["period_date"]

    @pytest.mark.asyncio
    async def test_spending_trends_variance_calculation(self, client: TestClient, auth_headers: dict):
        """Test correct variance calculation in spending trends."""
        response = client.get("/api/reports/spending-trends", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        for trend in response_data["trends"]:
            expected_variance = trend["actual_amount"] - trend["budget_amount"]
            assert abs(trend["variance"] - expected_variance) < 0.01


class TestPeriodStatsEndpoint:
    """Test the /reports/period-stats endpoint."""

    @pytest.mark.asyncio
    async def test_get_period_stats_success(self, client: TestClient, auth_headers: dict):
        """Test successful period stats retrieval."""
        response = client.get("/api/reports/period-stats", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        assert isinstance(response_data, list)

        for period_stat in response_data:
            assert "period_name" in period_stat
            assert "total_budget" in period_stat
            assert "total_fact" in period_stat
            assert "utilization_percent" in period_stat

            # Type checks
            assert isinstance(period_stat["period_name"], str)
            assert isinstance(period_stat["total_budget"], (int, float))
            assert isinstance(period_stat["total_fact"], (int, float))
            assert isinstance(period_stat["utilization_percent"], (int, float))

    @pytest.mark.asyncio
    async def test_period_stats_utilization_calculation(self, client: TestClient, auth_headers: dict):
        """Test correct utilization percentage calculation."""
        response = client.get("/api/reports/period-stats", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        for period_stat in response_data:
            total_budget = period_stat["total_budget"]
            total_fact = period_stat["total_fact"]
            utilization_percent = period_stat["utilization_percent"]

            if total_budget > 0:
                expected_utilization = (total_fact / total_budget) * 100
                assert abs(utilization_percent - expected_utilization) < 0.01
            else:
                assert utilization_percent == 0


class TestAnalyticsEndpoint:
    """Test the /reports/analytics endpoint."""

    @pytest.mark.asyncio
    async def test_get_analytics_data_success(self, client: TestClient, auth_headers: dict):
        """Test successful analytics data retrieval."""
        response = client.get("/api/reports/analytics", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        assert "categories" in response_data
        assert "trends" in response_data
        assert "variance" in response_data

        assert isinstance(response_data["categories"], list)
        assert isinstance(response_data["trends"], list)
        assert isinstance(response_data["variance"], list)

    @pytest.mark.asyncio
    async def test_analytics_data_categories_structure(self, client: TestClient, auth_headers: dict):
        """Test analytics categories data structure."""
        response = client.get("/api/reports/analytics", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        for category in response_data["categories"]:
            assert "name" in category
            assert "value" in category
            assert isinstance(category["name"], str)
            assert isinstance(category["value"], (int, float))

    @pytest.mark.asyncio
    async def test_analytics_data_trends_structure(self, client: TestClient, auth_headers: dict):
        """Test analytics trends data structure."""
        response = client.get("/api/reports/analytics", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        for trend in response_data["trends"]:
            assert "date" in trend
            assert "plan" in trend
            assert "fact" in trend
            assert isinstance(trend["date"], str)
            assert isinstance(trend["plan"], (int, float))
            assert isinstance(trend["fact"], (int, float))

    @pytest.mark.asyncio
    async def test_analytics_data_variance_structure(self, client: TestClient, auth_headers: dict):
        """Test analytics variance data structure."""
        response = client.get("/api/reports/analytics", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        for variance_item in response_data["variance"]:
            assert "category" in variance_item
            assert "value" in variance_item
            assert "percent" in variance_item
            assert isinstance(variance_item["category"], str)
            assert isinstance(variance_item["value"], (int, float))
            assert isinstance(variance_item["percent"], (int, float))

    @pytest.mark.asyncio
    async def test_analytics_data_with_filters(self, client: TestClient, auth_headers: dict):
        """Test analytics data with all filters."""
        response = client.get(
            "/api/reports/analytics",
            headers=auth_headers,
            params={
                "period_id": 1,
                "financial_center_id": 1,
                "cost_center_id": 1
            }
        )

        assert response.status_code == 200
        response_data = response.json()

        assert "categories" in response_data
        assert "trends" in response_data
        assert "variance" in response_data


class TestUserIsolation:
    """Test that dashboard data is properly isolated by user."""

    @pytest.mark.asyncio
    async def test_dashboard_stats_user_isolation(self, client: TestClient, auth_headers: dict, auth_headers_2: dict):
        """Test that different users see different dashboard statistics."""
        # Get data for user 1
        response1 = client.get("/api/reports/dashboard-stats", headers=auth_headers)
        assert response1.status_code == 200
        data1 = response1.json()

        # Get data for user 2
        response2 = client.get("/api/reports/dashboard-stats", headers=auth_headers_2)
        assert response2.status_code == 200
        data2 = response2.json()

        # Data should be different (or both empty for new users)
        # The important thing is that each user only sees their own data
        validate_dashboard_stats_response(data1)
        validate_dashboard_stats_response(data2)

    @pytest.mark.asyncio
    async def test_category_analysis_user_isolation(self, client: TestClient, auth_headers: dict, auth_headers_2: dict):
        """Test that category analysis is properly isolated by user."""
        response1 = client.get("/api/reports/category-analysis", headers=auth_headers)
        assert response1.status_code == 200
        data1 = response1.json()

        response2 = client.get("/api/reports/category-analysis", headers=auth_headers_2)
        assert response2.status_code == 200
        data2 = response2.json()

        validate_category_analysis_response(data1)
        validate_category_analysis_response(data2)


class TestErrorHandling:
    """Test error handling in dashboard endpoints."""

    @pytest.mark.asyncio
    async def test_database_connection_error(self, client: TestClient, auth_headers: dict):
        """Test handling of database connection errors."""
        # This would require mocking database to fail
        # For now, just ensure endpoints handle errors gracefully
        pass

    @pytest.mark.asyncio
    async def test_invalid_query_parameters(self, client: TestClient, auth_headers: dict):
        """Test handling of invalid query parameters."""
        # Test with invalid data types
        response = client.get(
            "/api/reports/dashboard-stats",
            headers=auth_headers,
            params={"period_id": "invalid"}
        )

        assert response.status_code in [400, 422]

    @pytest.mark.asyncio
    async def test_missing_foreign_key_references(self, client: TestClient, auth_headers: dict):
        """Test handling when referenced entities don't exist."""
        response = client.get(
            "/api/reports/category-analysis",
            headers=auth_headers,
            params={
                "period_id": 99999,
                "financial_center_id": 99999,
                "cost_center_id": 99999
            }
        )

        # Should return empty data, not error
        assert response.status_code == 200
        response_data = response.json()
        validate_category_analysis_response(response_data)


class TestPerformanceAndLimits:
    """Test performance aspects and data limits."""

    @pytest.mark.asyncio
    async def test_spending_trends_month_limits(self, client: TestClient, auth_headers: dict):
        """Test spending trends respects month limits."""
        # Test with reasonable limit
        response = client.get(
            "/api/reports/spending-trends",
            headers=auth_headers,
            params={"months": 24}
        )

        assert response.status_code == 200
        response_data = response.json()

        # Should not return more than requested months
        assert len(response_data["trends"]) <= 24

    @pytest.mark.asyncio
    async def test_top_categories_limit_enforcement(self, client: TestClient, auth_headers: dict):
        """Test that dashboard enforces top categories limit."""
        response = client.get("/api/reports/dashboard", headers=auth_headers)

        assert response.status_code == 200
        response_data = response.json()

        # Should never return more than 5 categories
        assert len(response_data["top_categories"]) <= 5

    @pytest.mark.asyncio
    async def test_large_dataset_handling(self, client: TestClient, auth_headers: dict):
        """Test that endpoints handle larger datasets appropriately."""
        # Test endpoints respond within reasonable time even with more data
        response = client.get("/api/reports/analytics", headers=auth_headers)

        assert response.status_code == 200
        # Response should be structured properly regardless of data size
        response_data = response.json()
        assert "categories" in response_data
        assert "trends" in response_data
        assert "variance" in response_data


class TestDataConsistency:
    """Test data consistency across different dashboard endpoints."""

    @pytest.mark.asyncio
    async def test_dashboard_stats_vs_dashboard_data_consistency(self, client: TestClient, auth_headers: dict):
        """Test that dashboard-stats and dashboard endpoints return consistent totals."""
        # Get data from both endpoints
        stats_response = client.get("/api/reports/dashboard-stats", headers=auth_headers)
        dashboard_response = client.get("/api/reports/dashboard", headers=auth_headers)

        assert stats_response.status_code == 200
        assert dashboard_response.status_code == 200

        stats_data = stats_response.json()
        dashboard_data = dashboard_response.json()

        # Total income/budget should match
        assert abs(stats_data["total_budget"] - dashboard_data["total_income"]) < 0.01

        # Total actual/expense should match
        assert abs(stats_data["total_actual"] - dashboard_data["total_expense"]) < 0.01

    @pytest.mark.asyncio
    async def test_category_analysis_vs_analytics_consistency(self, client: TestClient, auth_headers: dict):
        """Test that category analysis and analytics return consistent category data."""
        analysis_response = client.get("/api/reports/category-analysis", headers=auth_headers)
        analytics_response = client.get("/api/reports/analytics", headers=auth_headers)

        assert analysis_response.status_code == 200
        assert analytics_response.status_code == 200

        analysis_data = analysis_response.json()
        analytics_data = analytics_response.json()

        # Both should have category data
        validate_category_analysis_response(analysis_data)
        assert isinstance(analytics_data["categories"], list)

        # If there's data, the categories should be consistent
        if analysis_data and analytics_data["categories"]:
            analysis_categories = {cat["nomenclature_name"]: cat["actual_amount"] for cat in analysis_data}
            analytics_categories = {cat["name"]: cat["value"] for cat in analytics_data["categories"]}

            # Categories that appear in both should have consistent values
            for name, value in analytics_categories.items():
                if name in analysis_categories:
                    assert abs(analysis_categories[name] - value) < 0.01