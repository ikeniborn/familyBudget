"""
Integration tests for Admin Analytics endpoints.

Tests all 6 admin analytics endpoints:
- /admin/analytics/overview
- /admin/analytics/users-growth
- /admin/analytics/transactions-trends
- /admin/analytics/top-users
- /admin/analytics/categories-breakdown
- /admin/analytics/centers-usage
"""

import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio


class TestAdminAnalyticsEndpoints:
    """Test suite for admin analytics endpoints."""

    async def test_overview(self, admin_client: AsyncClient):
        """Test system overview endpoint."""
        response = await admin_client.get("/api/v1/admin/analytics/overview")

        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"

        data = response.json()
        assert "total_users" in data
        assert "total_transactions" in data
        assert "total_articles" in data
        assert "total_financial_centers" in data
        assert "total_cost_centers" in data
        assert "recent_activity" in data
        assert "financial_summary" in data

        # Check recent activity structure
        assert "new_users_30d" in data["recent_activity"]
        assert "transactions_30d" in data["recent_activity"]

        # Check financial summary structure
        assert "total_income" in data["financial_summary"]
        assert "total_expense" in data["financial_summary"]
        assert "balance" in data["financial_summary"]

    async def test_users_growth_default(self, admin_client: AsyncClient):
        """Test users growth with default period."""
        response = await admin_client.get("/api/v1/admin/analytics/users-growth")

        assert response.status_code == 200
        data = response.json()

        assert "period_days" in data
        assert data["period_days"] == 90  # Default
        assert "start_date" in data
        assert "end_date" in data
        assert "total_registrations" in data
        assert "data" in data
        assert isinstance(data["data"], list)

    async def test_users_growth_custom_period(self, admin_client: AsyncClient):
        """Test users growth with custom period."""
        response = await admin_client.get("/api/v1/admin/analytics/users-growth?days=30")

        assert response.status_code == 200
        data = response.json()

        assert data["period_days"] == 30

        # Check data structure
        if len(data["data"]) > 0:
            item = data["data"][0]
            assert "date" in item
            assert "count" in item
            assert "cumulative" in item

    async def test_transactions_trends_default(self, admin_client: AsyncClient):
        """Test transactions trends with default period."""
        response = await admin_client.get("/api/v1/admin/analytics/transactions-trends")

        assert response.status_code == 200
        data = response.json()

        assert "period_days" in data
        assert data["period_days"] == 90  # Default
        assert "start_date" in data
        assert "end_date" in data
        assert "total_transactions" in data
        assert "total_income" in data
        assert "total_expense" in data
        assert "data" in data
        assert isinstance(data["data"], list)

    async def test_transactions_trends_custom_period(self, admin_client: AsyncClient):
        """Test transactions trends with custom period."""
        response = await admin_client.get("/api/v1/admin/analytics/transactions-trends?days=7")

        assert response.status_code == 200
        data = response.json()

        assert data["period_days"] == 7

        # Check data structure
        if len(data["data"]) > 0:
            item = data["data"][0]
            assert "date" in item
            assert "income_count" in item
            assert "expense_count" in item
            assert "income_amount" in item
            assert "expense_amount" in item

    async def test_top_users_by_transactions(self, admin_client: AsyncClient):
        """Test top users sorted by transaction count."""
        response = await admin_client.get("/api/v1/admin/analytics/top-users?metric=transactions&limit=5")

        assert response.status_code == 200
        data = response.json()

        assert "metric" in data
        assert data["metric"] == "transactions"
        assert "limit" in data
        assert data["limit"] == 5
        assert "data" in data
        assert isinstance(data["data"], list)
        assert len(data["data"]) <= 5

        # Check data structure
        if len(data["data"]) > 0:
            user = data["data"][0]
            assert "user_id" in user
            assert "username" in user
            assert "first_name" in user
            assert "transaction_count" in user
            assert "total_amount" in user

    async def test_top_users_by_amount(self, admin_client: AsyncClient):
        """Test top users sorted by total amount."""
        response = await admin_client.get("/api/v1/admin/analytics/top-users?metric=amount&limit=10")

        assert response.status_code == 200
        data = response.json()

        assert data["metric"] == "amount"
        assert data["limit"] == 10

    async def test_categories_breakdown_expense(self, admin_client: AsyncClient):
        """Test categories breakdown for expenses."""
        response = await admin_client.get("/api/v1/admin/analytics/categories-breakdown?type=expense&limit=10")

        assert response.status_code == 200
        data = response.json()

        assert "type" in data
        assert data["type"] == "expense"
        assert "limit" in data
        assert data["limit"] == 10
        assert "total_amount" in data
        assert "data" in data
        assert isinstance(data["data"], list)

        # Check data structure
        if len(data["data"]) > 0:
            category = data["data"][0]
            assert "article_id" in category
            assert "name" in category
            assert "transaction_count" in category
            assert "total_amount" in category
            assert "percentage" in category

    async def test_categories_breakdown_income(self, admin_client: AsyncClient):
        """Test categories breakdown for income."""
        response = await admin_client.get("/api/v1/admin/analytics/categories-breakdown?type=income&limit=15")

        assert response.status_code == 200
        data = response.json()

        assert data["type"] == "income"
        assert data["limit"] == 15

    async def test_centers_usage(self, admin_client: AsyncClient):
        """Test ЦФО and МВЗ usage statistics."""
        response = await admin_client.get("/api/v1/admin/analytics/centers-usage")

        assert response.status_code == 200
        data = response.json()

        assert "financial_centers" in data
        assert "cost_centers" in data
        assert "timestamp" in data
        assert isinstance(data["financial_centers"], list)
        assert isinstance(data["cost_centers"], list)

        # Check financial centers structure
        if len(data["financial_centers"]) > 0:
            fc = data["financial_centers"][0]
            assert "id" in fc
            assert "code" in fc
            assert "name" in fc
            assert "transaction_count" in fc
            assert "total_amount" in fc

        # Check cost centers structure
        if len(data["cost_centers"]) > 0:
            cc = data["cost_centers"][0]
            assert "id" in cc
            assert "code" in cc
            assert "name" in cc
            assert "transaction_count" in cc
            assert "total_amount" in cc

    async def test_non_admin_access_denied(self, auth_client: AsyncClient):
        """Test that non-admin users cannot access admin analytics."""
        response = await auth_client.get("/api/v1/admin/analytics/overview")

        assert response.status_code == 403
        data = response.json()
        assert "Admin access required" in data["detail"]
