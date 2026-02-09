"""
Unit tests for recurring_plans endpoint date validation.

Tests verify that the list_recurring_plans endpoint correctly validates:
- Date format (YYYY-MM-DD)
- Date logic (from_date <= to_date)
- Accepts valid past dates (historical queries)

Added as part of fix for HTTP 422 error in recurring-plans sync.
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

    @pytest.mark.asyncio
    async def test_list_recurring_plans_limit_1000(
        self,
        auth_client: AsyncClient
    ):
        """Test that limit=1000 is accepted (v11.4.12+)."""
        response = await auth_client.get(
            "/api/v1/recurring-plans?limit=1000",
            follow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()
        assert "items" in data
        assert "total" in data
        # Verify limit parameter accepted without 422 error

    @pytest.mark.asyncio
    async def test_list_recurring_plans_null_generation_date(
        self,
        auth_client: AsyncClient,
        session,
        test_user,
        test_article_root
    ):
        """Test that plans with NULL next_generation_date are included in date range."""
        from datetime import date

        from backend.app.models.financial_center import FinancialCenter
        from backend.app.models.recurring_plan import RecurringPlan

        # Create test financial center
        financial_center = FinancialCenter(
            user_id=test_user.id,
            name="Test Cash",
            type="cash"
        )
        session.add(financial_center)
        await session.commit()
        await session.refresh(financial_center)

        # Create plan with NULL next_generation_date (inactive/completed)
        plan = RecurringPlan(
            user_id=test_user.id,
            article_id=test_article_root.id,
            financial_center_id=financial_center.id,
            amount=100.00,
            frequency_type="monthly",
            frequency_value=15,
            start_date=date(2025, 1, 1),
            record_type="plan",
            next_generation_date=None,  # NULL value
            is_active=False
        )
        session.add(plan)
        await session.commit()
        await session.refresh(plan)

        # Query with date range
        response = await auth_client.get(
            "/api/v1/recurring-plans?from_date=2025-01-01&to_date=2026-12-31",
            follow_redirects=True
        )
        assert response.status_code == 200
        data = response.json()

        # Verify NULL plan is included
        assert len(data["items"]) >= 1
        null_plan = next((p for p in data["items"] if p["id"] == plan.id), None)
        assert null_plan is not None
        assert null_plan["next_generation_date"] is None
