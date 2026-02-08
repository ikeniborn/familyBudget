"""
Unit tests for recurring_plans endpoint date validation.

Tests verify that the list_recurring_plans endpoint correctly validates:
- Date format (YYYY-MM-DD)
- Date logic (from_date <= to_date)
- Accepts valid past dates (historical queries)
"""

import pytest
from httpx import AsyncClient


class TestRecurringPlansDateValidation:
    """Test date validation for list_recurring_plans endpoint."""

    @pytest.mark.asyncio
    async def test_list_recurring_plans_invalid_from_date_format(
        self,
        auth_client: AsyncClient
    ):
        """Invalid from_date format returns 422."""
        response = await auth_client.get(
            "/api/v1/recurring-plans?from_date=invalid-date&limit=10",
            follow_redirects=True
        )
        assert response.status_code == 422
        error_detail = response.json()["detail"]
        # Pydantic pattern validation error message format
        assert "from_date" in str(error_detail).lower()

    @pytest.mark.asyncio
    async def test_list_recurring_plans_invalid_to_date_format(
        self,
        auth_client: AsyncClient
    ):
        """Invalid to_date format returns 422."""
        response = await auth_client.get(
            "/api/v1/recurring-plans?to_date=2025/11/09&limit=10",  # Wrong separator
            follow_redirects=True
        )
        assert response.status_code == 422
        error_detail = response.json()["detail"]
        assert "to_date" in str(error_detail).lower()

    @pytest.mark.asyncio
    async def test_list_recurring_plans_from_date_after_to_date(
        self,
        auth_client: AsyncClient
    ):
        """from_date > to_date returns 422."""
        response = await auth_client.get(
            "/api/v1/recurring-plans?from_date=2026-05-08&to_date=2025-11-09&limit=10",
            follow_redirects=True
        )
        assert response.status_code == 422
        error_detail = response.json()["detail"]
        assert "from_date" in str(error_detail).lower()
        assert "to_date" in str(error_detail).lower()

    @pytest.mark.asyncio
    async def test_list_recurring_plans_valid_past_dates(
        self,
        auth_client: AsyncClient
    ):
        """Valid past dates (90 days ago) return 200."""
        # Simulate frontend date calculation (today - 90 days, today + 90 days)
        response = await auth_client.get(
            "/api/v1/recurring-plans?from_date=2025-11-09&to_date=2026-05-08&limit=10",
            follow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        assert isinstance(data["items"], list)
        assert isinstance(data["total"], int)

    @pytest.mark.asyncio
    async def test_list_recurring_plans_only_from_date(
        self,
        auth_client: AsyncClient
    ):
        """Providing only from_date is valid."""
        response = await auth_client.get(
            "/api/v1/recurring-plans?from_date=2025-01-01&limit=10",
            follow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    @pytest.mark.asyncio
    async def test_list_recurring_plans_only_to_date(
        self,
        auth_client: AsyncClient
    ):
        """Providing only to_date is valid."""
        response = await auth_client.get(
            "/api/v1/recurring-plans?to_date=2026-12-31&limit=10",
            follow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data

    @pytest.mark.asyncio
    async def test_list_recurring_plans_no_date_filters(
        self,
        auth_client: AsyncClient
    ):
        """No date filters returns all plans (200)."""
        response = await auth_client.get(
            "/api/v1/recurring-plans?limit=10",
            follow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
