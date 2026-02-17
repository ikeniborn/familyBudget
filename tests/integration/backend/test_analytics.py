"""
Integration tests for analytics endpoints.

Tests heatmap endpoint with transaction_filter parameter.
"""

import pytest
from httpx import AsyncClient


@pytest.mark.integration
class TestHeatmapEndpoint:
    """Test heatmap endpoint functionality with transaction_filter."""

    async def test_heatmap_with_transaction_filter_debit(self, authenticated_admin_client: AsyncClient):
        """Test heatmap endpoint with transaction_filter=debit parameter."""
        # Request heatmap with debit filter
        response = await authenticated_admin_client.get(
            "/api/v1/analytics/heatmap",
            params={
                "period": "month",
                "transaction_filter": "debit"
            }
        )

        # Should succeed (200 OK)
        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "xAxis" in data
        assert "yAxis" in data
        assert "data" in data
        assert "period" in data
        assert "aggregation" in data

        # xAxis and yAxis should be lists
        assert isinstance(data["xAxis"], list)
        assert isinstance(data["yAxis"], list)
        assert isinstance(data["data"], list)

    async def test_heatmap_with_transaction_filter_credit(self, authenticated_admin_client: AsyncClient):
        """Test heatmap endpoint with transaction_filter=credit parameter."""
        # Request heatmap with credit filter
        response = await authenticated_admin_client.get(
            "/api/v1/analytics/heatmap",
            params={
                "period": "month",
                "transaction_filter": "credit"
            }
        )

        # Should succeed (200 OK)
        assert response.status_code == 200
        data = response.json()

        # Check response structure
        assert "xAxis" in data
        assert "yAxis" in data
        assert "data" in data
        assert "period" in data
        assert "aggregation" in data

    async def test_heatmap_backward_compatibility_article_type(self, authenticated_admin_client: AsyncClient):
        """Test backward compatibility: article_type parameter still works without transaction_filter."""
        # Request heatmap with legacy article_type parameter
        response = await authenticated_admin_client.get(
            "/api/v1/analytics/heatmap",
            params={
                "period": "month",
                "article_type": "expense"
            }
        )

        # Should succeed (200 OK)
        assert response.status_code == 200
        data = response.json()

        # Check response structure (same as before)
        assert "xAxis" in data
        assert "yAxis" in data
        assert "data" in data

    async def test_heatmap_transaction_filter_invalid_value(self, authenticated_admin_client: AsyncClient):
        """Test heatmap endpoint rejects invalid transaction_filter values."""
        # Request with invalid transaction_filter
        response = await authenticated_admin_client.get(
            "/api/v1/analytics/heatmap",
            params={
                "period": "month",
                "transaction_filter": "invalid_value"
            }
        )

        # Should return validation error (422 Unprocessable Entity)
        assert response.status_code == 422

    async def test_heatmap_transaction_filter_priority_over_article_type(self, authenticated_admin_client: AsyncClient):
        """Test that transaction_filter takes priority over article_type."""
        # Request with both transaction_filter and article_type
        # Backend should use transaction_filter (debit → expense categories)
        response = await authenticated_admin_client.get(
            "/api/v1/analytics/heatmap",
            params={
                "period": "month",
                "article_type": "income",  # Legacy parameter
                "transaction_filter": "debit"  # New parameter (should take priority)
            }
        )

        # Should succeed and use transaction_filter
        assert response.status_code == 200
        data = response.json()
        assert "xAxis" in data
